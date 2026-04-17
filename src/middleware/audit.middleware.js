// src/middleware/audit.middleware.js
import { SecurityAudit, ACTION_CATEGORIES, SEVERITY_LEVELS } from '../features/auth/audit.model.js';
import { logger } from '../utils/logger.util.js';

// Try to import geoip-lite, but make it optional
let geoip = null;
(async () => {
  try {
    geoip = await import('geoip-lite').then(module => module.default);
    logger.info('GeoIP module loaded successfully');
  } catch (error) {
    logger.warn('GeoIP module not found. Geolocation will be disabled.');
    logger.warn('Install with: npm install geoip-lite');
  }
})();

/**
 * Middleware to log all sensitive requests automatically
 * SIMPLIFIED: Pass through immediately, actual audit logging happens in controllers
 */
export const auditSensitiveRequests = () => {
  return (req, res, next) => {
    // Just pass through - don't block requests
    // Actual audit logging should happen in individual route handlers
    next();
  };
};

/**
 * Middleware to add geolocation to request (optional)
 */
export const addGeolocation = (req, res, next) => {
  if (!req.geolocation && geoip) {
    try {
      const geo = geoip.lookup(req.ip);
      if (geo) {
        req.geolocation = {
          country: geo.country,
          countryCode: geo.country,
          region: geo.region,
          city: geo.city,
          ll: geo.ll,
          metro: geo.metro,
          range: geo.range,
          timezone: geo.timezone
        };
      }
    } catch (err) {
      // Silently fail
    }
  }
  next();
};

/**
 * Middleware to initialize audit system on startup
 */
export const initializeAuditSystem = async () => {
  try {
    // Create indexes if needed
    await SecurityAudit.createIndexesIfNeeded();

    // Log system startup
    await SecurityAudit.create({
      action: 'system_startup',
      category: ACTION_CATEGORIES.SYSTEM,
      severity: SEVERITY_LEVELS.LOW,
      details: 'Audit system initialized successfully',
      ipAddress: '127.0.0.1',
      endpoint: '/system/startup',
      method: 'SYSTEM',
      success: true,
      source: 'system',
      metadata: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90,
        geoipAvailable: !!geoip,
        timestamp: new Date().toISOString()
      }
    });

    logger.info('Audit system initialized successfully');
    logger.info(`GeoIP module: ${geoip ? 'Available' : 'Not available'}`);

    return true;
  } catch (error) {
    logger.error('Failed to initialize audit system', { error: error.message });
    throw error;
  }
};

// Optimize audit middleware to log only critical events
export const optimizedAuditMiddleware = async (req, res, next) => {
  try {
    if (req.method === 'POST' || req.method === 'DELETE') {
      // Log only critical events
      console.log(`Audit Log: ${req.method} request to ${req.originalUrl}`);
    }
    next();
  } catch (err) {
    console.error('Audit middleware error:', err);
    next();
  }
};