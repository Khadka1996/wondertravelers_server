import * as analyticsService from './analytics.service.js';
import { logger } from '../../utils/logger.util.js';

/**
 * GET /analytics/global-reach
 * Get global reach statistics for admin dashboard
 * Query params: days (1-365, default 30)
 */
export const getGlobalReach = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching global reach stats for ${days} days`);
    const stats = await analyticsService.getGlobalReachStats(parseInt(days));

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching global reach:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global reach statistics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/heatmap
 * Get heatmap data for global visualization
 * Query params: days (1-365, default 30)
 */
export const getHeatmapData = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching heatmap data for ${days} days`);
    const data = await analyticsService.getHeatmapData(parseInt(days));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching heatmap data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heatmap data',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/by-type/:type
 * Get analytics data by event type
 * Params: type (page_view, product_view, order, user_signup)
 * Query params: days (1-365, default 30)
 */
export const getAnalyticsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { days = 30 } = req.query;

    logger.info(`Fetching ${type} analytics for ${days} days`);
    const stats = await analyticsService.getAnalyticsByType(type, parseInt(days));

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching analytics by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message,
    });
  }
};

/**
 * POST /analytics/cleanup
 * Cleanup old analytics data (admin only)
 * Body: { retentionDays: 1-365 }
 */
export const cleanupAnalytics = async (req, res) => {
  try {
    const { retentionDays = 90 } = req.body;
    
    logger.info(`Cleaning up analytics older than ${retentionDays} days`, {
      admin: req.user?.email,
    });
    const result = await analyticsService.cleanupOldAnalytics(retentionDays);

    logger.info(`Cleanup complete: ${result.deletedCount} records deleted`);

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old analytics records`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error('Error cleaning up analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup analytics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/regional-stats
 * Get regional analytics statistics
 * Query params: days (1-365, default 30)
 */
export const getRegionalStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching regional stats for ${days} days`);
    const stats = await analyticsService.getRegionalStats(parseInt(days));

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching regional stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch regional statistics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/market-stats
 * Get market analytics - sales by country
 * Query params: days (1-365, default 30)
 */
export const getMarketStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching market stats for ${days} days`);
    const Order = req.app.locals.OrderModel;
    const stats = await analyticsService.getMarketStats(parseInt(days), Order);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market statistics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/market-products
 * Get product performance by market/country
 * Query params: days (1-365, default 30)
 */
export const getProductByMarket = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching product by market for ${days} days`);
    const Order = req.app.locals.OrderModel;
    const stats = await analyticsService.getProductByMarket(parseInt(days), Order);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching product by market:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product market data',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/market-engagement
 * Get user engagement metrics by market
 * Query params: days (1-365, default 30)
 */
export const getUserEngagementByMarket = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching user engagement by market for ${days} days`);
    const Order = req.app.locals.OrderModel;
    const Analytics = req.app.locals.AnalyticsModel;
    const stats = await analyticsService.getUserEngagementByMarket(parseInt(days), Order, Analytics);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching user engagement by market:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market engagement data',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/page-visits
 * Get page visit analytics
 * Query params: days (1-365, default 30)
 */
export const getPageVisitAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching page visit analytics for ${days} days`);
    const stats = await analyticsService.getPageVisitAnalytics(parseInt(days));

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching page visit analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page visit analytics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/detailed-web-analytics
 * Get comprehensive web analytics with time breakdowns
 * Query params: days (1-365, default 30)
 */
export const getDetailedWebAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    logger.info(`Fetching detailed web analytics for ${days} days`);
    const stats = await analyticsService.getDetailedWebAnalytics(parseInt(days));

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching detailed web analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch detailed web analytics',
      error: error.message,
    });
  }
};

/**
 * GET /analytics/debug/stats
 * Debug endpoint - Check if analytics are being tracked
 * Admin only
 */
export const getAnalyticsDebugStats = async (req, res) => {
  try {
    const stats = await analyticsService.getAnalyticsDebugStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching analytics debug stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics debug stats',
      error: error.message,
    });
  }
};
