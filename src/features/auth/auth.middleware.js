// src/features/auth/auth.middleware.js
import jwt from 'jsonwebtoken';
import { User } from './auth.model.js';
import { logger } from '../../utils/logger.util.js';
import { authService } from './auth.service.js';
import { SecurityAudit } from './audit.model.js';
import redisClient from '../../utils/redis.util.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET is missing or too weak in .env! Security risk!');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Helper function to log security audit events
const logSecurityAudit = async (event) => {
  try {
    const { ACTION_CATEGORIES, SEVERITY_LEVELS } = await import('./audit.model.js');
    const audit = new SecurityAudit({
      ...event,
      timestamp: new Date(),
      // Ensure category is always set
      category: event.category || ACTION_CATEGORIES.SYSTEM,
      // Default severity to LOW if not specified
      severity: event.severity || SEVERITY_LEVELS.LOW
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

export const authMiddleware = {
  /**
   * Protect route: validate JWT from cookies or Authorization header
   */
  async protect(req, res, next) {
    console.log('🔐 [AUTH-DEBUG] Protect middleware called at', new Date().toISOString());
    try {
      console.log('🔐 [AUTH-DEBUG] Getting token from request');
      // 1. Get token from cookie (primary) or Authorization header (fallback)
      let token = null;
      let tokenSource = 'none';
      
      // Priority 1: HttpOnly cookie (most secure)
      if (req.cookies?.access_token) {
        token = req.cookies.access_token;
        tokenSource = 'cookie';
        console.log('🔐 [AUTH-DEBUG] Found token in cookie');
        logger.debug('Using access token from cookie');
      }
      // Priority 2: Authorization header (backward compatibility)
      else if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
        tokenSource = 'header';
        logger.debug('Using access token from Authorization header');
      }
      // Priority 3: Query parameter (for special cases)
      else if (req.query.access_token && process.env.NODE_ENV !== 'production') {
        token = req.query.access_token;
        tokenSource = 'query';
        logger.warn('Using access token from query parameter');
      }

      if (!token) {
        logger.warn('Access token missing from all sources', {
          path: req.path,
          method: req.method,
          hasCookies: !!req.cookies,
          cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
          hasAuthHeader: !!req.headers.authorization,
          cookieHeader: req.headers.cookie?.substring(0, 50) // Log first 50 chars for debugging
        });
        
        // Log failed authentication attempt (fire-and-forget, don't await)
        logSecurityAudit({
          userId: null,
          action: 'authentication_failed',
          details: 'No authentication token provided',
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Authentication required – please log in',
          code: 'NO_TOKEN'
        });
      }

      // 2. Verify token signature and decode
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        // Clear invalid cookie - try all possible paths
        if (req.cookies?.access_token) {
          res.clearCookie('access_token', { path: '/api' });
          res.clearCookie('access_token', { path: '/' });
          res.clearCookie('access_token'); // Default path
        }
        
        const message = err.name === 'TokenExpiredError'
          ? 'Session expired – please log in again'
          : 'Invalid authentication token';
          
        logger.warn('Token verification failed', {
          error: err.name,
          path: req.path,
          ip: req.ip,
          userId: decoded?.id,
          message
        });
        
        // Log token verification failure (fire-and-forget, don't await)
        logSecurityAudit({
          userId: decoded?.id || null,
          action: 'token_verification_failed',
          details: `Token ${err.name}: ${err.message}`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          tokenSource
        });
        
        return res.status(401).json({ 
          success: false, 
          message,
          code: 'TOKEN_INVALID'
        });
      }

      // 3. Validate token type
      if (decoded.type !== 'access') {
        logger.warn('Wrong token type used for access', {
          expected: 'access',
          actual: decoded.type,
          userId: decoded.id
        });
        
        logSecurityAudit({
          userId: decoded.id,
          action: 'wrong_token_type',
          details: `Expected access token but got ${decoded.type}`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid token type',
        });
      }

      // 4. Fetch user with minimal fields for performance
      console.log('🔐 [AUTH-DEBUG] About to query User.findById for', decoded.id);
      const user = await User.findById(decoded.id)
        .select('_id username email role active passwordLastChanged sessionVersion lastLogin trustedDevices');
      console.log('🔐 [AUTH-DEBUG] User query completed:', !!user);

      if (!user) {
        logger.warn('User not found for valid token', { userId: decoded.id });
        
        logSecurityAudit({
          userId: decoded.id,
          action: 'user_not_found',
          details: 'User account not found in database',
          severity: 'high',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Account not found',
        });
      }

      if (!user.active) {
        logger.warn('Inactive user attempted access', { userId: user._id });
        
        logSecurityAudit({
          userId: user._id,
          action: 'inactive_account_access',
          details: 'Attempt to access deactivated account',
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Account deactivated',
        });
      }

      // 5. Check if password changed after token issuance
      // Skip this check if password was changed within 10 seconds of token issuance
      // (indicates fresh registration or immediate password reset)
      if (user.passwordLastChanged && decoded.iat) {
        const tokenIssuedAt = decoded.iat * 1000;
        const timeDiffSeconds = (user.passwordLastChanged.getTime() - tokenIssuedAt) / 1000;
        
        // Only invalidate if password changed significantly after token was issued
        // Allow 10 second grace period for registration/login flow
        if (user.passwordLastChanged.getTime() > tokenIssuedAt && timeDiffSeconds > 10) {
          logger.info('Password changed after token issuance', {
            userId: user._id,
            passwordChanged: user.passwordLastChanged,
            tokenIssued: new Date(tokenIssuedAt)
          });
          
          // Clear all auth cookies
          res.clearCookie('access_token', { path: '/api' });
          res.clearCookie('refresh_token', { path: '/api' });
          res.clearCookie('fingerprint', { path: '/api' });
          
          logSecurityAudit({
            userId: user._id,
            action: 'password_changed_after_token',
            details: 'Token invalidated due to password change',
            severity: 'low',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method
          });
          
          return res.status(401).json({
            success: false,
            message: 'Password changed – please log in again',
          });
        }
      }

      // 6. Check session version (for token rotation and forced logout)
      if (decoded.version !== user.sessionVersion) {
        logger.info('Session version mismatch', {
          userId: user._id,
          tokenVersion: decoded.version,
          dbVersion: user.sessionVersion
        });
        
        // Clear all auth cookies
        res.clearCookie('access_token', { path: '/api' });
        res.clearCookie('refresh_token', { path: '/api' });
        res.clearCookie('fingerprint', { path: '/api' });
        
        logSecurityAudit({
          userId: user._id,
          action: 'session_version_mismatch',
          details: `Token version ${decoded.version} != DB version ${user.sessionVersion}`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Session invalidated – please log in again',
        });
      }

      // 7. Optional: CSRF protection for state-changing requests
      const enforceCSRF = process.env.ENFORCE_CSRF === 'true';
      if (enforceCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const isValidFingerprint = authService.verifyFingerprint(req);
        if (!isValidFingerprint) {
          logger.warn('Possible CSRF attempt detected', {
            userId: decoded.id,
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });
          
          logSecurityAudit({
            userId: user._id,
            action: 'csrf_attempt',
            details: 'Missing or invalid CSRF fingerprint',
            severity: 'high',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method
          });
          
          return res.status(403).json({
            success: false,
            message: 'Security verification failed – please refresh the page',
          });
        }
      }

      // 8. Optional: Check if access is from a trusted device
      const deviceFingerprint = req.headers['x-device-fingerprint'];
      const requireDeviceTrust = process.env.REQUIRE_DEVICE_TRUST === 'true';
      
      if (requireDeviceTrust && deviceFingerprint) {
        const isTrusted = user.trustedDevices?.some(
          device => device.fingerprint === deviceFingerprint
        );
        
        if (!isTrusted) {
          logger.warn('Access attempt from untrusted device', {
            userId: user._id,
            deviceFingerprint: deviceFingerprint?.slice(0, 16),
            ip: req.ip,
            path: req.path
          });
          
          logSecurityAudit({
            userId: user._id,
            action: 'untrusted_device_access',
            details: `Device fingerprint: ${deviceFingerprint?.slice(0, 16)}...`,
            severity: 'medium',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method
          });
          
          // Don't block, just log for now
          // In production, you might want to require device verification
          // for sensitive operations
        }
      }

      // 9. ✅ DISABLED: Redis session management - was causing timeouts
      // TODO: Re-enable with proper Redis error handling and timeouts
      /*
      const MAX_CONCURRENT_SESSIONS = 5;
      const sessionKey = `user:${user._id}:sessions`;
      
      try {
        const redisConnectionClient = redisClient.getClient();
        if (redisConnectionClient && typeof redisConnectionClient.hlen === 'function') {
          // Redis session management code - DISABLED FOR NOW
        }
      } catch (error) {
        logger.warn('Failed to check max sessions', { error: error.message, userId: user._id });
      }
      */

      // 10. Attach user to request
      req.user = user;
      
      // Add token info for debugging/auditing
      req.tokenInfo = {
        issuedAt: decoded.iat ? new Date(decoded.iat * 1000) : null,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
        type: decoded.type,
        version: decoded.version
      };

      // 11. DISABLED: Session validation - was causing timeouts
      // Proceed with next middleware
      
      // Log successful authentication (sampled to avoid log spam)
      if (Math.random() < 0.01) {
        logger.debug('Authentication successful', {
          userId: user._id,
          email: user.email,
          role: user.role,
          path: req.path,
          method: req.method
        });
        
        logSecurityAudit({
          userId: user._id,
          action: 'authentication_success',
          details: `Role: ${user.role}, Method: ${req.method}`,
          severity: 'low',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
      }

      next();
    } catch (err) {
      logger.error('Protect middleware failed', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        ip: req.ip,
        method: req.method,
      });
      
      // Clear potentially invalid cookies
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });
      
      // Log the error
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'authentication_error',
        details: `Middleware error: ${err.message}`,
        severity: 'high',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });
      
      res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }
  },

  /**
   * Optional middleware: Only allow cookie-based authentication
   */
  async protectCookiesOnly(req, res, next) {
    try {
      const token = req.cookies?.access_token;
      
      if (!token) {
        logger.warn('Cookie-based authentication required but no cookie found', {
          path: req.path,
          ip: req.ip
        });
        
        logSecurityAudit({
          userId: null,
          action: 'cookie_auth_failed',
          details: 'Cookie-based authentication required but no cookie found',
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Cookie-based authentication required',
        });
      }

      // Use the main protect logic but skip header/query checks
      const originalHeaders = { ...req.headers };
      delete req.headers.authorization;
      delete req.query.access_token;
      
      try {
        await this.protect(req, res, () => {
          // Restore original headers after successful auth
          req.headers = originalHeaders;
          next();
        });
      } catch (error) {
        req.headers = originalHeaders;
        throw error;
      }
    } catch (err) {
      logger.error('Cookie-only protect middleware failed', {
        error: err.message,
        path: req.path,
        ip: req.ip,
      });
      
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'cookie_auth_error',
        details: `Cookie-only auth failed: ${err.message}`,
        severity: 'high',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });
      
      res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }
  },

  /**
   * Middleware to refresh access token if expired or about to expire
   */
  async protectWithAutoRefresh(req, res, next) {
    try {
      // First try to authenticate with current token
      await this.protect(req, res, (err) => {
        if (err) {
          // If token is expired, try to refresh it
          if (err.message.includes('expired')) {
            return this.handleTokenRefresh(req, res, next);
          }
          return next(err);
        }
        next();
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Helper: Handle token refresh flow
   */
  async handleTokenRefresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refresh_token;
      
      if (!refreshToken) {
        logSecurityAudit({
          userId: req.user?._id || null,
          action: 'token_refresh_failed',
          details: 'No refresh token available for auto-refresh',
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({
          success: false,
          message: 'Session expired – please log in again',
        });
      }

      const tokens = await authService.refreshToken(refreshToken);
      
      // Set new tokens in cookies
      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Allow cross-origin requests
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      
      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Allow cross-origin requests
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Update fingerprint (optional)
      const fingerprint = authService.generateFingerprint(req);
      res.cookie('fingerprint', fingerprint, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Allow cross-origin requests
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Log successful token refresh
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'auto_token_refresh',
        details: 'Access token automatically refreshed',
        severity: 'low',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });

      // Set the new access token in the request for the protect middleware
      req.cookies.access_token = tokens.accessToken;
      
      // Retry authentication with new token
      await this.protect(req, res, next);
    } catch (refreshErr) {
      logger.error('Token refresh failed', {
        error: refreshErr.message,
        path: req.path,
        ip: req.ip,
      });
      
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'auto_token_refresh_failed',
        details: `Auto-refresh failed: ${refreshErr.message}`,
        severity: 'medium',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });
      
      // Clear all auth cookies
      res.clearCookie('access_token', { path: '/api' });
      res.clearCookie('refresh_token', { path: '/api' });
      res.clearCookie('fingerprint', { path: '/api' });
      
      res.status(401).json({
        success: false,
        message: 'Session expired – please log in again',
      });
    }
  },

  /**
   * Role-based access control
   */
  restrictTo(...allowedRoles) {
    return async (req, res, next) => {
      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        logger.warn('Permission denied', {
          userId: req.user?._id,
          userRole: req.user?.role,
          requiredRoles: allowedRoles,
          path: req.path,
          ip: req.ip,
        });
        
        logSecurityAudit({
          userId: req.user?._id || null,
          action: 'permission_denied',
          details: `User role ${req.user?.role} not in allowed roles: ${allowedRoles.join(', ')}`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }
      next();
    };
  },

  /**
   * Zero-trust: enforce trusted device check
   */
  async checkDeviceTrust(req, res, next) {
    try {
      const fingerprint = req.headers['x-device-fingerprint'];
      const skipIfLocal = process.env.SKIP_DEVICE_TRUST_LOCAL === 'true';

      // Skip for localhost/development if configured
      if (skipIfLocal && (req.ip === '127.0.0.1' || req.ip === '::1')) {
        logger.debug('Skipping device trust check for localhost', { ip: req.ip });
        return next();
      }

      if (!fingerprint || typeof fingerprint !== 'string' || fingerprint.length < 16) {
        logger.warn('Missing/invalid device fingerprint', {
          userId: req.user?._id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          path: req.path,
          fingerprintLength: fingerprint?.length,
        });
        
        logSecurityAudit({
          userId: req.user?._id || null,
          action: 'device_fingerprint_invalid',
          details: `Invalid device fingerprint length: ${fingerprint?.length}`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(400).json({
          success: false,
          message: 'Valid device fingerprint required (x-device-fingerprint header, min 16 chars)',
        });
      }

      // Fetch fresh user with device data
      const user = await User.findById(req.user._id)
        .select('trustedDevices username email');

      if (!user) {
        logSecurityAudit({
          userId: req.user._id,
          action: 'device_check_user_not_found',
          details: 'User not found during device trust check',
          severity: 'high',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      const isTrusted = user.trustedDevices?.some(d => d.fingerprint === fingerprint);
      
      if (!isTrusted) {
        logger.warn('Access from untrusted device', {
          userId: req.user._id,
          username: user.username,
          email: user.email,
          fingerprint: fingerprint.slice(0, 16) + '...',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          path: req.path,
        });

        logSecurityAudit({
          userId: req.user._id,
          action: 'device_not_trusted',
          details: `Device fingerprint: ${fingerprint.slice(0, 16)}...`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          metadata: {
            username: user.username,
            email: user.email
          }
        });

        return res.status(403).json({
          success: false,
          message: 'This device is not trusted. Please verify your device first.',
          code: 'DEVICE_NOT_TRUSTED',
        });
      }

      // Update last used timestamp (non-blocking with arrayFilters)
      User.findByIdAndUpdate(
        req.user._id,
        { 
          $set: { 
            'trustedDevices.$[device].lastUsed': new Date(),
            'trustedDevices.$[device].ip': req.ip,
            'trustedDevices.$[device].userAgent': req.headers['user-agent'] || 'unknown'
          } 
        },
        { 
          arrayFilters: [{ 'device.fingerprint': fingerprint }]
        }
      ).catch(err => logger.error('Update trusted device failed', { 
        error: err.message,
        userId: req.user._id 
      }));

      logSecurityAudit({
        userId: req.user._id,
        action: 'device_trust_check_passed',
        details: 'Device trust verification successful',
        severity: 'low',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });

      next();
    } catch (err) {
      logger.error('Device trust check failed', { 
        error: err.message,
        userId: req.user?._id,
        path: req.path 
      });
      
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'device_check_error',
        details: `Device trust check failed: ${err.message}`,
        severity: 'high',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method
      });
      
      res.status(500).json({ 
        success: false, 
        message: 'Device verification error' 
      });
    }
  },

  /**
   * Middleware to require device trust for sensitive operations
   */
  requireDeviceTrustForSensitiveOps(req, res, next) {
    const sensitivePaths = [
      '/change-password',
      '/delete-me',
      '/verify-device',
      '/trusted-devices',
      '/reset-password'
    ];
    
    const isSensitive = sensitivePaths.some(path => req.path.includes(path));
    
    if (isSensitive) {
      return this.checkDeviceTrust(req, res, next);
    }
    
    next();
  },

  /**
   * Rate limiting middleware wrapper
   */
  createRateLimiter(options = {}) {
    const rateLimit = require('express-rate-limit');
    
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { 
        success: false, 
        message: 'Too many requests from this IP, please try again later' 
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      handler: async (req, res, next, options) => {
        // Log rate limit violation
        logSecurityAudit({
          userId: req.user?._id || null,
          action: 'rate_limit_exceeded',
          details: `Rate limit exceeded: ${options.max} requests per ${options.windowMs/60000} minutes`,
          severity: 'medium',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method
        });
        
        res.status(options.statusCode).json(options.message);
      }
    };
    
    return rateLimit({ ...defaultOptions, ...options });
  },

  /**
   * CSRF protection middleware (for forms and state-changing operations)
   */
  csrfProtection(req, res, next) {
    // Skip for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // Skip for API requests with Content-Type: application/json
    if (req.headers['content-type']?.includes('application/json')) {
      return next();
    }
    
    // Verify CSRF token
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    const cookieToken = req.cookies['XSRF-TOKEN'];
    
    if (!csrfToken || csrfToken !== cookieToken) {
      logger.warn('CSRF validation failed', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasToken: !!csrfToken,
        hasCookie: !!cookieToken
      });
      
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'csrf_validation_failed',
        details: 'CSRF token validation failed',
        severity: 'high',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        metadata: {
          hasToken: !!csrfToken,
          hasCookie: !!cookieToken
        }
      }).catch(err => logger.error('Failed to log CSRF audit', err));
      
      return res.status(403).json({
        success: false,
        message: 'CSRF token validation failed',
      });
    }
    
    next();
  },

  /**
   * Log all requests for auditing (optional middleware)
   */
  auditAllRequests(req, res, next) {
    // Audit logging logic can be added here
    next();
  },

  /**
   * Optional auth middleware: validates JWT if present, but doesn't fail if missing
   * Perfect for endpoints that work with or without authentication
   */
  async optional(req, res, next) {
    try {
      // Get token from cookie (primary) or Authorization header
      let token = null;

      if (req.cookies?.access_token) {
        token = req.cookies.access_token;
      } else if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }

      // If no token, continue without user
      if (!token) {
        req.user = null;
        return next();
      }

      // Try to validate token
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'access') {
          req.user = null;
          return next();
        }

        // Fetch user from database
        const user = await User.findById(decoded.id).lean();
        if (!user) {
          req.user = null;
          return next();
        }

        req.user = user;
        next();
      } catch (err) {
        // Token is invalid, but continue anyway
        req.user = null;
        next();
      }
    } catch (err) {
      logger.error('Optional auth middleware failed', { error: err.message });
      // Continue without authentication on error
      req.user = null;
      next();
    }
  },

  /**
   * Request logging middleware
   */
  requestLogging(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Override send to capture response details
    res.send = function(body) {
      const duration = Date.now() - startTime;
      
      // Log to audit trail (async, don't block response)
      logSecurityAudit({
        userId: req.user?._id || null,
        action: 'request_processed',
        details: `${req.method} ${req.path} - ${res.statusCode}`,
        severity: 'low',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: res.statusCode < 400,
        metadata: {
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('Content-Length') || 'unknown'
        }
      }).catch(err => {
        logger.error('Failed to log request audit', err);
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  }
};