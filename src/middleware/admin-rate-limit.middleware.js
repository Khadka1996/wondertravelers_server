// src/middleware/admin-rate-limit.middleware.js
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../utils/logger.util.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../features/auth/audit.model.js';

/**
 * Special rate limiter for admin actions
 * Based on user ID instead of IP to prevent bypass via multiple IPs
 * Falls back to IP if no user is authenticated
 */
export const adminActionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 requests per hour per admin
  message: { 
    success: false, 
    message: 'Too many admin actions. Please try again later.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use user ID as primary key to prevent IP-bypass attacks
    if (req.user && req.user._id) {
      return `admin:${req.user._id.toString()}`;
    }
    // Fallback to IP with proper IPv6 handling if not authenticated
    return `admin:ip:${ipKeyGenerator(req, res)}`;
  },
  handler: async (req, res, next, options) => {
    logger.warn('Admin action rate limit exceeded', {
      adminId: req.user?._id,
      adminRole: req.user?.role,
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    // Log rate limit violation
    try {
      await SecurityAudit.create({
        userId: req.user?._id || null,
        action: 'admin_rate_limit_exceeded',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Admin rate limit exceeded: ${options.max} actions per ${options.windowMs/60000} minutes`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          adminId: req.user?._id?.toString(),
          adminRole: req.user?.role,
          windowMs: options.windowMs,
          maxRequests: options.max
        }
      });
    } catch (auditErr) {
      logger.error('Failed to log admin rate limit audit', { error: auditErr.message });
    }

    const statusCode = Number.isInteger(options?.statusCode) ? options.statusCode : 429;
    res.status(statusCode).json(options.message);
  }
});

/**
 * Per-action admin rate limiter (more restrictive for sensitive ops)
 */
export const adminSensitiveActionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 sensitive actions per hour (increased for permission management)
  message: {
    success: false,
    message: 'Too many sensitive admin actions. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    if (req.user && req.user._id) {
      return `admin:sensitive:${req.user._id.toString()}`;
    }
    return `admin:sensitive:ip:${ipKeyGenerator(req, res)}`;
  },
  handler: async (req, res, next, options) => {
    logger.error('SENSITIVE admin action rate limit exceeded - potential attack', {
      adminId: req.user?._id,
      adminRole: req.user?.role,
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    try {
      await SecurityAudit.create({
        userId: req.user?._id || null,
        action: 'rate_limit_exceeded',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `SENSITIVE admin rate limit exceeded: ${options.max} actions per ${options.windowMs/60000} minutes - POTENTIAL ATTACK`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          adminId: req.user?._id?.toString(),
          adminRole: req.user?.role,
          action: 'potential_brute_force_attack'
        }
      });
    } catch (auditErr) {
      logger.error('Failed to log sensitive admin rate limit audit', { error: auditErr.message });
    }

    const statusCode = Number.isInteger(options?.statusCode) ? options.statusCode : 429;
    res.status(statusCode).json(options.message);
  }
});

export default {
  adminActionRateLimiter,
  adminSensitiveActionRateLimiter
};
