import express from 'express';
import {
  getDestinations,
  getFeaturedDestinations,
  getCategories,
  getDestinationBySlug,
  getAllDestinationsAdmin,
  createDestination,
  updateDestination,
  deleteDestination,
  recordDestinationView,
  saveDestination
} from './destination.controller.js';
import {
  getDestinationRatings,
  rateDestination,
  getUserRating,
  deleteRating,
  markHelpful,
  markUnhelpful
} from './rating.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { z } from 'zod';

const router = express.Router();

/**
 * PUBLIC ROUTES - No authentication required
 */

// Get all published destinations with filters
router.get('/public', getDestinations);

// Get featured destinations only
router.get('/featured', getFeaturedDestinations);

// Get available categories
router.get('/categories', getCategories);

// Get single destination by slug
router.get('/public/:slug', getDestinationBySlug);

// Record destination view
router.post('/:id/view', recordDestinationView);

/**
 * PROTECTED ROUTES - Requires authentication
 */

// Save destination
router.post(
  '/:id/save',
  authMiddleware.protect,
  saveDestination
);

/**
 * ADMIN ONLY ROUTES
 */

// Get all destinations (published & unpublished) - for admin panel
router.get(
  '/admin/all',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  getAllDestinationsAdmin
);

// Create new destination
const createDestinationSchema = z.object({
  name: z.string().min(3).max(100),
  category: z.enum(['Mountains', 'Lakes & Adventure', 'Cultural Heritage', 'Trekking', 'Wildlife & Jungle', 'Other']),
  shortDesc: z.string().min(10).max(200),
  longDesc: z.string().max(2000).optional(),
  image: z.object({
    url: z.string().url(),
    size: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional()
  }),
  featured: z.boolean().optional(),
  published: z.boolean().optional()
});

router.post(
  '/',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  validate(createDestinationSchema, 'body'),
  createDestination
);

// Update destination
router.put(
  '/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  updateDestination
);

// Delete destination
router.delete(
  '/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  deleteDestination
);

/**
 * RATING ROUTES
 */

// Get all ratings for a destination (public)
router.get('/:id/ratings', getDestinationRatings);

// Get user's rating for a destination (auth protected)
router.get(
  '/:id/my-rating',
  authMiddleware.protect,
  getUserRating
);

// Rate a destination (auth protected)
const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  review: z.string().max(500).optional()
});

router.post(
  '/:id/ratings',
  authMiddleware.protect,
  validate(ratingSchema, 'body'),
  rateDestination
);

// Delete user's rating (auth protected, owner only)
router.delete(
  '/:id/ratings/:ratingId',
  authMiddleware.protect,
  deleteRating
);

// Mark rating as helpful (public)
router.post('/:id/ratings/:ratingId/helpful', markHelpful);

// Mark rating as unhelpful (public)
router.post('/:id/ratings/:ratingId/unhelpful', markUnhelpful);

export default router;
