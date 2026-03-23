// src/features/auth/auth.controller.js
import { authService } from './auth.service.js';
import { User } from './auth.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from './audit.model.js'; // NEW: Import audit model
import { logger } from '../../utils/logger.util.js';
import { sendLoginNotification, sendSecurityAlert } from '../../utils/notification.util.js';

// Cookie configuration constants
const isProduction = process.env.NODE_ENV === 'production';

// ✅ IMPORTANT: For cross-domain frontend (wondertravelers.com) and backend (shirijanga.com):
// - Use 'Lax' to allow cookies on safe cross-origin requests (GET, navigation)
// - Use 'None' requires Secure flag and HTTPS (for unrestricted cross-origin access)
// - Frontend must send: fetch(..., { credentials: 'include' })
// - Use secure: true when frontend is HTTPS (regardless of NODE_ENV)
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // ✅ ALWAYS true for cross-domain HTTPS frontend/backend
  sameSite: 'Lax', // Allows cookies on cross-origin POST with credentials (not 'strict')
  path: '/', // ✅ FIXED: Changed from '/api' so cookies are sent to all routes
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const ACCESS_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: true, // ✅ ALWAYS true for cross-domain HTTPS frontend/backend
  sameSite: 'Lax', // Allows cookies on cross-origin requests
  path: '/', // ✅ FIXED: Changed from '/api' so cookies are sent to all routes
  maxAge: 15 * 60 * 1000,
};

const FINGERPRINT_OPTIONS = {
  httpOnly: false,
  secure: true, // ✅ ALWAYS true for cross-domain HTTPS frontend/backend
  sameSite: 'Lax', // Allows cookies on cross-origin requests
  path: '/', // ✅ FIXED: Changed from '/api' so cookies are sent to all routes
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Helper function to log security audit events
const logSecurityAudit = async (event) => {
  try {
    const audit = new SecurityAudit({
      ...event,
      timestamp: new Date()
    });
    await audit.save();
    
    // Also log to console for immediate visibility
    const logLevel = event.severity === 'high' ? 'error' : 
                     event.severity === 'medium' ? 'warn' : 'info';
    logger[logLevel](`Security Audit: ${event.action}`, event);
  } catch (error) {
    logger.error('Failed to log security audit', { error: error.message });
  }
};

// Helper to create user metadata for audit logs
const createUserMetadata = (user) => {
  if (!user) return null;
  
  return {
    userId: user._id?.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    active: user.active
  };
};

export const authController = {
  // ---------------- Register ----------------
  async register(req, res, next) {
    try {
      logger.info('Register endpoint called', { 
        username: req.body.username,
        email: req.body.email 
      });

      const user = await authService.register(req.body);

      // Generate tokens
      const { accessToken, refreshToken } = authService.generateTokens(
        user._id,
        user.role,
        user.sessionVersion,
        user.refreshTokenVersion || 0
      );

      // Store refresh token
      await user.setRefreshToken(refreshToken);

      // Update last login on registration
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      // Set tokens in HttpOnly cookies
      res.cookie('access_token', accessToken, ACCESS_TOKEN_OPTIONS);
      res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

      // Add fingerprint for CSRF protection
      const fingerprint = authService.generateFingerprint(req);
      res.cookie('fingerprint', fingerprint, FINGERPRINT_OPTIONS);

      // Log successful registration
      await logSecurityAudit({
        userId: user._id,
        action: 'registration',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.LOW,
        details: `New user registered: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('User registered & logged in automatically', {
        userId: user._id,
        email: user.email
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: user.toJSON(),
      });
    } catch (err) {
      logger.error('Error in register', { 
        error: err.message, 
        stack: err.stack,
        email: req.body.email 
      });
      
      // Log failed registration attempt
      await logSecurityAudit({
        userId: null,
        action: 'registration_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Registration failed for ${req.body.email}: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          attemptedEmail: req.body.email,
          attemptedUsername: req.body.username,
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Login ----------------
  async login(req, res, next) {
    try {
      logger.info('Login endpoint called', { email: req.body.email });

      const { email, password } = req.body;
      const { user, accessToken, refreshToken } = await authService.login(email, password, { ip: req.ip, userAgent: req.headers['user-agent'] });

      // Set tokens in HttpOnly cookies
      res.cookie('access_token', accessToken, ACCESS_TOKEN_OPTIONS);
      res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

      // Add fingerprint for CSRF protection
      const fingerprint = authService.generateFingerprint(req);
      res.cookie('fingerprint', fingerprint, FINGERPRINT_OPTIONS);

      // Log successful login
      await logSecurityAudit({
        userId: user._id,
        action: 'login_success',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.LOW,
        details: `Successful login for ${user.email} from IP: ${req.ip}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('User logged in successfully', { 
        userId: user._id, 
        email: user.email 
      });

      // Send simple login notification (console placeholder)
      try {
        await sendLoginNotification(user._id, { ip: req.ip, userAgent: req.headers['user-agent'] });
      } catch (notifErr) {
        logger.warn('Failed to send login notification', { error: notifErr.message });
      }

      const userResponse = user.toJSON ? user.toJSON() : user;

      res.json({
        success: true,
        user: userResponse,
      });
    } catch (err) {
      logger.error('Error in login', { 
        error: err.message, 
        stack: err.stack,
        email: req.body.email 
      });
      
      // Log failed login attempt
      await logSecurityAudit({
        userId: null,
        action: 'login_failed',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed login attempt for ${req.body.email}: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          attemptedEmail: req.body.email,
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Refresh Token ----------------
  async refresh(req, res, next) {
    try {
      logger.info('Refresh token endpoint called');

      // Get refresh token from cookie
      const refreshToken = req.cookies.refresh_token;
      
      if (!refreshToken) {
        logger.warn('Refresh token missing in cookies');
        
        await logSecurityAudit({
          userId: null,
          action: 'token_refresh_failed',
          category: ACTION_CATEGORIES.AUTHENTICATION,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: 'No refresh token provided',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false
        });
        
        return res.status(401).json({ 
          success: false, 
          message: 'Refresh token required' 
        });
      }

      const tokens = await authService.refreshToken(refreshToken);
      logger.info('Refresh token successful', { 
        hasNewTokens: !!tokens 
      });

      // Set new tokens in cookies
      res.cookie('access_token', tokens.accessToken, ACCESS_TOKEN_OPTIONS);
      res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTIONS);

      // Update fingerprint
      const fingerprint = authService.generateFingerprint(req);
      res.cookie('fingerprint', fingerprint, FINGERPRINT_OPTIONS);

      // Log token refresh
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'token_refresh',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Access token refreshed successfully',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          userId: req.user?._id?.toString()
        }
      });

      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        expiresIn: 15 * 60 * 1000,
      });
    } catch (err) {
      logger.error('Error in refresh token', { 
        error: err.message, 
        stack: err.stack 
      });
      
      // Log failed refresh
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'token_refresh_failed',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Token refresh failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: { 
          error: err.message,
          userId: req.user?._id?.toString()
        }
      });
      
      // Clear all auth cookies on failure
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      res.clearCookie('fingerprint');
      
      next(err);
    }
  },

  // ---------------- Logout ----------------
  async logout(req, res, next) {
    try {
      logger.info('Logout endpoint called', { userId: req.user?._id });

      await authService.logout(req.user._id);

      // Clear all auth cookies (path must match how they were set)
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      res.clearCookie('fingerprint', { path: '/' });

      // Log logout event
      await logSecurityAudit({
        userId: req.user._id,
        action: 'logout',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.LOW,
        details: 'User logged out successfully',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(req.user)
      });

      logger.info('User logged out successfully', { userId: req.user._id });

      res.json({ 
        success: true, 
        message: 'Logged out successfully' 
      });
    } catch (err) {
      logger.error('Error in logout', { 
        error: err.message, 
        stack: err.stack 
      });
      
      // Log logout failure
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'logout_failed',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Logout failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Get Current User ----------------
  async getMe(req, res, next) {
    try {
      logger.info('Get current user endpoint called', { userId: req.user?._id });

      // Convert to safe object
      let userData = req.user;
      
      if (userData && typeof userData.toObject === 'function') {
        userData = userData.toObject();
      }
      
      // Remove sensitive fields
      if (userData) {
        delete userData.password;
        delete userData.refreshToken;
        delete userData.refreshTokenExpires;
        delete userData.refreshTokenVersion;
        delete userData.sessionVersion;
        delete userData.passwordHistory;
        delete userData.passwordResetToken;
        delete userData.passwordResetExpires;
        delete userData.loginAttempts;
        delete userData.lastFailedLogin;
        delete userData.lastLogoutAt;
        delete userData.__v;
      }

      // Log profile access (sampled to avoid spam)
      if (Math.random() < 0.01) {
        await logSecurityAudit({
          userId: req.user._id,
          action: 'profile_accessed',
          category: ACTION_CATEGORIES.USER_MANAGEMENT,
          severity: SEVERITY_LEVELS.LOW,
          details: 'User profile accessed',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            userId: req.user._id?.toString()
          }
        });
      }

      res.json({
        success: true,
        user: userData,
      });
    } catch (err) {
      logger.error('Error in getMe', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'profile_access_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Profile access failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // Check authentication status (optional auth endpoint)
  async checkAuth(req, res) {
    try {
      if (!req.user) {
        return res.json({
          success: true,
          authenticated: false,
          user: null,
        });
      }

      // Convert to safe object
      let userData = req.user;
      if (userData && typeof userData.toObject === 'function') {
        userData = userData.toObject();
      }

      // Remove sensitive fields
      if (userData) {
        delete userData.password;
        delete userData.refreshToken;
        delete userData.refreshTokenExpires;
        delete userData.refreshTokenVersion;
        delete userData.sessionVersion;
        delete userData.passwordHistory;
        delete userData.passwordResetToken;
        delete userData.passwordResetExpires;
        delete userData.loginAttempts;
        delete userData.lastFailedLogin;
        delete userData.lastLogoutAt;
        delete userData.__v;
      }

      res.json({
        success: true,
        authenticated: true,
        user: userData,
      });
    } catch (err) {
      logger.error('Error in checkAuth', { error: err.message });
      res.json({
        success: false,
        authenticated: false,
        user: null,
      });
    }
  },

  // ---------------- Change Password ----------------
  async changePassword(req, res, next) {
    try {
      logger.info('Change password endpoint called', { userId: req.user._id });

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        // Log failed password change attempt
        await logSecurityAudit({
          userId: user._id,
          action: 'password_change_failed',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: 'Incorrect current password provided for password change',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: createUserMetadata(user)
        });
        
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      if (await user.comparePassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'New password cannot be the same as current password'
        });
      }

      if (await user.isPasswordReused(newPassword)) {
        // Log password reuse attempt
        await logSecurityAudit({
          userId: user._id,
          action: 'password_reuse_attempt',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: 'Attempt to reuse old password blocked',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: createUserMetadata(user)
        });
        
        return res.status(400).json({
          success: false,
          message: 'Cannot reuse any of your last 5 passwords'
        });
      }

      user.password = newPassword;
      await user.save();
      
      // Invalidate all sessions when password changes
      await user.invalidateAllSessions();

      // Clear all auth cookies - user needs to login again
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });

      // Log successful password change
      await logSecurityAudit({
        userId: user._id,
        action: 'password_change',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: 'Password changed successfully, all sessions invalidated',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('Password changed successfully', { userId: user._id });

      // Send security alert/notification about password change
      try {
        await sendSecurityAlert(user._id, { event: 'password_changed', ip: req.ip, userAgent: req.headers['user-agent'] }, 'high');
      } catch (notifErr) {
        logger.warn('Failed to send security alert for password change', { error: notifErr.message });
      }

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (err) {
      logger.error('Error in changePassword', { 
        error: err.message, 
        stack: err.stack 
      });
      
      // Log password change error
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'password_change_error',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Password change failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Update Profile ----------------
  async updateProfile(req, res, next) {
    try {
      logger.info('Update profile endpoint called', { userId: req.user._id });

      const updates = req.body;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      );

      // Log profile update
      await logSecurityAudit({
        userId: user._id,
        action: 'profile_update',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.LOW,
        details: `Profile updated: ${Object.keys(updates).join(', ')}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          ...createUserMetadata(user),
          updatedFields: Object.keys(updates)
        }
      });

      logger.info('Profile updated successfully', { userId: user._id });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: user.toJSON(),
      });
    } catch (err) {
      logger.error('Error in updateProfile', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'profile_update_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Profile update failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message,
          attemptedUpdates: req.body
        }
      });
      
      next(err);
    }
  },

  // ---------------- Update Avatar (URL) ----------------
  async updateAvatar(req, res, next) {
    try {
      logger.info('Update avatar endpoint called', { userId: req.user._id });

      const { avatar } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatar || null },
        { new: true, runValidators: true }
      );

      // Log avatar update via URL
      await logSecurityAudit({
        userId: user._id,
        action: 'avatar_updated',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Avatar updated via URL',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('Avatar updated via URL', { userId: user._id });

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        user: user.toJSON(),
      });
    } catch (err) {
      logger.error('Error in updateAvatar', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'avatar_update_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Avatar update failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Upload Avatar (File Upload) ----------------
  async uploadAvatar(req, res, next) {
    try {
      logger.info('Upload avatar endpoint called', { userId: req.user._id });

      if (!req.processedAvatar) {
        return res.status(400).json({
          success: false,
          message: 'No avatar file uploaded or processing failed'
        });
      }

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { 
          avatar: req.processedAvatar.url // store thumbnail URL
        },
        { new: true }
      );

      // Log avatar upload
      await logSecurityAudit({
        userId: user._id,
        action: 'avatar_uploaded',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Avatar uploaded successfully via file upload',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          ...createUserMetadata(user),
          avatarInfo: {
            url: req.processedAvatar.url,
            size: req.processedAvatar.size,
            format: req.processedAvatar.format
          }
        }
      });

      logger.info('Avatar uploaded successfully', { 
        userId: user._id,
        avatarUrl: user.avatar 
      });

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        user: user.toJSON(),
        avatar: req.processedAvatar
      });
    } catch (err) {
      logger.error('Error in uploadAvatar', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'avatar_upload_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Avatar upload failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Delete Avatar ----------------
  async deleteAvatar(req, res, next) {
    try {
      logger.info('Delete avatar endpoint called', { userId: req.user._id });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: null },
        { new: true }
      );

      // Log avatar deletion
      await logSecurityAudit({
        userId: user._id,
        action: 'avatar_deleted',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Avatar deleted successfully',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('Avatar deleted successfully', { userId: user._id });

      res.json({
        success: true,
        message: 'Avatar deleted successfully',
        user: user.toJSON(),
      });
    } catch (err) {
      logger.error('Error in deleteAvatar', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'avatar_deletion_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Avatar deletion failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Delete Current User ----------------
  async deleteMe(req, res, next) {
    try {
      logger.info('Delete me endpoint called', { userId: req.user._id });

      const { password } = req.body;
      
      // Verify password
      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        // Log failed delete attempt
        await logSecurityAudit({
          userId: user._id,
          action: 'account_deletion_failed',
          category: ACTION_CATEGORIES.USER_MANAGEMENT,
          severity: SEVERITY_LEVELS.HIGH,
          details: 'Incorrect password provided for account deletion',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: createUserMetadata(user)
        });
        
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }

      // Soft delete with truncated username to avoid length issues
      const timestamp = Date.now();
      const oldEmail = user.email;
      const oldUsername = user.username;
      
      user.active = false;
      user.email = `deleted_${timestamp}_${user.email}`.slice(0, 255);
      user.username = `deleted_${timestamp}`.slice(0, 30);
      await user.save();

      // Clear all auth cookies
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });

      // Log account deactivation
      await logSecurityAudit({
        userId: user._id,
        action: 'account_deactivated',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.HIGH,
        details: 'User account deactivated (soft delete)',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          userId: user._id.toString(),
          oldEmail,
          oldUsername,
          newEmail: user.email,
          newUsername: user.username
        }
      });

      logger.info('User account deactivated', { userId: user._id });

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (err) {
      logger.error('Error in deleteMe', { 
        error: err.message, 
        stack: err.stack 
      });
      
      // Log deletion error
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'account_deletion_error',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.CRITICAL,
        details: `Account deletion failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Delete User (Admin Only) ----------------
  async deleteUser(req, res, next) {
    try {
      logger.info('Delete user endpoint called', { 
        adminId: req.user._id,
        targetUserId: req.params.id 
      });

      const { id } = req.params;
      
      // Prevent admin from deleting themselves via this endpoint
      if (id === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Use /me endpoint to delete your own account'
        });
      }

      const user = await User.findByIdAndDelete(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Log admin deletion of user
      await logSecurityAudit({
        userId: req.user._id, // Admin who performed the action
        action: 'user_deleted',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Admin deleted user: ${user.username} (${user.email})`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminId: req.user._id.toString(),
          adminUsername: req.user.username,
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          targetEmail: user.email
        }
      });

      logger.info('User deleted successfully', { 
        adminId: req.user._id,
        deletedUserId: user._id,
        username: user.username 
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (err) {
      logger.error('Error in deleteUser', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'user_deletion_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.CRITICAL,
        details: `User deletion failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          adminId: req.user?._id?.toString(),
          targetUserId: req.params.id,
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Verify Device (Zero-Trust) ----------------
  async verifyDevice(req, res, next) {
    try {
      logger.info('Verify device endpoint called', { userId: req.user._id });

      const { deviceFingerprint, deviceName } = req.body;
      
      if (!deviceFingerprint) {
        return res.status(400).json({
          success: false,
          message: 'Device fingerprint required'
        });
      }

      const user = await User.findById(req.user._id);
      
      await user.addTrustedDevice(deviceFingerprint, {
        name: deviceName || 'Verified Device',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Log device verification
      await logSecurityAudit({
        userId: user._id,
        action: 'device_verified',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Device verified: ${deviceName || 'Unknown Device'}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          ...createUserMetadata(user),
          deviceFingerprint: deviceFingerprint.slice(0, 16) + '...',
          deviceName: deviceName || 'Verified Device'
        }
      });

      logger.info('Device verified and added to trusted devices', {
        userId: user._id,
        deviceFingerprint
      });

      res.json({
        success: true,
        message: 'Device verified successfully and added to trusted devices'
      });
    } catch (err) {
      logger.error('Error in verifyDevice', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'device_verification_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Device verification failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Get Trusted Devices ----------------
  async getTrustedDevices(req, res, next) {
    try {
      logger.info('Get trusted devices endpoint called', { userId: req.user._id });

      const user = await User.findById(req.user._id);
      
      // Log trusted devices access
      await logSecurityAudit({
        userId: user._id,
        action: 'trusted_devices_accessed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Trusted devices list accessed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          ...createUserMetadata(user),
          deviceCount: user.trustedDevices?.length || 0
        }
      });

      res.json({
        success: true,
        devices: user.trustedDevices.map(device => ({
          name: device.name,
          lastUsed: device.lastUsed,
          addedAt: device.addedAt,
          userAgent: device.userAgent,
          ip: device.ip,
        }))
      });
    } catch (err) {
      logger.error('Error in getTrustedDevices', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'trusted_devices_access_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Trusted devices access failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Remove Trusted Device ----------------
  async removeTrustedDevice(req, res, next) {
    try {
      logger.info('Remove trusted device endpoint called', {
        userId: req.user._id,
        deviceFingerprint: req.params.fingerprint
      });

      const { fingerprint } = req.params;
      const user = await User.findById(req.user._id);

      user.trustedDevices = user.trustedDevices.filter(
        device => device.fingerprint !== fingerprint
      );

      await user.save();

      // Log device removal
      await logSecurityAudit({
        userId: user._id,
        action: 'device_removed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: 'Trusted device removed',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          ...createUserMetadata(user),
          deviceFingerprint: fingerprint.slice(0, 16) + '...'
        }
      });

      logger.info('Trusted device removed successfully', {
        userId: user._id,
        deviceFingerprint: fingerprint
      });

      res.json({
        success: true,
        message: 'Device removed from trusted devices'
      });
    } catch (err) {
      logger.error('Error in removeTrustedDevice', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'device_removal_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Device removal failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          deviceFingerprint: req.params.fingerprint,
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Request Password Reset ----------------
  async requestPasswordReset(req, res, next) {
    try {
      logger.info('Request password reset endpoint called', { 
        email: req.body.email 
      });

      const { email } = req.body;
      
      // Use service method (returns { userId, resetToken } or null)
      const result = await authService.generatePasswordResetToken(email);
      
      if (!result) {
        // User not found or inactive - don't reveal this info
        logger.info('Password reset requested for non-existent or inactive account', { 
          email 
        });
        
        // Still log the attempt (but with success: true to not reveal)
        await logSecurityAudit({
          userId: null,
          action: 'password_reset_request',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.LOW,
          details: 'Password reset requested (account not found or inactive)',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true, // Success to not reveal account existence
          metadata: {
            requestedEmail: email
          }
        });
        
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent'
        });
      }

      // In development, show the token for testing
      if (process.env.NODE_ENV === 'development') {
        return res.json({
          success: true,
          message: 'Password reset link sent (in dev mode showing token)',
          resetToken: result.resetToken
        });
      }

      // TODO: In production, send email with the resetToken
      // await sendPasswordResetEmail(email, result.resetToken);
      
      // Log password reset request
      await logSecurityAudit({
        userId: result.userId,
        action: 'password_reset_request',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: 'Password reset requested',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          userId: result.userId.toString(),
          email: email
        }
      });

      logger.info('Password reset token generated', { 
        userId: result.userId 
      });

      res.json({
        success: true,
        message: 'Password reset link sent to your email'
      });
    } catch (err) {
      logger.error('Error in requestPasswordReset', { 
        error: err.message, 
        stack: err.stack 
      });
      
      await logSecurityAudit({
        userId: null,
        action: 'password_reset_request_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Password reset request failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          requestedEmail: req.body.email,
          error: err.message
        }
      });
      
      next(err);
    }
  },

  // ---------------- Reset Password ----------------
  async resetPassword(req, res, next) {
    try {
      logger.info('Reset password endpoint called', { 
        hasToken: !!req.body.token 
      });

      const { token, newPassword } = req.body;

      // Use service method (expects plain token, NOT hashed)
      const user = await authService.resetPassword(token, newPassword);

      // Clear all auth cookies since password has changed
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });

      // Log successful password reset
      await logSecurityAudit({
        userId: user._id,
        action: 'password_reset_success',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: 'Password reset successfully via reset token',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: createUserMetadata(user)
      });

      logger.info('Password reset successful', { userId: user._id });

      res.json({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.'
      });
    } catch (err) {
      logger.error('Password reset failed', {
        error: err.message,
        stack: err.stack?.slice(0, 300)
      });

      // Log failed password reset
      await logSecurityAudit({
        userId: null,
        action: 'password_reset_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Password reset failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          error: err.message
        }
      });

      // User-friendly messages
      if (err.message.includes('Invalid or expired reset token')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      if (err.message.includes('Cannot reuse')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reuse any of your last 5 passwords'
        });
      }

      // Fallback for unexpected errors
      res.status(500).json({
        success: false,
        message: 'Failed to reset password. Please try again.'
      });
    }
  },

  // ---------------- Clear Auth Cookies (Helper endpoint for frontend) ----------------
  async clearCookies(req, res, next) {
    try {
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });

      // Log cookie clearance
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'auth_cookies_cleared',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Authentication cookies cleared',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          userId: req.user?._id?.toString()
        }
      });

      res.json({
        success: true,
        message: 'Auth cookies cleared'
      });
    } catch (err) {
      logger.error('Error clearing cookies', {
        error: err.message,
        stack: err.stack
      });
      
      await logSecurityAudit({
        userId: req.user?._id || null,
        action: 'cookie_clearance_failed',
        category: ACTION_CATEGORIES.AUTHENTICATION,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Cookie clearance failed: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userId: req.user?._id?.toString(),
          error: err.message
        }
      });
      
      next(err);
    }
  }
};