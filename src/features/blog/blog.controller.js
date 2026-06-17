// src/features/blog/blog.controller.js

import Blog from './blog.model.js';
import Comment from '../comment/comment.model.js';
import Author from '../author/author.model.js';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import cache from '../../utils/cache.util.js';
import { generateExcerpt } from '../../utils/excerpt-generator.util.js';
import { generateSEOMetadata } from '../../utils/seo-generator.util.js';

// ==================== HELPER FUNCTIONS ====================

/**
 * Sanitize pagination parameters
 */
const sanitizePagination = (page, limit, maxLimit = 50) => {
  const sanitizedPage = Math.max(1, parseInt(page) || 1);
  const sanitizedLimit = Math.min(Math.max(1, parseInt(limit) || 10), maxLimit);
  const skip = (sanitizedPage - 1) * sanitizedLimit;
  
  return { page: sanitizedPage, limit: sanitizedLimit, skip };
};

/**
 * 
 
 * Build cache control headers
 */
const setCacheHeaders = (res, duration = 60) => {
  res.set({
    'Cache-Control': `public, max-age=${duration}`,
    'Expires': new Date(Date.now() + duration * 1000).toUTCString()
  });
};

// ==================== PUBLIC READ METHODS ====================

/**
 * Get recent blogs (latest published)
 */
export const getRecentBlogs = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);

    const cacheKey = `blogs:recent:limit:${parsedLimit}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.find({ status: 'published' })
      .select('title slug excerpt featuredImage author publishedAt views readingTime category')
      .populate('author', 'name profileImage bio isVerified')
      .populate('category', 'name slug color')
      .sort({ publishedAt: -1 })
      .limit(parsedLimit)
      .lean(true);  // ⚡ Optimized: returns plain JS objects, not Mongoose docs

    await cache.set(cacheKey, blogs, 1800); // 30 min cache
    setCacheHeaders(res, 1800);
    res.set('X-Cache', 'MISS');

    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getRecentBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent blogs.' });
  }
};

/**
 * Get trending blogs (this week) - Popular posts from last 7 days
 */
export const getTrendingBlogs = async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const parsedDays = Math.min(Math.max(1, parseInt(days) || 7), 90);

    const cacheKey = `blogs:trending:limit:${parsedLimit}:days:${parsedDays}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getPopularPosts(parsedLimit, parsedDays);

    await cache.set(cacheKey, blogs, 1800); // 30 min cache
    setCacheHeaders(res, 1800);
    res.set('X-Cache', 'MISS');

    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getTrendingBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending blogs.' });
  }
};

/**
 * Get featured blogs
 */
export const getFeaturedBlogs = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 5), 50);

    const cacheKey = `blogs:featured:limit:${parsedLimit}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getFeaturedPosts(parsedLimit);

    await cache.set(cacheKey, blogs, 3600); // 1 hour cache
    setCacheHeaders(res, 3600);
    res.set('X-Cache', 'MISS');

    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getFeaturedBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured blogs.' });
  }
};

/**
 * Get breaking news
 */
export const getBreakingNews = async (req, res) => {
  try {
    const { limit = 3 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 3), 20);

    const cacheKey = `blogs:breaking:limit:${parsedLimit}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getBreakingNews(parsedLimit);

    await cache.set(cacheKey, blogs, 900); // 15 min cache (breaking news changes frequently)
    setCacheHeaders(res, 900);
    res.set('X-Cache', 'MISS');

    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getBreakingNews:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch breaking news.' });
  }
};

/**
 * Retrieve blogs by category with pagination and caching
 */
export const getBlogsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit);

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, error: 'Invalid category ID format' });
    }

    // 🚀 CACHE KEY STRATEGY
    const cacheKey = `blogs:category:${categoryId}:page:${page}:limit:${limit}`;

    // TRY CACHE FIRST
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      setCacheHeaders(res, 300);
      return res.status(200).json({
        success: true,
        data: cachedResult.blogs,
        pagination: cachedResult.pagination,
        cached: true
      });
    }

    // IF NOT IN CACHE, FETCH FROM DATABASE
    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({ category: categoryId, status: 'published' })
        .select('title slug excerpt featuredImage author category publishedAt views readingTime')
        .populate('author', 'name profileImage isVerified')
        .populate('category', 'name slug color')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(true)  // ⚡ Optimized: plain JS objects, no overhead
        .hint({ category: 1, status: 1, publishedAt: -1 }),
      Blog.countDocuments({ category: categoryId, status: 'published' })
    ]);

    const totalPages = Math.ceil(totalBlogs / limit);
    
    // 💾 STORE IN CACHE (1 hour for category blogs)
    const result = {
      blogs,
      pagination: {
        page,
        limit,
        total: totalBlogs,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
    await cache.set(cacheKey, result, 3600);

    setCacheHeaders(res, 300);
    res.status(200).json({
      success: true,
      data: blogs,
      pagination: result.pagination,
      cached: false
    });
  } catch (error) {
    console.error('Error in getBlogsByCategory:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs. Please try again.' });
  }
};

/**
 * Retrieve similar blogs by ID
 */
export const getSimilarBlogs = async (req, res) => {
  try {
    const { id } = req.params;
    
    // OPTIMIZATION: Use the model's method which is already optimized
    const similarBlogs = await Blog.getSimilarBlogs(id, 5);
    
    res.status(200).json({
      success: true,
      data: similarBlogs
    });
  } catch (error) {
    if (error.message === 'Blog not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Retrieve blogs by tag with pagination
 */
export const getBlogsByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const { page = 1, limit = 4 } = req.query;
    
    if (!tag || tag.trim() === '') {
      return res.status(400).json({ success: false, error: 'Tag is required' });
    }

    const { skip, limit: parsedLimit } = sanitizePagination(page, limit);

    // OPTIMIZATION: Case-insensitive tag search
    const tagRegex = new RegExp(`^${tag}$`, 'i');
    
    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({ 
        tags: { $in: [tagRegex] },
        status: 'published',
        type: 'blog'
      })
        .select('title slug subHeading featuredImage author category views likesCount publishedAt createdAt content')
        .populate('author', '_id name profileImage bio')
        .populate('category', 'name slug')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      
      Blog.countDocuments({ 
        tags: { $in: [tagRegex] },
        status: 'published',
        type: 'blog'
      })
    ]);

    const totalPages = Math.ceil(totalBlogs / parsedLimit);
    setCacheHeaders(res, 300);

    res.status(200).json({
      success: true,
      data: {
        tag: tag,
        blogs: blogs,
        total: totalBlogs,
        pagination: {
          page: Math.max(1, parseInt(page) || 1),
          limit: parsedLimit,
          pages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error in getBlogsByTag:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs by tag. Please try again.' });
  }
};

// Standardized getBlogsByAuthor
export const getBlogsByAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit);

    if (!mongoose.Types.ObjectId.isValid(authorId)) {
      return res.status(400).json({ success: false, error: 'Invalid author ID format' });
    }

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({ author: authorId })
        .populate('author category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments({ author: authorId })
    ]);

    const totalPages = Math.ceil(totalBlogs / limit);
    setCacheHeaders(res, 300);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total: totalBlogs,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getBlogsByAuthor:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs. Please try again.' });
  }
};

/**
 * Get blogs by author name (for author page)
 */
export const getBlogsByAuthorName = async (req, res) => {
  try {
    const { authorName } = req.params;
    const { page = 1, limit = 4 } = req.query;
    
    if (!authorName || authorName.trim() === '') {
      return res.status(400).json({ success: false, error: 'Author name is required' });
    }

    // Decode the author name from URL
    const decodedAuthorName = decodeURIComponent(authorName).trim();
    console.log('🔍 Searching for author:', decodedAuthorName);
    
    const { skip, limit: parsedLimit } = sanitizePagination(page, limit);

    // Find author by name using Author model
    const author = await Author.findOne(
      { name: { $regex: `^${decodedAuthorName}$`, $options: 'i' } }
    );

    if (!author) {
      console.log(`❌ Author not found: "${decodedAuthorName}"`);
      return res.status(404).json({ success: false, error: 'Author not found', data: [] });
    }
    
    console.log('✅ Author found:', author.name);

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({ author: author._id, status: 'published' })
        .select('title slug subHeading featuredImage author category views likesCount publishedAt createdAt content')
        .populate('author', '_id name profileImage bio')
        .populate('category', 'name slug')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Blog.countDocuments({ author: author._id, status: 'published' })
    ]);

    const totalPages = Math.ceil(totalBlogs / parsedLimit);
    setCacheHeaders(res, 300);

    res.status(200).json({
      success: true,
      data: {
        author: {
          _id: author._id,
          name: author.name,
          profileImage: author.profileImage || null,
          bio: author.bio || null,
          isVerified: false
        },
        blogs: blogs,
        total: totalBlogs,
        pagination: {
          page: Math.max(1, parseInt(page) || 1),
          limit: parsedLimit,
          pages: totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error in getBlogsByAuthorName:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch author blogs. Please try again.' });
  }
};

// Optimized getBlogs - Only return published blogs with proper dates and views
export const getBlogs = async (req, res) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit);
    const cacheKey = `blogs:public:page:${page}:limit:${limit}`;

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      setCacheHeaders(res, 300);
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        data: cachedResult.data,
        pagination: cachedResult.pagination,
        cached: true
      });
    }

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({ status: 'published', type: 'blog' })
        .select('title slug content subHeading featuredImage author category views likesCount publishedAt status type')
        .populate('author', 'name profileImage')
        .populate('category', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments({ status: 'published', type: 'blog' })
    ]);

    // Ensure all blogs have proper defaults
    const enrichedBlogs = blogs.map(blog => ({
      ...blog,
      views: blog.views || 0,
      publishedAt: blog.publishedAt || new Date(),
      featuredImage: blog.featuredImage || '/photos/default-blog.jpg'
    }));

    const totalPages = Math.ceil(totalBlogs / limit);
    const payload = {
      data: enrichedBlogs,
      pagination: {
        page,
        limit,
        total: totalBlogs,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };

    await cache.set(cacheKey, payload, 300);
    setCacheHeaders(res, 300);
    res.set('X-Cache', 'MISS');

    res.status(200).json({
      success: true,
      data: payload.data,
      pagination: payload.pagination,
      cached: false
    });
  } catch (error) {
    console.error('Error in getBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs. Please try again.' });
  }
};

/**
 * Get all published news with pagination
 */
export const getNews = async (req, res) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit);
    const cacheKey = `blogs:news:page:${page}:limit:${limit}`;

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      setCacheHeaders(res, 300);
      res.set('X-Cache', 'HIT');
      return res.status(200).json({
        success: true,
        data: cachedResult.data,
        pagination: cachedResult.pagination,
        cached: true
      });
    }

    const [news, totalNews] = await Promise.all([
      Blog.find({ status: 'published', type: 'news' })
        .select('title slug content subHeading featuredImage author category views likesCount publishedAt status type')
        .populate('author', 'name profileImage')
        .populate('category', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments({ status: 'published', type: 'news' })
    ]);

    // Ensure all news have proper defaults
    const enrichedNews = news.map(item => ({
      ...item,
      views: item.views || 0,
      publishedAt: item.publishedAt || new Date(),
      featuredImage: item.featuredImage || '/photos/default-blog.jpg'
    }));

    const totalPages = Math.ceil(totalNews / limit);
    const payload = {
      data: enrichedNews,
      pagination: {
        page,
        limit,
        total: totalNews,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };

    await cache.set(cacheKey, payload, 300);
    setCacheHeaders(res, 300);
    res.set('X-Cache', 'MISS');

    res.status(200).json({
      success: true,
      data: payload.data,
      pagination: payload.pagination,
      cached: false
    });
  } catch (error) {
    console.error('Error in getNews:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch news. Please try again.' });
  }
};

/**
 * Get ALL blogs for admin (no filters - returns all statuses and types)
 * This is used in admin panel for content management
 */
export const getAllBlogsForAdmin = async (req, res) => {
  try {
    console.log('🔍 getAllBlogsForAdmin called - fetching ALL blogs without filters');
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit);

    const [blogs, totalBlogs] = await Promise.all([
      Blog.find({}) // No filters - get all blogs
        .select('title slug content subHeading featuredImage author category views likesCount publishedAt status type isFeatured isBreaking createdAt updatedAt')
        .populate('author', 'name profileImage')
        .populate('category', 'name slug')
        .sort({ createdAt: -1 }) // Sort by newest created first
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments({}) // Count all blogs
    ]);

    console.log(`📊 Total blogs found: ${totalBlogs}, Returned: ${blogs.length}`);
    console.log(`📋 Blog types: ${blogs.map(b => b.type).join(', ')}`);

    // Ensure all blogs have proper defaults
    const enrichedBlogs = blogs.map(blog => ({
      ...blog,
      views: blog.views || 0,
      publishedAt: blog.publishedAt || new Date(),
      featuredImage: blog.featuredImage || '/photos/default-blog.jpg'
    }));

    const totalPages = Math.ceil(totalBlogs / limit);

    res.status(200).json({
      success: true,
      data: enrichedBlogs,
      pagination: {
        page,
        limit,
        total: totalBlogs,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getAllBlogsForAdmin:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs. Please try again.' });
  }
};

/**
 * Get a single blog by ID
 */
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    // ⚡ OPTIMIZED: Use .lean() for read-only query
    const blog = await Blog.findById(id)
      .populate('author', 'name profileImage')
      .populate('category', 'name slug')
      .lean();

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // ⚡ OPTIMIZED: Atomic view increment (fire-and-forget, non-blocking)
    Blog.findByIdAndUpdate(id, { $inc: { views: 1 } }).exec().catch(err => 
      console.error('View increment failed:', err.message)
    );

    setCacheHeaders(res, 60);

    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    console.error('Error in getBlogById:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blog. Please try again.' });
  }
};

// Updated createBlog with validation and auto-generated excerpt + SEO
export const createBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let { title, subHeading, content, tags, category, isFeatured, isBreaking, allowComments, isScheduled, type } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    if (!subHeading || !subHeading.trim()) {
      return res.status(400).json({ success: false, error: 'Sub-heading is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }

    // Validate author if provided
    if (req.body.author) {
      if (!mongoose.Types.ObjectId.isValid(req.body.author)) {
        return res.status(400).json({ success: false, error: 'Invalid author ID format' });
      }
      // Verify author exists before creating blog
      const authorExists = await mongoose.model('Author').findById(req.body.author);
      if (!authorExists) {
        return res.status(400).json({ success: false, error: 'Target author not found' });
      }
    }

    // Parse tags if it's a string (from FormData)
    if (typeof tags === 'string') {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    if (!Array.isArray(tags)) {
      tags = [];
    }

    // Convert boolean strings from FormData to actual booleans
    if (typeof isFeatured === 'string') isFeatured = isFeatured === 'true';
    if (typeof isBreaking === 'string') isBreaking = isBreaking === 'true';
    if (typeof allowComments === 'string') allowComments = allowComments === 'true';
    if (typeof isScheduled === 'string') isScheduled = isScheduled === 'true';

    // Auto-generate excerpt from title, subHeading, and content
    const generatedExcerpt = generateExcerpt(title, subHeading, content);
    
    // Auto-generate SEO metadata
    const seoMetadata = generateSEOMetadata({
      title,
      subHeading,
      content,
      tags: tags || [],
      category,
      slug: req.body.slug
    });
    
    // Handle featured image
    let featuredImage = null;
    if (req.file) {
      // Save the file path - convert to relative URL
      featuredImage = `/uploads/blogs/${req.file.filename}`;
    }
    
    const blog = new Blog({
      ...req.body,
      title: title.trim(),
      subHeading: subHeading.trim(),
      content: content.trim(),
      tags: tags,
      isFeatured,
      isBreaking,
      allowComments,
      isScheduled,
      type: type || 'blog',
      featuredImage,
      excerpt: generatedExcerpt,
      seoTitle: seoMetadata.seoTitle,
      seoDescription: seoMetadata.seoDescription,
      seoKeywords: seoMetadata.seoKeywords,
      slug: seoMetadata.slug
    });

    await blog.save();
    
    // Populate references in response by refetching the document
    const populatedBlog = await Blog.findById(blog._id)
      .populate('author', 'name profileImage bio')
      .populate('category', 'name slug');

    res.status(201).json({ success: true, data: populatedBlog, message: 'Blog created successfully' });
  } catch (error) {
    console.error('Error in createBlog:', error.message);
    console.error('Full error stack:', error.stack);
    res.status(500).json({ success: false, error: error.message || 'Failed to create blog. Please try again.' });
  }
};

// Improved deleteBlog
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    res.status(200).json({ success: true, message: 'Blog deleted successfully', data: blog });
  } catch (error) {
    console.error('Error in deleteBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to delete blog. Please try again.' });
  }
};

// Enhanced updateBlog with file upload support
export const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    // Find existing blog first
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    let {
      title,
      subHeading,
      content,
      tags,
      category,
      isFeatured,
      isBreaking,
      allowComments,
      isScheduled,
      type,
      status,
    } = req.body;

    // Validate required fields
    if (title && !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title cannot be empty' });
    }
    if (subHeading && !subHeading.trim()) {
      return res.status(400).json({ success: false, error: 'Sub-heading cannot be empty' });
    }
    if (content && !content.trim()) {
      return res.status(400).json({ success: false, error: 'Content cannot be empty' });
    }

    // Build updates object
    const updates = {};

    if (title) {
      updates.title = title.trim();
    }
    if (subHeading) {
      updates.subHeading = subHeading.trim();
    }
    if (content) {
      updates.content = content.trim();
    }
    if (category) {
      updates.category = category;
    }

    // Parse tags if it's a string (from FormData)
    if (tags) {
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [];
        }
      }
      if (Array.isArray(tags)) {
        updates.tags = tags;
      }
    }

    // Convert boolean strings from FormData to actual booleans
    if (typeof isFeatured === 'string') isFeatured = isFeatured === 'true';
    if (typeof isBreaking === 'string') isBreaking = isBreaking === 'true';
    if (typeof allowComments === 'string') allowComments = allowComments === 'true';
    if (typeof isScheduled === 'string') isScheduled = isScheduled === 'true';

    if (typeof isFeatured === 'boolean') updates.isFeatured = isFeatured;
    if (typeof isBreaking === 'boolean') updates.isBreaking = isBreaking;
    if (typeof allowComments === 'boolean') updates.allowComments = allowComments;
    if (typeof isScheduled === 'boolean') updates.isScheduled = isScheduled;

    if (type) {
      updates.type = type;
    }

    if (status) {
      updates.status = status;
    }

    // Add author if provided - validate it exists
    if (req.body.author) {
      if (!mongoose.Types.ObjectId.isValid(req.body.author)) {
        return res.status(400).json({ success: false, error: 'Invalid author ID format' });
      }
      // Verify author exists before updating
      const authorExists = await mongoose.model('Author').findById(req.body.author);
      if (!authorExists) {
        return res.status(400).json({ success: false, error: 'Target author not found' });
      }
      updates.author = req.body.author;
    }

    // Add publish/schedule dates if provided
    if (req.body.publishedAt) {
      updates.publishedAt = req.body.publishedAt;
    }
    if (req.body.scheduledFor) {
      updates.scheduledFor = req.body.scheduledFor;
    }

    // Handle featured image replacement
    if (req.file) {
      updates.featuredImage = `/uploads/blogs/${req.file.filename}`;
    }

    // Regenerate excerpt if content was updated
    if (content) {
      updates.excerpt = generateExcerpt(
        updates.title || blog.title,
        updates.subHeading || blog.subHeading,
        content
      );
    }

    // Regenerate SEO metadata if relevant fields were updated
    if (title || subHeading || content || tags) {
      const seoMetadata = generateSEOMetadata({
        title: updates.title || blog.title,
        subHeading: updates.subHeading || blog.subHeading,
        content: updates.content || blog.content,
        tags: updates.tags || blog.tags || [],
        category: updates.category || blog.category,
        slug: blog.slug
      });
      updates.seoTitle = seoMetadata.seoTitle;
      updates.seoDescription = seoMetadata.seoDescription;
      updates.seoKeywords = seoMetadata.seoKeywords;
    }

    // Perform the update
    const updatedBlog = await Blog.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('author', 'name profileImage')
      .populate('category', 'name slug');

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: updatedBlog
    });
  } catch (error) {
    console.error('Error in updateBlog:', error.message);
    console.error('Full error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update blog. Please try again.'
    });
  }
};

// Refactored uploadBlogImage
export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { path, filename } = req.file;

    // Assuming some processing or storage logic here
    const imageUrl = `/uploads/${filename}`;

    res.status(200).json({ success: true, message: 'Image uploaded successfully', data: { imageUrl } });
  } catch (error) {
    console.error('Error in uploadBlogImage:', error);
    res.status(500).json({ success: false, error: 'Failed to upload image. Please try again.' });
  }
};

// Updated toggleBlogLike
export const toggleBlogLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    const isLiked = blog.likes.includes(userId);
    if (isLiked) {
      blog.likes = blog.likes.filter((like) => like.toString() !== userId.toString());
    } else {
      blog.likes.push(userId);
    }

    blog.likesCount = blog.likes.length;
    await blog.save();

    res.status(200).json({ success: true, data: { likes: blog.likes, likesCount: blog.likesCount } });
  } catch (error) {
    console.error('Error in toggleBlogLike:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle like. Please try again.' });
  }
};

// Get moderation blogs
export const getModerationBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { blogs, totalBlogs } = await Promise.all([
      Blog.find({ status: 'pending' })
        .select('title slug excerpt featuredImage author category publishedAt views readingTime')
        .populate('author', 'name profileImage isVerified')
        .populate('category', 'name slug color')
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(true),  // ⚡ Optimized for moderation page listing
      Blog.countDocuments({ status: 'pending' })
    ]);

    const totalPages = Math.ceil(totalBlogs / limit);
    setCacheHeaders(res, 300);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total: totalBlogs,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getModerationBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch moderation blogs. Please try again.' });
  }
};

// Optimized bulkUpdateStatus
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty IDs array' });
    }

    if (!['published', 'draft', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const result = await Blog.updateMany(
      { _id: { $in: ids.map((id) => mongoose.Types.ObjectId(id)) } },
      { status }
    );

    res.status(200).json({ success: true, message: `Updated ${result.modifiedCount} blogs successfully` });
  } catch (error) {
    console.error('Error in bulkUpdateStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to update blog statuses. Please try again.' });
  }
};

// ==================== COMMENT METHODS ====================

/**
 * Fetch comments for a blog
 */
export const getCommentsForBlog = async (req, res) => {
  try {
    const { blogId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const comments = await Comment.find({ blog: blogId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: comments });
  } catch (error) {
    console.error('Error in getCommentsForBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments. Please try again.' });
  }
};

/**
 * Post a comment on a blog
 */
export const postCommentOnBlog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { blogId } = req.params;
    const { authorName, content, parentComment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const comment = new Comment({
      blog: blogId,
      authorName,
      content,
      parentComment: parentComment || null,
    });

    await comment.save();

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Error in postCommentOnBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to post comment. Please try again.' });
  }
};

// Helper function to clean blog content
const cleanBlogContent = (blog) => {
  if (!blog) return blog;
  
  let cleanContent = blog.content || '';
  
  // Replace all non-breaking spaces with regular spaces for proper text wrapping
  cleanContent = cleanContent.replace(/&nbsp;/g, ' ');
  
  // Make images responsive
  cleanContent = cleanContent.replace(/<img([^>]*)>/g, (match, attrs) => {
    if (!attrs.includes('style=')) {
      return `<img${attrs} style="max-width: 100%; height: auto; display: block; margin: 1rem 0;">`;
    }
    return match;
  });
  
  return {
    ...blog,
    content: cleanContent
  };
};

// Updated getBlogBySlug with caching
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `blog:${slug}`;

    // Check cache
    const cachedBlog = await cache.get(cacheKey);
    if (cachedBlog) {
      const parsedBlog = JSON.parse(cachedBlog);
      // Clean cached content too
      const cleanedBlog = cleanBlogContent(parsedBlog);
      return res.status(200).json({ success: true, data: cleanedBlog });
    }

    const blog = await Blog.findOne({ slug })
      .populate('author', 'name profileImage bio isVerified')
      .populate('category', 'name slug color')
      .lean(true);  // ⚡ Optimized
    
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Ensure proper defaults and clean content
    const enrichedBlog = {
      ...blog,
      views: blog.views || 0,
      publishedAt: blog.publishedAt || new Date(),
      featuredImage: blog.featuredImage || '/photos/default-blog.jpg',
      subHeading: blog.subHeading || ''
    };
    
    // Clean the content
    const cleanedBlog = cleanBlogContent(enrichedBlog);

    // Set cache with cleaned blog
    await cache.set(cacheKey, JSON.stringify(cleanedBlog), 3600);

    res.status(200).json({ success: true, data: cleanedBlog });
  } catch (error) {
    console.error('Error in getBlogBySlug:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blog. Please try again.' });
  }
};

// ==================== DRAFT BLOGS ====================

export const getDraftBlogs = async (req, res) => {
  try {
    const { limit = 20, authorId } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

    const blogs = await Blog.getDraftBlogs(authorId, parsedLimit);
    res.status(200).json({ 
      success: true, 
      data: blogs,
      message: `Found ${blogs.length} draft blog(s)`
    });
  } catch (error) {
    console.error('Error in getDraftBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch draft blogs.' });
  }
};

// ==================== SCHEDULED BLOGS ====================

export const getScheduledBlogs = async (req, res) => {
  try {
    const { authorId } = req.query;
    
    const blogs = await Blog.getScheduledBlogs(authorId);
    res.status(200).json({ 
      success: true, 
      data: blogs,
      message: `Found ${blogs.length} scheduled blog(s)`
    });
  } catch (error) {
    console.error('Error in getScheduledBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled blogs.' });
  }
};

export const scheduleBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { publishDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    if (!publishDate) {
      return res.status(400).json({ success: false, error: 'Publish date is required' });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    await blog.schedule(new Date(publishDate));
    
    res.status(200).json({ 
      success: true, 
      message: 'Blog scheduled successfully',
      data: blog 
    });
  } catch (error) {
    console.error('Error in scheduleBlog:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to schedule blog.' });
  }
};

// ==================== PUBLISH/ARCHIVE BLOG ====================

export const publishBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    await blog.publish();
    
    res.status(200).json({ 
      success: true, 
      message: 'Blog published successfully',
      data: blog 
    });
  } catch (error) {
    console.error('Error in publishBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to publish blog.' });
  }
};

export const archiveBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    await blog.archive();
    
    res.status(200).json({ 
      success: true, 
      message: 'Blog archived successfully',
      data: blog 
    });
  } catch (error) {
    console.error('Error in archiveBlog:', error);
    res.status(500).json({ success: false, error: 'Failed to archive blog.' });
  }
};

// ==================== ARCHIVED BLOGS ====================

export const getArchivedBlogs = async (req, res) => {
  try {
    const { limit = 20, authorId } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

    const blogs = await Blog.getArchivedBlogs(authorId, parsedLimit);
    res.status(200).json({ 
      success: true, 
      data: blogs,
      message: `Found ${blogs.length} archived blog(s)`
    });
  } catch (error) {
    console.error('Error in getArchivedBlogs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch archived blogs.' });
  }
};

// ==================== ENGAGEMENT (LIKE/SHARES) ====================

export const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    console.log('\n=== LIKE BLOG REQUEST ===');
    console.log('Blog ID:', id);
    console.log('User ID from req.user._id:', userId);
    console.log('Full req.user:', req.user ? { _id: req.user._id, username: req.user.username } : 'NO USER');
    console.log('Authorization header:', req.headers.authorization ? 'EXISTS' : 'MISSING');
    console.log('Cookie access_token:', req.cookies?.access_token ? 'EXISTS' : 'MISSING');
    console.log('=====================\n');

    // Validate user ID
    if (!userId) {
      console.error('❌ NO USER ID - Request will fail');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - user not found',
        debug: {
          hasUser: !!req.user,
          userKeys: req.user ? Object.keys(req.user) : []
        }
      });
    }

    // Validate blog ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('❌ Invalid blog ID format:', id);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid blog ID format' 
      });
    }

    // Find blog
    const blog = await Blog.findById(id);
    if (!blog) {
      console.error('❌ Blog not found:', id);
      return res.status(404).json({ 
        success: false, 
        error: 'Blog not found' 
      });
    }

    console.log('✅ Blog found:', blog.title);

    // Ensure likes array exists
    if (!blog.likes) {
      blog.likes = [];
    }

    // Check if user already liked
    const isLiked = blog.likes.some(like => like.toString() === userId.toString());
    console.log('Is already liked:', isLiked);

    // Toggle like
    if (isLiked) {
      blog.likes = blog.likes.filter((like) => like.toString() !== userId.toString());
      console.log('✅ Removed like');
    } else {
      blog.likes.push(userId);
      console.log('✅ Added like');
    }

    // Update count
    blog.likesCount = blog.likes.length;
    const savedBlog = await blog.save();
    
    console.log('✅ Blog saved. New count:', blog.likesCount);
    console.log('Final likes array:', blog.likes);

    res.status(200).json({ 
      success: true,
      data: {
        likesCount: blog.likesCount,
        isLiked: !isLiked,
        debug: {
          userId: userId.toString(),
          blogId: id,
          totalLikes: blog.likes.length
        }
      },
      message: !isLiked ? 'Blog liked successfully' : 'Blog unliked successfully'
    });
  } catch (error) {
    console.error('❌ Error in likeBlog:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to like blog', 
      details: error.message 
    });
  }
};

export const getBlogEngagement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid blog ID format' });
    }

    const blog = await Blog.findById(id).select('views likesCount shares commentsCount');
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    const metrics = blog.getEngagementMetrics();
    
    res.status(200).json({ 
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error in getBlogEngagement:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch engagement metrics.' });
  }
};

export const getEngagementTrending = async (req, res) => {
  try {
    const { limit = 10, days = 7 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const parsedDays = Math.min(Math.max(1, parseInt(days) || 7), 90);

    const cacheKey = `blogs:engagement:trending:${parsedLimit}:${parsedDays}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getEngagementTrending(parsedLimit, parsedDays);
    
    await cache.set(cacheKey, blogs, 1800);
    
    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getEngagementTrending:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending blogs.' });
  }
};

export const getMostViewed = async (req, res) => {
  try {
    const { limit = 10, days = 30 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const parsedDays = Math.min(Math.max(1, parseInt(days) || 30), 365);

    const cacheKey = `blogs:mostviewed:${parsedLimit}:${parsedDays}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getMostViewed(parsedLimit, parsedDays);
    
    await cache.set(cacheKey, blogs, 3600);
    
    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getMostViewed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch most viewed blogs.' });
  }
};

export const getMostLiked = async (req, res) => {
  try {
    const { limit = 10, days = 30 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const parsedDays = Math.min(Math.max(1, parseInt(days) || 30), 365);

    const cacheKey = `blogs:mostliked:${parsedLimit}:${parsedDays}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      return res.status(200).json({ success: true, data: cachedResult, cached: true });
    }

    const blogs = await Blog.getMostLiked(parsedLimit, parsedDays);
    
    await cache.set(cacheKey, blogs, 3600);
    
    res.status(200).json({ success: true, data: blogs, cached: false });
  } catch (error) {
    console.error('Error in getMostLiked:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch most liked blogs.' });
  }
};