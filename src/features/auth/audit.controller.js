// src/features/auth/audit.controller.js
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from './audit.model.js';
import {User } from './auth.model.js';
import { logger } from '../../utils/logger.util.js';
import mongoose from 'mongoose';

/**
 * Helper function to validate date ranges
 */
const validateDateRange = (startDate, endDate) => {
  if (startDate && isNaN(Date.parse(startDate))) {
    throw new Error('Invalid start date format');
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    throw new Error('Invalid end date format');
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw new Error('Start date cannot be after end date');
  }
  return true;
};

/**
 * Helper to parse pagination parameters
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit) || 50));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

/**
 * Helper to build filter query
 */
const buildFilterQuery = (queryParams) => {
  const filter = {};
  
  // User ID filter
  if (queryParams.userId) {
    if (!mongoose.Types.ObjectId.isValid(queryParams.userId)) {
      throw new Error('Invalid user ID format');
    }
    filter.userId = queryParams.userId;
  }
  
  // Action filter
  if (queryParams.action) {
    filter.action = queryParams.action;
  }
  
  // Category filter
  if (queryParams.category) {
    if (!Object.values(ACTION_CATEGORIES).includes(queryParams.category)) {
      throw new Error(`Invalid category. Must be one of: ${Object.values(ACTION_CATEGORIES).join(', ')}`);
    }
    filter.category = queryParams.category;
  }
  
  // Severity filter
  if (queryParams.severity) {
    if (!Object.values(SEVERITY_LEVELS).includes(queryParams.severity)) {
      throw new Error(`Invalid severity. Must be one of: ${Object.values(SEVERITY_LEVELS).join(', ')}`);
    }
    filter.severity = queryParams.severity;
  }
  
  // IP address filter
  if (queryParams.ipAddress) {
    filter.ipAddress = queryParams.ipAddress;
  }
  
  // Success filter
  if (queryParams.success !== undefined) {
    filter.success = queryParams.success === 'true';
  }
  
  // Status code filter
  if (queryParams.statusCode) {
    const statusCode = parseInt(queryParams.statusCode);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
      throw new Error('Invalid status code. Must be between 100 and 599');
    }
    filter.statusCode = statusCode;
  }
  
  // Method filter
  if (queryParams.method) {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    if (!validMethods.includes(queryParams.method.toUpperCase())) {
      throw new Error(`Invalid method. Must be one of: ${validMethods.join(', ')}`);
    }
    filter.method = queryParams.method.toUpperCase();
  }
  
  // Endpoint filter (partial match) - ✅ Escaped to prevent NoSQL regex injection
  if (queryParams.endpoint) {
    // Escape regex special characters to prevent injection attacks
    const escapedEndpoint = queryParams.endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.endpoint = { $regex: escapedEndpoint, $options: 'i' };
  }
  
  // ✅ NEW: Enforce maximum date range (90 days) to prevent data overload
  const MAX_DATE_RANGE_DAYS = 90;
  if (queryParams.startDate && queryParams.endDate) {
    const rangeDays = (new Date(queryParams.endDate) - new Date(queryParams.startDate)) / (1000 * 60 * 60 * 24);
    if (rangeDays > MAX_DATE_RANGE_DAYS) {
      throw new Error(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
    }
  }
  
  // Tag filter
  if (queryParams.tag) {
    filter.tags = queryParams.tag;
  }
  
  // Source filter
  if (queryParams.source) {
    filter.source = queryParams.source;
  }
  
  // Date range filter
  if (queryParams.startDate || queryParams.endDate) {
    validateDateRange(queryParams.startDate, queryParams.endDate);
    filter.timestamp = {};
    
    if (queryParams.startDate) {
      filter.timestamp.$gte = new Date(queryParams.startDate);
    }
    if (queryParams.endDate) {
      filter.timestamp.$lte = new Date(queryParams.endDate);
    }
  } else {
    // Default to last 7 days if no date range specified
    const defaultDays = parseInt(queryParams.defaultDays) || 7;
    filter.timestamp = {
      $gte: new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000)
    };
  }
  
  return filter;
};

export const auditController = {
  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(req, res, next) {
    try {
      logger.info('Fetching audit logs', {
        userId: req.user._id,
        query: req.query
      });
      
      const { page, limit, skip } = parsePagination(req.query);
      
      // Build filter query
      const filter = buildFilterQuery(req.query);
      
      // Execute queries in parallel for performance
      const [logs, total, distinctActions, distinctIPs] = await Promise.all([
        // Get paginated logs
        SecurityAudit.find(filter)
          .populate('userId', 'username email avatar')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        
        // Get total count
        SecurityAudit.countDocuments(filter),
        
        // Get distinct actions for filter options
        SecurityAudit.distinct('action', filter),
        
        // Get distinct IPs for filter options (limit in JS after getting results)
        SecurityAudit.distinct('ipAddress', filter)
      ]);
      
      // Enrich logs with user-friendly data
      const enrichedLogs = logs.map(log => ({
        ...log,
        // Add virtual properties
        timeAgo: new Date() - new Date(log.timestamp),
        formattedDate: new Date(log.timestamp).toLocaleString(),
        // Add user info if populated
        user: log.userId ? {
          id: log.userId._id,
          username: log.userId.username,
          email: log.userId.email,
          avatar: log.userId.avatar
        } : null
      }));
      
      // Log the audit log access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_accessed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin accessed audit logs with filters: ${JSON.stringify(req.query)}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          page,
          limit,
          totalResults: total,
          filter: req.query
        }
      });
      
      res.json({
        success: true,
        data: enrichedLogs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        filterOptions: {
          actions: distinctActions.sort(),
          ipAddresses: distinctIPs.slice(0, 50).sort()
        },
        appliedFilters: req.query
      });
    } catch (err) {
      logger.error('Error fetching audit logs', {
        error: err.message,
        userId: req.user._id,
        query: req.query
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_access_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to access audit logs: database error`,  // ✅ Generic message
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          error: isProd ? undefined : err.message,  // Error details only in dev
          query: req.query
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Get security summary and statistics
   */
  async getSecuritySummary(req, res, next) {
    try {
      logger.info('Fetching security summary', { userId: req.user._id });
      
      const hours = parseInt(req.query.hours) || 24;
      const days = parseInt(req.query.days) || 7;
      
      if (hours > 720) { // 30 days max
        return res.status(400).json({
          success: false,
          message: 'Maximum time range is 720 hours (30 days)'
        });
      }
      
      // Get dashboard statistics
      const dashboardStats = await SecurityAudit.getDashboardStats(hours);
      
      // Get OVERALL database statistics (not just last X hours)
      const [
        totalInDatabase,
        criticalTotal,
        highTotal,
        mediumTotal,
        lowTotal,
        todayCount,
        thisWeekCount,
        uniqueUsersCount
      ] = await Promise.all([
        // Total logs in entire database
        SecurityAudit.countDocuments({}),
        // Critical severity logs (all time)
        SecurityAudit.countDocuments({ severity: SEVERITY_LEVELS.CRITICAL }),
        // High severity logs (all time)
        SecurityAudit.countDocuments({ severity: SEVERITY_LEVELS.HIGH }),
        // Medium severity logs (all time)
        SecurityAudit.countDocuments({ severity: SEVERITY_LEVELS.MEDIUM }),
        // Low severity logs (all time)
        SecurityAudit.countDocuments({ severity: SEVERITY_LEVELS.LOW }),
        // Logs from today
        SecurityAudit.countDocuments({
          timestamp: {
            $gte: new Date(new Date().toDateString())
          }
        }),
        // Logs from this week
        SecurityAudit.countDocuments({
          timestamp: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }),
        // Unique users count
        SecurityAudit.aggregate([
          { $match: { userId: { $exists: true, $ne: null } } },
          { $group: { _id: '$userId' } },
          { $count: 'count' }
        ]).then(result => result[0]?.count || 0)
      ]);
      
      // Get trend data for the last 7 days
      const trendData = await SecurityAudit.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            totalEvents: { $sum: 1 },
            failedEvents: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
            },
            highSeverityEvents: {
              $sum: { $cond: [{ $eq: ['$severity', SEVERITY_LEVELS.HIGH] }, 1, 0] }
            },
            criticalSeverityEvents: {
              $sum: { $cond: [{ $eq: ['$severity', SEVERITY_LEVELS.CRITICAL] }, 1, 0] }
            }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);
      
      // Get top users by activity
      const topUsers = await SecurityAudit.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(Date.now() - hours * 60 * 60 * 1000)
            },
            userId: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$userId',
            activityCount: { $sum: 1 },
            lastActivity: { $max: '$timestamp' }
          }
        },
        {
          $sort: { activityCount: -1 }
        },
        {
          $limit: 10
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            userId: '$_id',
            username: '$user.username',
            email: '$user.email',
            activityCount: 1,
            lastActivity: 1
          }
        }
      ]);
      
      // Log the summary access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'security_dashboard_accessed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin accessed security summary for last ${hours} hours`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          hours,
          days
        }
      });
      
      res.json({
        success: true,
        summary: {
          period: `${hours}h`,
          // Overall database stats (not filtered by time)
          totalEvents: totalInDatabase,
          criticalEvents: criticalTotal,
          highEvents: highTotal,
          mediumEvents: mediumTotal,
          lowEvents: lowTotal,
          todayEvents: todayCount,
          weekEvents: thisWeekCount,
          uniqueUsers: uniqueUsersCount,
          // Recent period stats (last X hours)
          recentPeriod: {
            period: `${hours}h`,
            totalEvents: dashboardStats.totalEvents,
            failedEvents: dashboardStats.failedEvents,
            highSeverityEvents: dashboardStats.highSeverity,
            criticalSeverityEvents: dashboardStats.criticalSeverity,
            successRate: dashboardStats.totalEvents > 0 
              ? ((dashboardStats.totalEvents - dashboardStats.failedEvents) / dashboardStats.totalEvents * 100).toFixed(2)
              : 100,
            topActions: dashboardStats.topActions,
            suspiciousIPs: dashboardStats.suspiciousIPs
          },
          trendData,
          topUsers
        }
      });
    } catch (err) {
      logger.error('Error fetching security summary', {
        error: err.message,
        userId: req.user._id
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_access_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to access security summary: database error`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          error: err.message
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Get user-specific audit trail
   */
  async getUserAuditTrail(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit = 100 } = req.query;
      
      logger.info('Fetching user audit trail', {
        adminId: req.user._id,
        targetUserId: userId,
        limit
      });
      
      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }
      
      // Check if user exists
      const targetUser = await User.findById(userId)
        .select('_id username email role active')
        .lean();
      
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Authorization check: prevent lower-privilege admins from viewing higher-privilege users
      if (req.user.role === 'admin' && req.user.role !== 'superadmin') {
        // Regular admins cannot view audit trails of other admins or superadmins
        if (['admin', 'superadmin'].includes(targetUser.role)) {
          logger.warn('Unauthorized audit trail access attempt', {
            adminId: req.user._id,
            targetUserId: userId,
            targetRole: targetUser.role,
            adminRole: req.user.role
          });
          
          await SecurityAudit.create({
            userId: req.user._id,
            action: 'unauthorized_audit_trail_access',
            category: ACTION_CATEGORIES.SECURITY,
            severity: SEVERITY_LEVELS.HIGH,
            details: `Unauthorized attempt to access ${targetUser.role} audit trail`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: false,
            metadata: {
              targetUserId: userId,
              targetRole: targetUser.role
            }
          });
          
          return res.status(403).json({
            success: false,
            message: 'Insufficient privileges to view this audit trail'
          });
        }
      }
      
      // Get user's audit logs
      const logs = await SecurityAudit.findByUser(
        userId, 
        parseInt(limit),
        req.query.startDate,
        req.query.endDate
      );
      
      // Get user statistics
      const userStats = await SecurityAudit.aggregate([
        {
          $match: { userId: new mongoose.Types.ObjectId(userId) }
        },
        {
          $facet: {
            totalEvents: [{ $count: 'count' }],
            byAction: [
              { $group: { _id: '$action', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ],
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } }
            ],
            recentIPs: [
              { $group: { _id: '$ipAddress', lastUsed: { $max: '$timestamp' } } },
              { $sort: { lastUsed: -1 } },
              { $limit: 10 }
            ],
            last30Days: [
              {
                $match: {
                  timestamp: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  }
                }
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id': 1 } }
            ]
          }
        }
      ]);
      
      // Log the user audit trail access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_audit_trail_accessed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin accessed audit trail for user: ${targetUser.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: userId,
          targetUsername: targetUser.username,
          limit
        }
      });
      
      res.json({
        success: true,
        user: {
          id: targetUser._id,
          username: targetUser.username,
          email: targetUser.email,
          role: targetUser.role,
          active: targetUser.active
        },
        auditTrail: logs,
        statistics: {
          totalEvents: userStats[0]?.totalEvents[0]?.count || 0,
          byAction: userStats[0]?.byAction || [],
          bySeverity: userStats[0]?.bySeverity || [],
          recentIPs: userStats[0]?.recentIPs || [],
          activityTrend: userStats[0]?.last30Days || []
        }
      });
    } catch (err) {
      logger.error('Error fetching user audit trail', {
        error: err.message,
        adminId: req.user._id,
        targetUserId: req.params.userId
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_audit_trail_access_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to access user audit trail: database error`,  // ✅ Generic
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          targetUserId: req.params.userId,
          error: err.message
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Search audit logs with full-text search
   */
  async searchAuditLogs(req, res, next) {
    try {
      const { q: query, limit = 50, page = 1 } = req.query;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }
      
      logger.info('Searching audit logs', {
        userId: req.user._id,
        query,
        limit,
        page
      });
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Perform full-text search
      const [results, total] = await Promise.all([
        SecurityAudit.find(
          { $text: { $search: query } },
          { score: { $meta: 'textScore' } }
        )
          .populate('userId', 'username email')
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        
        SecurityAudit.countDocuments({ $text: { $search: query } })
      ]);
      
      // Log the search
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_searched',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin searched audit logs for: "${query}"`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          query,
          resultsCount: results.length,
          totalResults: total
        }
      });
      
      res.json({
        success: true,
        query,
        results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      logger.error('Error searching audit logs', {
        error: err.message,
        userId: req.user._id,
        query: req.query.q
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_search_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Search operation failed`,  // ✅ Generic message
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          query: req.query.q,
          error: isProd ? undefined : err.message  // Debug only in dev
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Export audit logs for compliance reporting
   */
  async exportAuditLogs(req, res, next) {
    try {
      const { startDate, endDate, format = 'json', anonymize = false } = req.body;
      
      // Validate request body size (prevent JSON bomb attacks)
      const requestBodySize = JSON.stringify(req.body).length;
      const maxBodySize = 1024 * 100; // 100 KB max
      
      if (requestBodySize > maxBodySize) {
        return res.status(413).json({
          success: false,
          message: 'Request body too large',
          maxSize: `${maxBodySize / 1024}KB`
        });
      }
      
      logger.info('Exporting audit logs', {
        userId: req.user._id,
        startDate,
        endDate,
        format,
        anonymize
      });
      
      // Validate date range
      validateDateRange(startDate, endDate);
      
      // Maximum export range: 90 days
      const maxRangeDays = 90;
      if (startDate && endDate) {
        const rangeDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        if (rangeDays > maxRangeDays) {
          return res.status(400).json({
            success: false,
            message: `Export range cannot exceed ${maxRangeDays} days`
          });
        }
      }
      
      // Get logs for export - exclude sensitive fields
      const logs = await SecurityAudit.exportForCompliance(startDate, endDate)
        .select('-password -sessionId -refreshToken -__v');
      
      if (logs.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No audit logs found for the specified date range'
        });
      }
      
      // ✅ NEW: Apply anonymization if requested (P2-9) - GDPR compliance
      let processedLogs = logs;
      if (anonymize === true || anonymize === 'true') {
        logger.info('Anonymizing audit logs for GDPR compliance', { count: logs.length });
        processedLogs = logs.map(log => anonymizeAuditLog(log, process.env.NODE_ENV === 'production'));
      }
      
      // ✅ NEW: Enforce maximum export size (50MB) to prevent memory DoS
      const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50MB
      const exportSize = JSON.stringify(processedLogs).length;
      
      if (exportSize > MAX_EXPORT_SIZE) {
        return res.status(413).json({
          success: false,
          message: `Export too large (${(exportSize / 1024 / 1024).toFixed(2)}MB). Maximum allowed: 50MB.`,
          suggestion: 'Reduce date range to smaller periods',
          currentSize: `${(exportSize / 1024 / 1024).toFixed(2)}MB`,
          maxSize: '50MB'
        });
      }
      
      // ✅ NEW: Enhanced audit logging for bulk exports (P2-10)
      const isBulkExport = logs.length > 1000;  // More than 1000 records = bulk
      const action = isBulkExport ? 'audit_logs_bulk_export' : 'audit_logs_exported';
      
      // Log the export (with anonymization note and bulk flag)
      await SecurityAudit.create({
        userId: req.user._id,
        action: action,
        category: ACTION_CATEGORIES.SYSTEM,
        severity: isBulkExport ? SEVERITY_LEVELS.HIGH : SEVERITY_LEVELS.MEDIUM,  // Flag bulk exports
        details: `Admin exported ${logs.length} audit logs${anonymize ? ' (anonymized)' : ''}${isBulkExport ? ' [BULK EXPORT]' : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          startDate,
          endDate,
          format,
          recordCount: logs.length,
          exportSize: exportSize,
          anonymized: anonymize,
          bulkExport: isBulkExport,  // Flag for monitoring/compliance
          dateRangeDays: startDate && endDate ? 
            Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) : 0
        }
      });
      
      // Handle different export formats
      if (format === 'csv') {
        // Convert to CSV
        const headers = ['timestamp', 'action', 'severity', 'ipAddress', 'userAgent', 'endpoint', 'method', 'statusCode', 'details'];
        const csvRows = [];
        
        // Add header
        csvRows.push(headers.join(','));
        
        // Add data rows using processedLogs (may be anonymized)
        processedLogs.forEach(log => {
          const row = headers.map(header => {
            const value = log[header] || '';
            // Escape commas and quotes for CSV
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvRows.push(row.join(','));
        });
        
        const csv = csvRows.join('\n');
        
        // ✅ NEW: Add security headers to CSV export
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');  // Prevent MIME sniffing attacks
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');  // No caching
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'");  // Prevent script execution
        return res.send(csv);
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');  // Prevent MIME sniffing
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json(processedLogs);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Use "json" or "csv"'
        });
      }
    } catch (err) {
      logger.error('Error exporting audit logs', {
        error: err.message,
        userId: req.user._id,
        exportParams: req.body
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_export_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Export operation failed`,  // ✅ Generic message
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          exportParams: req.body,
          error: isProd ? undefined : err.message  // Debug only in dev
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Cleanup old audit logs (admin only)
   */
  async cleanupAuditLogs(req, res, next) {
    try {
      const { days, confirm } = req.body;
      
      logger.info('Cleaning up audit logs', {
        userId: req.user._id,
        days,
        confirm
      });
      
      // Validate input
      const retentionDays = days ? parseInt(days) : null;
      
      if (retentionDays && retentionDays < 30) {
        return res.status(400).json({
          success: false,
          message: 'Minimum retention period is 30 days for compliance'
        });
      }
      
      if (retentionDays && retentionDays > 365) {
        return res.status(400).json({
          success: false,
          message: 'Maximum retention period is 365 days'
        });
      }
      
      // Require explicit confirmation for cleanup
      if (!confirm || confirm !== 'YES_DELETE_OLD_LOGS') {
        return res.status(400).json({
          success: false,
          message: 'Confirmation required. Set confirm="YES_DELETE_OLD_LOGS" to proceed'
        });
      }
      
      // Perform cleanup
      const result = await SecurityAudit.cleanupOldRecords(retentionDays);
      
      // Update TTL index with new retention period if specified
      if (retentionDays) {
        // Note: In MongoDB, you need to drop and recreate the TTL index to change expiry
        // This is handled by the createIndexesIfNeeded static method
        await SecurityAudit.createIndexesIfNeeded();
      }
      
      // Log the cleanup
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_cleaned',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Cleaned ${result.deletedCount} audit logs${retentionDays ? ` older than ${retentionDays} days` : ' (default retention)'}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          deletedCount: result.deletedCount,
          retentionDays: retentionDays || 'default',
          admin: req.user.username
        }
      });
      
      res.json({
        success: true,
        message: `Cleaned ${result.deletedCount} audit logs${retentionDays ? ` older than ${retentionDays} days` : ''}`,
        deletedCount: result.deletedCount
      });
    } catch (err) {
      logger.error('Error cleaning audit logs', {
        error: err.message,
        userId: req.user._id,
        cleanupParams: req.body
      });
      
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_logs_cleanup_failed',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Cleanup failed: database error`,  // ✅ Generic
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          cleanupParams: req.body,
          error: isProd ? undefined : err.message  // Debug only in dev
        }
      });
      
      next(err);
    }
  },
  
  /**
   * Get audit log statistics and metrics
   */
  async getAuditMetrics(req, res, next) {
    try {
      logger.info('Fetching audit metrics', { userId: req.user._id });
      
      const hours = parseInt(req.query.hours) || 24;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      
      if (isNaN(hours) || hours < 1 || hours > 720) {
        return res.status(400).json({
          success: false,
          message: 'Invalid hours parameter. Must be between 1 and 720.'
        });
      }
      
      if (isNaN(page) || page < 1) {
        return res.status(400).json({
          success: false,
          message: 'Invalid page parameter. Must be a positive number.'
        });
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter. Must be between 1 and 100.'
        });
      }
      
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const skip = (page - 1) * limit;
      
      try {
        // Get various metrics in parallel
        const [
          hourlyActivity,
          actionDistribution,
          severityDistribution,
          topEndpoints,
          geolocationStats,
          userActivityStats
        ] = await Promise.all([
          // Hourly activity for last 24 hours
          SecurityAudit.aggregate([
            {
              $match: {
                timestamp: { $gte: startTime }
              }
            },
            {
              $group: {
                _id: { $hour: '$timestamp' },
                count: { $sum: 1 },
                failedCount: {
                  $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
                }
              }
            },
            { $sort: { '_id': 1 } }
          ]).catch(e => {
            logger.error('Hourly activity aggregation failed:', e.message);
            return [];
          }),
          
          // Action type distribution
          SecurityAudit.aggregate([
            {
              $match: { timestamp: { $gte: startTime } }
            },
            {
              $group: {
                _id: '$action',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
          ]).catch(e => {
            logger.error('Action distribution aggregation failed:', e.message);
            return [];
          }),
          
          // Severity distribution
          SecurityAudit.aggregate([
            {
              $match: { timestamp: { $gte: startTime } }
            },
            {
              $group: {
                _id: '$severity',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ]).catch(e => {
            logger.error('Severity distribution aggregation failed:', e.message);
            return [];
          }),
          
          // Top endpoints with detailed metrics
          SecurityAudit.aggregate([
            {
              $match: { timestamp: { $gte: startTime } }
            },
            {
              $group: {
                _id: '$endpoint',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                errorRate: {
                  $avg: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
                },
                method: { $first: '$method' },
                statusCode: { $first: '$statusCode' },
                requiresAuth: { $max: { $cond: [{ $eq: ['$userId', null] }, 0, 1] } }
              }
            },
            { $sort: { count: -1 } },
            { $skip: skip },
            { $limit: limit }
          ]).catch(e => {
            logger.error('Top endpoints aggregation failed:', e.message);
            return [];
          }),
          
          // Geolocation statistics
          SecurityAudit.aggregate([
            {
              $match: {
                timestamp: { $gte: startTime },
                'geolocation.country': { $exists: true }
              }
            },
            {
              $group: {
                _id: '$geolocation.country',
                count: { $sum: 1 },
                countryCode: { $first: '$geolocation.countryCode' }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]).catch(e => {
            logger.error('Geolocation aggregation failed:', e.message);
            return [];
          }),
          
          // User activity statistics
          SecurityAudit.aggregate([
            {
              $match: {
                timestamp: { $gte: startTime },
                userId: { $exists: true, $ne: null }
              }
            },
            {
              $group: {
                _id: '$userId',
                activityCount: { $sum: 1 },
                lastActivity: { $max: '$timestamp' }
              }
            },
            { $sort: { activityCount: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
              }
            },
            {
              $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
            },
            {
              $project: {
                userId: '$_id',
                username: '$user.username',
                email: '$user.email',
                activityCount: 1,
                lastActivity: 1
              }
            }
          ]).catch(e => {
            logger.error('User activity aggregation failed:', e.message);
            return [];
          })
        ]);
        
        // Calculate total metrics
        const totalMetrics = await SecurityAudit.aggregate([
          {
            $match: { timestamp: { $gte: startTime } }
          },
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              failedEvents: {
                $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
              },
              avgResponseTime: { $avg: '$responseTime' },
              uniqueIPs: { $addToSet: '$ipAddress' },
              uniqueUsers: { $addToSet: '$userId' }
            }
          }
        ]).catch(e => {
          logger.error('Total metrics aggregation failed:', e.message);
          return [];
        });
        
        // Get total unique endpoint count
        const totalEndpointCount = await SecurityAudit.aggregate([
          {
            $match: { timestamp: { $gte: startTime } }
          },
          {
            $group: {
              _id: '$endpoint'
            }
          },
          {
            $count: 'total'
          }
        ]).catch(e => {
          logger.error('Total endpoint count aggregation failed:', e.message);
          return [];
        });
        
        const metrics = totalMetrics[0] || {
          totalEvents: 0,
          failedEvents: 0,
          avgResponseTime: 0,
          uniqueIPs: [],
          uniqueUsers: []
        };
        
        // Log metrics access
        try {
          await SecurityAudit.create({
            userId: req.user._id,
            action: 'audit_metrics_accessed',
            category: ACTION_CATEGORIES.SYSTEM,
            severity: SEVERITY_LEVELS.LOW,
            details: `Admin accessed audit metrics for last ${hours} hours`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: true,
            metadata: { hours }
          });
        } catch (e) {
          logger.warn('Failed to create audit log for metrics access:', e.message);
          // Don't fail the whole request if audit logging fails
        }
        
        res.json({
          success: true,
          metrics: {
            period: `${hours}h`,
            totalEvents: metrics.totalEvents,
            failedEvents: metrics.failedEvents,
            successRate: metrics.totalEvents > 0 
              ? ((metrics.totalEvents - metrics.failedEvents) / metrics.totalEvents * 100).toFixed(2)
              : 100,
            avgResponseTime: metrics.avgResponseTime ? Math.round(metrics.avgResponseTime) : 0,
            uniqueIPs: metrics.uniqueIPs ? metrics.uniqueIPs.filter(ip => ip).length : 0,
            uniqueUsers: metrics.uniqueUsers ? metrics.uniqueUsers.filter(user => user).length : 0,
            hourlyActivity,
            actionDistribution,
            severityDistribution,
            topEndpoints,
            geolocationStats,
            userActivityStats,
            // Pagination info
            pagination: {
              currentPage: page,
              pageSize: limit,
              totalEndpoints: totalEndpointCount[0]?.total || 0,
              totalPages: Math.ceil((totalEndpointCount[0]?.total || 0) / limit),
              hasMore: page < Math.ceil((totalEndpointCount[0]?.total || 0) / limit)
            }
          }
        });
      } catch (innerErr) {
        logger.error('Error in metrics aggregation:', {
          error: innerErr.message,
          stack: innerErr.stack
        });
        
        return res.status(500).json({
          success: false,
          message: 'Error calculating metrics',
          error: process.env.NODE_ENV === 'development' ? innerErr.message : undefined
        });
      }
    } catch (err) {
      logger.error('Error fetching audit metrics', {
        error: err.message,
        stack: err.stack,
        userId: req.user._id
      });
      
      // Return error response instead of calling next
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch audit metrics',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
  },
  
  /**
   * Get real-time audit stream (WebSocket/SSE ready)
   */
  async streamAuditEvents(req, res, next) {
    try {
      logger.info('Starting audit event stream', { userId: req.user._id });
      
      // ✅ NEW: Add origin validation for SSE streams (CSRF protection)
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        process.env.AUDIT_DASHBOARD_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://api.wondertravelers.com',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5000'
      ].filter(Boolean);
      
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        logger.warn('SSE stream CSRF attempt blocked', { origin, userId: req.user._id });
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'stream_csrf_attempt',
          severity: SEVERITY_LEVELS.HIGH,
          category: ACTION_CATEGORIES.SECURITY,
          details: `Unauthorized origin attempted to open SSE stream: ${origin}`,
          ipAddress: req.ip,
          endpoint: req.path,
          method: req.method,
          success: false
        });
        return res.status(403).json({ message: 'CORS violation on stream endpoint' });
      }
      
      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.setHeader('Access-Control-Allow-Origin', origin || '*');  // Allow specific origin
      
      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Audit event stream connected',
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // Keep track of last event timestamp
      let lastTimestamp = new Date();
      
      // Function to check for new events
      const checkNewEvents = async () => {
        try {
          const newEvents = await SecurityAudit.find({
            timestamp: { $gt: lastTimestamp }
          })
            .sort({ timestamp: 1 })
            .limit(50)
            .populate('userId', 'username email')
            .lean();
          
          if (newEvents.length > 0) {
            // Update last timestamp
            lastTimestamp = newEvents[newEvents.length - 1].timestamp;
            
            // Send each event
            newEvents.forEach(event => {
              const eventData = {
                type: 'audit_event',
                data: {
                  ...event,
                  timeAgo: new Date() - new Date(event.timestamp),
                  formattedDate: new Date(event.timestamp).toLocaleString()
                }
              };
              
              res.write(`data: ${JSON.stringify(eventData)}\n\n`);
            });
          }
          
          // Send heartbeat every 30 seconds
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
          
        } catch (error) {
          logger.error('Error checking new audit events', { error: error.message });
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: 'Error checking for new events',
            error: error.message
          })}\n\n`);
        }
      };
      
      // Check for new events every 5 seconds
      const intervalId = setInterval(checkNewEvents, 5000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(intervalId);
        logger.info('Audit event stream disconnected', { userId: req.user._id });
        
        // Log stream disconnect
        SecurityAudit.create({
          userId: req.user._id,
          action: 'audit_stream_disconnected',
          category: ACTION_CATEGORIES.SYSTEM,
          severity: SEVERITY_LEVELS.LOW,
          details: 'Audit event stream disconnected by client',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            duration: new Date() - new Date(lastTimestamp)
          }
        }).catch(err => logger.error('Failed to log stream disconnect', err));
      });
      
      // Log stream connection
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'audit_stream_connected',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: 'Audit event stream connection established',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true
      });
      
    } catch (err) {
      logger.error('Error setting up audit event stream', {
        error: err.message,
        userId: req.user._id
      });
      
      next(err);
    }
  }
};

// ✅ NEW: Helper function for anonymizing audit logs (P2-9) - GDPR compliance
const anonymizeAuditLog = (log, isProd = true) => {
  if (typeof log.toObject === 'function') {
    log = log.toObject();
  }
  
  const crypto = require('crypto');
  const hashValue = (value) => {
    if (!value) return value;
    return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
  };
  
  return {
    ...log,
    // Hash IP addresses for privacy
    ipAddress: log.ipAddress ? `IP-${hashValue(log.ipAddress)}` : '[REDACTED]',
    // Remove user agents
    userAgent: '[REDACTED]',
    // Remove geolocation details
    geolocation: log.geolocation ? {
      country: '[REDACTED]',
      city: '[REDACTED]',
      latitude: null,
      longitude: null
    } : null,
    // Hash user ID
    userId: log.userId ? hashValue(log.userId) : null,
    // Keep action and timestamp for audit purposes
    // Remove sensitive metadata
    metadata: log.metadata ? {
      ...log.metadata,
      error: undefined,
      token: undefined,
      sessionId: undefined
    } : null
  };
};

// Export anonymize function for use in routes
auditController.anonymizeAuditLog = anonymizeAuditLog;