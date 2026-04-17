// src/middleware/blog-cache.middleware.js

import cache from '../utils/cache.util.js';
import { logger } from '../utils/logger.util.js';

/**
 * Global blog caching middleware
 * Caches all GET requests to blog endpoints with Redis + NodeCache
 */
export const blogCachingMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Generate cache key from URL + query params
  const cacheKey = generateBlogCacheKey(req);

  // Override res.json to intercept responses
  const originalJson = res.json.bind(res);

  res.json = async function(body) {
    try {
      // Only cache successful responses (200-299)
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
        // Different TTL based on endpoint
        const ttl = getTTLForEndpoint(req.path);
        await cache.set(cacheKey, body, ttl);
        
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
      }
    } catch (err) {
      logger.warn('Blog cache set failed', { error: err.message, cacheKey });
    }

    return originalJson(body);
  };

  next();
};

/**
 * Blog read-through cache middleware
 * Checks cache before calling next middleware/handler
 */
export const blogReadCache = async (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = generateBlogCacheKey(req);

  try {
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      logger.debug('Blog cache hit', { cacheKey });
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', cacheKey);
      return res.status(200).json(cachedData);
    }

    res.set('X-Cache', 'MISS');
    res.set('X-Cache-Key', cacheKey);
  } catch (err) {
    logger.warn('Blog cache read failed', { error: err.message, cacheKey });
  }

  next();
};

/**
 * Invalidate blog caches when creating/updating/deleting
 * Use this in POST/PATCH/DELETE handlers
 */
export const invalidateBlogCache = async (pattern = 'blogs:*') => {
  try {
    await cache.delPattern(pattern);
    logger.debug('Blog cache invalidated', { pattern });
  } catch (err) {
    logger.warn('Blog cache invalidation failed', { error: err.message, pattern });
  }
};

/**
 * Generate cache key from request
 */
function generateBlogCacheKey(req) {
  const path = req.path;
  const query = new URLSearchParams(req.query).toString();
  
  const baseKey = path.replace(/^\/api/, '').replace(/\/$/, '');
  return query ? `${baseKey}:${query}` : baseKey;
}

/**
 * Get TTL based on endpoint type
 */
function getTTLForEndpoint(path) {
  // Homepage blogs - cache longer (2 hours)
  if (/\/api\/blogs\/?$/.test(path)) {
    return 7200;
  }

  // Category blogs - cache 1 hour
  if (/\/api\/blogs\/category\//.test(path)) {
    return 3600;
  }

  // Single blog post - cache 4 hours
  if (/\/api\/blogs\/[a-z0-9]+\/?$/.test(path)) {
    return 14400;
  }

  // Featured/popular - cache 2 hours
  if (/\/featured|popular/.test(path)) {
    return 7200;
  }

  // Default - cache 1 hour
  return 3600;
}

export default {
  blogCachingMiddleware,
  blogReadCache,
  invalidateBlogCache,
  generateBlogCacheKey,
  getTTLForEndpoint,
};
