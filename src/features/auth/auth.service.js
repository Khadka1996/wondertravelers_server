// src/features/auth/auth.service.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from './auth.model.js';
import { logger } from '../../utils/logger.util.js';
import redisClient from '../../utils/redis.util.js';
import { checkBruteForce } from './auth.enhanced.js';

// ========================
// Environment Validation
// ========================
const JWT_ACCESS_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

const parseExpiryToMs = (value, fallback = '30d') => {
  if (typeof value !== 'string' || !value.trim()) {
    value = fallback;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*([smhdwmy])$/);

  if (!match) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.d);
};

export { parseExpiryToMs };

// Validate at module load
(() => {
  if (!JWT_ACCESS_SECRET || JWT_ACCESS_SECRET === 'your-access-secret-change-me') {
    throw new Error('JWT_SECRET environment variable is not set or is using default value');
  }
  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'your-refresh-secret-change-me') {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set or is using default value');
  }
  if (JWT_ACCESS_SECRET === JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }
  if (JWT_ACCESS_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
})();

// SECURITY: Check brute force with proper error handling
const safeCheckBruteForce = async (userId) => {
  try {
    if (!userId) return false;
    return await checkBruteForce(userId);
  } catch (err) {
    // Fail open: allow login but log error (don't break login flow)
    logger.warn('Brute force check failed, allowing login attempt', { 
      error: err.message,
      userId 
    });
    return false;
  }
};

// Helper to convert user document to safe response object
const userToResponse = (user) => {
  if (!user) return null;
  
  // If already a plain object, return as is
  if (typeof user.toObject !== 'function') {
    return user;
  }
  
  // Convert Mongoose document to plain object and remove sensitive fields
  const userObj = user.toObject();
  
  // Remove sensitive fields
  delete userObj.password;
  delete userObj.refreshToken;
  delete userObj.refreshTokenExpires;
  delete userObj.refreshTokenVersion;
  delete userObj.sessionVersion;
  delete userObj.passwordHistory;
  delete userObj.passwordResetToken;
  delete userObj.passwordResetExpires;
  delete userObj.loginAttempts;
  delete userObj.lastFailedLogin;
  delete userObj.lastLogoutAt;
  delete userObj.__v;
  
  return userObj;
};

export const authService = {
  /**
   * Register a new user
   */
  async register({ username, email, password, fullName }) {
    // Check for existing user
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    }).lean();
    
    if (existingUser) {
      throw new Error(
        existingUser.email === email ? 'Email already in use' : 'Username already taken'
      );
    }

    // Create and save user
    const user = new User({
      username,
      email,
      password,
      fullName,
    });

    await user.save();
    return user; // Return Mongoose document
  },

  /**
   * Login user with token generation
   */
  async login(email, password, { ip = '0.0.0.0', userAgent = 'unknown' } = {}) {
    // Ensure Redis client is available (optional)
    try {
      await redisClient.connect();
    } catch (err) {
      logger.debug('Redis connect skipped or failed during login', { error: err?.message });
    }

    const redisCli = redisClient.getClient();

    // Check IP-based blocking before attempting credential verification
    const ipKey = `bf:ip:${ip}`;
    try {
      if (redisCli) {
        const current = await redisCli.get(ipKey);
        if (current && Number(current) >= (Number(process.env.IP_BLOCK_THRESHOLD) || 10)) {
          throw new Error('Too many failed attempts from this IP. Try again later.');
        }
      }
    } catch (err) {
      logger.warn('IP block check failed', { error: err.message });
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password +sessionVersion');
    if (!user || !user.active) {
      // If user not found, increment IP failure counter
      try {
        if (redisCli) {
          const val = await redisCli.incr(ipKey);
          if (val === 1) await redisCli.expire(ipKey, 60 * 60);
        }
      } catch (err) {
        logger.warn('Failed to increment IP failure counter', { error: err.message });
      }
      throw new Error('Invalid credentials or account inactive');
    }

    // Check user-based brute force
    try {
      const locked = await checkBruteForce(user._id, Number(process.env.USER_BF_THRESHOLD) || 5);
      if (locked) {
        throw new Error('Too many failed attempts for this account. Try again later.');
      }
    } catch (err) {
      // If checkBruteForce throws, treat as lock
      if (err.message && err.message.includes('Too many failed')) throw err;
      logger.debug('Brute force check failed unexpectedly', { error: err.message });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Record failed attempt to user document
      try {
        await user.recordLoginAttempt(ip, false);
      } catch (err) {
        logger.warn('Failed to record login attempt on user', { error: err.message });
      }

      // Increment IP failure counter
      try {
        if (redisCli) {
          const val = await redisCli.incr(ipKey);
          if (val === 1) await redisCli.expire(ipKey, 60 * 60);
        }
      } catch (err) {
        logger.warn('Failed to increment IP failure counter', { error: err.message });
      }

      throw new Error('Invalid credentials');
    }

    // On success: clear IP failure counter
    try {
      if (redisCli) {
        await redisCli.del(ipKey);
      }
    } catch (err) {
      logger.warn('Failed to clear IP failure counter', { error: err.message });
    }

    // Record successful login
    try {
      await user.recordLoginAttempt(ip, true);
    } catch (err) {
      logger.warn('Failed to record successful login attempt', { error: err.message });
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user._id, user.role, user.sessionVersion);
    const refreshToken = this.generateRefreshToken(user._id, user.refreshTokenVersion || 0);

    // Store refresh token with expiry
    await user.setRefreshToken(refreshToken);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Return safe user object with tokens
    return { 
      user: userToResponse(user), 
      accessToken, 
      refreshToken 
    };
  },

  /**
   * Generate both access and refresh tokens together
   */
  generateTokens(userId, role, sessionVersion, tokenVersion) {
    const accessToken = this.generateAccessToken(userId, role, sessionVersion);
    const refreshToken = this.generateRefreshToken(userId, tokenVersion);
    
    return { accessToken, refreshToken };
  },

  /**
   * Generate access token with session version
   */
  generateAccessToken(userId, role, sessionVersion) {
    if (!userId || !role) {
      throw new Error('User ID and role are required for token generation');
    }

    return jwt.sign(
      { 
        id: userId, 
        role,
        version: sessionVersion || 0,  // Include session version
        type: 'access'
      },
      JWT_ACCESS_SECRET,
      { 
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'wondertravelers-api',
        audience: 'wondertravelers-client'
      }
    );
  },

  /**
   * Generate refresh token with token version
   */
  generateRefreshToken(userId, tokenVersion) {
    if (!userId) {
      throw new Error('User ID is required for refresh token generation');
    }

    return jwt.sign(
      { 
        id: userId,
        version: tokenVersion || 0,  // Include token version
        type: 'refresh'
      },
      JWT_REFRESH_SECRET,
      { 
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'wondertravelers-api',
        audience: 'wondertravelers-client'
      }
    );
  },

  /**
   * Generate client fingerprint for CSRF protection
   * Combines IP + User Agent + Random component
   */
  generateFingerprint(req) {
    try {
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Add a random component to make it unique per session
      const random = crypto.randomBytes(8).toString('hex');
      
      // Create a deterministic but unique fingerprint
      const fingerprint = crypto
        .createHash('sha256')
        .update(`${userAgent}:${ip}:${random}:${Date.now()}`)
        .digest('hex')
        .slice(0, 32); // 32 chars is enough
      
      logger.debug('Generated fingerprint', {
        fingerprint,
        userAgentLength: userAgent.length,
        ip,
      });
      
      return fingerprint;
    } catch (error) {
      logger.error('Failed to generate fingerprint', { error: error.message });
      // Fallback to random string if generation fails
      return crypto.randomBytes(16).toString('hex');
    }
  },

  /**
   * Verify request fingerprint for CSRF protection
   */
  verifyFingerprint(req) {
    try {
      const cookieFingerprint = req.cookies?.fingerprint;
      if (!cookieFingerprint) {
        logger.warn('No fingerprint cookie found');
        return false;
      }
      
      // In a real implementation, you might want to store and validate
      // the fingerprint against a session or database
      // For now, we'll just verify it exists and is valid format
      if (typeof cookieFingerprint !== 'string' || cookieFingerprint.length !== 32) {
        logger.warn('Invalid fingerprint format', { 
          length: cookieFingerprint?.length 
        });
        return false;
      }
      
      // You could add additional checks here, like:
      // - Compare with stored fingerprint in session
      // - Check if IP changed dramatically
      // - Verify user agent similarity
      
      return true;
    } catch (error) {
      logger.error('Fingerprint verification failed', { error: error.message });
      return false;
    }
  },

  /**
   * Refresh token with rotation (prevents token reuse)
   */
  async refreshToken(oldRefreshToken) {
    try {
      // Verify token signature
      let decoded;
      try {
        decoded = jwt.verify(oldRefreshToken, JWT_REFRESH_SECRET);
      } catch (err) {
        logger.warn('Invalid refresh token signature', { 
          error: err.message,
          name: err.name 
        });
        throw new Error('Invalid refresh token');
      }

      // Verify token type
      if (decoded.type !== 'refresh') {
        logger.warn('Wrong token type used for refresh', { type: decoded.type });
        throw new Error('Invalid refresh token');
      }

      // Find user with refresh token
      const user = await User.findById(decoded.id)
        .select('+refreshToken +refreshTokenVersion +sessionVersion +active +role');
      
      if (!user || !user.active) {
        logger.warn('User not found or inactive during refresh', { userId: decoded.id });
        throw new Error('User not found or inactive');
      }

      // Verify the old refresh token matches stored hash
      const isValid = await user.verifyRefreshToken(oldRefreshToken);
      if (!isValid) {
        // Possible token reuse - invalidate all sessions
        await user.invalidateAllSessions();
        logger.warn('Refresh token reuse detected', { 
          userId: user._id,
          tokenVersion: decoded.version 
        });
        throw new Error('Invalid refresh token - possible security issue');
      }

      // Verify token version matches
      const currentVersion = user.refreshTokenVersion || 0;
      if (decoded.version !== currentVersion) {
        logger.warn('Token version mismatch', {
          userId: user._id,
          tokenVersion: decoded.version,
          dbVersion: currentVersion
        });
        throw new Error('Token version mismatch');
      }

      // Generate new tokens
      const accessToken = this.generateAccessToken(user._id, user.role, user.sessionVersion);
      const newRefreshToken = this.generateRefreshToken(user._id, currentVersion);

      // Store new refresh token (invalidates old one via token rotation)
      await user.setRefreshToken(newRefreshToken);

      logger.info('Refresh token rotated successfully', { 
        userId: user._id,
        oldVersion: currentVersion,
        newVersion: currentVersion + 1
      });

      return { 
        accessToken, 
        refreshToken: newRefreshToken 
      };
    } catch (err) {
      logger.error('Refresh token error', { 
        error: err.message,
        stack: err.stack 
      });
      
      // Specific error messages
      if (err.message.includes('security issue')) {
        throw new Error('Security violation detected. Please login again.');
      }
      if (err.message.includes('version mismatch')) {
        throw new Error('Token invalidated. Please login again.');
      }
      if (err.message.includes('TokenExpiredError')) {
        throw new Error('Refresh token expired. Please login again.');
      }
      
      throw new Error('Invalid or expired refresh token');
    }
  },

  /**
   * Logout user (invalidate current refresh token)
   */
async logout(userId) {
  const user = await User.findById(userId);
  if (user) {
    user.refreshToken = null;
    user.refreshTokenExpires = null;
    user.lastLogoutAt = new Date();
    
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    
    await user.save();
    logger.info('User logged out and sessions invalidated', { 
      userId,
      newSessionVersion: user.sessionVersion 
    });
  }
},
  /**
   * Verify access token and return user
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      
      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Find user with minimal fields
      const user = await User.findById(decoded.id)
        .select('username email role active sessionVersion')
        .lean();
      
      if (!user || !user.active) {
        throw new Error('User not found or inactive');
      }

      // Check session version
      if (decoded.version !== user.sessionVersion) {
        throw new Error('Session invalidated');
      }

      return user;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw new Error('Authentication failed');
    }
  },

  /**
   * Revoke all sessions (for password change, security breach, etc.)
   */
  async revokeAllSessions(userId, invalidateDevices = false) {
    const user = await User.findById(userId);
    if (user) {
      await user.invalidateAllSessions(invalidateDevices);
      logger.info('All sessions revoked', { 
        userId, 
        invalidateDevices 
      });
    }
  },

  /**
   * Check if user exists and is active
   */
  async validateUser(userId) {
    const user = await User.findById(userId)
      .select('username email role active')
      .lean();
    
    return user && user.active ? user : null;
  },

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(email) {
    const user = await User.findOne({ email });
    if (!user || !user.active) {
      // Don't reveal if user exists
      logger.info('Password reset requested for non-existent or inactive user', { email });
      return null;
    }

    const resetToken = await user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    logger.info('Password reset token generated', { userId: user._id });

    return { userId: user._id, resetToken };
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    // Find users with valid reset tokens
    const users = await User.find({
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken');

    let targetUser = null;
    
    // Check each user's token (bcrypt comparison)
    for (const user of users) {
      const isValid = await user.verifyPasswordResetToken(token);
      if (isValid) {
        targetUser = user;
        break;
      }
    }

    if (!targetUser) {
      logger.warn('Invalid or expired password reset token used');
      throw new Error('Invalid or expired reset token');
    }

    // Check password reuse
    if (await targetUser.isPasswordReused(newPassword)) {
      logger.warn('Password reuse attempt detected', { userId: targetUser._id });
      throw new Error('Cannot reuse any of your last 5 passwords');
    }

    // Update password
    targetUser.password = newPassword;
    targetUser.passwordResetToken = undefined;
    targetUser.passwordResetExpires = undefined;
    
    // Invalidate all sessions
    await targetUser.invalidateAllSessions();
    await targetUser.save();

    logger.info('Password reset successful', { userId: targetUser._id });

    // Return safe user object
    return userToResponse(targetUser);
  },

  /**
   * Decode token without verification (for debugging/logging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Failed to decode token', { error: error.message });
      return null;
    }
  },

  /**
   * Validate token structure (for client-side checks)
   */
  validateTokenStructure(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Check if it looks like a JWT (three parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    
    // Check if each part is base64url encoded
    try {
      parts.forEach(part => {
        Buffer.from(part, 'base64url');
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get token expiration time (for frontend to track)
   */
  getTokenExpiry(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
};