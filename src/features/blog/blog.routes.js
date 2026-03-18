// src/features/blog/blog.routes.js

import express from 'express';
import {
  createBlog,
  getBlogs,
  getNews,
  getAllBlogsForAdmin,
  getBlogById,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
  uploadBlogImage,
  getBlogsByCategory,
  getSimilarBlogs,
  getBlogsByTag,
  getBlogsByAuthor,
  getBlogsByAuthorName,
  getRecentBlogs,
  getTrendingBlogs,
  getFeaturedBlogs,
  getBreakingNews,
  getDraftBlogs,
  getScheduledBlogs,
  scheduleBlog,
  publishBlog,
  archiveBlog,
  getArchivedBlogs,
  likeBlog,
  getBlogEngagement,
  getEngagementTrending,
  getMostViewed,
  getMostLiked,
} from './blog.controller.js';
import {
  getCommentsForBlog,
  addCommentToBlog,
  deleteComment,
  updateComment
} from '../comment/comment.controller.js';
import { requireAdminRole } from '../../middleware/admin-privilege.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import multer from 'multer';

const router = express.Router();

// Configure Multer for blog image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/blogs/'); // Directory for storing blog images
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Create a new blog (Admin or Super Admin)
router.post('/', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, upload.single('featuredImage'), createBlog);

// ==================== ADMIN ONLY ROUTES (must come first) ====================

// Get all blogs for admin (no filters - all statuses and types)
router.get('/admin/all', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getAllBlogsForAdmin);

// Get draft blogs (Admin)
router.get('/admin/drafts', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getDraftBlogs);

// Get scheduled blogs (Admin)
router.get('/admin/scheduled', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getScheduledBlogs);

// Get archived blogs (Admin)
router.get('/admin/archived', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getArchivedBlogs);

// ==================== PUBLIC ROUTES ====================

// Get all blogs
router.get('/', getBlogs);

// Get all news
router.get('/news', getNews);

// ==================== PUBLIC CURATED BLOG ENDPOINTS ====================

// Get recent blogs (latest published)
router.get('/recent', getRecentBlogs);

// Get trending blogs (this week)
router.get('/trending', getTrendingBlogs);

// Get featured blogs
router.get('/featured', getFeaturedBlogs);

// Get breaking news
router.get('/breaking-news', getBreakingNews);

// ==================== ENGAGEMENT ENDPOINTS ====================

// Get engagement trending (most liked/shared)
router.get('/engagement/trending', getEngagementTrending);

// Get most viewed blogs
router.get('/engagement/most-viewed', getMostViewed);

// Get most liked blogs
router.get('/engagement/most-liked', getMostLiked);

// ==================== BLOG STATUS ACTIONS ====================

// Publish a blog (Admin)  
router.put('/:id/publish', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, publishBlog);

// Archive a blog (Admin)
router.put('/:id/archive', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, archiveBlog);

// Schedule a blog (Admin)
router.post('/:id/schedule', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, scheduleBlog);

// ==================== GENERAL BLOG ENDPOINTS ====================

// Get a single blog by slug (PUBLIC) - Must come before /:id routes
router.get('/slug/:slug', getBlogBySlug);

// Retrieve blogs by category - Must come before /:id routes
router.get('/category/:categoryId', getBlogsByCategory);

// Retrieve blogs by tag - Must come before /:id routes
router.get('/tag/:tag', getBlogsByTag);

// Retrieve blogs by author - Must come before /:id routes
router.get('/author/:authorId', getBlogsByAuthor);

// Retrieve blogs by author name (for author page) - NEW
router.get('/author-name/:authorName', getBlogsByAuthorName);

// ==================== COMMENT ENDPOINTS ====================

// Get comments for a blog - Must come before /:id route
router.get('/:id/comments', getCommentsForBlog);

// Add a comment to a blog (requires authentication)
router.post('/:id/comments', (req, res, next) => authMiddleware.protect(req, res, next), addCommentToBlog);

// Update a comment (requires authentication - only author can edit)
router.put('/:id/comments/:commentId', (req, res, next) => authMiddleware.protect(req, res, next), updateComment);

// Delete a comment (requires authentication)
router.delete('/:id/comments/:commentId', (req, res, next) => authMiddleware.protect(req, res, next), deleteComment);

// ==================== ENGAGEMENT & ACTION ENDPOINTS ====================

// DEBUG: Log like requests before processing
router.post('/:id/like', (req, res, next) => {
  console.log('\n=== LIKE ROUTE HIT ===');
  console.log('Blog ID from params:', req.params.id);
  console.log('Authorization header:', req.headers.authorization ? '✅ EXISTS' : '❌ MISSING');
  console.log('Cookies:', Object.keys(req.cookies || {}).join(', ') || '❌ No cookies');
  console.log('Access token cookie:', req.cookies?.access_token ? '✅ EXISTS' : '❌ MISSING');
  console.log('Next: calling protect middleware');
  console.log('====================\n');
  authMiddleware.protect(req, res, next);
}, likeBlog);

// Get blog engagement metrics
router.get('/:id/engagement', getBlogEngagement);

// Retrieve similar blogs by ID
router.get('/:id/similar', getSimilarBlogs);

// Upload blog image
router.post('/:id/image', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, upload.single('image'), uploadBlogImage);

// ==================== GENERIC BLOG ENDPOINTS ====================

// Get a single blog by ID - Must come after all /:id/* routes
router.get('/:id', getBlogById);

// Update a blog (Admin or Super Admin) - with file upload support
router.put('/:id', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, upload.single('featuredImage'), updateBlog);

// Delete a blog (Admin or Super Admin)
router.delete('/:id', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, deleteBlog);

export default router;