import { trackAnalyticsEvent } from '../features/analytics/analytics.service.js';

/**
 * Middleware to track page views automatically
 * Attach to Express app to track all page views
 */
export const analyticsTrackingMiddleware = async (req, res, next) => {
  // Skip tracking for certain paths (health checks, analytics endpoints, static files)
  const excludePaths = [
    '/api/health',         // Health check
    '/metrics',            // Prometheus metrics
    '/api/analytics',      // Analytics API itself
    '/api-docs',           // Swagger docs
    '/uploads',            // Static uploads
    '/public',             // Public static files
  ];
  
  const isFrontendRequest = req.path.startsWith('/') && !req.path.startsWith('/api');
  const shouldSkip = excludePaths.some(path => req.path.startsWith(path)) || isFrontendRequest;

  if (!shouldSkip && req.method === 'GET') {  // Only track GET requests (main page navigation)
    // Track asynchronously without blocking the request
    setImmediate(() => {
      trackAnalyticsEvent(req, 'page_view').catch(err =>
        console.error('Failed to track analytics:', err)
      );
    });
  }

  next();
};
