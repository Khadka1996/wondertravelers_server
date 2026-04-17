import Notification from './notification.model.js';
import { AppError } from '../../utils/errors.util.js';

/**
 * GET /api/notifications
 * Get user notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user._id;

    const skip = (page - 1) * limit;
    
    const query = { userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(userId);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
 */
export const getNotificationPreferences = async (req, res, next) => {
  try {
    const User = (await import('../auth/auth.model.js')).User;
    const user = await User.findById(req.user._id).select('notificationPreferences');
    const prefs = user?.notificationPreferences || {};
    res.status(200).json({ status: 'success', data: prefs });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/preferences
 * Update current user's notification preferences (partial)
 */
export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const updates = req.body;
    const User = (await import('../auth/auth.model.js')).User;
    const user = await User.findById(req.user._id).select('notificationPreferences');
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    user.notificationPreferences = Object.assign({}, user.notificationPreferences || {}, updates);
    await user.save();

    res.status(200).json({ status: 'success', message: 'Notification preferences updated', data: user.notificationPreferences });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.status(200).json({
      status: 'success',
      data: { unreadCount }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/:notificationId
 * Get single notification
 */
export const getNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification || !notification.userId.equals(userId)) {
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: notification
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/:notificationId/read
 * Mark notification as read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification || !notification.userId.equals(userId)) {
      return next(new AppError('Notification not found', 404));
    }

    await notification.markAsRead();

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: notification
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications as read
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:notificationId
 * Delete notification
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(notificationId);

    if (!notification || !notification.userId.equals(userId)) {
      return next(new AppError('Notification not found', 404));
    }

    await Notification.findByIdAndDelete(notificationId);

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/clear-all
 * Delete all notifications for user
 */
export const clearAllNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ userId });

    res.status(200).json({
      status: 'success',
      message: 'All notifications cleared'
    });
  } catch (err) {
    next(err);
  }
};
