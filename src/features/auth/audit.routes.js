// src/features/auth/audit.routes.js
import express from 'express';
import { auditController } from './audit.controller.js';
import { authMiddleware } from './auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import rateLimit from 'express-rate-limit';
import { logger } from '../../utils/logger.util.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from './audit.model.js';

const router = express.Router();

// Rate limiters for audit endpoints
const auditRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { 
    success: false, 
    message: 'Too many audit requests, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: { 
    success: false, 
    message: 'Too many export requests, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const cleanupRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 cleanup operations per day
  message: { 
    success: false, 
    message: 'Too many cleanup requests, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const streamRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 concurrent streams per user
  message: { 
    success: false, 
    message: 'Too many stream connections, please try again later' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user._id.toString(), // Rate limit per user, not per IP
});

// Apply audit logging middleware to all audit routes
router.use((req, res, next) => {
  // Add audit source to request
  req.auditSource = 'audit-routes';
  next();
});

// CSRF Token Validation Middleware for state-changing operations
const validateCsrfToken = (req, res, next) => {
  // Skip CSRF check if not enforced
  if (process.env.ENFORCE_CSRF !== 'true') {
    return next();
  }
  
  const tokenFromHeader = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const tokenFromCookie = req.cookies['fingerprint'];
  
  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({
      success: false,
      message: 'CSRF validation failed',
      error: 'Invalid or missing CSRF token'
    });
  }
  
  next();
};

// All audit routes require admin privileges
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// ✅ NEW: Superadmin-only middleware for sensitive operations
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    SecurityAudit.create({
      userId: req.user._id,
      action: 'unauthorized_sensitive_audit_access',
      category: ACTION_CATEGORIES.SECURITY,
      severity: SEVERITY_LEVELS.HIGH,
      details: `${req.user.role} denied access to ${req.path}`,
      ipAddress: req.ip,
      endpoint: req.path,
      success: false
    }).catch(e => logger.error('Audit log failed', e));
    
    return res.status(403).json({ success: false, message: 'Superadmin access required' });
  }
  next();
};

// ========================
// Audit Log Access
// ========================

/**
 * @swagger
 * /api/audit/logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: severity
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Get audit logs with filtering
router.get('/logs', 
  auditRateLimiter,
  auditController.getAuditLogs
);

/**
 * @swagger
 * /api/audit/search:
 *   get:
 *     summary: Search audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema: { type: string }
 *         required: true
 *       - in: query
 *         name: field
 *         schema: { type: string, enum: [action, userId, ipAddress, endpoint] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Search audit logs
router.get('/search', 
  auditRateLimiter,
  auditController.searchAuditLogs
);

/**
 * @swagger
 * /api/audit/summary:
 *   get:
 *     summary: Get security summary
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 7 }
 *     responses:
 *       200:
 *         description: Security summary retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Get security summary
router.get('/summary', 
  auditRateLimiter,
  auditController.getSecuritySummary
);

/**
 * @swagger
 * /api/audit/metrics:
 *   get:
 *     summary: Get audit metrics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Audit metrics retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Get audit metrics
router.get('/metrics', 
  auditRateLimiter,
  authMiddleware.restrictTo('admin'),
  auditController.getAuditMetrics
);

/**
 * @swagger
 * /api/audit/test:
 *   get:
 *     summary: Test endpoint to verify connectivity
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test successful
 */
// Test endpoint
router.get('/test', 
  auditRateLimiter,
  (req, res) => {
    res.json({
      success: true,
      message: 'Audit API is working',
      user: req.user._id,
      role: req.user.role,
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * @swagger
 * /api/audit/user/{userId}:
 *   get:
 *     summary: Get user audit trail
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User audit trail retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Get user audit trail
router.get('/user/:userId', 
  auditRateLimiter,
  auditController.getUserAuditTrail
);

// ========================
// Audit Data Management
// ========================

/**
 * @swagger
 * /api/audit/export:
 *   post:
 *     summary: Export audit logs (superadmin only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [csv, json, pdf]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Audit logs exported successfully
 *       401:
 *         description: Unauthorized - Superadmin access required
 *       429:
 *         description: Too many export requests
 */
// Export audit logs (superadmin only)
router.post('/export', 
  exportRateLimiter,
  validateCsrfToken,
  requireSuperAdmin,
  auditController.exportAuditLogs
);

/**
 * @swagger
 * /api/audit/cleanup:
 *   post:
 *     summary: Cleanup old audit logs (superadmin only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysToKeep:
 *                 type: integer
 *                 default: 90
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Cleanup operation completed successfully
 *       401:
 *         description: Unauthorized - Superadmin access required
 *       429:
 *         description: Too many cleanup requests
 */
// Cleanup old audit logs (superadmin only)
router.post('/cleanup', 
  cleanupRateLimiter,
  validateCsrfToken,
  requireSuperAdmin,
  auditController.cleanupAuditLogs
);

// ========================
// Real-time Audit Stream
// ========================

/**
 * @swagger
 * /api/audit/stream:
 *   get:
 *     summary: Stream audit events (superadmin only, WebSocket)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       101:
 *         description: WebSocket upgrade successful, streaming audit events
 *       401:
 *         description: Unauthorized - Superadmin access required
 *       429:
 *         description: Too many concurrent stream connections
 */
// Stream audit events (superadmin only)
router.get('/stream', 
  streamRateLimiter,
  requireSuperAdmin,
  auditController.streamAuditEvents
);

// ========================
// Audit System Health
// ========================

/**
 * @swagger
 * /api/audit/status:
 *   get:
 *     summary: Get audit system status and database statistics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit system status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: integer
 *                     storageSize:
 *                       type: string
 *                     eventsLast24h:
 *                       type: integer
 *                     retentionDays:
 *                       type: integer
 *       401:
 *         description: Unauthorized - Admin access required
 */
// Get audit system status
router.get('/status', async (req, res) => {
  try {
    const { SecurityAudit } = await import('./audit.model.js');
    
    // Get audit database stats
    const stats = await SecurityAudit.collection.stats();
    const recentEvents = await SecurityAudit.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    res.json({
      success: true,
      status: 'operational',
      stats: {
        totalRecords: stats.count,
        storageSize: `${Math.round(stats.storageSize / 1024 / 1024)} MB`,
        indexSize: `${Math.round(stats.totalIndexSize / 1024 / 1024)} MB`,
        eventsLast24h: recentEvents,
        avgEventSize: stats.avgObjSize ? Math.round(stats.avgObjSize) : 0,
        retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get audit system status',
      error: error.message
    });
  }
});

export default router;