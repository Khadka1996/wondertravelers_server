import { getIO } from '../socket/socket.handler.js';
import { logger } from './logger.util.js';

/**
 * Socket.IO Emitter Utility
 * Easy helper functions to emit notifications from anywhere in the app
 */

/**
 * Notify blog like event
 */
export const emitBlogLike = (blogOwnerId, data) => {
  try {
    const io = getIO();
    io.to(`user_${blogOwnerId}`).emit('notification:blog_like', {
      type: 'blog_liked',
      subject: `${data.likerName} liked your blog`,
      message: `"${data.blogTitle}" was liked by ${data.likerName}`,
      blogId: data.blogId,
      blogTitle: data.blogTitle,
      likerName: data.likerName,
      likerId: data.likerId,
      timestamp: new Date(),
      action: 'blog_like'
    });

    logger.info('Blog like emitted', { recipient: blogOwnerId });
  } catch (error) {
    logger.error('emitBlogLike error:', error.message);
  }
};

/**
 * Notify blog comment event
 */
export const emitBlogComment = (blogOwnerId, data) => {
  try {
    const io = getIO();
    const truncatedComment = data.commentText.substring(0, 60).trim() + 
                            (data.commentText.length > 60 ? '...' : '');

    io.to(`user_${blogOwnerId}`).emit('notification:blog_comment', {
      type: 'blog_commented',
      subject: `${data.commenterName} commented on your blog`,
      message: `"${data.commenterName}": "${truncatedComment}"`,
      blogId: data.blogId,
      blogTitle: data.blogTitle,
      commenterName: data.commenterName,
      commenterId: data.commenterId,
      commentText: truncatedComment,
      timestamp: new Date(),
      action: 'blog_comment'
    });

    logger.info('Blog comment emitted', { recipient: blogOwnerId });
  } catch (error) {
    logger.error('emitBlogComment error:', error.message);
  }
};

/**
 * Notify photo purchase request event
 */
export const emitPhotoPurchaseRequest = (photoOwnerId, data) => {
  try {
    const io = getIO();
    io.to(`user_${photoOwnerId}`).emit('notification:photo_purchase', {
      type: 'photo_purchase',
      subject: `${data.requesterName} wants to buy "${data.photoTitle}"`,
      message: `${data.requesterName} is interested in purchasing: "${data.photoTitle}"`,
      photoId: data.photoId,
      photoTitle: data.photoTitle,
      requesterName: data.requesterName,
      requesterId: data.requesterId,
      requestMessage: data.message || '',
      timestamp: new Date(),
      action: 'photo_purchase_request'
    });

    logger.info('Photo purchase request emitted', { recipient: photoOwnerId });
  } catch (error) {
    logger.error('emitPhotoPurchaseRequest error:', error.message);
  }
};

/**
 * Notify new user registration (admin only)
 */
export const emitNewUserRegistration = (data) => {
  try {
    const io = getIO();
    io.to('admin_notifications').emit('notification:user_registered', {
      type: 'user_registered',
      subject: 'New user registered',
      message: `${data.userName} (${data.userEmail}) just joined the platform`,
      newUserId: data.newUserId,
      userName: data.userName,
      userEmail: data.userEmail,
      userRole: data.userRole || 'user',
      timestamp: new Date(),
      action: 'user_registered'
    });

    logger.info('New user registration notification emitted');
  } catch (error) {
    logger.error('emitNewUserRegistration error:', error.message);
  }
};

/**
 * Notify admin alert
 */
export const emitAdminAlert = (data) => {
  try {
    const io = getIO();
    io.to('admin_notifications').emit('notification:admin_alert', {
      type: data.type || 'admin_alert',
      subject: data.title,
      message: data.message,
      severity: data.severity || 'low',
      timestamp: new Date(),
      action: 'admin_alert'
    });

    logger.warn('Admin alert emitted', { severity: data.severity });
  } catch (error) {
    logger.error('emitAdminAlert error:', error.message);
  }
};

/**
 * Send notification to specific user
 */
export const emitToUser = (userId, eventName, data) => {
  try {
    const io = getIO();
    io.to(`user_${userId}`).emit(eventName, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Custom notification emitted', { userId, event: eventName });
  } catch (error) {
    logger.error('emitToUser error:', error.message);
  }
};

/**
 * Send notification to all admins
 */
export const emitToAdmins = (eventName, data) => {
  try {
    const io = getIO();
    io.to('admin_notifications').emit(eventName, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Admin notification emitted', { event: eventName });
  } catch (error) {
    logger.error('emitToAdmins error:', error.message);
  }
};

/**
 * Broadcast to all connected clients
 */
export const broadcastToAll = (eventName, data) => {
  try {
    const io = getIO();
    io.emit(eventName, {
      ...data,
      timestamp: new Date()
    });

    logger.info('Broadcast emitted', { event: eventName });
  } catch (error) {
    logger.error('broadcastToAll error:', error.message);
  }
};

export default {
  emitBlogLike,
  emitBlogComment,
  emitPhotoPurchaseRequest,
  emitNewUserRegistration,
  emitAdminAlert,
  emitToUser,
  emitToAdmins,
  broadcastToAll
};
