// src/features/featured-image/featured-image.routes.js
import express from 'express';
import { body } from 'express-validator';
import {
  getFeaturedImages,
  getAllFeaturedImages,
  getFeaturedImageById,
  createFeaturedImage,
  uploadFeaturedImage,
  updateFeaturedImage,
  deleteFeaturedImage,
  recordView,
  recordClick,
  reorderFeaturedImages
} from './featured-image.controller.js';
import { validateAdminPrivilege } from '../../middleware/admin-privilege.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { uploadFeaturedImage as uploadFeaturedImageMiddleware, processFeaturedImage } from '../../middleware/upload.middleware.js';
import { logger } from '../../utils/logger.util.js';

const router = express.Router();

// Middleware to check if user has admin role
const requireAdminRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const adminRoles = ['admin', 'super-admin', 'moderator'];
  if (!adminRoles.includes(req.user.role)) {
    logger.warn('Non-admin user attempted admin operation', {
      userId: req.user._id,
      userRole: req.user.role,
      path: req.path,
      method: req.method
    });
    
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action. Admin access required.'
    });
  }

  next();
};

// Validation middleware - only imageUrl required
const validateFeaturedImage = [
  body('imageUrl').trim().notEmpty().withMessage('Image URL is required').isURL({ require_protocol: true })
];

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Featured images endpoint is healthy' });
});

// Public routes
router.get('/public', getFeaturedImages);
router.get('/public/:id', getFeaturedImageById);
router.post('/public/:id/view', recordView);
router.post('/public/:id/click', recordClick);

// Admin routes
router.get('/', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getAllFeaturedImages);

// Upload route MUST come before /:id routes to avoid conflicts
router.post(
  '/upload',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  uploadFeaturedImageMiddleware,
  processFeaturedImage,
  uploadFeaturedImage
);

// Create and update routes
router.post(
  '/',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  validateFeaturedImage,
  createFeaturedImage
);

// Reorder route
router.post(
  '/reorder',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  reorderFeaturedImages
);

// ID-based routes (MUST be last)
// PUT with optional image upload for editing
router.put(
  '/:id',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  uploadFeaturedImageMiddleware,  // Optional - will skip if no file
  (req, res, next) => {
    // Only process image if file was uploaded
    if (req.file) {
      processFeaturedImage(req, res, next);
    } else {
      next();
    }
  },
  updateFeaturedImage
);

router.delete(
  '/:id',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  deleteFeaturedImage
);

export default router;
