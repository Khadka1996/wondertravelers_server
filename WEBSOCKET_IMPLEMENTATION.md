# WebSocket Implementation Guide

## Quick Start

### 1. Install Socket.IO

```bash
npm install socket.io socket.io-client
# or with yarn
yarn add socket.io socket.io-client
```

### 2. Server is Ready! ✅

- Socket handler: `/server/src/socket/socket.handler.js`
- Socket emitter: `/server/src/utils/socket-emitter.util.js`
- Integrated in: `/server/src/server.js`

The server automatically initializes Socket.IO on startup.

---

## Server API

### Events Your Frontend Can Send

#### Blog Like (from frontend)
```javascript
socket.emit('blog:like', {
  blogId: blogId,
  blogTitle: 'My awesome blog',
  blogOwnerId: ownerId,
  likerName: 'Subash Thapa',
  likerId: currentUserId
});
```

#### Blog Comment (from frontend)
```javascript
socket.emit('blog:comment', {
  blogId: blogId,
  blogTitle: 'My awesome blog',
  blogOwnerId: ownerId,
  commenterName: 'Subash Thapa',
  commenterId: currentUserId,
  commentText: 'Great article!'
});
```

#### Photo Purchase Request (from frontend)
```javascript
socket.emit('photo:purchase_request', {
  photoId: photoId,
  photoTitle: 'Mountain Sunset',
  photoOwnerId: ownerId,
  requesterName: 'Subash Thapa',
  requesterId: currentUserId,
  message: 'I want to use this for commercial purposes'
});
```

#### New User Registration (from backend - auth controller)
```javascript
// Automatically handled in backend
// Just emit from auth.controller.js when user registers

import { emitNewUserRegistration } from '../utils/socket-emitter.util.js';

// After successful registration:
await emitNewUserRegistration({
  newUserId: user._id,
  userName: user.name,
  userEmail: user.email,
  userRole: user.role
});
```

---

## Frontend Integration

### 1. Install Socket.IO Client

```bash
npm install socket.io-client
# or with yarn
yarn add socket.io-client
```

### 2. Create Socket Hook

```jsx
// hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = () => {
  const socket = useRef(null);

  useEffect(() => {
    // Get token from localStorage or auth context
    const token = localStorage.getItem('token');

    if (!token) {
      console.warn('No token found for Socket.IO connection');
      return;
    }

    // Connect to Socket.IO server
    socket.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Connection events
    socket.current.on('connection:success', (data) => {
      console.log('✅ Connected to notification server', data);
    });

    socket.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.current.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  return socket.current;
};
```

### 3. Use In Component

```jsx
import { useSocket } from '../hooks/useSocket';
import { useEffect, useState } from 'react';

export default function BlogDetailPage({ blogId, blogOwnerId }) {
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);

  // Like blog
  const handleLikeBlog = async () => {
    if (!socket) return;

    socket.emit('blog:like', {
      blogId: blogId,
      blogTitle: 'Blog Title Here',
      blogOwnerId: blogOwnerId,
      likerName: user.name,
      likerId: user._id
    });

    // Also send like to backend API
    await fetch(`/api/blogs/${blogId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  // Comment on blog
  const handleCommentBlog = async (commentText) => {
    if (!socket) return;

    socket.emit('blog:comment', {
      blogId: blogId,
      blogTitle: 'Blog Title Here',
      blogOwnerId: blogOwnerId,
      commenterName: user.name,
      commenterId: user._id,
      commentText: commentText
    });

    // Also send comment to backend API
    await fetch(`/api/blogs/${blogId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text: commentText })
    });
  };

  // Photo purchase request
  const handleRequestPhotoPurchase = async (photoId, photoTitle, photoOwnerId) => {
    if (!socket) return;

    socket.emit('photo:purchase_request', {
      photoId: photoId,
      photoTitle: photoTitle,
      photoOwnerId: photoOwnerId,
      requesterName: user.name,
      requesterId: user._id,
      message: 'I want to buy this photo'
    });

    // Also send request to backend API
    await fetch(`/api/photos/${photoId}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ buyerMessage: 'I want to buy this photo' })
    });
  };

  // Listen for incoming notifications
  useEffect(() => {
    if (!socket) return;

    // Listen for blog like notification
    socket.on('notification:blog_like', (notification) => {
      console.log('Someone liked your blog:', notification);
      setNotifications(prev => [notification, ...prev]);
      showToast(notification.subject);
    });

    // Listen for blog comment notification
    socket.on('notification:blog_comment', (notification) => {
      console.log('Someone commented on your blog:', notification);
      setNotifications(prev => [notification, ...prev]);
      showToast(notification.subject);
    });

    // Listen for photo purchase request notification
    socket.on('notification:photo_purchase', (notification) => {
      console.log('Someone wants to buy your photo:', notification);
      setNotifications(prev => [notification, ...prev]);
      showToast(notification.subject);
    });

    // Listen for user online status
    socket.on('user:online', (data) => {
      console.log(`${data.name} is now online`, data);
    });

    socket.on('user:offline', (data) => {
      console.log(`User ${data.userId} is offline`, data);
    });

    return () => {
      socket.off('notification:blog_like');
      socket.off('notification:blog_comment');
      socket.off('notification:photo_purchase');
      socket.off('user:online');
      socket.off('user:offline');
    };
  }, [socket]);

  return (
    <div>
      <button onClick={handleLikeBlog}>Like Blog</button>
      <button onClick={() => handleCommentBlog('Great post!')}>Comment</button>
      
      <div className="notifications">
        {notifications.map((notif, i) => (
          <div key={i} className="notification">
            <h5>{notif.subject}</h5>
            <p>{notif.message}</p>
            <small>{new Date(notif.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. Notification Center Component

```jsx
import { useSocket } from '../hooks/useSocket';
import { useEffect, useState } from 'react';

export default function NotificationCenter() {
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load initial notifications on mount (polling)
    fetchInitialNotifications();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for all notification types
    socket.on('notification:blog_like', addNotification);
    socket.on('notification:blog_comment', addNotification);
    socket.on('notification:photo_purchase', addNotification);
    socket.on('notification:user_registered', addNotification);
    socket.on('notification:admin_alert', addNotification);

    return () => {
      socket.off('notification:blog_like');
      socket.off('notification:blog_comment');
      socket.off('notification:photo_purchase');
      socket.off('notification:user_registered');
      socket.off('notification:admin_alert');
    };
  }, [socket]);

  const fetchInitialNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show toast
    showToast(notification.subject, 'info');
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      // Also emit to socket
      if (socket) {
        socket.emit('notification:read', { notificationId });
      }

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  return (
    <div className="notification-center">
      <h3>Notifications {unreadCount > 0 && <span className="badge">{unreadCount}</span>}</h3>
      
      <div className="notification-list">
        {notifications.length === 0 ? (
          <p className="empty">No notifications yet</p>
        ) : (
          notifications.map((notif, i) => (
            <div key={i} className="notification-item">
              <div className="notification-header">
                <h5>{notif.subject}</h5>
                <button onClick={() => markAsRead(notif._id)} className="btn-small">
                  Mark as read
                </button>
              </div>
              <p>{notif.message}</p>
              <small>{new Date(notif.timestamp).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Backend Integration Examples

### Blog Controller - On Like/Comment

```javascript
// blog.controller.js
import { emitBlogLike, emitBlogComment } from '../utils/socket-emitter.util.js';
import { logBlogActivity } from '../utils/activity-logger.util.js';

export const likeBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const userId = req.user._id;

    // Add like to database...
    const blog = await Blog.findByIdAndUpdate(
      blogId,
      { $addToSet: { likes: userId } },
      { new: true }
    ).select('title userId likes');

    // Emit real-time notification
    emitBlogLike(blog.userId, {
      blogId: blog._id,
      blogTitle: blog.title,
      likerName: req.user.name,
      likerId: userId
    });

    // Log activity
    await logBlogActivity(userId, 'liked', blogId, `Liked blog: ${blog.title}`);

    res.json({
      success: true,
      message: 'Blog liked',
      likes: blog.likes.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const commentBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    // Add comment to database...
    const comment = await Comment.create({
      blogId,
      userId,
      text,
      createdAt: new Date()
    });

    const blog = await Blog.findById(blogId).select('title userId');

    // Emit real-time notification
    emitBlogComment(blog.userId, {
      blogId: blog._id,
      blogTitle: blog.title,
      commenterName: req.user.name,
      commenterId: userId,
      commentText: text
    });

    // Log activity
    await logBlogActivity(userId, 'commented', blogId, `Commented on blog: ${blog.title}`);

    res.status(201).json({
      success: true,
      message: 'Comment added',
      comment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

### Photo Controller - On Purchase Request

```javascript
// photo.controller.js
import { emitPhotoPurchaseRequest } from '../utils/socket-emitter.util.js';
import { logPhotoActivity } from '../utils/activity-logger.util.js';

export const requestPhotoPurchase = async (req, res) => {
  try {
    const { photoId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    const photo = await Photo.findById(photoId).select('title userId');

    // Create purchase request in database...
    const purchaseRequest = await PhotoPurchaseRequest.create({
      photoId,
      buyerId: userId,
      sellerIds: photo.userId,
      message,
      status: 'pending'
    });

    // Emit real-time notification
    emitPhotoPurchaseRequest(photo.userId, {
      photoId: photo._id,
      photoTitle: photo.title,
      requesterName: req.user.name,
      requesterId: userId,
      message
    });

    // Log activity
    await logPhotoActivity(userId, 'purchase_request', photoId, `Requested purchase of: ${photo.title}`);

    res.status(201).json({
      success: true,
      message: 'Purchase request sent',
      request: purchaseRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

### Auth Controller - On New User Registration

```javascript
// auth.controller.js
import { emitNewUserRegistration } from '../utils/socket-emitter.util.js';
import { logUserActivity } from '../utils/activity-logger.util.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Create user...
    const user = new User({ name, email, password });
    await user.save();

    // Emit notification to admins
    emitNewUserRegistration({
      newUserId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role
    });

    // Log activity
    await logUserActivity(user._id, 'register', `User registered: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

---

## Environment Variables

Add to `.env`:

```env
# WebSocket
FRONTEND_URL=http://localhost:3000
# or for production
# FRONTEND_URL=https://yourdomain.com
```

---

## Testing WebSocket

### Using WebSocket Client Library

```bash
npm install -g wscat
```

Connect to WebSocket:
```bash
wscat -c "ws://localhost:5000?token=YOUR_JWT_TOKEN"
```

Send test message:
```
{"type":"blog:like","data":{"blogId":"123","blogOwnerId":"456","likerName":"Test User","likerId":"789"}}
```

### PostMan (if using WebSocket plugin)

1. Create new WebSocket request
2. URL: `ws://localhost:5000`
3. Add auth header with JWT token
4. Send events as JSON

---

## Features

✅ Real-time blog likes  
✅ Real-time blog comments  
✅ Real-time photo purchase requests  
✅ Real-time user registration alerts (admin)  
✅ Online/offline status tracking  
✅ Automatic reconnection  
✅ JWT authentication  
✅ Room-based messaging (user-specific & admin room)  
✅ Activity logging  
✅ Error handling  

---

## Production Deployment

### Using PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'travel-api',
      script: './src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log'
    }
  ]
};
```

Run:
```bash
pm2 start ecosystem.config.js
```

### Using Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "src/server.js"]
```

---

## Troubleshooting

### Connection Refused
- Ensure server is running
- Check `FRONTEND_URL` env variable
- Verify JWT token is valid

### Token Invalid
- Token expired? Refresh it
- Check JWT_SECRET matches backend

### No Notifications Received
- Check browser console for errors
- Verify socket listener is attached
- Check server logs for emission errors

### Memory Leaks
- Socket .off() all listeners on unmount
- Check Socket.IO version compatibility
- Monitor with `node --inspect`

---

Done! WebSocket is production-ready! 🚀
