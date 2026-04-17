/**
 * QUICK REFERENCE: Socket.IO Usage Examples
 * 
 * Copy-paste ready code snippets
 */

// ========================================
// 1. FRONTEND SETUP
// ========================================

// App.js or main component
import { useSocket } from './hooks/useSocket';
import NotificationCenter from './components/NotificationCenter';

function App() {
  const socket = useSocket();

  return (
    <>
      <NotificationCenter />
      {/* rest of app */}
    </>
  );
}

// ========================================
// 2. EMIT FROM FRONTEND
// ========================================

// Like a blog
const handleBlogLike = (blogId, blogTitle, blogOwnerId) => {
  socket.emit('blog:like', {
    blogId,
    blogTitle,
    blogOwnerId,
    likerName: user.name,
    likerId: user._id
  });
};

// Comment on blog
const handleBlogComment = (blogId, blogTitle, blogOwnerId, commentText) => {
  socket.emit('blog:comment', {
    blogId,
    blogTitle,
    blogOwnerId,
    commenterName: user.name,
    commenterId: user._id,
    commentText
  });
};

// Request photo purchase
const handlePhotoPurchase = (photoId, photoTitle, photoOwnerId) => {
  socket.emit('photo:purchase_request', {
    photoId,
    photoTitle,
    photoOwnerId,
    requesterName: user.name,
    requesterId: user._id,
    message: 'Interested in purchasing'
  });
};

// ========================================
// 3. LISTEN FOR NOTIFICATIONS
// ========================================

useEffect(() => {
  if (!socket) return;

  // Blog like notification
  socket.on('notification:blog_like', (data) => {
    console.log(`${data.likerName} liked your blog!`);
    showToast(data.subject);
  });

  // Blog comment notification
  socket.on('notification:blog_comment', (data) => {
    console.log(`${data.commenterName} commented!`);
    showToast(data.subject);
  });

  // Photo purchase notification
  socket.on('notification:photo_purchase', (data) => {
    console.log(`${data.requesterName} wants to buy your photo!`);
    showToast(data.subject);
  });

  // User online status
  socket.on('user:online', (data) => {
    console.log(`${data.name} is online`);
  });

  return () => {
    socket.off('notification:blog_like');
    socket.off('notification:blog_comment');
    socket.off('notification:photo_purchase');
    socket.off('user:online');
  };
}, [socket]);

// ========================================
// 4. EMIT FROM BACKEND (Controllers)
// ========================================

// In blog.controller.js
import { emitBlogLike } from '../utils/socket-emitter.util.js';
import { logBlogActivity } from '../utils/activity-logger.util.js';

export const likeBlog = async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(blogId, { $addToSet: { likes: req.user._id } });

  // Send real-time notification
  emitBlogLike(blog.userId, {
    blogId: blog._id,
    blogTitle: blog.title,
    likerName: req.user.name,
    likerId: req.user._id
  });

  // Log activity
  await logBlogActivity(req.user._id, 'liked', blogId, `Liked: ${blog.title}`);

  res.json({ success: true });
};

// In photo.controller.js
import { emitPhotoPurchaseRequest } from '../utils/socket-emitter.util.js';

export const requestPhotoPurchase = async (req, res) => {
  const photo = await Photo.findById(photoId);

  // Send notification
  emitPhotoPurchaseRequest(photo.userId, {
    photoId: photo._id,
    photoTitle: photo.title,
    requesterName: req.user.name,
    requesterId: req.user._id,
    message: req.body.message
  });

  res.json({ success: true });
};

// In auth.controller.js
import { emitNewUserRegistration } from '../utils/socket-emitter.util.js';

export const registerUser = async (req, res) => {
  const user = await User.create(userData);

  // Notify admins
  emitNewUserRegistration({
    newUserId: user._id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role
  });

  res.json({ success: true, user });
};

// ========================================
// 5. AVAILABLE EMIT FUNCTIONS
// ========================================

// From socket-emitter.util.js - use in any controller

import {
  emitBlogLike,              // (userId, data) - notify blog owner
  emitBlogComment,           // (userId, data) - notify blog owner
  emitPhotoPurchaseRequest,  // (userId, data) - notify photo owner
  emitNewUserRegistration,   // (data) - notify all admins
  emitAdminAlert,            // (data) - notify all admins
  emitToUser,                // (userId, eventName, data) - custom
  emitToAdmins,              // (eventName, data) - custom
  broadcastToAll             // (eventName, data) - broadcast everyone
} from '../utils/socket-emitter.util.js';

// ========================================
// 6. ACTIVITY LOGGING (Goes with notifications)
// ========================================

import {
  logBlogActivity,         // (userId, action, blogId, description)
  logPhotoActivity,        // (userId, action, photoId, description)
  logUserActivity,         // (userId, action, description)
  logDestinationActivity,  // (userId, action, destId, description)
  logAdminActivity         // (userId, action, description, type, resourceId)
} from '../utils/activity-logger.util.js';

// Example:
await logBlogActivity(req.user._id, 'liked', blogId, 'Liked awesome travel blog');
await logPhotoActivity(req.user._id, 'purchase_request', photoId, 'Requested to buy photo');

// ========================================
// 7. FULL EXAMPLE: Blog Like Feature
// ========================================

// BACKEND: blog.controller.js
export const likeBlog = async (req, res) => {
  try {
    const { blogId } = req.params;
    const userId = req.user._id;

    // 1. Update database
    const blog = await Blog.findByIdAndUpdate(
      blogId,
      { $addToSet: { likes: userId } },
      { new: true }
    ).select('title userId likes');

    // 2. Create notification in DB
    await Notification.create({
      userId: blog.userId,
      type: 'blog_liked',
      subject: `${req.user.name} liked your blog`,
      message: `"${blog.title}" was liked by ${req.user.name}`,
      relatedId: { blogId },
      actionBy: userId
    });

    // 3. Send real-time notification
    emitBlogLike(blog.userId, {
      blogId,
      blogTitle: blog.title,
      likerName: req.user.name,
      likerId: userId
    });

    // 4. Log activity
    await logBlogActivity(userId, 'liked', blogId, `Liked blog: ${blog.title}`);

    // 5. Return response
    res.json({
      success: true,
      message: 'Blog liked',
      likes: blog.likes.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// FRONTEND: useSocket hook
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = () => {
  const socket = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socket.current = io(process.env.REACT_APP_API_URL, {
      auth: { token }
    });

    return () => socket.current?.disconnect();
  }, []);

  return socket.current;
};

// FRONTEND: BlogPost component
function BlogPost({ blog, currentUser }) {
  const socket = useSocket();
  const [likes, setLikes] = useState(blog.likes.length);
  const [isLiked, setIsLiked] = useState(blog.likes.includes(currentUser._id));

  const handleLike = async () => {
    // 1. Update UI immediately (optimistic)
    setIsLiked(!isLiked);
    setLikes(prev => isLiked ? prev - 1 : prev + 1);

    // 2. Send to backend
    const response = await fetch(`/api/blogs/${blog._id}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      // Revert if failed
      setIsLiked(isLiked);
      setLikes(prev => isLiked ? prev + 1 : prev - 1);
    }
  };

  // Listen for notifications (someone liked blog YOU own)
  useEffect(() => {
    if (!socket) return;

    socket.on('notification:blog_like', (data) => {
      if (data.blogId === blog._id) {
        setLikes(prev => prev + 1);
        showToast(`${data.likerName} liked your blog!`);
      }
    });

    return () => socket.off('notification:blog_like');
  }, [socket, blog._id]);

  return (
    <div className="blog-post">
      <h2>{blog.title}</h2>
      <p>{blog.content}</p>
      <button 
        className={`like-btn ${isLiked ? 'liked' : ''}`}
        onClick={handleLike}
      >
        ❤️ Like ({likes})
      </button>
    </div>
  );
}

// ========================================
// 8. ADMIN NOTIFICATIONS (Example)
// ========================================

// Backend: When new user registers
import { emitNewUserRegistration } from '../utils/socket-emitter.util.js';

const newUser = await User.create(userData);
emitNewUserRegistration({
  newUserId: newUser._id,
  userName: newUser.name,
  userEmail: newUser.email
});

// Admin Dashboard component
function AdminDashboard() {
  const socket = useSocket(); // Admin's socket

  useEffect(() => {
    socket.on('notification:user_registered', (data) => {
      console.log(`New user: ${data.userName} (${data.userEmail})`);
      // Add to admin's list
    });

    return () => socket.off('notification:user_registered');
  }, [socket]);

  return <div>Admin Panel</div>;
}

// ========================================
// 9. ENVIRONMENT SETUP
// ========================================

// .env
FRONTEND_URL=http://localhost:3000
# or production
# FRONTEND_URL=https://yourdomain.com

// package.json
{
  "dependencies": {
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "socket.io-client": "^4.7.0"
  }
}

// ========================================
// 10. COMMON PATTERNS
// ========================================

// Pattern 1: Optimistic Updates
async function likePost(postId) {
  // Update UI immediately
  setIsLiked(true);
  
  // Send to server
  try {
    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  } catch (error) {
    // Revert on error
    setIsLiked(false);
  }
}

// Pattern 2: Batch Notifications
const [notifications, setNotifications] = useState([]);

socket.on('notification:new', (notif) => {
  setNotifications(prev => [notif, ...prev].slice(0, 50)); // Keep last 50
});

// Pattern 3: Sound Alert
socket.on('notification:blog_like', (data) => {
  new Audio('/sounds/notification.mp3').play();
  showToast(data.subject);
});

// Pattern 4: Notification Badge
const [unreadCount, setUnreadCount] = useState(0);

socket.on('notification:new', () => {
  setUnreadCount(prev => prev + 1);
});

// Pattern 5: Mark All as Read
const markAllAsRead = async () => {
  await fetch('/api/notifications/read-all', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  setUnreadCount(0);
};
