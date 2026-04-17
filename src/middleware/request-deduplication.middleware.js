// src/middleware/request-deduplication.middleware.js
/**
 * Request Deduplication Middleware
 * Prevents duplicate identical GET requests from hitting DB
 * If same request comes in while first is processing, returns same result
 */

import cache from '../utils/cache.util.js';

const requestDeduplication = async (req, res, next) => {
  // Skip deduplication for all admin endpoints (they need fresh data)
  if (req.path.includes('/admin/')) {
    return next();
  }

  // Only deduplicate safe GET/HEAD requests
  if (!['GET', 'HEAD'].includes(req.method)) {
    return next();
  }

  // Generate cache key from method + path + query
  const cacheKey = `req:dedup:${req.method}:${req.path}:${JSON.stringify(req.query)}`;
  const pendingKey = `req:pending:${cacheKey}`;

  try {
    // Check if identical request is already in progress
    const pending = await cache.get(pendingKey);
    
    if (pending) {
      // Request already being processed - return pending promise
      res.set('X-Dedup', 'QUEUED');
      res.set('X-Dedup-Key', cacheKey);
      
      // Wait for original request to complete
      return res.json(pending);
    }

    // Mark this request as pending (being processed)
    await cache.set(pendingKey, { status: 'processing' }, 10); // 10 sec timeout

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    
    res.json = async (body) => {
      try {
        // Only cache successful responses (2xx status)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Don't cache complex objects - only cache simple JSON
          let cacheableBody = body;
          try {
            // Test if the body can be stringified
            JSON.stringify(body);
          } catch (serErr) {
            // Body not serializable, don't cache
            cacheableBody = null;
          }

          if (cacheableBody) {
            // Cache response for 5 minutes
            const ttl = req.path.includes('/trending') ? 1800 : 300;
            try {
              await cache.set(cacheKey, body, ttl);
              res.set('X-Cache-Dedup', 'SAVED');
            } catch (cacheErr) {
              // Caching failed, but don't break the response
              console.debug('Dedup cache set failed (non-critical):', cacheErr.message);
            }
          }
        }

        // Clear pending marker
        try {
          await cache.del(pendingKey);
        } catch (delErr) {
          console.debug('Dedup pending clear failed:', delErr.message);
        }
        res.set('X-Dedup', 'FRESH');
      } catch (err) {
        console.debug('Dedup response cache error (non-critical):', err.message);
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error('Dedup middleware error:', err.message);
    // On error, continue normally without dedup
    next();
  }
};

export default requestDeduplication;
