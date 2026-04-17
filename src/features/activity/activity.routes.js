import express from 'express';
import * as activityController from './activity.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

// ========================
// PROTECTED ROUTES
// ========================

// Get user's own activity history
router.get('/user', authMiddleware.protect, activityController.getUserActivity);

// ========================
// ADMIN ROUTES
// ========================

// Get system-wide activity
router.get(
  '/',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  activityController.getSystemActivity
);

// Get activity for specific resource
router.get(
  '/resource/:resourceType/:resourceId',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  activityController.getResourceActivity
);

// Get activity statistics
router.get(
  '/stats',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  activityController.getActivityStats
);

export default router;
