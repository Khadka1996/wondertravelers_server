import redisClient from '../utils/redis.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Rate limiting middleware for analytics endpoints
 * Limits admin users to 100 requests per hour per endpoint
 */
export const analyticsRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const endpoint = req.originalUrl.split('?')[0]; // Remove query params
    const key = `rate-limit:analytics:${userId}:${endpoint}`;
    const limit = 100; // requests per hour
    const window = 3600; // 1 hour in seconds

    // Try to increment the counter
    try {
      const current = await redisClient.incr(key);
      
      if (current === 1) {
        // First request in this window, set expiration
        await redisClient.expire(key, window);
      }

      const remaining = Math.max(0, limit - current);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + window,
      });

      if (current > limit) {
        logger.warn(`Rate limit exceeded for user ${userId} on ${endpoint}`, {
          current,
          limit,
        });
        return res.status(429).json({
          success: false,
          message: `Too many requests. Limit: ${limit} per hour. Try again in ${window} seconds.`,
          retryAfter: window,
        });
      }

      next();
    } catch (redisErr) {
      logger.warn('Redis rate limiting failed, allowing request:', redisErr.message);
      // If Redis fails, allow the request to proceed
      next();
    }
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // On error, allow request to proceed
    next();
  }
};

/**
 * Stricter rate limiting for cleanup endpoint
 * Limits to 10 requests per hour
 */
export const analyticsCleanupRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const key = `rate-limit:analytics-cleanup:${userId}`;
    const limit = 10; // requests per hour
    const window = 3600; // 1 hour in seconds

    try {
      const current = await redisClient.incr(key);
      
      if (current === 1) {
        await redisClient.expire(key, window);
      }

      const remaining = Math.max(0, limit - current);

      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': remaining,
        'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + window,
      });

      if (current > limit) {
        logger.warn(`Cleanup rate limit exceeded for user ${userId}`, {
          current,
          limit,
        });
        return res.status(429).json({
          success: false,
          message: `Too many cleanup requests. Limit: ${limit} per hour.`,
          retryAfter: window,
        });
      }

      next();
    } catch (redisErr) {
      logger.warn('Redis rate limiting failed for cleanup, allowing request:', redisErr.message);
      next();
    }
  } catch (error) {
    logger.error('Cleanup rate limiter error:', error);
    next();
  }
};
