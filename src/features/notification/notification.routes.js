import { Router } from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import {
  getNotifications,
  getUnreadCount,
  getNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences
} from './notification.controller.js';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware.protect);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 */
router.get(
  '/unread-count',
  getUnreadCount
);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get(
  '/',
  getNotifications
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   get:
 *     summary: Get single notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification retrieved
 */
router.get(
  '/:notificationId',
  getNotification
);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.post(
  '/:notificationId/read',
  markAsRead
);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Mark all as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All marked as read
 */
router.post(
  '/mark-all-read',
  markAllAsRead
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.delete(
  '/:notificationId',
  deleteNotification
);

/**
 * @swagger
 * /api/notifications/clear-all:
 *   delete:
 *     summary: Clear all notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications cleared
 */
router.delete(
  '/clear-all',
  clearAllNotifications
);

/**
 * User notification preferences
 */
router.get('/preferences', getNotificationPreferences);
router.patch('/preferences', updateNotificationPreferences);

export default router;
