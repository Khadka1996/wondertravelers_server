// src/features/moderator/moderator.routes.js
import express from 'express';
import { moderatorController } from './moderator.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { loginRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { checkPermission, checkPermissionAny } from '../../middleware/check-permission.middleware.js';
import { z } from 'zod';

const router = express.Router();

// ========================
// Moderator Schemas
// ========================

const deactivateUserSchema = z.object({
  reason: z.string().optional().default('No reason provided')
});

const reactivateUserSchema = z.object({
  reason: z.string().optional().default('No reason provided')
});

// ========================
// Middleware
// ========================

// All moderator routes require authentication and moderator role
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('moderator', 'admin'));

// Optional: Dynamic permission checking can be added to individual routes
// Routes will work for admins automatically, and for moderators if they have permissions

// Rate limiter for sensitive moderator operations
const moderatorActionLimiter = loginRateLimiter;

// ========================
// User Management Routes
// ========================

/**
 * @swagger
 * /api/moderator/users:
 *   get:
 *     summary: List all users with filtering options
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin, moderator, seller] }
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 *       403:
 *         description: Forbidden - Moderator or Admin access required
 */
router.get('/users', async (req, res, next) => {
  try {
    await moderatorController.listUsers(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/moderator/users/{userId}:
 *   get:
 *     summary: Get detailed information about a specific user
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 *       404:
 *         description: User not found
 */
router.get('/users/:userId', async (req, res, next) => {
  try {
    await moderatorController.getUserDetails(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/moderator/users/{userId}/login-history:
 *   get:
 *     summary: Get user's login history
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 50, default: 20 }
 *     responses:
 *       200:
 *         description: Login history retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/users/:userId/login-history', async (req, res, next) => {
  try {
    await moderatorController.getUserLoginHistory(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/moderator/users/{userId}/activity:
 *   get:
 *     summary: Get complete activity audit trail for a user
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 100, default: 50 }
 *     responses:
 *       200:
 *         description: Activity audit trail retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/users/:userId/activity', async (req, res, next) => {
  try {
    await moderatorController.getUserActivity(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ========================
// Moderation Actions
// ========================

/**
 * @swagger
 * /api/moderator/users/{userId}/deactivate:
 *   post:
 *     summary: Deactivate a user account (prevent login)
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Suspicious activity detected"
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 *       403:
 *         description: Cannot deactivate admin users
 */
router.post(
  '/users/:userId/deactivate',
  moderatorActionLimiter,
  validate(deactivateUserSchema),
  async (req, res, next) => {
    try {
      await moderatorController.deactivateUser(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/moderator/users/{userId}/reactivate:
 *   post:
 *     summary: Reactivate a deactivated user account
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Account verified as legitimate"
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.post(
  '/users/:userId/reactivate',
  moderatorActionLimiter,
  validate(reactivateUserSchema),
  async (req, res, next) => {
    try {
      await moderatorController.reactivateUser(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/moderator/users/{userId}/force-logout:
 *   post:
 *     summary: Force logout a user from all sessions
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User forced logout successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.post(
  '/users/:userId/force-logout',
  moderatorActionLimiter,
  async (req, res, next) => {
    try {
      await moderatorController.forceLogoutUser(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// ========================
// Security & Monitoring Routes
// ========================

/**
 * @swagger
 * /api/moderator/security/summary:
 *   get:
 *     summary: Get security metrics summary
 *     tags: [Moderator]
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
 *         description: Unauthorized - Bearer token required
 */
router.get('/security/summary', async (req, res, next) => {
  try {
    await moderatorController.getSecuritySummary(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/moderator/audit-logs:
 *   get:
 *     summary: View recent audit logs with filtering
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: category
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    await moderatorController.getAuditLogs(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ========================
// Info/Status Routes
// ========================

/**
 * @swagger
 * /api/moderator/status:
 *   get:
 *     summary: Get moderator access status and available endpoints
 *     tags: [Moderator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Moderator status information retrieved successfully
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.get('/status', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Moderator API is operational',
      status: {
        role: req.user.role,
        username: req.user.username,
        accessLevel: 'moderator',
        endpoints: {
          userManagement: '/api/moderator/users',
          moderation: '/api/moderator/users/:userId/deactivate',
          security: '/api/moderator/security/summary',
          audit: '/api/moderator/audit-logs'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get moderator status',
      error: error.message
    });
  }
});

export default router;
