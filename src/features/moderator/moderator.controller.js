// src/features/moderator/moderator.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';

export const moderatorController = {
  /**
   * GET /api/moderator/users
   * List users with filtering options (with moderation focus)
   */
  async listUsers(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      
      // Build filter
      const filter = {};
      if (req.query.search) {
        filter.$or = [
          { username: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } }
        ];
      }
      if (req.query.role) {
        filter.role = req.query.role;
      }
      if (req.query.active !== undefined) {
        filter.active = req.query.active === 'true';
      }

      const users = await User.find(filter)
        .select('username email role active lastLogin avatar failedLoginAttemptsCount createdAt')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      const total = await User.countDocuments(filter);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Moderator viewed user list (page ${page}, limit ${limit})`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          page,
          limit,
          total,
          filter: Object.keys(filter)
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing users', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/moderator/users/:userId
   * Get detailed user information
   */
  async getUserDetails(req, res, next) {
    try {
      const user = await User.findById(req.params.userId)
        .select('-password -refreshToken -passwordHistory -passwordResetToken')
        .lean();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_details_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Moderator viewed details of user: ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          targetUsername: user.username
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({ success: true, data: user });
    } catch (error) {
      logger.error('Error getting user details', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/moderator/users/:userId/login-history
   * Get user's login history and audit trail
   */
  async getUserLoginHistory(req, res, next) {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
      
      const logs = await SecurityAudit.find({
        userId: req.params.userId,
        action: { $in: ['login_success', 'login_failed', 'logout'] }
      })
        .select('action severity details ipAddress userAgent createdAt metadata')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const user = await User.findById(req.params.userId).select('username email').lean();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'login_history_accessed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Moderator accessed login history of user: ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          logsCount: logs.length
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        data: {
          user: user.username,
          email: user.email,
          loginHistory: logs
        }
      });
    } catch (error) {
      logger.error('Error getting login history', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/moderator/users/:userId/activity
   * Get complete user activity audit trail
   */
  async getUserActivity(req, res, next) {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      
      const activities = await SecurityAudit.find({
        userId: req.params.userId
      })
        .select('action category severity details ipAddress createdAt metadata success')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const user = await User.findById(req.params.userId).select('username email').lean();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_activity_accessed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Moderator accessed activity trail of user: ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          activitiesCount: activities.length
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        data: {
          user: user.username,
          email: user.email,
          activityCount: activities.length,
          activities
        }
      });
    } catch (error) {
      logger.error('Error getting user activity', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/moderator/users/:userId/deactivate
   * Deactivate user account (prevent login)
   */
  async deactivateUser(req, res, next) {
    try {
      const { reason = 'No reason provided' } = req.body;
      
      const user = await User.findById(req.params.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.role === 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: 'Cannot deactivate admin users. Contact super-admin.' 
        });
      }

      user.active = false;
      await user.save();

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_deactivated',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Moderator deactivated user: ${user.username}. Reason: ${reason}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          targetUsername: user.username,
          reason,
          moderatorId: req.user._id,
          moderatorUsername: req.user.username
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        message: `User ${user.username} has been deactivated`,
        data: {
          userId: user._id,
          username: user.username,
          active: user.active
        }
      });
    } catch (error) {
      logger.error('Error deactivating user', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/moderator/users/:userId/reactivate
   * Reactivate deactivated user account
   */
  async reactivateUser(req, res, next) {
    try {
      const { reason = 'No reason provided' } = req.body;
      
      const user = await User.findById(req.params.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.active = true;
      await user.save();

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_reactivated',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Moderator reactivated user: ${user.username}. Reason: ${reason}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          targetUsername: user.username,
          reason
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        message: `User ${user.username} has been reactivated`,
        data: {
          userId: user._id,
          username: user.username,
          active: user.active
        }
      });
    } catch (error) {
      logger.error('Error reactivating user', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/moderator/users/:userId/force-logout
   * Force logout user from all sessions
   */
  async forceLogoutUser(req, res, next) {
    try {
      const user = await User.findById(req.params.userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Clear refresh tokens & increment session version
      user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
      user.trustedDevices = [];
      await user.save();

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_force_logout',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Moderator force logged out user: ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: req.params.userId,
          targetUsername: user.username
        }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        message: `User ${user.username} has been logged out from all sessions`,
        data: {
          userId: user._id,
          username: user.username
        }
      });
    } catch (error) {
      logger.error('Error forcing logout', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/moderator/security/summary
   * Get security metrics and summary
   */
  async getSecuritySummary(req, res, next) {
    try {
      const { days = 7 } = req.query;
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get recent audit data
      const failedLogins = await SecurityAudit.countDocuments({
        action: 'login_failed',
        createdAt: { $gte: dateFrom }
      });

      const successfulLogins = await SecurityAudit.countDocuments({
        action: 'login_success',
        createdAt: { $gte: dateFrom }
      });

      const deactivatedUsers = await User.countDocuments({ active: false });
      const activeUsers = await User.countDocuments({ active: true });
      const totalUsers = await User.countDocuments();

      const suspiciousActivities = await SecurityAudit.countDocuments({
        category: ACTION_CATEGORIES.SECURITY,
        severity: { $in: [SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.CRITICAL] },
        createdAt: { $gte: dateFrom }
      });

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'security_summary_accessed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Moderator viewed security summary (last ${days} days)`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: { days }
      }).catch(err => logger.error('Failed to log moderator action', { error: err.message }));

      res.json({
        success: true,
        data: {
          period: `Last ${days} days`,
          users: {
            total: totalUsers,
            active: activeUsers,
            deactivated: deactivatedUsers
          },
          logins: {
            successful: successfulLogins,
            failed: failedLogins,
            failureRate: successfulLogins + failedLogins > 0 
              ? ((failedLogins / (successfulLogins + failedLogins)) * 100).toFixed(2) + '%'
              : 'N/A'
          },
          security: {
            suspiciousActivities,
            highRiskCount: suspiciousActivities
          }
        }
      });
    } catch (error) {
      logger.error('Error getting security summary', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/moderator/audit-logs
   * View recent audit logs (sample)
   */
  async getAuditLogs(req, res, next) {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const { action, severity, category } = req.query;

      const filter = {};
      if (action) filter.action = action;
      if (severity) filter.severity = severity;
      if (category) filter.category = category;

      const logs = await SecurityAudit.find(filter)
        .select('action category severity details ipAddress userId createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: {
          count: logs.length,
          logs
        }
      });
    } catch (error) {
      logger.error('Error getting audit logs', { error: error.message });
      next(error);
    }
  }
};
