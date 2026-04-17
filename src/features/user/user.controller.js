// src/features/user/user.controller.js
import { userService } from './user.service.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';

export const userController = {
  /**
   * GET /api/users/stats
   * Get user statistics and summary
   */
  async getStats(req, res, next) {
    try {
      const stats = await userService.getUserStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting user stats', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users
   * Get all users with pagination, search, and filters
   */
  async getAllUsers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        role = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = -1,
        dateFrom = '',
        dateTo = ''
      } = req.query;

      const dateRange = dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null;

      const result = await userService.getAllUsers({
        page,
        limit,
        search,
        role,
        status,
        sortBy,
        sortOrder,
        dateRange
      });

      // Log audit for admin viewing users list
      if (req.user && req.user.role === 'admin') {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'view_users_list',
          category: ACTION_CATEGORIES.ADMIN,
          severity: SEVERITY_LEVELS.LOW,
          details: `Admin ${req.user.username} viewed users list`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            adminUserId: req.user._id.toString(),
            filters: { search, role, status, sortBy }
          }
        }).catch(err => logger.warn('Failed to log audit', { error: err.message }));
      }

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting all users', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users/:userId
   * Get single user by ID
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await userService.getUserById(userId);

      // Log audit
      if (req.user && (req.user.role === 'admin' || req.user._id.toString() === userId)) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'view_user_details',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.LOW,
          details: `User details viewed for ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            viewedUserId: userId,
            viewedBy: req.user._id.toString()
          }
        }).catch(err => logger.warn('Failed to log audit', { error: err.message }));
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Error getting user by ID', { error: error.message });
      next(error);
    }
  },

  /**
   * PUT /api/users/:userId/role
   * Update user role (Admin only)
   */
  async updateUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      const result = await userService.updateUserRole(userId, role, req.user);

      // Log security audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'update_user_role',
        category: ACTION_CATEGORIES.ADMIN,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} updated role for user ${result.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetUserId: userId,
          oldRole: result.oldRole,
          newRole: result.newRole
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error updating user role', { error: error.message });
      next(error);
    }
  },

  /**
   * PUT /api/users/:userId/status
   * Update user status (Admin only)
   */
  async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { active, reason = '' } = req.body;

      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status is required'
        });
      }

      const result = await userService.updateUserStatus(userId, active, reason, req.user);

      // Log security audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: active ? 'activate_user' : 'deactivate_user',
        category: ACTION_CATEGORIES.SECURITY,
        severity: active ? SEVERITY_LEVELS.LOW : SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} ${active ? 'activated' : 'deactivated'} user ${result.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetUserId: userId,
          action: active ? 'activate' : 'deactivate',
          reason
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: `User ${active ? 'activated' : 'deactivated'} successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Error updating user status', { error: error.message });
      next(error);
    }
  },

  /**
   * PUT /api/users/:userId
   * Update user information (fullName, email, phone, role, status)
   */
  async updateUserInfo(req, res, next) {
    try {
      const { userId } = req.params;
      const { fullName, email, phone, role, status } = req.body;

      const updateData = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (role !== undefined) updateData.role = role;
      if (status !== undefined) updateData.status = status;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      const result = await userService.updateUserInfo(userId, updateData, req.user);

      // Log security audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'update_user_info',
        category: ACTION_CATEGORIES.ADMIN,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} updated user information`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetUserId: userId,
          updatedFields: Object.keys(updateData)
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: 'User information updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error updating user info', { error: error.message });
      next(error);
    }
  },

  /**
   * DELETE /api/users/:userId
   * Delete user (Admin only)
   */
  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { softDelete = true, reason = '' } = req.body;

      const result = await userService.deleteUser(userId, softDelete, reason, req.user);

      // Log security audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: softDelete ? 'soft_delete_user' : 'hard_delete_user',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Admin ${req.user.username} ${softDelete ? 'soft' : 'hard'} deleted user`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetUserId: userId,
          deleteType: softDelete ? 'soft' : 'hard',
          reason
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: `User ${softDelete ? 'deactivated' : 'deleted'} successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Error deleting user', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users/role/:role
   * Get users by role
   */
  async getUsersByRole(req, res, next) {
    try {
      const { role } = req.params;
      const { page = 1, limit = 20, search = '' } = req.query;

      const result = await userService.getUsersByRole(role, { page, limit, search });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Error getting users by role', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users/search
   * Search users with advanced filters
   */
  async searchUsers(req, res, next) {
    try {
      const { q, role = '', status = '', sortBy = 'createdAt', sortOrder = -1 } = req.query;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const results = await userService.searchUsers(q, { role, status, sortBy, sortOrder });

      res.json({
        success: true,
        query: q,
        count: results.length,
        data: results
      });
    } catch (error) {
      logger.error('Error searching users', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users/sessions/active
   * Get active sessions count
   */
  async getActiveSessions(req, res, next) {
    try {
      const count = await userService.getActiveSessionsCount();

      res.json({
        success: true,
        data: {
          activeSessionsCount: count,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting active sessions', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/users/activity-summary
   * Get user activity summary
   */
  async getActivitySummary(req, res, next) {
    try {
      const { days = 30 } = req.query;
      const summary = await userService.getUserActivitySummary(parseInt(days));

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting activity summary', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/users/bulk-role-update
   * Bulk update user roles (Admin only)
   */
  async bulkUpdateRoles(req, res, next) {
    try {
      const { userIds, role } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required and must not be empty'
        });
      }

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      const result = await userService.bulkUpdateRoles(userIds, role);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'bulk_update_roles',
        category: ACTION_CATEGORIES.ADMIN,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} bulk updated ${result.updated} users to ${role} role`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          userCount: result.total,
          updatedCount: result.updated,
          newRole: role
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: `Successfully updated ${result.updated} user(s)`,
        data: result
      });
    } catch (error) {
      logger.error('Error bulk updating roles', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/users/bulk-status-update
   * Bulk update user status (Admin only)
   */
  async bulkUpdateStatus(req, res, next) {
    try {
      const { userIds, active } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required and must not be empty'
        });
      }

      if (active === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Active status is required'
        });
      }

      const result = await userService.bulkUpdateStatus(userIds, active);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: active ? 'bulk_activate_users' : 'bulk_deactivate_users',
        category: ACTION_CATEGORIES.ADMIN,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} bulk ${active ? 'activated' : 'deactivated'} ${result.updated} users`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          userCount: result.total,
          updatedCount: result.updated,
          action: active ? 'activate' : 'deactivate'
        }
      }).catch(err => logger.warn('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        message: `Successfully updated ${result.updated} user(s)`,
        data: result
      });
    } catch (error) {
      logger.error('Error bulk updating status', { error: error.message });
      next(error);
    }
  }
};
