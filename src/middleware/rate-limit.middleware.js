import rateLimit from 'express-rate-limit';
import { SecurityAudit } from '../features/auth/audit.model.js';
import { logger } from '../utils/logger.util.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// ✅ NEW: Custom handler for rate limit exceeded (P2-10) - Enhanced audit logging
const handleRateLimitExceeded = async (req, res) => {
  try {
    // Log rate limit breach to audit system
    if (req.user) {
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'rate_limit_exceeded',
        category: 'SECURITY',
        severity: 'MEDIUM',
        details: `Rate limit exceeded on endpoint: ${req.path}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          rateLimitType: req.rateLimit?.type || 'unknown',
          remainingRequests: 0,
          resetTime: req.rateLimit?.resetTime
        }
      });
    } else {
      // Log even for unauthenticated users
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
    }
  } catch (error) {
    logger.error('Failed to log rate limit exceeded event', { error: error.message });
  }
};

export const loginRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_LOGIN) || 30,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    handleRateLimitExceeded(req, res);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts, please try again later'
    });
  }
});

export const apiRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_API) || 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    handleRateLimitExceeded(req, res);
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }
});

export default { loginRateLimiter, apiRateLimiter };
