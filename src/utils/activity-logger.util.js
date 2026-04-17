import Activity from '../features/activity/activity.model.js';

/**
 * Activity Logger Utility
 * Easy way to log activities throughout the app
 */

export const logActivity = async (data) => {
  try {
    await Activity.logActivity({
      userId: data.userId,
      action: data.action,
      description: data.description,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: {
        ip: data.ip,
        userAgent: data.userAgent,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        duration: data.duration,
        details: data.details
      },
      status: data.status || 'success',
      severity: data.severity || 'low'
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
    // Don't throw - don't break main functionality
  }
};

/**
 * Blog activity logger
 */
export const logBlogActivity = async (userId, action, blogId, description) => {
  await logActivity({
    userId,
    action: `blog_${action}`,
    description,
    resourceType: 'blog',
    resourceId: blogId,
    status: 'success'
  });
};

/**
 * Photo activity logger
 */
export const logPhotoActivity = async (userId, action, photoId, description) => {
  await logActivity({
    userId,
    action: `photo_${action}`,
    description,
    resourceType: 'photo',
    resourceId: photoId,
    status: 'success'
  });
};

/**
 * User activity logger
 */
export const logUserActivity = async (userId, action, description) => {
  await logActivity({
    userId,
    action: `user_${action}`,
    description,
    resourceType: 'user',
    resourceId: userId,
    status: 'success'
  });
};

/**
 * Destination activity logger
 */
export const logDestinationActivity = async (userId, action, destinationId, description) => {
  await logActivity({
    userId,
    action: `destination_${action}`,
    description,
    resourceType: 'destination',
    resourceId: destinationId,
    status: 'success'
  });
};

/**
 * Admin activity logger
 */
export const logAdminActivity = async (userId, action, description, resourceType, resourceId) => {
  await logActivity({
    userId,
    action: `admin_${action}`,
    description,
    resourceType,
    resourceId,
    severity: 'medium',
    status: 'success'
  });
};

export default {
  logActivity,
  logBlogActivity,
  logPhotoActivity,
  logUserActivity,
  logDestinationActivity,
  logAdminActivity
};
