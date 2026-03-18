import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.util.js';

let io = null;
const connectedUsers = new Map(); // Track online users

/**
 * Initialize Socket.IO
 */
export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
    maxHttpBufferSize: 1e6, // 1MB
    allowEIO3: true
  });

  // ========================
  // MIDDLEWARE: JWT Verification
  // ========================
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn('Socket connection attempt without token', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.id;
      socket.email = decoded.email;
      socket.role = decoded.role;
      socket.name = decoded.name;

      next();
    } catch (error) {
      logger.warn('Invalid socket token', {
        socketId: socket.id,
        error: error.message
      });
      next(new Error('Invalid token: ' + error.message));
    }
  });

  // ========================
  // CONNECTION HANDLER
  // ========================
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Track user connection
    connectedUsers.set(userId, socket.id);

    logger.info('User connected', {
      userId,
      socketId: socket.id,
      email: socket.email,
      role: socket.role,
      totalUsers: connectedUsers.size
    });

    // ========================
    // USER-SPECIFIC ROOMS
    // ========================
    // Join personal notification room
    socket.join(`user_${userId}`);

    // Join admin room if user is admin
    if (socket.role === 'admin' || socket.role === 'super-admin') {
      socket.join('admin_notifications');
      socket.join(`admin_${userId}`);
    }

    // ========================
    // EMIT: User Online Status
    // ========================
    socket.emit('connection:success', {
      message: 'Connected to notification server',
      userId,
      socketId: socket.id,
      timestamp: new Date()
    });

    // Broadcast user online to others
    io.emit('user:online', {
      userId,
      name: socket.name,
      email: socket.email,
      timestamp: new Date(),
      onlineCount: connectedUsers.size
    });

    // ========================
    // HANDLE: Blog Like Notification
    // ========================
    socket.on('blog:like', (data) => {
      try {
        const { blogId, blogTitle, blogOwnerId, likerName, likerId } = data;

        if (!blogOwnerId || !blogId) {
          socket.emit('error', { message: 'Missing blog data' });
          return;
        }

        // Send notification to blog owner
        io.to(`user_${blogOwnerId}`).emit('notification:blog_like', {
          type: 'blog_liked',
          subject: `${likerName} liked your blog`,
          message: `"${blogTitle}" was liked by ${likerName}`,
          blogId,
          blogTitle,
          likerName,
          likerId,
          timestamp: new Date(),
          action: 'blog_like'
        });

        logger.info('Blog like notification sent', {
          recipient: blogOwnerId,
          blogger: likerName
        });
      } catch (error) {
        logger.error('Blog like error:', error);
        socket.emit('error', { message: 'Failed to process like' });
      }
    });

    // ========================
    // HANDLE: Blog Comment Notification
    // ========================
    socket.on('blog:comment', (data) => {
      try {
        const { blogId, blogTitle, blogOwnerId, commenterName, commenterId, commentText } = data;

        if (!blogOwnerId || !blogId) {
          socket.emit('error', { message: 'Missing blog data' });
          return;
        }

        // Limit comment text in notification
        const truncatedComment = commentText.substring(0, 60).trim() + (commentText.length > 60 ? '...' : '');

        // Send notification to blog owner
        io.to(`user_${blogOwnerId}`).emit('notification:blog_comment', {
          type: 'blog_commented',
          subject: `${commenterName} commented on your blog`,
          message: `"${commenterName}": "${truncatedComment}"`,
          blogId,
          blogTitle,
          commenterName,
          commenterId,
          commentText: truncatedComment,
          timestamp: new Date(),
          action: 'blog_comment'
        });

        logger.info('Blog comment notification sent', {
          recipient: blogOwnerId,
          commenter: commenterName
        });
      } catch (error) {
        logger.error('Blog comment error:', error);
        socket.emit('error', { message: 'Failed to process comment' });
      }
    });

    // ========================
    // HANDLE: Photo Purchase Request
    // ========================
    socket.on('photo:purchase_request', (data) => {
      try {
        const { photoId, photoTitle, photoOwnerId, requesterName, requesterId, message } = data;

        if (!photoOwnerId || !photoId) {
          socket.emit('error', { message: 'Missing photo data' });
          return;
        }

        // Send notification to photo owner
        io.to(`user_${photoOwnerId}`).emit('notification:photo_purchase', {
          type: 'photo_purchase',
          subject: `${requesterName} wants to buy "${photoTitle}"`,
          message: `${requesterName} is interested in purchasing your photo: "${photoTitle}"`,
          photoId,
          photoTitle,
          requesterName,
          requesterId,
          requestMessage: message || '',
          timestamp: new Date(),
          action: 'photo_purchase_request'
        });

        logger.info('Photo purchase notification sent', {
          recipient: photoOwnerId,
          requester: requesterName
        });
      } catch (error) {
        logger.error('Photo purchase error:', error);
        socket.emit('error', { message: 'Failed to process request' });
      }
    });

    // ========================
    // HANDLE: New User Registration (Admin Only)
    // ========================
    socket.on('admin:new_user_registered', (data) => {
      try {
        const { newUserId, userName, userEmail, userRole } = data;

        if (!newUserId || !userName) {
          socket.emit('error', { message: 'Missing user data' });
          return;
        }

        // Send notification only to admins
        io.to('admin_notifications').emit('notification:user_registered', {
          type: 'user_registered',
          subject: 'New user registered',
          message: `${userName} (${userEmail}) just joined the platform`,
          newUserId,
          userName,
          userEmail,
          userRole: userRole || 'user',
          timestamp: new Date(),
          action: 'user_registered'
        });

        logger.info('New user notification sent to admins', {
          newUserId,
          email: userEmail
        });
      } catch (error) {
        logger.error('New user notification error:', error);
      }
    });

    // ========================
    // HANDLE: Generic Admin Alert
    // ========================
    socket.on('admin:alert', (data) => {
      try {
        if (!socket.role || (socket.role !== 'admin' && socket.role !== 'super-admin')) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const { title, message, severity = 'low', type } = data;

        io.to('admin_notifications').emit('notification:admin_alert', {
          type: type || 'admin_alert',
          subject: title,
          message,
          severity,
          timestamp: new Date(),
          action: 'admin_alert'
        });

        logger.warn('Admin alert sent', {
          sentBy: socket.email,
          severity,
          message
        });
      } catch (error) {
        logger.error('Admin alert error:', error);
        socket.emit('error', { message: 'Failed to send alert' });
      }
    });

    // ========================
    // HANDLE: Mark Notification as Read
    // ========================
    socket.on('notification:read', (data) => {
      try {
        const { notificationId } = data;

        // In production, update notification in DB here
        logger.info('Notification marked as read', {
          userId,
          notificationId
        });

        // Confirm to client
        socket.emit('notification:read_confirmed', {
          notificationId,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Mark read error:', error);
      }
    });

    // ========================
    // HANDLE: Is User Online Check
    // ========================
    socket.on('user:check_online', (data) => {
      try {
        const { targetUserId } = data;
        const isOnline = connectedUsers.has(targetUserId);

        socket.emit('user:online_status', {
          userId: targetUserId,
          isOnline,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Check online error:', error);
      }
    });

    // ========================
    // HANDLE: User Typing (for comments)
    // ========================
    socket.on('user:typing', (data) => {
      try {
        const { targetRoom, isTyping } = data;

        io.to(targetRoom).emit('user:typing_notification', {
          userId,
          userName: socket.name,
          isTyping,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Typing notification error:', error);
      }
    });

    // ========================
    // HANDLE: Disconnect
    // ========================
    socket.on('disconnect', () => {
      connectedUsers.delete(userId);

      logger.info('User disconnected', {
        userId,
        socketId: socket.id,
        totalUsers: connectedUsers.size
      });

      // Broadcast user offline
      io.emit('user:offline', {
        userId,
        timestamp: new Date(),
        onlineCount: connectedUsers.size
      });
    });

    // ========================
    // HANDLE: Connection Errors
    // ========================
    socket.on('error', (error) => {
      logger.error('Socket error', {
        userId,
        socketId: socket.id,
        error: error.message
      });
    });
  });

  logger.info('Socket.IO initialized successfully');
  return io;
};

/**
 * Get Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
};

/**
 * Get online users count
 */
export const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Check if user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

export default { initializeSocket, getIO, getOnlineUsersCount, isUserOnline };
