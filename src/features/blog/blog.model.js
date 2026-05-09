// src/features/blog/blog.model.js

import mongoose from 'mongoose';
import Category from '../category/category.model.js';

const { Schema } = mongoose;

// ==================== CATEGORY SCHEMA ====================
const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true 
  },
  description: String,
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    default: null 
  },
  icon: String,
  color: String,
  postCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1, order: 1 });
categorySchema.index({ isActive: 1 });

// ==================== COMMENT SCHEMA ====================
const commentSchema = new mongoose.Schema({
  blog: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Blog', 
    required: true,
    index: true 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Author', 
    required: true,
    index: true 
  },
  content: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 2000 
  },
  parentComment: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Comment', 
    default: null,
    index: true 
  },
  likes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Author' 
  }],
  likesCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['active', 'hidden', 'deleted'], 
    default: 'active' 
  },
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

commentSchema.index({ blog: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

// ==================== BLOG SCHEMA ====================
const blogSchema = new Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    subHeading: {
      type: String,
      required: true,
      trim: true
    },
    content: { 
      type: String, 
      required: true,
      trim: true
    },
    excerpt: {
      type: String,
      maxlength: 500
    },
    author: { 
      type: Schema.Types.ObjectId, 
      ref: 'Author', 
      required: true,
      index: true
    },
    category: { 
      type: Schema.Types.ObjectId, 
      ref: 'Category', 
      required: true,
      index: true
    },
    type: { 
      type: String, 
      enum: ['blog', 'news'], 
      default: 'blog'
    },
    tags: {
      type: [String],
      default: [],
      lowercase: true
    },
    
    // ========== STATUS & PUBLISHING ==========
    status: {
      type: String,
      enum: ['draft', 'published', 'archived', 'scheduled'],
      default: 'draft',
      index: true
    },
    publishedAt: {
      type: Date,
      index: true
    },
    scheduledFor: {
      type: Date,
      default: null // When to auto-publish
    },
    isScheduled: {
      type: Boolean,
      default: false
    },
    
    // ========== FEATURED & BREAKING ==========
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    isBreaking: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // ========== MEDIA ==========
    featuredImage: {
      type: String, // URL to featured image
      default: null
    },
    
    // ========== ENGAGEMENT ==========
    views: {
      type: Number,
      default: 0,
      index: true
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: []
    },
    likesCount: {
      type: Number,
      default: 0,
      index: true
    },
    shares: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    
    // ========== METADATA ==========
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true
    },
    readingTime: {
      type: Number, // in minutes
      default: 0
    },
    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],
    
    // ========== FLAGS & PROPERTIES ==========
    isPublished: { 
      type: Boolean, 
      default: false 
    },
    allowComments: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true } // Adds createdAt, updatedAt
);

// ==================== INDEXES ====================
blogSchema.index({ slug: 1 }, { unique: true });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ tags: 1, status: 1, publishedAt: -1 });
blogSchema.index({ author: 1, status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1, publishedAt: -1 });
blogSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 });
blogSchema.index({ isBreaking: 1, publishedAt: -1 });
blogSchema.index({ views: -1, publishedAt: -1 }); // For trending
blogSchema.index({ publishedAt: -1 }); // For recent
blogSchema.index({ scheduledFor: 1, status: 1 }); // For scheduled posts
blogSchema.index({ createdAt: -1 }); // For latest
blogSchema.index({ likesCount: -1, publishedAt: -1 }); // For most liked

// Full-text search index
blogSchema.index({ 
  title: 'text', 
  content: 'text', 
  excerpt: 'text', 
  tags: 'text' 
});

// ==================== VIRTUALS ====================
blogSchema.virtual('authorDetails', {
  ref: 'Author',
  localField: 'author',
  foreignField: '_id',
  justOne: true
});

blogSchema.virtual('categoryDetails', {
  ref: 'Category',
  localField: 'category',
  foreignField: '_id',
  justOne: true
});

blogSchema.virtual('recentComments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'blog',
  options: { 
    match: { status: 'active' },
    sort: { createdAt: -1 },
    limit: 5
  }
});

blogSchema.virtual('formattedDate').get(function() {
  if (!this.publishedAt) return null;
  return {
    relative: this.getRelativeTime(),
    full: this.publishedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    short: this.publishedAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  };
});

// ==================== PRE-SAVE HOOKS ====================
blogSchema.pre('save', function() {
  // Generate slug if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Generate excerpt if missing
  if (!this.excerpt && this.content) {
    const plainText = this.content.replace(/<[^>]*>/g, '');
    this.excerpt = plainText.substring(0, 200) + '...';
  }

  // Calculate reading time
  if (this.content && !this.readingTime) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200); // 200 words per minute
  }

  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Update likesCount
  if (this.isModified('likes')) {
    this.likesCount = this.likes.length;
  }
});

// Update author's post count when blog is published
// Update author's post count and invalidate cache when blog is saved
blogSchema.post('save', async function() {
  try {
    const doc = this;
    if (doc.status === 'published' && doc.author) {
      try {
        const Author = mongoose.model('Author');
        const count = await doc.constructor.countDocuments({ 
          author: doc.author, 
          status: 'published' 
        });
        await Author.findByIdAndUpdate(doc.author, { 
          'stats.totalPosts': count 
        }, { new: false });
      } catch (authorErr) {
        console.warn('Failed to update author post count:', authorErr.message);
      }
    }

    // Update category's post count
    if (doc.category) {
      try {
        const Category = mongoose.model('Category');
        const count = await doc.constructor.countDocuments({ 
          category: doc.category, 
          status: 'published' 
        });
        await Category.findByIdAndUpdate(doc.category, { postCount: count }, { new: false });
      } catch (categErr) {
        console.warn('Failed to update category post count:', categErr.message);
      }
    }

    // 🚀 CACHE INVALIDATION on save
    try {
      const cacheModule = await import('../../utils/cache.util.js');
      const cache = cacheModule.default;
      
      await cache.delPattern('blogs:*');
      await cache.delPattern(`blog:${doc._id}:*`);
      await cache.delPattern(`blogs:category:${doc.category}:*`);
      await cache.delPattern(`blogs:author:${doc.author}:*`);
      await cache.delPattern('blogs:featured:*');
      await cache.delPattern('blogs:popular:*');
      await cache.delPattern(`blog:${doc.slug}:*`);
    } catch (cacheErr) {
      console.warn('Cache invalidation failed:', cacheErr.message);
    }
  } catch (err) {
    console.warn('Post-save hook error:', err.message);
  }
});

// Cache invalidation on delete
blogSchema.post('deleteOne', async function() {
  try {
    const cacheModule = await import('../../utils/cache.util.js');
    const cache = cacheModule.default;
    await cache.delPattern('blogs:*');
  } catch (err) {
    console.warn('Cache invalidation on delete failed:', err.message);
  }
});

// ==================== METHODS ====================
blogSchema.methods.getRelativeTime = function() {
  if (!this.publishedAt) return '';
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const now = new Date();
  const diffTime = this.publishedAt - now;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (Math.abs(diffDays) > 30) {
    return rtf.format(Math.round(diffDays / 30), 'month');
  } else if (Math.abs(diffDays) > 0) {
    return rtf.format(diffDays, 'day');
  } else {
    const diffHours = Math.round(diffTime / (1000 * 60 * 60));
    if (Math.abs(diffHours) > 0) {
      return rtf.format(diffHours, 'hour');
    } else {
      const diffMinutes = Math.round(diffTime / (1000 * 60));
      return rtf.format(diffMinutes, 'minute');
    }
  }
};

blogSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
  return this.views;
};

blogSchema.methods.toggleLike = async function(userId) {
  const index = this.likes.indexOf(userId);
  if (index === -1) {
    this.likes.push(userId);
  } else {
    this.likes.splice(index, 1);
  }
  await this.save();
  return {
    liked: index === -1,
    likesCount: this.likes.length
  };
};

blogSchema.methods.incrementShares = async function() {
  this.shares += 1;
  await this.save();
  return this.shares;
};

// ========== NEW ENGAGEMENT METHODS ==========

/**
 * Check if user already liked this blog
 */
blogSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

/**
 * Get engagement score for ranking
 */
blogSchema.methods.getEngagementScore = function() {
  const viewsScore = this.views * 0.1;
  const likesScore = this.likesCount * 0.5;
  const sharesScore = this.shares * 0.8;
  const commentsScore = this.commentsCount * 0.3;
  
  return viewsScore + likesScore + sharesScore + commentsScore;
};

/**
 * Get engagement summary
 */
blogSchema.methods.getEngagementMetrics = function() {
  return {
    views: this.views,
    likes: this.likesCount,
    shares: this.shares,
    comments: this.commentsCount,
    engagement_rate: this.views > 0 
      ? (((this.likesCount + this.shares + this.commentsCount) / this.views) * 100).toFixed(2) 
      : 0
  };
};

/**
 * Increment view count (for analytics)
 */
blogSchema.methods.recordView = async function() {
  this.views += 1;
  await this.save();
  return this.views;
};

/**
 * Publish blog immediately
 */
blogSchema.methods.publish = async function() {
  this.status = 'published';
  this.publishedAt = new Date();
  this.isScheduled = false;
  await this.save();
  return this;
};

/**
 * Archive blog
 */
blogSchema.methods.archive = async function() {
  this.status = 'archived';
  await this.save();
  return this;
};

/**
 * Move blog to draft
 */
blogSchema.methods.moveToDraft = async function() {
  this.status = 'draft';
  await this.save();
  return this;
};

/**
 * Schedule blog for future publishing
 */
blogSchema.methods.schedule = async function(publishDate) {
  if (publishDate <= new Date()) {
    throw new Error('Scheduled date must be in the future');
  }
  this.status = 'scheduled';
  this.scheduledFor = publishDate;
  this.isScheduled = true;
  await this.save();
  return this;
};

/**
 * Get status label with emoji
 */
blogSchema.methods.getStatusLabel = function() {
  const labels = {
    'draft': '📝 Draft',
    'published': '✅ Published',
    'archived': '📦 Archived',
    'scheduled': '⏰ Scheduled'
  };
  return labels[this.status] || this.status;
};

blogSchema.methods.getRelatedPosts = async function(limit = 3) {
  return this.constructor.find({
    _id: { $ne: this._id },
    status: 'published',
    $or: [
      { category: this.category },
      { tags: { $in: this.tags?.slice(0, 5) } }
    ]
  })
    .select('title slug excerpt featuredImage publishedAt views')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort({ publishedAt: -1, views: -1 })
    .limit(limit)
    .lean();
};

// ==================== STATIC METHODS ====================
blogSchema.statics.getFeaturedPosts = async function(limit = 5) {
  return this.find({ 
    isFeatured: true, 
    status: 'published' 
  })
    .select('title slug excerpt featuredImage author publishedAt views')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
};

blogSchema.statics.getBreakingNews = async function(limit = 3) {
  return this.find({ 
    isBreaking: true, 
    status: 'published' 
  })
    .select('title slug publishedAt category')
    .populate('category', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
};

blogSchema.statics.getPopularPosts = async function(limit = 5, days = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.find({
    status: 'published',
    publishedAt: { $gte: dateThreshold }
  })
    .select('title slug excerpt featuredImage author publishedAt views commentsCount')
    .populate('author', 'name profileImage')
    .sort({ views: -1, commentsCount: -1 })
    .limit(limit)
    .lean();
};

blogSchema.statics.search = async function(query, options = {}) {
  const { page = 1, limit = 10, sortBy = 'relevance' } = options;
  
  const searchQuery = {
    status: 'published',
    $text: { $search: query }
  };
  
  const sort = {};
  if (sortBy === 'relevance') {
    sort.score = { $meta: 'textScore' };
  } else if (sortBy === 'latest') {
    sort.publishedAt = -1;
  } else if (sortBy === 'popular') {
    sort.views = -1;
  }
  
  const results = await this.find(
    searchQuery,
    sortBy === 'relevance' ? { score: { $meta: 'textScore' } } : {}
  )
    .select('title slug excerpt featuredImage author publishedAt views category')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  const total = await this.countDocuments(searchQuery);
  
  return {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

blogSchema.statics.getPopularTags = async function(limit = 10) {
  const tags = await this.aggregate([
    { $match: { status: 'published', tags: { $exists: true, $ne: [] } } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
  
  return tags.map(tag => ({ name: tag._id, count: tag.count }));
};

blogSchema.statics.getDraftBlogs = async function(authorId = null, limit = 10) {
  const query = { status: 'draft' };
  if (authorId) query.author = authorId;
  
  return this.find(query)
    .select('title slug author category publishedAt updatedAt')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
};

blogSchema.statics.getScheduledBlogs = async function(authorId = null) {
  const query = { 
    status: 'scheduled',
    scheduledFor: { $gt: new Date() }
  };
  if (authorId) query.author = authorId;
  
  return this.find(query)
    .select('title slug author category scheduledFor')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort({ scheduledFor: 1 })
    .lean();
};

blogSchema.statics.getArchivedBlogs = async function(authorId = null, limit = 20) {
  const query = { status: 'archived' };
  if (authorId) query.author = authorId;
  
  return this.find(query)
    .select('title slug author category publishedAt')
    .populate('author', 'name profileImage')
    .populate('category', 'name slug')
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Publish all scheduled blogs that are ready
 * Should be called by a cron job periodically
 */
blogSchema.statics.publishScheduledBlogs = async function() {
  const now = new Date();
  const updated = await this.updateMany(
    {
      status: 'scheduled',
      scheduledFor: { $lte: now }
    },
    {
      $set: {
        status: 'published',
        publishedAt: now,
        isScheduled: false
      }
    }
  );
  
  return {
    modifiedCount: updated.modifiedCount,
    message: `Published ${updated.modifiedCount} scheduled blog(s)`
  };
};

/**
 * Get engagement trending - most liked/shared in period
 */
blogSchema.statics.getEngagementTrending = async function(limit = 10, days = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.find({
    status: 'published',
    publishedAt: { $gte: dateThreshold }
  })
    .select('title slug excerpt featuredImage author publishedAt views likesCount shares commentsCount')
    .populate('author', 'name profileImage')
    .sort({ likesCount: -1, shares: -1, commentsCount: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get most viewed blogs
 */
blogSchema.statics.getMostViewed = async function(limit = 10, days = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.find({
    status: 'published',
    publishedAt: { $gte: dateThreshold }
  })
    .select('title slug excerpt featuredImage author publishedAt views')
    .populate('author', 'name profileImage')
    .sort({ views: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get most liked blogs
 */
blogSchema.statics.getMostLiked = async function(limit = 10, days = 30) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  
  return this.find({
    status: 'published',
    publishedAt: { $gte: dateThreshold },
    likesCount: { $gt: 0 }
  })
    .select('title slug excerpt featuredImage author publishedAt likesCount')
    .populate('author', 'name profileImage')
    .sort({ likesCount: -1 })
    .limit(limit)
    .lean();
};

// ==================== COMMENT METHODS ====================
commentSchema.methods.addLike = async function(userId) {
  const index = this.likes.indexOf(userId);
  if (index === -1) {
    this.likes.push(userId);
    this.likesCount = this.likes.length;
  }
  await this.save();
  return this.likesCount;
};

commentSchema.methods.addReply = async function(replyData) {
  const reply = await this.constructor.create({
    ...replyData,
    parentComment: this._id
  });
  
  this.repliesCount += 1;
  await this.save();
  
  return reply;
};

commentSchema.statics.getCommentsForBlog = async function(blogId, page = 1, limit = 20) {
  const query = { 
    blog: blogId, 
    parentComment: null,
    status: 'active' 
  };
  
  const [comments, total] = await Promise.all([
    this.find(query)
      .populate('author', 'name profileImage isVerified')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    
    this.countDocuments(query)
  ]);
  
  // Get replies for these comments
  const commentIds = comments.map(c => c._id);
  const replies = await this.find({
    parentComment: { $in: commentIds },
    status: 'active'
  })
    .populate('author', 'name profileImage isVerified')
    .sort({ createdAt: 1 })
    .lean();
  
  // Group replies by parent
  const repliesByParent = {};
  replies.forEach(reply => {
    const parentId = reply.parentComment.toString();
    if (!repliesByParent[parentId]) {
      repliesByParent[parentId] = [];
    }
    repliesByParent[parentId].push(reply);
  });
  
  // Attach replies to comments
  comments.forEach(comment => {
    comment.replies = repliesByParent[comment._id.toString()] || [];
  });
  
  return {
    comments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// ==================== EXPORTS ====================
const Blog = mongoose.model('Blog', blogSchema);
export default Blog;