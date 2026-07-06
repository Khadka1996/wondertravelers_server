//server/utils/cache.util.js
import NodeCache from 'node-cache';
import redisClient from './redis.util.js';
import { logger } from './logger.util.js';

const nodeCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

const normalizeCacheValue = (value) => {
  if (value && typeof value === 'object') {
    if (typeof value.toObject === 'function') {
      try {
        return value.toObject({ getters: false, virtuals: false });
      } catch (_err) {
        // Fall back to toJSON or original value
      }
    }
    if (typeof value.toJSON === 'function') {
      try {
        return value.toJSON();
      } catch (_err) {
        // Fall back to original value
      }
    }
  }
  return value;
};

/**
 * Get value from cache (Redis first, then NodeCache fallback)
 * @param {string} key - Cache key
 * @returns {Promise<any>} Cached value or null
 */
export const get = async (key) => {
  try {
    const redisClient_ = redisClient.getClient();
    if (redisClient_ && redisClient_.isOpen) {
      const redisValue = await redisClient_.get(key);
      if (redisValue) {
        logger.debug('Cache HIT (Redis)', { key });
        return JSON.parse(redisValue);
      }
    }
  } catch (err) {
    logger.warn('Redis get failed, falling back to NodeCache', { error: err.message, key });
  }

  // Fallback to NodeCache
  const nodeValue = nodeCache.get(key);
  if (nodeValue) {
    logger.debug('Cache HIT (NodeCache)', { key });
  }
  return nodeValue || null;
};

/**
 * Set value in cache (Both Redis and NodeCache)
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
export const set = async (key, value, ttl = 3600) => {
  const normalizedValue = normalizeCacheValue(value);

  try {
    const redisClient_ = redisClient.getClient();
    if (redisClient_ && redisClient_.isOpen) {
      // Use setEx (camelCase) for redis v4+ with correct parameter order
      await redisClient_.setEx(key, ttl, JSON.stringify(normalizedValue));
      logger.debug('Cache SET (Redis)', { key, ttl });
    }
  } catch (err) {
    logger.warn('Redis set failed', { error: err.message, key });
  }

  // Always set in NodeCache as fallback
  nodeCache.set(key, normalizedValue, ttl);
  logger.debug('Cache SET (NodeCache)', { key, ttl });
};

/**
 * Delete key from cache
 * @param {string} key - Cache key
 */
export const del = async (key) => {
  try {
    const redisClient_ = redisClient.getClient();
    if (redisClient_ && redisClient_.isOpen) {
      await redisClient_.del(key);
      logger.debug('Cache DELETE (Redis)', { key });
    }
  } catch (err) {
    logger.warn('Redis delete failed', { error: err.message, key });
  }

  nodeCache.del(key);
  logger.debug('Cache DELETE (NodeCache)', { key });
};

/**
 * Delete all keys matching pattern
 * @param {string} pattern - Pattern (e.g., 'blogs:*')
 */
export const delPattern = async (pattern) => {
  try {
    const redisClient_ = redisClient.getClient();
    if (redisClient_ && redisClient_.isOpen) {
      const keys = await redisClient_.keys(pattern);
      if (keys.length > 0) {
        await redisClient_.del(keys);
        logger.debug('Cache DELETE pattern (Redis)', { pattern, count: keys.length });
      }
    }
  } catch (err) {
    logger.warn('Redis pattern delete failed', { error: err.message, pattern });
  }

  // Also clear from NodeCache
  const nodeKeys = nodeCache.keys();
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  nodeKeys.filter(k => regex.test(k)).forEach(k => nodeCache.del(k));
};

/**
 * Wrap async function with caching
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 */
export const remember = async (key, fetchFn, ttl = 3600) => {
  try {
    const cached = await get(key);
    if (cached) return cached;

    const result = await fetchFn();
    await set(key, result, ttl);
    return result;
  } catch (err) {
    logger.error('Cache remember failed', { error: err.message, key });
    // Return fresh data even if cache fails
    return fetchFn();
  }
};

/**
 * Get cache stats
 */
export const getStats = () => {
  const nodeStats = nodeCache.getStats();
  return {
    nodeCache: {
      keys: nodeStats.keys,
      hits: nodeStats.hits,
      misses: nodeStats.misses,
      ksize: nodeStats.ksize,
      vsize: nodeStats.vsize
    }
  };
};

/**
 * Clear all cache
 */
export const flush = async () => {
  try {
    const redisClient_ = redisClient.getClient();
    if (redisClient_ && redisClient_.isOpen) {
      await redisClient_.flushDb();
      logger.info('Cache FLUSH (Redis)');
    }
  } catch (err) {
    logger.warn('Redis flush failed', { error: err.message });
  }

  nodeCache.flushAll();
  logger.info('Cache FLUSH (NodeCache)');
};

export default {
  get,
  set,
  del,
  delPattern,
  remember,
  getStats,
  flush,
};