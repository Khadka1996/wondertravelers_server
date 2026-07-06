// src/features/user/user.service.js
import { User } from '../auth/auth.model.js';
import { logger } from '../../utils/logger.util.js';
import mongoose from 'mongoose';

// Helper to convert user to safe response
const userToResponse = (user) => {
  if (!user) return null;
  
  const userObj = user.toObject ? user.toObject() : user;
  
  // Remove sensitive fields
  delete userObj.password;
  delete userObj.refreshToken;
  delete userObj.refreshTokenExpires;
  delete userObj.refreshTokenVersion;
  delete userObj.sessionVersion;
  delete userObj.passwordHistory;
  delete userObj.passwordResetToken;
  delete userObj.passwordResetExpires;
  delete userObj.loginAttempts;
  delete userObj.lastFailedLogin;
  delete userObj.lastLogoutAt;
  
  return userObj;
};

export const userService = {
  /**
   * Get user statistics and summaries
   */
  async getUserStats() {
    try {
      const [
        totalUsers,
        totalAdmins,
        totalModerators,
        totalRegularUsers,
        activeUsers,
        inactiveUsers,
        verifiedEmails,
        lastLoginStats
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ role: 'moderator' }),
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ active: true }),
        User.countDocuments({ active: false }),
        User.countDocuments({ emailVerified: true }),
        User.aggregate([
          {
            $group: {
              _id: null,
              lastLogin: { $max: '$lastLogin' },
              avgLastLogin: { $avg: { $cond: ['$lastLogin', 1, 0] } }
            }
          }
        ])
      ]);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeIn30Days = await User.countDocuments({
        lastLogin: { $gte: thirtyDaysAgo }
      });

      return {
        totalUsers,
        totalAdmins,
        totalModerators,
        totalRegularUsers,
        activeUsers,
        inactiveUsers,
        verifiedEmails,
        activeIn30Days,
        lastLoginStats: lastLoginStats[0] || { lastLogin: null, avgLastLogin: 0 }
      };
    } catch (error) {
      logger.error('Error getting user stats', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all users with pagination, search, and filters
   */
  async getAllUsers(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        role = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = -1,
        dateRange = null
      } = options;

      // Validate pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter object
      const filter = {};

      // Role filter
      if (role && ['admin', 'moderator', 'user'].includes(role.toLowerCase())) {
        filter.role = role.toLowerCase();
      }

      // Status filter (active/inactive)
      if (status) {
        if (status.toLowerCase() === 'active') {
          filter.active = true;
        } else if (status.toLowerCase() === 'inactive') {
          filter.active = false;
        }
      }

      // Search filter - search in username, email, and fullName
      if (search.trim()) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      // Date range filter
      if (dateRange) {
        if (dateRange.from && dateRange.to) {
          filter.createdAt = {
            $gte: new Date(dateRange.from),
            $lte: new Date(dateRange.to)
          };
        }
      }

      // Validate sortBy - prevent injection
      const allowedSortFields = ['createdAt', 'lastLogin', 'username', 'email', 'role', 'active'];
      const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const finalSortOrder = sortOrder === 1 ? 1 : -1;

      // Execute query
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('username email fullName firstName lastName role avatar active lastLogin createdAt emailVerified')
          .skip(skip)
          .limit(limitNum)
          .sort({ [finalSortBy]: finalSortOrder })
          .lean(),
        User.countDocuments(filter)
      ]);

      // Transform users
      const transformedUsers = users.map((user, index) => ({
        sno: skip + index + 1,
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        status: user.active ? 'active' : 'inactive',
        joined: user.createdAt,
        lastLogin: user.lastLogin,
        emailVerified: user.emailVerified || false
      }));

      return {
        data: transformedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      };
    } catch (error) {
      logger.error('Error getting all users', { error: error.message });
      throw error;
    }
  },

  /**
   * Get single user by ID
   */
  async getUserById(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId)
        .select('-password -refreshToken -sessionVersion -passwordHistory');

      if (!user) {
        throw new Error('User not found');
      }

      return userToResponse(user);
    } catch (error) {
      logger.error('Error getting user by ID', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole, updatedByAdmin) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      if (!['user', 'moderator', 'admin'].includes(newRole)) {
        throw new Error('Invalid role provided');
      }

      // Prevent user from downgrading themselves
      if (userId === updatedByAdmin._id.toString() && newRole === 'user') {
        throw new Error('Cannot downgrade your own role to user');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldRole = user.role;
      user.role = newRole;
      await user.save();

      logger.info('User role updated', {
        userId,
        oldRole,
        newRole,
        updatedBy: updatedByAdmin._id
      });

      return {
        userId: user._id,
        username: user.username,
        email: user.email,
        oldRole,
        newRole,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error updating user role', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Update user status (active/inactive)
   */
  async updateUserStatus(userId, active, reason = '', updatedByAdmin) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      // Prevent user from deactivating themselves
      if (userId === updatedByAdmin._id.toString() && !active) {
        throw new Error('You cannot deactivate your own account');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const previousStatus = user.active;
      user.active = active;
      await user.save();

      logger.info('User status updated', {
        userId,
        previousStatus,
        newStatus: active,
        reason,
        updatedBy: updatedByAdmin._id
      });

      return {
        userId: user._id,
        username: user.username,
        email: user.email,
        previousStatus,
        currentStatus: active,
        reason,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error updating user status', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Update user information (fullName, email, phone, role, status)
   */
  async updateUserInfo(userId, updateData, updatedByAdmin) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const oldData = {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active
      };

      // Update allowed fields
      if (updateData.fullName !== undefined) user.fullName = updateData.fullName;
      if (updateData.email !== undefined) user.email = updateData.email;
      if (updateData.phone !== undefined) user.phone = updateData.phone;
      if (updateData.role !== undefined) user.role = updateData.role;
      if (updateData.status !== undefined) user.active = updateData.status === 'active';

      await user.save();

      logger.info('User info updated', {
        userId,
        oldData,
        newData: { fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, active: user.active },
        updatedBy: updatedByAdmin._id
      });

      return {
        _id: user._id,
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.active ? 'active' : 'inactive',
        avatar: user.avatar,
        emailVerified: user.emailVerified || false,
        createdAt: user.createdAt,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error updating user info', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Delete user (soft delete or hard delete)
   */
  async deleteUser(userId, softDelete = true, reason = '', deletedByAdmin) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID format');
      }

      // Prevent user from deleting themselves
      if (userId === deletedByAdmin._id.toString()) {
        throw new Error('You cannot delete your own account');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      let result;
      if (softDelete) {
        // Soft delete - mark as inactive
        user.active = false;
        await user.save();
        result = { deleted: true, type: 'soft_delete', userId: user._id };
      } else {
        // Hard delete - remove from database
        const username = user.username;
        const email = user.email;
        await User.findByIdAndDelete(userId);
        result = { deleted: true, type: 'hard_delete', userId, username, email };
      }

      logger.info('User deleted', {
        userId,
        type: softDelete ? 'soft_delete' : 'hard_delete',
        reason,
        deletedBy: deletedByAdmin._id
      });

      return result;
    } catch (error) {
      logger.error('Error deleting user', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Get users by role
   */
  async getUsersByRole(role, pagination = {}) {
    try {
      if (!['user', 'moderator', 'admin'].includes(role)) {
        throw new Error('Invalid role provided');
      }

      const { page = 1, limit = 20, search = '' } = pagination;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const filter = { role };

      if (search.trim()) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('username email fullName role avatar active lastLogin createdAt')
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(filter)
      ]);

      return {
        data: users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      };
    } catch (error) {
      logger.error('Error getting users by role', { error: error.message, role });
      throw error;
    }
  },

  /**
   * Search users with advanced filters
   */
  async searchUsers(query, filters = {}) {
    try {
      const {
        role = '',
        status = '',
        sortBy = 'createdAt',
        sortOrder = -1
      } = filters;

      const searchFilter = {
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { fullName: { $regex: query, $options: 'i' } }
        ]
      };

      if (role && ['admin', 'moderator', 'user'].includes(role.toLowerCase())) {
        searchFilter.role = role.toLowerCase();
      }

      if (status) {
        searchFilter.active = status.toLowerCase() === 'active';
      }

      const users = await User.find(searchFilter)
        .select('username email fullName role avatar active lastLogin createdAt')
        .limit(50)
        .sort({ [sortBy]: sortOrder })
        .lean();

      return users;
    } catch (error) {
      logger.error('Error searching users', { error: error.message, query });
      throw error;
    }
  },

  /**
   * Get active sessions count
   */
  async getActiveSessionsCount() {
    try {
      // Count users with recent last login (within last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const activeSessions = await User.countDocuments({
        lastLogin: { $gte: oneDayAgo },
        active: true
      });

      return activeSessions;
    } catch (error) {
      logger.error('Error getting active sessions count', { error: error.message });
      throw error;
    }
  },

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(daysBack = 30) {
    try {
      const dateRange = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      const [newUsers, activeUsers, inactiveUsers] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: dateRange } }),
        User.countDocuments({
          lastLogin: { $gte: dateRange },
          active: true
        }),
        User.countDocuments({
          lastLogin: { $lt: dateRange },
          active: true
        })
      ]);

      return {
        period: `${daysBack} days`,
        newUsers,
        activeUsers,
        inactiveUsers,
        totalActive: activeUsers + inactiveUsers
      };
    } catch (error) {
      logger.error('Error getting user activity summary', { error: error.message });
      throw error;
    }
  },

  /**
   * Bulk update user roles
   */
  async bulkUpdateRoles(userIds, newRole) {
    try {
      if (!['user', 'moderator', 'admin'].includes(newRole)) {
        throw new Error('Invalid role provided');
      }

      // Validate user IDs
      const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        throw new Error('No valid user IDs provided');
      }

      const result = await User.updateMany(
        { _id: { $in: validIds } },
        { role: newRole },
        { multi: true }
      );

      logger.info('Bulk update user roles completed', {
        userIds: validIds,
        newRole,
        modified: result.modifiedCount
      });

      return {
        updated: result.modifiedCount,
        total: validIds.length
      };
    } catch (error) {
      logger.error('Error bulk updating user roles', { error: error.message });
      throw error;
    }
  },

  /**
   * Bulk update user status
   */
  async bulkUpdateStatus(userIds, active) {
    try {
      // Validate user IDs
      const validIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        throw new Error('No valid user IDs provided');
      }

      const result = await User.updateMany(
        { _id: { $in: validIds } },
        { active },
        { multi: true }
      );

      logger.info('Bulk update user status completed', {
        userIds: validIds,
        active,
        modified: result.modifiedCount
      });

      return {
        updated: result.modifiedCount,
        total: validIds.length
      };
    } catch (error) {
      logger.error('Error bulk updating user status', { error: error.message });
      throw error;
    }
  }
};
