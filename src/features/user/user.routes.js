// src/features/user/user.routes.js
import express from 'express';
import { userController } from './user.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';
import { adminSensitiveActionRateLimiter } from '../../middleware/admin-rate-limit.middleware.js';

const router = express.Router();

// ========================
// VALIDATION SCHEMAS
// ========================
const updateRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin'])
    .describe('User role to assign')
});

const updateStatusSchema = z.object({
  active: z.boolean().describe('User active status'),
  reason: z.string().optional().describe('Reason for status change')
});

const deleteUserSchema = z.object({
  softDelete: z.boolean().default(true).describe('Soft delete or hard delete'),
  reason: z.string().optional().describe('Reason for deletion')
});

const bulkRoleUpdateSchema = z.object({
  userIds: z.array(z.string()).min(1).describe('Array of user IDs'),
  role: z.enum(['user', 'moderator', 'admin']).describe('Role to assign')
});

const bulkStatusUpdateSchema = z.object({
  userIds: z.array(z.string()).min(1).describe('Array of user IDs'),
  active: z.boolean().describe('Active status to set')
});

const updateUserInfoSchema = z.object({
  fullName: z.string().optional().describe('User full name'),
  email: z.string().email().optional().describe('User email'),
  phone: z.string().optional().describe('User phone number'),
  role: z.enum(['user', 'moderator', 'admin']).optional().describe('User role'),
  status: z.enum(['active', 'inactive']).optional().describe('User status')
});

// ========================
// PUBLIC ENDPOINTS
// ========================

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users (public)
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: ['user', 'moderator', 'admin'] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['active', 'inactive'] }
 */
router.get('/search', userController.searchUsers);

// ========================
// PROTECTED ENDPOINTS (Auth Required)
// ========================
router.use(authMiddleware.protect);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', userController.getStats);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filters
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
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: ['user', 'moderator', 'admin'] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['active', 'inactive'] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: 'createdAt' }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: integer, enum: [1, -1], default: -1 }
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /api/users/sessions/active:
 *   get:
 *     summary: Get active sessions count
 *     security:
 *       - bearerAuth: []
 */
router.get('/sessions/active', userController.getActiveSessions);

/**
 * @swagger
 * /api/users/activity-summary:
 *   get:
 *     summary: Get user activity summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30 }
 */
router.get('/activity-summary', userController.getActivitySummary);

/**
 * @swagger
 * /api/users/role/{role}:
 *   get:
 *     summary: Get users by role
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema: { type: string, enum: ['user', 'moderator', 'admin'] }
 */
router.get('/role/:role', userController.getUsersByRole);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get single user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 */
router.get('/:userId', userController.getUserById);

// ========================
// ADMIN-ONLY ENDPOINTS
// ========================
router.use(authMiddleware.restrictTo('admin'));
router.use(adminSensitiveActionRateLimiter);

/**
 * @swagger
 * /api/users/{userId}/role:
 *   put:
 *     summary: Update user role (Admin only)
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
 *               role:
 *                 type: string
 *                 enum: ['user', 'moderator', 'admin']
 */
router.put(
  '/:userId/role',
  validate(updateRoleSchema),
  userController.updateUserRole
);

/**
 * @swagger
 * /api/users/{userId}/status:
 *   put:
 *     summary: Update user status (Admin only)
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
 *               active:
 *                 type: boolean
 *               reason:
 *                 type: string
 */
router.put(
  '/:userId/status',
  validate(updateStatusSchema),
  userController.updateUserStatus
);

/**
 * @swagger
 * /api/users/{userId}:
 *   put:
 *     summary: Update user information (Admin only)
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
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: ['user', 'moderator', 'admin']
 *               status:
 *                 type: string
 *                 enum: ['active', 'inactive']
 */
router.put(
  '/:userId',
  validate(updateUserInfoSchema),
  userController.updateUserInfo
);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete user (Admin only)
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
 *               softDelete:
 *                 type: boolean
 *                 default: true
 *               reason:
 *                 type: string
 */
router.delete(
  '/:userId',
  validate(deleteUserSchema),
  userController.deleteUser
);

/**
 * @swagger
 * /api/users/bulk-role-update:
 *   post:
 *     summary: Bulk update user roles (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *               role:
 *                 type: string
 *                 enum: ['user', 'moderator', 'admin']
 */
router.post(
  '/bulk-role-update',
  validate(bulkRoleUpdateSchema),
  userController.bulkUpdateRoles
);

/**
 * @swagger
 * /api/users/bulk-status-update:
 *   post:
 *     summary: Bulk update user status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *               active:
 *                 type: boolean
 */
router.post(
  '/bulk-status-update',
  validate(bulkStatusUpdateSchema),
  userController.bulkUpdateStatus
);

export default router;
