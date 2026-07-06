import express from 'express';
import * as analyticsController from './analytics.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import {
  validateAnalyticsQuery,
  validateAnalyticsType,
  validateCleanupRequest,
} from '../../middleware/analytics-validation.middleware.js';
import {
  analyticsRateLimiter,
  analyticsCleanupRateLimiter,
} from '../../middleware/analytics-rate-limit.middleware.js';

const router = express.Router();

/**
 * All analytics routes require admin authentication
 */
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

/**
 * Apply rate limiting to all analytics endpoints
 */
router.use(analyticsRateLimiter);

// Get global reach statistics
router.get(
  '/global-reach',
  validateAnalyticsQuery,
  analyticsController.getGlobalReach
);

// Get heatmap data
router.get(
  '/heatmap',
  validateAnalyticsQuery,
  analyticsController.getHeatmapData
);

// Get regional statistics
router.get(
  '/regional-stats',
  validateAnalyticsQuery,
  analyticsController.getRegionalStats
);

// Get product performance by market
router.get(
  '/market-products',
  validateAnalyticsQuery,
  analyticsController.getProductByMarket
);

// Get user engagement by market
router.get(
  '/market-engagement',
  validateAnalyticsQuery,
  analyticsController.getUserEngagementByMarket
);

// Get analytics by type
router.get(
  '/by-type/:type',
  validateAnalyticsType,
  validateAnalyticsQuery,
  analyticsController.getAnalyticsByType
);

// Cleanup old analytics (stricter rate limit)
router.post(
  '/cleanup',
  analyticsCleanupRateLimiter,
  validateCleanupRequest,
  analyticsController.cleanupAnalytics
);

// Get page visit analytics
router.get(
  '/page-visits',
  validateAnalyticsQuery,
  analyticsController.getPageVisitAnalytics
);

// Get visits grouped by country
router.get(
  '/visits-by-country',
  validateAnalyticsQuery,
  analyticsController.getVisitsByCountry
);

// Get detailed web analytics
router.get(
  '/detailed-web-analytics',
  validateAnalyticsQuery,
  analyticsController.getDetailedWebAnalytics
);

// Debug endpoint - Check if analytics are being tracked
router.get(
  '/debug/stats',
  analyticsController.getAnalyticsDebugStats
);

export default router;
