/**
 * WEBSOCKET SETUP GUIDE FOR REAL-TIME NOTIFICATIONS
 * 
 * Implement Socket.IO for:
 * - Blog likes (real-time)
 * - Blog comments (real-time)
 * - Photo purchase requests (real-time)
 * - New user registrations (admin only)
 */

// ========================================
// STEP 1: Install Socket.IO
// ========================================
// npm install socket.io

// ========================================
// STEP 2: Create WebSocket Handler
// ========================================
// File: src/socket/socket.handler.js

/*
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Notification from '../features/notification/notification.model.js';
import { logger } from '../utils/logger.util.js';

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // ========================
  // MIDDLEWARE: Verify JWT
  // ========================
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.email = decoded.email;
      socket.role = decoded.role;

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // ========================
  // CONNECTION HANDLER
  // ========================
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Join user-specific room for notifications
    socket.join(`user_${socket.userId}`);

    // For admins, join admin room for system notifications
    if (socket.role === 'admin' || socket.role === 'super-admin') {
      socket.join('admin');
    }

    // ========================
    // BLOG LIKE EVENT
    // ========================
    socket.on('blog:like', async (data) => {
      try {
        const { blogId, blogTitle, likerName, likerId } = data;

        // Create notification
        const notification = await Notification.create({
          userId: data.blogOwnerId,
          type: 'blog_liked',
          subject: `${likerName} liked "${blogTitle}"`,
          message: `Your blog "${blogTitle}" was liked by ${likerName}`,
          relatedId: { blogId },
          actionBy: likerId,
          read: false
        });

        // Emit to blog owner
        io.to(`user_${data.blogOwnerId}`).emit('notification:new', {
          ...notification.toObject(),
          type: 'blog_liked',
          timestamp: new Date()
        });

        logger.info('Blog liked notification sent', { 
          blogId, 
          recipient: data.blogOwnerId 
        });
      } catch (error) {
        logger.error('Blog like error:', error);
        socket.emit('error', { message: 'Failed to process like' });
      }
    });

    // ========================
    // BLOG COMMENT EVENT
    // ========================
    socket.on('blog:comment', async (data) => {
      try {
        const { blogId, blogTitle, commentText, commenterName, commenterId } = data;

        // Create notification
        const notification = await Notification.create({
          userId: data.blogOwnerId,
          type: 'blog_commented',
          subject: `${commenterName} commented on "${blogTitle}"`,
          message: `"${commenterName}" commented: "${commentText.substring(0, 50)}..."`,
          relatedId: { blogId },
          actionBy: commenterId,
          read: false
        });

        // Emit to blog owner
        io.to(`user_${data.blogOwnerId}`).emit('notification:new', {
          ...notification.toObject(),
          type: 'blog_commented',
          timestamp: new Date()
        });

        logger.info('Blog comment notification sent', { 
          blogId, 
          recipient: data.blogOwnerId 
        });
      } catch (error) {
        logger.error('Blog comment error:', error);
        socket.emit('error', { message: 'Failed to process comment' });
      }
    });

    // ========================
    // PHOTO PURCHASE REQUEST EVENT
    // ========================
    socket.on('photo:purchase', async (data) => {
      try {
        const { photoId, photoTitle, requesterName, requesterId } = data;

        // Create notification
        const notification = await Notification.create({
          userId: data.photoOwnerId,
          type: 'photo_purchase',
          subject: `${requesterName} wants to buy "${photoTitle}"`,
          message: `${requesterName} is interested in purchasing "${photoTitle}"`,
          relatedId: { photoId, userId: requesterId },
          actionBy: requesterId,
          read: false
        });

        // Emit to photo owner
        io.to(`user_${data.photoOwnerId}`).emit('notification:new', {
          ...notification.toObject(),
          type: 'photo_purchase',
          timestamp: new Date()
        });

        logger.info('Photo purchase notification sent', { 
          photoId, 
          recipient: data.photoOwnerId 
        });
      } catch (error) {
        logger.error('Photo purchase error:', error);
        socket.emit('error', { message: 'Failed to process request' });
      }
    });

    // ========================
    // NEW USER REGISTRATION (Admin notification)
    // ========================
    socket.on('user:registered', async (data) => {
      try {
        const { newUserId, userName, userEmail } = data;

        // Create notification
        const notification = await Notification.create({
          userId: process.env.ADMIN_USER_ID,
          type: 'user_registered',
          subject: 'New user registered',
          message: `${userName} (${userEmail}) just joined`,
          relatedId: { userId: newUserId },
          actionBy: newUserId,
          read: false
        });

        // Emit to all admins
        io.to('admin').emit('notification:new', {
          ...notification.toObject(),
          type: 'user_registered',
          timestamp: new Date()
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
    // DISCONNECT HANDLER
    // ========================
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

export default initializeSocket;
*/

// ========================================
// STEP 3: Integrate with Server (server.js)
// ========================================
/*
import http from 'http';
import initializeSocket from './socket/socket.handler.js';

const server = http.createServer(app);
const io = initializeSocket(server);

// Make io accessible in app
app.locals.io = io;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
*/

// ========================================
// STEP 4: Emit Events from Controllers
// ========================================
// Example: Blog Controller

/*
import { logBlogActivity } from '../../utils/activity-logger.util.js';

export const likeBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const userId = req.user._id;
    const userName = req.user.name;

    // Add like to database...
    
    // Emit real-time notification
    const io = req.app.locals.io;
    const blog = await Blog.findById(blogId).select('title userId');

    io.emit('notification:blog_like', {
      blogId,
      blogTitle: blog.title,
      likerName: userName,
      likerId: userId,
      blogOwnerId: blog.userId,
      timestamp: new Date()
    });

    // Log activity
    await logBlogActivity(userId, 'liked', blogId, `Liked blog: ${blog.title}`);

    res.json({ success: true, message: 'Blog liked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
*/

// ========================================
// STEP 5: Frontend Integration (React)
// ========================================
/*
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const socket = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    socket.current = io(process.env.REACT_APP_API_URL, {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    // ========================
    // LISTEN FOR NOTIFICATIONS
    // ========================

    socket.current.on('notification:new', (notification) => {
      setNotifications(prev => [notification, ...prev]);

      // Show toast notification
      showToast(notification.subject);
    });

    socket.current.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => socket.current.disconnect();
  }, []);

  return (
    <div className="notifications-container">
      {notifications.map((notif, index) => (
        <div key={index} className="notification-item">
          <h5>{notif.subject}</h5>
          <p>{notif.message}</p>
          <small>{new Date(notif.timestamp).toLocaleTimeString()}</small>
        </div>
      ))}
    </div>
  );
}
*/

// ========================================
// STEP 6: Socket Events Summary
// ========================================

/*
BACKEND EMITS (to frontend):
✅ notification:new         - New notification arrived
✅ error                    - Socket error

FRONTEND SENDS (to backend):
✅ blog:like                - User liked a blog
✅ blog:comment             - User commented on blog
✅ photo:purchase           - User requested photo purchase
✅ user:registered          - New user registered (auto from backend)

NOTIFICATION PAYLOADS:

Blog Like:
{
  type: 'blog_liked',
  subject: 'John liked "My Travel Story"',
  message: 'Your blog was liked by John',
  timestamp: 2026-02-28T10:30:00Z
}

Blog Comment:
{
  type: 'blog_commented',
  subject: 'Jane commented on "My Travel Story"',
  message: '"Jane" commented: "Amazing photos!"',
  timestamp: 2026-02-28T10:30:00Z
}

Photo Purchase:
{
  type: 'photo_purchase',
  subject: 'Bob wants to buy "Mountain Sunset"',
  message: 'Bob is interested in purchasing your photo',
  timestamp: 2026-02-28T10:30:00Z
}

New User (Admin only):
{
  type: 'user_registered',
  subject: 'New user registered',
  message: 'alice@example.com just joined',
  timestamp: 2026-02-28T10:30:00Z
}
*/

// ========================================
// STEP 7: Database Queries (Frontend)
// ========================================

/*
// Get notifications on page load (polling)
const getNotifications = async () => {
  const response = await fetch('/api/notifications');
  const data = await response.json();
  return data.notifications;
};

// Get unread count
const getUnreadCount = async () => {
  const response = await fetch('/api/notifications?unreadOnly=true');
  const data = await response.json();
  return data.unreadCount;
};

// Mark as read
const markAsRead = async (notificationId) => {
  await fetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
};
*/

export default {
  description: 'WebSocket setup guide for real-time notifications'
};
