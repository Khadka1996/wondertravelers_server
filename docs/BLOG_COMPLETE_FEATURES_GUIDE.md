# Blog System - Complete Feature Guide

> **Last Updated:** February 27, 2026  
> **Status:** ✅ Fully Implemented & Production Ready

---

## 📋 Table of Contents

1. [Draft, Scheduled & Archived Features](#draft-scheduled--archived)
2. [Like & Comment Features (Facebook-style)](#engagement-likes--comments)
3. [Trending Content Updates](#trending-content-updates)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Database Schema](#database-schema)
6. [Usage Examples](#usage-examples)

---

## Draft, Scheduled & Archived Features

### 1️⃣ **DRAFT Blogs** 📝

Draft blogs are blogs that are **not yet published** and are only visible to the author.

**Features:**
- Save incomplete blogs
- Edit drafts anytime
- Multi-author drafts (each author has their own)
- Auto-save capability with timestamps
- Can be scheduled or published directly from draft

**Database Fields:**
```javascript
{
  status: 'draft',           // Must be 'draft'
  publishedAt: null,         // No publish date until published
  updatedAt: Date,           // Last edited time
  isScheduled: false,        // Not scheduled yet
  content: String,           // Can be incomplete
  title: String
}
```

**Creating a Draft Blog:**
```bash
POST /api/blogs
{
  "title": "My Draft Article",
  "content": "<p>Still working on this...</p>",
  "author": "user_id",
  "category": "category_id",
  "type": "blog",
  "status": "draft"           # Setting to draft
}
```

**Get All Draft Blogs (Author Only):**
```bash
GET /api/blogs/drafts
# Optional query params:
# ?authorId=user_id
# ?limit=20

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "My Draft Article",
      "slug": "my-draft-article",
      "author": { "name": "Subash Thapa", "avatar": "..." },
      "category": { "name": "Technology", "slug": "tech" },
      "updatedAt": "2026-02-27T10:30:00Z",
      "status": "📝 Draft"
    }
  ],
  "message": "Found 5 draft blog(s)"
}
```

---

### 2️⃣ **SCHEDULED Blogs** ⏰

Schedule blogs to publish automatically at a future date/time. Perfect for content calendars!

**Features:**
- Set future publish date
- Auto-publish without manual intervention
- Cron job checks every 5 minutes for scheduled blogs
- Visible only to authors (not public)
- Can be unscheduled and moved back to draft

**Database Fields:**
```javascript
{
  status: 'scheduled',           // Must be 'scheduled'
  scheduledFor: Date,            // Future date/time to publish
  isScheduled: true,             // Flag for quick filtering
  publishedAt: null,             // Set to now when published
  updatedAt: Date
}
```

**Schedule a Blog:**
```bash
POST /api/blogs/:blogId/schedule
Content-Type: application/json

{
  "publishDate": "2026-03-15T10:00:00Z"    # ISO 8601 format
}

Response:
{
  "success": true,
  "message": "Blog scheduled successfully",
  "data": {
    "_id": "...",
    "title": "Scheduled Blog",
    "status": "⏰ Scheduled",
    "scheduledFor": "2026-03-15T10:00:00Z",
    "isScheduled": true
  }
}
```

**Get All Scheduled Blogs:**
```bash
GET /api/blogs/scheduled
# Optional:
# ?authorId=user_id

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Article to publish tomorrow",
      "author": { "name": "Jane Doe" },
      "scheduledFor": "2026-02-28T09:00:00Z",
      "status": "⏰ Scheduled"
    }
  ]
}
```

**Auto-Publishing System:**
```
┌─ Cron Job (Every 5 minutes)
│  └─ Checks for blogs where:
│     • status = 'scheduled'
│     • scheduledFor <= now
│  └─ Automatically publishes them:
│     • status → 'published'
│     • publishedAt → now
│     • isScheduled → false
│
│  Log entry: "📅 Blog Scheduler: Published 3 scheduled blog(s)"
└─ Invalidates cache for all blog queries
```

---

### 3️⃣ **ARCHIVED Blogs** 📦

Archive old blogs instead of deleting them. Keep them for records but hide from public.

**Features:**
- Hide blogs from public listing
- Keep all blog data intact
- Searchable/filterable archive
- Can be restored by moving back to published/draft
- Useful for content pruning

**Database Fields:**
```javascript
{
  status: 'archived',        // Must be 'archived'
  publishedAt: Date,         // Previously published date
  updatedAt: Date,
  isScheduled: false
}
```

**Archive a Blog:**
```bash
PUT /api/blogs/:blogId/archive

Response:
{
  "success": true,
  "message": "Blog archived successfully",
  "data": {
    "_id": "...",
    "title": "Old Article",
    "status": "📦 Archived"
  }
}
```

**Get Archived Blogs:**
```bash
GET /api/blogs/archived
# Optional:
# ?authorId=user_id
# ?limit=20

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "2024 News Article",
      "publishedAt": "2024-06-15T...",
      "status": "📦 Archived"
    }
  ]
}
```

**Blog Status Lifecycle:**
```
┌─────────────┐
│   CREATE    │ New blog
└──────┬──────┘
       │
       ▼
   ┌─────────────┬─────────────────┐
   │             │                 │
   ▼             ▼                 ▼
┌────────┐  ┌──────────┐  ┌───────────────┐
│ Draft  │  │Scheduled │  │ Published     │
│ (Edit) │  │(Auto-pub)│  │(Public View)  │
└────────┘  └──────────┘  └───────────────┘
   │             │                 │
   └──────┬──────┴─────────────────┘
          │
          ▼
     ┌──────────┐
     │ Archived │
     │(Hidden)  │
     └──────────┘
```

---

## Engagement: Likes & Comments

### 📌 **LIKE System** (Facebook-style)

Users can like blogs just like on Facebook!

**Features:**
- Toggle like/unlike
- Real-time like counts
- User-specific like tracking
- Engagement metrics tracking
- Cache invalidation on like

**Database Fields:**
```javascript
{
  likes: ["userId1", "userId2", ...],    // Array of user IDs who liked
  likesCount: 45,                         // Denormalized for fast queries
}
```

**Like a Blog:**
```bash
POST /api/blogs/:blogId/like
Authorization: Bearer token

Body (optional, auto-uses logged-in user):
{
  "userId": "user_id"  # Or use from JWT token
}

Response:
{
  "success": true,
  "message": "Blog liked",
  "data": {
    "liked": true,           # true if just liked, false if unliked
    "likesCount": 46         # Updated like count
  }
}
```

**Unlike a Blog:**
```bash
POST /api/blogs/:blogId/like
# Same endpoint - toggles like state
# Response will show "liked": false
```

**Get Like Metrics:**
```bash
GET /api/blogs/:blogId/engagement

Response:
{
  "success": true,
  "data": {
    "views": 1250,
    "likes": 46,
    "shares": 8,
    "comments": 12,
    "engagement_rate": "4.80"  # (likes + shares + comments) / views * 100
  }
}
```

---

### 💬 **COMMENT System** (Threaded)

Full-featured comment system with replies and likes on comments!

**Features:**
- Top-level comments on blogs
- Reply to comments (threaded)
- Like comments (users can like other's comments)
- Comment moderation (active/hidden/deleted)
- Edit status for comments
- Pagination for large comment threads

**Database Fields:**
```javascript
commentSchema: {
  blog: ObjectId,              // Which blog
  author: ObjectId,            // Who commented
  content: String,             // Max 2000 chars
  parentComment: ObjectId,     // For replies (null = top-level)
  likes: [UserId],             // Who liked this comment
  likesCount: Number,
  repliesCount: Number,
  status: 'active'|'hidden'|'deleted',
  isEdited: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Post a Comment:**
```bash
POST /api/blogs/:blogId/comments
Content-Type: application/json

{
  "content": "Great article! I loved the insights on technology trends.",
  "authorName": "Subash Thapa",      # Or use from JWT
  "parentComment": null          # null for top-level, or comment_id for reply
}

Response:
{
  "success": true,
  "data": {
    "_id": "comment_id",
    "blog": "blog_id",
    "author": { "name": "Subash Thapa", "avatar": "..." },
    "content": "Great article! ...",
    "parentComment": null,
    "likes": [],
    "likesCount": 0,
    "repliesCount": 0,
    "status": "active",
    "createdAt": "2026-02-27T...",
    "isEdited": false
  }
}
```

**Reply to a Comment:**
```bash
POST /api/blogs/:blogId/comments
Content-Type: application/json

{
  "content": "@John Thanks! I'm glad you found it helpful.",
  "parentComment": "parent_comment_id"   # This creates a reply
}

Response shows:
{
  "parentComment": "parent_comment_id",
  # Now it's a reply to John's comment
}
```

**Get Comments for a Blog:**
```bash
GET /api/blogs/:blogId/comments?page=1&limit=20

Response:
{
  "success": true,
  "data": [
    {
      "_id": "comment1",
      "author": { "name": "Subash Thapa" },
      "content": "Great article!",
      "likesCount": 3,
      "repliesCount": 2,
      "replies": [           # Automatically fetched replies
        {
          "_id": "reply1",
          "author": { "name": "Jane Doe" },
          "content": "Thanks for the comment, John!"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

**Like a Comment:**
```bash
POST /api/blogs/:blogId/comments/:commentId/like

Response:
{
  "success": true,
  "message": "Comment liked",
  "data": {
    "liked": true,
    "likesCount": 4
  }
}
```

**Comment Thread Example:**
```
Blog Post: "React Best Practices"
│
├─ Comment 1: "Great post!" (by John)
│  ├─ Reply 1: "Thanks John!" (by Author)
│  └─ Reply 2: "I agree with John" (by Jane)
│
├─ Comment 2: "Need more examples" (by Mike)
│  └─ Reply 1: "Check GitHub link" (by Author)
│
└─ Comment 3: "Loved the tips" (by Sarah)
```

**Comment Moderation:**
```javascript
// Status values:
'active'  - Visible to all
'hidden'  - Hidden from public, but author & mods can see
'deleted' - Soft deleted, data kept but not visible

// Admin can change status:
PUT /api/blogs/:blogId/comments/:commentId/status
{
  "status": "hidden"  // or "deleted", "active"
}
```

---

## Trending Content Updates

### 🔥 **Trending This Week** (Auto-Updated)

Gets most viewed blogs from the last 7 days. Updates continuously as views come in.

**Endpoint:**
```bash
GET /api/blogs/trending?limit=10&days=7

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "React 19 Breaking Changes",
      "slug": "react-19-breaking-changes",
      "excerpt": "Everything you need to know about React 19...",
      "featuredImage": "...",
      "author": { "name": "Sarah Chen", "avatar": "..." },
      "publishedAt": "2026-02-25T...",
      "views": 8432,          # Most important metric
      "commentsCount": 45,
      "likesCount": 234
    }
  ],
  "cached": false
}
```

**What Makes it Trending:**
```
Trending Score = (views × 1.0) + (likes × 0.5) + (shares × 0.8) + (comments × 0.3)

Example:
Blog A: 1000 views, 50 likes, 10 shares, 20 comments
Score = 1000 + 25 + 8 + 6 = 1039

Blog B: 800 views, 100 likes, 5 shares, 10 comments  
Score = 800 + 50 + 4 + 3 = 857

Blog A ranks higher → More trending
```

**Updates:**
- ✅ Automatic - updates as users view, like, share, comment
- ✅ Real-time - reflects current engagement
- ✅ Period-based - can query last 7, 14, 30+ days
- ✅ Cached - 30 min cache for performance

### 📊 **Engagement Trending** (Facebook-style)

Ranked by engagement (likes + shares + comments), not just views.

**Endpoint:**
```bash
GET /api/blogs/engagement/trending?limit=10&days=7

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Best Programming Practices",
      "views": 2500,
      "likesCount": 450,         # High engagement
      "shares": 85,
      "commentsCount": 150       # Lots of discussion
    }
  ]
}
```

**Engagement Rate Formula:**
```
Engagement Rate = (Likes + Shares + Comments) / Views × 100

Example:
Blog A: 5000 views, 200 likes, 30 shares, 50 comments
ER = (200 + 30 + 50) / 5000 × 100 = 5.6%

Blog B: 2000 views, 150 likes, 25 shares, 100 comments
ER = (150 + 25 + 100) / 2000 × 100 = 13.75%

Blog B has much higher engagement! 🔥
```

### 📈 **Most Viewed (All Time or Period)**

```bash
GET /api/blogs/engagement/most-viewed?limit=10&days=30

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Node.js Performance Tips",
      "slug": "nodejs-performance-tips",
      "views": 15420,           # All-time views
      "author": { "name": "Alex Kumar" }
    }
  ]
}
```

### ❤️ **Most Liked (Period)**

```bash
GET /api/blogs/engagement/most-liked?limit=10&days=30

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Love This Guide",
      "likesCount": 567,        # High likes
      "author": { "name": "Jessica Lee" }
    }
  ]
}
```

---

## API Endpoints Reference

### 🔵 **Draft Blogs**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs/drafts` | Get all draft blogs |
| POST | `/api/blogs` | Create blog (status: draft) |
| PUT | `/api/blogs/:id` | Edit draft blog |
| DELETE | `/api/blogs/:id` | Delete draft blog |

### 🟠 **Scheduled Blogs**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs/scheduled` | Get scheduled blogs |
| POST | `/api/blogs/:id/schedule` | Schedule a blog |
| PUT | `/api/blogs/:id` | Update scheduled date |
| DELETE | `/api/blogs/:id` | Remove from schedule |

### 📦 **Archived Blogs**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs/archived` | Get archived blogs |
| PUT | `/api/blogs/:id/archive` | Archive a blog |
| PUT | `/api/blogs/:id/publish` | Un-archive & publish |

### 📌 **Engagement - Likes**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/blogs/:id/like` | Like/unlike blog |
| GET | `/api/blogs/:id/engagement` | Get engagement metrics |

### 💬 **Comments**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs/:blogId/comments` | Get comments with pagination |
| POST | `/api/blogs/:blogId/comments` | Post new comment |
| POST | `/api/blogs/:blogId/comments/:commentId/like` | Like a comment |

### 🔥 **Trending & Popular**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs/trending` | Trending this week |
| GET | `/api/blogs/engagement/trending` | Most engaged |
| GET | `/api/blogs/engagement/most-viewed` | Most viewed |
| GET | `/api/blogs/engagement/most-liked` | Most liked |
| GET | `/api/blogs/featured` | Featured/Editor picks |
| GET | `/api/blogs/breaking-news` | Breaking news |
| GET | `/api/blogs/recent` | Most recent |

---

## Database Schema

### **Blog Schema**
```javascript
{
  _id: ObjectId,
  
  // Content
  title: String (max 200),
  content: String (min 50),
  excerpt: String (max 500),
  slug: String (unique),
  
  // Media
  featuredImage: String,
  
  // Metadata
  type: 'blog'|'news',
  author: ObjectId → User,
  category: ObjectId → Category,
  tags: [String],
  
  // Publishing
  status: 'draft'|'published'|'archived'|'scheduled',
  publishedAt: Date,
  scheduledFor: Date,
  isScheduled: Boolean,
  
  // Featured & Breaking
  isFeatured: Boolean,
  isBreaking: Boolean,
  isPinned: Boolean,
  
  // Engagement
  views: Number,
  likes: [UserId],
  likesCount: Number,
  shares: Number,
  commentsCount: Number,
  
  // Features
  readingTime: Number (minutes),
  allowComments: Boolean,
  
  // SEO
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

### **Comment Schema**
```javascript
{
  _id: ObjectId,
  blog: ObjectId → Blog,
  author: ObjectId → User,
  content: String (max 2000),
  parentComment: ObjectId (null for top-level),
  
  likes: [UserId],
  likesCount: Number,
  repliesCount: Number,
  
  status: 'active'|'hidden'|'deleted',
  isEdited: Boolean,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## Usage Examples

### Complete Blog Creation Workflow

**Step 1: Create as Draft**
```bash
curl -X POST http://localhost:5000/api/blogs \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with TypeScript",
    "content": "<h2>Introduction</h2><p>TypeScript...</p>",
    "author": "auth_user_id",
    "category": "5f7a....", # Technology category
    "type": "blog",
    "status": "draft"
  }'

Response: { "data": { "_id": "blog123", "status": "draft" } }
```

**Step 2: Edit Draft**
```bash
curl -X PUT http://localhost:5000/api/blogs/blog123 \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<h2>Introduction</h2><p>Updated content...</p>"
  }'
```

**Step 3: Schedule for Publishing**
```bash
curl -X POST http://localhost:5000/api/blogs/blog123/schedule \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "publishDate": "2026-03-01T09:00:00Z"
  }'

Response: { "status": "scheduled", "scheduledFor": "2026-03-01T09:00:00Z" }
```

**Step 4: Cron Auto-Publishes at Time**
```
[09:00 on March 1]
✅ Automatic: status changed from 'scheduled' → 'published'
✅ Automatic: publishedAt set to 2026-03-01T09:00:00Z
✅ Automatic: Cache invalidated
✅ Log entry: "📅 Blog Scheduler: Published 1 scheduled blog(s)"
```

**Step 5: Users Like & Comment**
```bash
# User likes blog
curl -X POST http://localhost:5000/api/blogs/blog123/like \
  -H "Authorization: Bearer user_token"

# Response: { "liked": true, "likesCount": 1 }

# User posts comment
curl -X POST http://localhost:5000/api/blogs/blog123/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Excellent guide! Helped me understand TypeScript.",
    "authorName": "Jane Reviewer"
  }'

# Another user replies
curl -X POST http://localhost:5000/api/blogs/blog123/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Thanks! Glad you found it helpful.",
    "parentComment": "comment123"
  }'
```

**Step 6: Check Engagement**
```bash
curl http://localhost:5000/api/blogs/blog123/engagement

Response:
{
  "views": 450,
  "likes": 12,
  "shares": 3,
  "comments": 5,
  "engagement_rate": "4.44"
}
```

**Step 7: View Trending**
```bash
curl http://localhost:5000/api/blogs/trending?limit=5

Shows: Your blog might appear here if it's trending! 🔥
```

---

## 🎯 Quick Reference

**Status Transitions:**
```
DRAFT ────→ SCHEDULED ────→ PUBLISHED ────→ ARCHIVED
  │              │              │              │
  └──────────────┴──────────────┴──────────────┘
           (All transitions possible)
```

**Trending Updates:**
- ⏱️ Real-time as users engage
- 📊 10 most-viewed from last 7 days by default
- 🔄 Cache resets every 30 minutes
- 👁️ Views tracked automatically

**Comment Features:**
- ✅ Threaded replies
- ✅ Like comments
- ✅ Moderation status
- ✅ Edit tracking
- ✅ Pagination support

**Auto-Publishing:**
- ⏰ Every 5 minutes
- 📅 Checks `scheduledFor <= now`
- ✅ Auto-sets `publishedAt`
- 🚀 Live immediately

---

## 🔐 Permissions

| Feature | Admin | Author | User |
|---------|-------|--------|------|
| Create Blog | ✅ | ✅ | ❌ |
| Edit Own Draft | ✅ | ✅ | ❌ |
| Schedule Blog | ✅ | ✅ | ❌ |
| Publish Blog | ✅ | ✅ | ❌ |
| Archive Blog | ✅ | ✅ | ❌ |
| Like Blog | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ |
| Delete Comment | ✅ | Own only | ❌ |
| Moderate Comments | ✅ | ❌ | ❌ |

---

## 📝 Notes

- **Slugs** are auto-generated from title (lowercase, hyphens)
- **Excerpts** are auto-generated by stripping HTML (200 chars)
- **Reading Time** is auto-calculated (200 words/min)
- **Cache** invalidates automatically on edit
- **Scheduler** runs every 5 minutes (configurable)
- **Comments** support up to 2000 characters
- **Soft deletes** for comments (data preserved)

---

✨ **All features are production-ready and fully tested!**
