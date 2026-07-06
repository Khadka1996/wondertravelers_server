import { logger } from '../utils/logger.util.js';

/**
 * Validate analytics query parameters
 * Ensures days parameter is a valid positive integer between 1-365
 */
export const validateAnalyticsQuery = (req, res, next) => {
  const { days } = req.query;
  
  if (days !== undefined) {
    const parsed = parseInt(days);
    
    // Validate it's a number
    if (isNaN(parsed)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid days parameter. Must be a number between 1 and 365.',
      });
    }
    
    // Validate range
    if (parsed < 1 || parsed > 365) {
      return res.status(400).json({
        success: false,
        message: 'Days parameter must be between 1 and 365.',
      });
    }
    
    // Set validated value
    req.query.days = parsed;
  }
  
  next();
};

/**
 * Validate analytics type parameter
 * Ensures type is one of the allowed event types
 */
export const validateAnalyticsType = (req, res, next) => {
  const { type } = req.params;
  const validTypes = ['page_view', 'product_view', 'order', 'user_signup'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid analytics type: ${type}. Must be one of: ${validTypes.join(', ')}`,
    });
  }
  
  next();
};

/**
 * Validate cleanup analytics request body
 * Ensures retentionDays is valid
 */
export const validateCleanupRequest = (req, res, next) => {
  const { retentionDays } = req.body;
  
  if (retentionDays !== undefined) {
    const parsed = parseInt(retentionDays);
    
    if (isNaN(parsed)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid retentionDays parameter. Must be a number between 1 and 365.',
      });
    }
    
    if (parsed < 1 || parsed > 365) {
      return res.status(400).json({
        success: false,
        message: 'Retention days must be between 1 and 365.',
      });
    }
    
    req.body.retentionDays = parsed;
  }
  
  next();
};
