# ⚡ WebSocket Implementation - Quick Reference Card

**Print this page or keep it open while implementing!**

---

## 📋 Frontend Implementation Checklist

### Step 1: Install Package
```bash
npm install socket.io-client
```
- [ ] Done?

### Step 2: Create Hook
File: `client/src/hooks/useSocket.js`
```javascript
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = () => {
  const socket = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    socket.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token }
    });

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  return socket.current;
};
```
- [ ] Created?

### Step 3: Add to App Root
File: `client/src/app/layout.tsx`
```tsx
'use client';
import { useSocket } from '@/hooks/useSocket';

export default function RootLayout({ children }) {
  useSocket();
  return <html><body>{children}</body></html>;
}
```
- [ ] Added?

### Step 4: Update Blog Component
File: `client/src/app/blog/[id]/page.tsx`

**Listen for notifications:**
```tsx
const socket = useSocket();

useEffect(() => {
  if (!socket) return;

  socket.on('notification:blog_like', (data) => {
    showToast(`${data.likerName} liked "${data.blogTitle}"`);
  });

  socket.on('notification:blog_comment', (data) => {
    showToast(`${data.commenterName} commented on your blog`);
  });

  return () => {
    socket.off('notification:blog_like');
    socket.off('notification:blog_comment');
  };
}, [socket]);
```
- [ ] Added listeners?

**Emit like event:**
```tsx
const handleLike = async () => {
  await fetch(`/api/blogs/${id}/like`, { method: 'POST' });
  
  if (socket) {
    socket.emit('blog:like', {
      blogId: id,
      blogTitle: blog.title,
      blogOwnerId: blog.userId,
      likerName: user.name,
      likerId: user._id
    });
  }
};
```
- [ ] Added like emit?

**Emit comment event:**
```tsx
const handleSubmitComment = async (text) => {
  const response = await fetch(`/api/blogs/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content: text })
  });

  if (socket && response.ok) {
    socket.emit('blog:comment', {
      blogId: id,
      blogTitle: blog.title,
      blogOwnerId: blog.userId,
      commenterName: user.name,
      commenterId: user._id,
      commentText: text
    });
  }
};
```
- [ ] Added comment emit?

### Step 5: Update Photo Component
File: `client/src/app/pictures/[id]/page.tsx`

**Listen for requests:**
```tsx
useEffect(() => {
  if (!socket) return;

  socket.on('notification:photo_purchase', (data) => {
    showToast(`${data.requesterName} wants to buy "${data.photoTitle}"`);
  });

  return () => socket.off('notification:photo_purchase');
}, [socket]);
```
- [ ] Added listener?

**Emit purchase request:**
```tsx
const handlePurchaseRequest = async (message) => {
  const response = await fetch(`/api/photos/${id}/purchase-request`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });

  if (socket && response.ok) {
    socket.emit('photo:purchase_request', {
      photoId: id,
      photoTitle: photo.title,
      photoOwnerId: photo.uploadedBy,
      requesterName: user.name,
      requesterId: user._id,
      requestMessage: message
    });
  }
};
```
- [ ] Added emit?

### Step 6: Update Blog Controller (Backend)
File: `server/src/features/blog/blog.controller.js`

**Add imports at top:**
```javascript
import { logBlogActivity } from '../../utils/activity-logger.util.js';
```
- [ ] Import added?

**In likeBlog function:**
```javascript
export const likeBlog = async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(req.params.blogId, {
    $push: { likedBy: req.user._id }
  }, { new: true });

  // Add this:
  await logBlogActivity(req.user._id, 'liked', blog._id, `Liked: "${blog.title}"`);

  res.json(blog);
};
```
- [ ] Like logging added?

**In createComment function:**
```javascript
export const createComment = async (req, res) => {
  const comment = new Comment({
    blogId: req.params.blogId,
    userId: req.user._id,
    content: req.body.content
  });

  await comment.save();

  // Add this:
  await logBlogActivity(req.user._id, 'commented', req.params.blogId, `Commented on blog`);

  res.json(comment);
};
```
- [ ] Comment logging added?

### Step 7: Update Photo Controller (Backend)
File: `server/src/features/photo/photo.controller.js`

**Add import:**
```javascript
import { logPhotoActivity } from '../../utils/activity-logger.util.js';
```
- [ ] Import added?

**In purchase request function:**
```javascript
export const requestPhotoPurchase = async (req, res) => {
  const request = new PhotoRequest({
    photoId: req.params.photoId,
    buyerId: req.user._id,
    message: req.body.message
  });

  await request.save();

  // Add this:
  await logPhotoActivity(req.user._id, 'purchase_request', req.params.photoId, 'Purchase request sent');

  res.json(request);
};
```
- [ ] Photo logging added?

### Step 8: Test Everything
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

**In browser:**
1. Open DevTools → Network → Filter "WS"
2. Should see WebSocket connection
3. Try liking a blog
4. Should see console log in other tab
  - [ ] WebSocket connected?
  - [ ] Like event sent?
  - [ ] Notification received?

---

## 📊 Event Formats Reference

### Blog Like Event
**Send from frontend:**
```javascript
socket.emit('blog:like', {
  blogId: string,
  blogTitle: string,
  blogOwnerId: string,
  likerName: string,
  likerId: string
});
```

**Receive on blog owner's frontend:**
```javascript
socket.on('notification:blog_like', (data) => {
  // data.likerName - who liked
  // data.blogTitle - which blog
  // data.subject - formatted subject
  // data.message - formatted message
});
```

### Blog Comment Event
**Send from frontend:**
```javascript
socket.emit('blog:comment', {
  blogId: string,
  blogTitle: string,
  blogOwnerId: string,
  commenterName: string,
  commenterId: string,
  commentText: string
});
```

**Receive on blog owner's frontend:**
```javascript
socket.on('notification:blog_comment', (data) => {
  // data.commenterName - who commented
  // data.commentText - comment content (truncated)
  // data.blogTitle - which blog
  // data.subject - formatted subject
  // data.message - formatted message
});
```

### Photo Purchase Event
**Send from frontend:**
```javascript
socket.emit('photo:purchase_request', {
  photoId: string,
  photoTitle: string,
  photoOwnerId: string,
  requesterName: string,
  requesterId: string,
  requestMessage: string
});
```

**Receive on photo owner's frontend:**
```javascript
socket.on('notification:photo_purchase', (data) => {
  // data.requesterName - who requested
  // data.photoTitle - which photo
  // data.requestMessage - message from requester
  // data.subject - formatted subject
  // data.message - formatted message
});
```

---

## 🔧 Common Commands

### Start Development
```bash
# Backend (in /server)
npm run dev

# Frontend (in /client)
npm run dev
```

### Test Socket Connection
```javascript
// In browser console
console.log('Connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

### View Database Activities
```bash
# From browser (as admin)
fetch('/api/activities?limit=20')
  .then(r => r.json())
  .then(data => console.table(data));
```

### Manual Test
```javascript
// In browser console (after socket connects)
socket.emit('blog:like', {
  blogId: 'test-123',
  blogTitle: 'Test Blog',
  blogOwnerId: 'owner-123',
  likerName: 'Tester',
  likerId: 'user-123'
});
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Socket doesn't connect | Check token in localStorage, backend running |
| Event doesn't arrive | Check WebSocket in DevTools, verify socket.connected |
| Notification not shown | Check browser console for errors |
| Activity not logged | Verify logActivity import and call in controller |
| Server won't start | Check port 5000 not in use, npm dependencies |
| Can't find imports | Check file paths are correct (relative paths) |

---

## 📚 Documentation Files

- **WEBSOCKET_QUICK_START.md** → Full tutorial
- **WEBSOCKET_QUICK_REFERENCE.md** → Code snippets
- **WEBSOCKET_VERIFICATION.md** → Checklist
- **WEBSOCKET_IMPLEMENTATION.md** → Detailed guide
- **WEBSOCKET_COMPLETE.md** → System overview
- **WEBSOCKET_DOCUMENTATION_INDEX.md** → Navigation

---

## ✅ Final Checklist

- [ ] socket.io-client installed
- [ ] useSocket hook created
- [ ] App root calls useSocket()
- [ ] Blog component listens for notifications
- [ ] Blog component emits like event
- [ ] Blog component emits comment event
- [ ] Photo component listens for notifications
- [ ] Photo component emits purchase request
- [ ] Blog controller logs like activity
- [ ] Blog controller logs comment activity
- [ ] Photo controller logs purchase request
- [ ] Backend running without errors
- [ ] Frontend WebSocket connected
- [ ] Test like/comment/purchase works
- [ ] Activities logged in database

**All done? You're finished! 🎉**

---

## 🚀 Performance Tips

✅ **Do:**
- Use optimistic UI updates
- Debounce rapid events
- Handle reconnection gracefully
- Test on slow networks

❌ **Don't:**
- Emit before DB update
- Poll instead of using WebSocket
- Send large payloads
- Forget to cleanup listeners

---

**Last Updated:** 2026-02-28  
**Print & Keep Handy** 📍
