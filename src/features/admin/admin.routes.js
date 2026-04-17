// src/features/admin/admin.routes.js
import express from 'express';
import { adminController } from './admin.controller.js';
import { permissionController } from './permission.controller.js';
import { userListController } from './user-list.controller.js';
import { adminSettingsController } from './admin-settings.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { validateAdminPrivilege } from '../../middleware/admin-privilege.middleware.js';
import { adminActionRateLimiter, adminSensitiveActionRateLimiter } from '../../middleware/admin-rate-limit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { adminSchemas } from '../config/schemas/admin.schema.js';
import { adminSettingsSchemas } from './admin-settings.schema.js';
import { z } from 'zod';

const router = express.Router();

// ========================
// PUBLIC DEBUG ENDPOINTS (No Auth Required)
// Only enabled in development mode
// ========================
if (process.env.NODE_ENV === 'development') {
  router.get('/dashboard/stats-debug', adminController.getDashboardStats);
}

// All admin routes require admin role - PROTECT ALL OTHER ROUTES
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// Rate limiter for sensitive admin operations
const adminActionLimiter = adminSensitiveActionRateLimiter;

// ========================
// Test Endpoints
// ========================
router.get('/test', adminController.testDashboard);

// ========================
// User Management Endpoints
// ========================

/**
 * @swagger
 * /api/admin/users/summary:
 *   get:
 *     summary: Get user summary by role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User summary retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/users/summary', userListController.getUsersSummary);

/**
 * @swagger
 * /api/admin/users/list-admins:
 *   get:
 *     summary: List admin users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Admin users listed
 */
router.get('/users/list-admins', userListController.listAdmins);

/**
 * @swagger
 * /api/admin/users/list-mods:
 *   get:
 *     summary: List moderator users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Moderator users listed
 */
router.get('/users/list-mods', userListController.listMods);

/**
 * @swagger
 * /api/admin/users/list-users:
 *   get:
 *     summary: List regular users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Regular users listed
 */
router.get('/users/list-users', userListController.listUsers);

/**
 * @swagger
 * /api/admin/users/all:
 *   get:
 *     summary: List all users (any role) with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Items per page (default 20, max 100)
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by username, email, or fullName
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, moderator, user] }
 *         description: Filter by user role
 *       - in: query
 *         name: active
 *         schema: { type: string, enum: [true, false] }
 *         description: Filter by account status (locked/unlocked)
 *     responses:
 *       200:
 *         description: All users listed with pagination
 *       401:
 *         description: Unauthorized
 */
router.get('/users/all', userListController.getAllUsers);

/**
 * POST /api/admin/users/export
 * Export users to CSV
 * Body: { format: 'csv', includeSensitive: boolean }
 */
router.post('/users/export', adminController.exportUsers);

/**
 * POST /api/admin/users/:userId/lock
 * Lock or unlock a user account
 */
router.post(
  '/users/:userId/lock',
  adminActionLimiter,
  validateAdminPrivilege,
  validate(adminSchemas.lockUserSchema),
  adminController.toggleUserLock
);

/**
 * POST /api/admin/users/:userId/force-logout
 * Force logout user and optionally clear trusted devices
 */
router.post(
  '/users/:userId/force-logout',
  adminActionLimiter,
  validateAdminPrivilege,
  validate(adminSchemas.forceLogoutSchema),
  adminController.forceLogoutUser
);

/**
 * GET /api/admin/users/:userId/login-history
 * Get user's login history and authentication audit trail
 */
router.get(
  '/users/:userId/login-history',
  adminController.getUserLoginHistory
);

/**
 * GET /api/admin/users/:userId/audit-trail
 * Get user's complete audit trail (all actions)
 */
router.get(
  '/users/:userId/audit-trail',
  adminController.getUserAuditTrail
);

/**
 * GET /api/admin/users/:userId/details
 * Get complete user profile details
 */
router.get(
  '/users/:userId/details',
  adminController.getUserDetails
);

/**
 * POST /api/admin/users/:userId/change-role
 * Change user role (promote/demote)
 * Body: { newRole: 'admin'|'moderator'|'user', reason?: string }
 */
router.post(
  '/users/:userId/change-role',
  adminActionLimiter,
  validate(z.object({
    newRole: z.enum(['admin', 'moderator', 'user']),
    reason: z.string().max(500).optional()
  }), 'body'),
  adminController.changeUserRole
);

/**
 * PUT /api/admin/users/:userId
 * Edit user details (username, email, firstName, lastName, phone, address)
 * Body: { username?: string, email?: string, firstName?: string, lastName?: string, phone?: string, address?: string }
 */
router.put(
  '/users/:userId',
  adminActionLimiter,
  validate(z.object({
    username: z.string().min(3).max(30).optional(),
    email: z.string().email().optional(),
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
    phone: z.string().max(20).optional().nullable(),
    address: z.string().max(500).optional().nullable()
  }), 'body'),
  adminController.editUser
);

/**
 * DELETE /api/admin/users/:userId
 * Delete user account
 */
router.delete(
  '/users/:userId',
  adminActionLimiter,
  adminController.deleteUser
);

/**
 * GET /api/admin/users/:userId/devices
 * Get user's trusted devices
 */
router.get(
  '/users/:userId/devices',
  adminController.getUserTrustedDevices
);

/**
 * DELETE /api/admin/users/:userId/devices/:deviceId
 * Remove user's trusted device
 */
router.delete(
  '/users/:userId/devices/:deviceId',
  adminActionLimiter,
  adminController.removeUserDevice
);

/**
 * POST /api/admin/users/:userId/verify-phone
 * Verify user's phone number
 */
router.post(
  '/users/:userId/verify-phone',
  adminActionLimiter,
  adminController.verifyUserPhone
);

/**
 * POST /api/admin/users/:userId/verify-address
 * Verify user's address
 */
router.post(
  '/users/:userId/verify-address',
  adminActionLimiter,
  adminController.verifyUserAddress
);

// ========================
// Permission Management Endpoints
// ========================

/**
 * GET /api/admin/permissions/available
 * Get list of all available permissions
 */
router.get('/permissions/available', permissionController.listAvailablePermissions);

/**
 * GET /api/admin/moderators/with-permissions
 * List all moderators and their current permissions
 * Query: page, limit, active
 */
router.get('/moderators/with-permissions', permissionController.listModeratorsWithPermissions);

/**
 * POST /api/admin/moderators/export
 * Export moderators to PDF
 * Body: { format: 'pdf', includePermissions: boolean }
 */
router.post('/moderators/export', adminController.exportModerators);

/**
 * GET /api/admin/moderators/:modId/permissions
 * Get a moderator's current permissions
 */
router.get(
  '/moderators/:modId/permissions',
  permissionController.getModeratorPermissions
);

/**
 * POST /api/admin/moderators/:modId/permissions/grant
 * Grant permissions to a moderator
 * Body: { permissions: [], expiresAt?: Date, notes?: String }
 */
router.post(
  '/moderators/:modId/permissions/grant',
  adminActionLimiter,
  validate(z.object({
    permissions: z.array(z.string()).min(1, 'At least one permission is required'),
    expiresAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional()
  }), 'body'),
  permissionController.grantPermissions
);

/**
 * DELETE /api/admin/moderators/:modId/permissions/revoke
 * Revoke specific permissions from moderator
 * Body: { permissions: [], reason?: String }
 */
router.delete(
  '/moderators/:modId/permissions/revoke',
  adminActionLimiter,
  validate(z.object({
    permissions: z.array(z.string()).min(1, 'At least one permission is required'),
    reason: z.string().max(500).optional()
  }), 'body'),
  permissionController.revokePermissions
);

// ========================
// Settings & Configuration Endpoints
// ========================

/**
 * @swagger
 * /api/admin/settings/email:
 *   get:
 *     summary: Get email settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email settings retrieved
 *   put:
 *     summary: Update email settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [smtp, sendgrid, aws-ses]
 *               smtpHost:
 *                 type: string
 *               smtpPort:
 *                 type: number
 *               smtpUsername:
 *                 type: string
 *               smtpPassword:
 *                 type: string
 *               fromEmail:
 *                 type: string
 *               fromName:
 *                 type: string
 */
router.get('/settings/email', adminSettingsController.getEmailSettings);
router.put(
  '/settings/email',
  validate(adminSettingsSchemas.emailSettingsSchema, 'body'),
  adminSettingsController.updateEmailSettings
);

/**
 * @swagger
 * /api/admin/settings/email/test:
 *   post:
 *     summary: Test email configuration
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/settings/email/test',
  validate(adminSettingsSchemas.testEmailSchema, 'body'),
  adminSettingsController.testEmailConfig
);

/**
 * @swagger
 * /api/admin/settings/notifications:
 *   get:
 *     summary: Get notification settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update notification settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/notifications', adminSettingsController.getNotificationSettings);
router.put(
  '/settings/notifications',
  validate(adminSettingsSchemas.notificationSettingsSchema, 'body'),
  adminSettingsController.updateNotificationSettings
);

/**
 * @swagger
 * /api/admin/settings/database:
 *   get:
 *     summary: Get database settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update database settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/database', adminSettingsController.getDatabaseSettings);
router.put(
  '/settings/database',
  validate(adminSettingsSchemas.databaseSettingsSchema, 'body'),
  adminSettingsController.updateDatabaseSettings
);

/**
 * @swagger
 * /api/admin/settings/database/backup:
 *   post:
 *     summary: Trigger database backup
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/settings/database/backup', adminSettingsController.triggerDatabaseBackup);

/**
 * @swagger
 * /api/admin/settings/database/verify:
 *   post:
 *     summary: Verify database integrity
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/settings/database/verify', adminSettingsController.verifyDatabaseIntegrity);

/**
 * @swagger
 * /api/admin/settings/api:
 *   get:
 *     summary: Get API settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update API settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/api', adminSettingsController.getApiSettings);
router.put(
  '/settings/api',
  validate(adminSettingsSchemas.apiSettingsSchema, 'body'),
  adminSettingsController.updateApiSettings
);

/**
 * @swagger
 * /api/admin/settings/api/keys:
 *   post:
 *     summary: Generate new API key
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/settings/api/keys', adminSettingsController.generateApiKey);

/**
 * @swagger
 * /api/admin/settings/api/keys/revoke:
 *   post:
 *     summary: Revoke API key
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/settings/api/keys/revoke',
  validate(adminSettingsSchemas.revokeApiKeySchema, 'body'),
  adminSettingsController.revokeApiKey
);

/**
 * @swagger
 * /api/admin/settings/cron:
 *   get:
 *     summary: Get cron job settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Create cron job
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/cron', adminSettingsController.getCronSettings);
router.post(
  '/settings/cron',
  validate(adminSettingsSchemas.cronJobSchema, 'body'),
  adminSettingsController.createCronJob
);

/**
 * @swagger
 * /api/admin/settings/cron/{jobId}:
 *   patch:
 *     summary: Update cron job
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Delete cron job
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/settings/cron/:jobId',
  validate(adminSettingsSchemas.cronJobSchema, 'body'),
  adminSettingsController.updateCronJob
);
router.delete('/settings/cron/:jobId', adminSettingsController.deleteCronJob);

/**
 * @swagger
 * /api/admin/settings/cron/{jobId}/toggle:
 *   post:
 *     summary: Toggle cron job status
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.post('/settings/cron/:jobId/toggle', adminSettingsController.toggleCronJobStatus);

/**
 * @swagger
 * /api/admin/settings/maintenance:
 *   get:
 *     summary: Get maintenance settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update maintenance settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/maintenance', adminSettingsController.getMaintenanceSettings);
router.put(
  '/settings/maintenance',
  validate(adminSettingsSchemas.maintenanceSettingsSchema, 'body'),
  adminSettingsController.updateMaintenanceSettings
);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get all admin settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings', adminSettingsController.getAllSettings);

/**
 * @swagger
 * /api/admin/settings/payment-methods:
 *   get:
 *     summary: Get all payment methods with status
 *     tags: [Admin Payment Methods]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update payment method configuration
 *     tags: [Admin Payment Methods]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/payment-methods', adminSettingsController.getPaymentMethods);
router.get('/settings/payment-methods/enabled', adminSettingsController.getEnabledPaymentMethods);
router.post('/settings/payment-methods/:methodName/toggle', adminSettingsController.togglePaymentMethod);
router.put('/settings/payment-methods/:methodName', adminSettingsController.updatePaymentMethod);

/**
 * @swagger
 * /api/admin/settings/order-notifications:
 *   get:
 *     summary: Get order notification settings
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *   put:
 *     summary: Update order notification settings
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 */
router.get('/settings/order-notifications', adminSettingsController.getOrderNotifications);
router.put('/settings/order-notifications', validate(adminSettingsSchemas.notificationSettingsSchema, 'body'), adminSettingsController.updateOrderNotifications);

// Admin: Manage a specific user's notification preferences (view/update)
router.get(
  '/users/:userId/notification-preferences',
  validate(z.object({ userId: z.string().min(1) }), 'params'),
  adminSettingsController.getUserNotificationPreferences
);

router.put(
  '/users/:userId/notification-preferences',
  adminActionLimiter,
  validate(z.object({
    order: z.object({
      notifyOnNewOrder: z.boolean().optional(),
      notifyOnPaymentConfirmed: z.boolean().optional(),
      notifyOnOrderShipped: z.boolean().optional(),
      notifyOnOrderDelivered: z.boolean().optional(),
      notifyOnCancellation: z.boolean().optional(),
      notifyOnRefund: z.boolean().optional(),
      notificationChannels: z.object({
        email: z.boolean().optional(),
        inApp: z.boolean().optional(),
        sms: z.boolean().optional(),
        whatsapp: z.boolean().optional()
      }).optional()
    }).optional()
  }), 'body'),
  adminSettingsController.updateUserNotificationPreferences
);

// ========================
// Security Endpoints
// ========================

/**
 * GET /api/admin/dashboard/stats
 * Get comprehensive dashboard statistics
 * NOTE: This is a critical endpoint that should not be deduplicated
 * as it needs to return fresh data on each request
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * GET /api/admin/security/dashboard
 * Get security metrics and dashboard data
 */
router.get(
  '/security/dashboard',
  adminController.getSecurityDashboard
);

export default router;
