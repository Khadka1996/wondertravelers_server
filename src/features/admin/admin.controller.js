// src/features/admin/admin.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../auth/audit.model.js';
import Blog from '../blog/blog.model.js';
import Advertisement from '../advertisement/advertisement.model.js';
import Category from '../category/category.model.js';
import { logger } from '../../utils/logger.util.js';
import mongoose from 'mongoose';

export const adminController = {
  /**
   * Test endpoint to verify dashboard is working
   */
  async testDashboard(req, res) {
    return res.json({
      success: true,
      message: 'Dashboard test endpoint working',
      user: req.user?.username,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Toggle user lock/unlock
   */
  async toggleUserLock(req, res, next) {
    try {
      const { userId } = req.params;
      const { lock, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Toggle active status based on lock parameter
      user.active = !lock;
      await user.save();

      // Log admin action - SAFE: Verify req.user exists
      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: lock ? 'user_locked' : 'user_unlocked',
          category: ACTION_CATEGORIES.SECURITY,
          severity: lock ? SEVERITY_LEVELS.MEDIUM : SEVERITY_LEVELS.LOW,
          details: `Admin ${req.user.username} ${lock ? 'locked' : 'unlocked'} user ${user.username}${reason ? ` - Reason: ${reason}` : ''}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            targetUserId: user._id.toString(),
            targetUsername: user.username,
            adminUserId: req.user._id.toString(),
            adminUsername: req.user.username,
            reason: reason || null,
            lockStatus: lock
          }
        });
      }

      logger.info(`User ${lock ? 'locked' : 'unlocked'} by admin`, {
        targetUserId: user._id,
        targetUsername: user.username,
        adminId: req.user._id,
        reason
      });

      res.json({
        success: true,
        message: `User ${lock ? 'locked' : 'unlocked'} successfully`,
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          active: user.active
        }
      });
    } catch (err) {
      logger.error('Error toggling user lock', { error: err.message });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'toggle_user_lock_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to toggle user lock: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          targetUserId: req.params.userId,
          adminUserId: req.user._id.toString(),
          error: err.message
        }
      });

      next(err);
    }
  },

  /**
   * Force logout user (invalidate all sessions)
   */
  async forceLogoutUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { clearDevices } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select('+sessionVersion +refreshTokenVersion');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Invalidate all sessions
      await user.invalidateAllSessions(Boolean(clearDevices));
      await user.save();

      // Log admin action
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'admin_force_logout',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} force logged out user ${user.username}${clearDevices ? ' and cleared devices' : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          adminUserId: req.user._id.toString(),
          clearDevices: Boolean(clearDevices)
        }
      });

      logger.info('User force logged out by admin', {
        targetUserId: user._id,
        targetUsername: user.username,
        adminId: req.user._id,
        clearDevices
      });

      res.json({
        success: true,
        message: 'User force logged out successfully',
        data: {
          userId: user._id,
          username: user.username,
          sessionsInvalidated: true,
          devicesCleared: Boolean(clearDevices)
        }
      });
    } catch (err) {
      logger.error('Error forcing logout', { error: err.message });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'authentication_error',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to force logout user: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          targetUserId: req.params.userId,
          adminUserId: req.user._id.toString(),
          error: err.message
        }
      });

      next(err);
    }
  },

  /**
   * Get user login history (audit trail)
   */
  async getUserLoginHistory(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select('username email');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));
      const limit_ = Math.min(200, Math.max(1, parseInt(limit)));

      // Get login-related audit logs
      const [logs, total] = await Promise.all([
        SecurityAudit.find({
          userId,
          action: { $in: ['login_success', 'login_failed', 'logout', 'token_refresh'] }
        })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit_)
          .lean(),
        SecurityAudit.countDocuments({
          userId,
          action: { $in: ['login_success', 'login_failed', 'logout', 'token_refresh'] }
        })
      ]);

      // Log admin access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_login_history_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} accessed login history for user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: userId,
          adminUserId: req.user._id.toString(),
          recordsRetrieved: logs.length
        }
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: Math.max(1, parseInt(page)),
          limit: limit_,
          total,
          pages: Math.ceil(total / limit_)
        },
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err) {
      logger.error('Error fetching user login history', { error: err.message });
      next(err);
    }
  },

  /**
   * Get user audit trail (all actions for user)
   */
  async getUserAuditTrail(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select('username email');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(200, Math.max(1, parseInt(limit)));
      const limit_ = Math.min(200, Math.max(1, parseInt(limit)));

      // Get ALL audit logs for user (all actions)
      const [logs, total] = await Promise.all([
        SecurityAudit.find({ userId })
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit_)
          .lean(),
        SecurityAudit.countDocuments({ userId })
      ]);

      // Log admin access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_audit_trail_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} accessed audit trail for user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: userId,
          adminUserId: req.user._id.toString(),
          recordsRetrieved: logs.length
        }
      });

      res.json({
        success: true,
        data: logs,
        pagination: {
          page: Math.max(1, parseInt(page)),
          limit: limit_,
          total,
          pages: Math.ceil(total / limit_)
        },
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err) {
      logger.error('Error fetching user audit trail', { error: err.message });
      next(err);
    }
  },

  /**
   * Get user details (complete profile info)
   */
  async getUserDetails(req, res, next) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select(
        'username email fullName phone role active createdAt lastLogin avatar phoneVerified emailVerified twoFactorAuth addresses trustedDevices'
      );

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Transform response to simplify twoFactorAuth
      const userData = user.toObject ? user.toObject() : user;
      if (userData.twoFactorAuth) {
        userData.twoFactorAuth = userData.twoFactorAuth.enabled || false;
      }
      // Count trusted devices for display
      if (userData.trustedDevices) {
        userData.trustedDevicesCount = userData.trustedDevices.length;
      }

      // Log admin access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_details_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed details for user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: userId,
          adminUserId: req.user._id.toString()
        }
      });

      res.json({
        success: true,
        data: userData
      });
    } catch (err) {
      logger.error('Error fetching user details', { error: err.message });
      next(err);
    }
  },

  /**
   * Change user role (promote/demote)
   */
  async changeUserRole(req, res, next) {
    try {
      const { userId } = req.params;
      const { newRole, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      if (!['admin', 'moderator', 'user'].includes(newRole)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Prevent admin from losing their role (keep at least one admin)
      if (user.role === 'admin' && newRole !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({ 
            success: false, 
            message: 'Cannot demote the last admin user' 
          });
        }
      }

      const oldRole = user.role;
      user.role = newRole;
      await user.save();

      // Log admin action
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_role_changed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} changed role for ${user.username} from ${oldRole} to ${newRole}${reason ? ` - Reason: ${reason}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          adminUserId: req.user._id.toString(),
          oldRole,
          newRole,
          reason: reason || null
        }
      });

      logger.info('User role changed by admin', {
        targetUserId: user._id,
        targetUsername: user.username,
        oldRole,
        newRole,
        adminId: req.user._id,
        reason
      });

      res.json({
        success: true,
        message: `User role changed from ${oldRole} to ${newRole}`,
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          oldRole,
          newRole,
          active: user.active
        }
      });
    } catch (err) {
      logger.error('Error changing user role', { error: err.message });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'change_user_role_failed',
        category: ACTION_CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to change user role: ${err.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          targetUserId: req.params.userId,
          adminUserId: req.user._id.toString(),
          error: err.message
        }
      });

      next(err);
    }
  },

  /**
   * Get user's trusted devices (admin view)
   */
  async getUserTrustedDevices(req, res, next) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select('+trustedDevices');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Format devices with additional metadata
      const devices = (user.trustedDevices || []).map(device => ({
        _id: device._id,
        id: device._id,
        name: device.name || `Device ${device._id.toString().slice(-6)}`,
        deviceName: device.name,
        fingerprint: device.fingerprint,
        userAgent: device.userAgent,
        ipAddress: device.ip,
        ip: device.ip,
        lastUsed: device.lastUsed,
        addedAt: device.addedAt || device.createdAt,
        isCurrent: false // Can be enhanced to mark current device
      }));

      // Log admin action
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'admin_view_user_devices',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed trusted devices for user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          adminUserId: req.user._id.toString(),
          deviceCount: devices.length
        }
      });

      res.json({
        success: true,
        data: {
          userId: user._id,
          username: user.username,
          devices,
          count: devices.length
        }
      });
    } catch (err) {
      logger.error('Error fetching user trusted devices', { error: err.message });
      next(err);
    }
  },

  /**
   * Remove user's trusted device (admin action)
   */
  async removeUserDevice(req, res, next) {
    try {
      const { userId, deviceId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId).select('+trustedDevices');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Find and remove the device
      const deviceIndex = user.trustedDevices.findIndex(d => d._id.toString() === deviceId);
      if (deviceIndex === -1) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      const removedDevice = user.trustedDevices[deviceIndex];
      user.trustedDevices.splice(deviceIndex, 1);
      await user.save();

      // Log admin action
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'admin_remove_user_device',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} removed trusted device from user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          deviceId: removedDevice._id.toString(),
          adminUserId: req.user._id.toString()
        }
      });

      res.json({
        success: true,
        message: 'Device removed successfully',
        data: {
          userId: user._id,
          deviceId: removedDevice._id,
          remaining: user.trustedDevices.length
        }
      });
    } catch (err) {
      logger.error('Error removing user device', { error: err.message });
      next(err);
    }
  },

  /**
   * Get security dashboard metrics
   */
  async getSecurityDashboard(req, res, next) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Count critical security events
      const criticalEvents = await SecurityAudit.countDocuments({
        timestamp: { $gte: timeAgo },
        severity: SEVERITY_LEVELS.HIGH
      });

      // Count failed auth attempts
      const failedAuthAttempts = await SecurityAudit.countDocuments({
        action: /failed|denied/i,
        timestamp: { $gte: timeAgo }
      });

      // Count locked users
      const lockedUsers = await User.countDocuments({ active: false });

      // Get top security events
      const topEvents = await SecurityAudit.aggregate([
        {
          $match: {
            timestamp: { $gte: timeAgo }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ]);

      // Log dashboard access
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'security_dashboard_accessed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} accessed security dashboard`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          timeRange: `${hours}h`
        }
      });

      res.json({
        success: true,
        data: {
          summary: {
            criticalSecurityEvents: criticalEvents,
            failedAuthAttempts,
            lockedUsers,
            timeRange: `${hours}h`
          },
          topSecurityEvents: topEvents
        }
      });
    } catch (err) {
      logger.error('Error fetching security dashboard', { error: err.message });
      next(err);
    }
  },

  /**
   * Edit user details
   */
  async editUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { username, email, firstName, lastName, phone, address } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Track changes for audit log
      const changes = {};

      // Check for duplicate email if being changed
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        changes.email = email;
        user.email = email;
      }

      // Check for duplicate username if being changed
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username, _id: { $ne: userId } });
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'Username already in use' });
        }
        changes.username = username;
        user.username = username;
      }

      // Update name fields - combine firstName and lastName into fullName
      if (firstName || lastName) {
        const first = firstName || user.fullName?.split(' ')[0] || '';
        const last = lastName || user.fullName?.split(' ').slice(1).join(' ') || '';
        const newFullName = `${first} ${last}`.trim();
        if (newFullName !== user.fullName) {
          changes.firstName = firstName;
          changes.lastName = lastName;
          changes.fullName = newFullName;
          user.fullName = newFullName;
        }
      }

      // Update phone (admin can edit phone directly and auto-verify)
      if (phone !== undefined) {
        if (phone !== user.phone) {
          changes.phone = phone;
          user.phone = phone || null;
          // Auto-verify phone when admin edits it
          if (phone) {
            user.phoneVerified = true;
            changes.phoneVerified = true;
          }
        }
      }

      // Update address (admin can edit address directly and auto-verify)
      if (address !== undefined) {
        if (address !== user.address) {
          changes.address = address;
          user.address = address || null;
          // Auto-verify address when admin edits it
          if (address) {
            user.addressVerified = true;
            changes.addressVerified = true;
          }
        }
      }

      await user.save();

      // Log admin action
      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'user_edited',
          category: ACTION_CATEGORIES.USER_MANAGEMENT,
          severity: SEVERITY_LEVELS.LOW,
          details: `Admin ${req.user.username} edited user ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            targetUserId: user._id.toString(),
            targetUsername: user.username,
            adminUserId: req.user._id.toString(),
            adminUsername: req.user.username,
            changedFields: Object.keys(changes)
          }
        });
      }

      logger.info(`User edited by admin`, {
        targetUserId: user._id,
        targetUsername: user.username,
        adminId: req.user._id,
        changes: changes
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          phone: user.phone,
          address: user.address
        }
      });
    } catch (err) {
      logger.error('Error editing user', { error: err.message });

      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'edit_user_failed',
          category: ACTION_CATEGORIES.AUTHORIZATION,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: `Failed to edit user: ${err.message}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: {
            targetUserId: req.params.userId,
            adminUserId: req.user._id.toString(),
            error: err.message
          }
        });
      }

      next(err);
    }
  },

  /**
   * Delete user account
   */
  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Prevent deleting the requesting admin
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Cannot delete your own account' });
      }

      const username = user.username;
      const email = user.email;

      // Delete the user
      await User.findByIdAndDelete(userId);

      // Log admin action
      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'user_deleted',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.HIGH,
          details: `Admin ${req.user.username} deleted user ${username} (${email})`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            deletedUserId: userId,
            deletedUsername: username,
            deletedEmail: email,
            adminUserId: req.user._id.toString(),
            adminUsername: req.user.username
          }
        });
      }

      logger.info(`User deleted by admin`, {
        deletedUserId: userId,
        deletedUsername: username,
        deletedEmail: email,
        adminId: req.user._id
      });

      res.json({
        success: true,
        message: 'User deleted successfully',
        data: {
          deletedUserId: userId,
          deletedUsername: username,
          deletedEmail: email
        }
      });
    } catch (err) {
      logger.error('Error deleting user', { error: err.message });

      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'delete_user_failed',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.HIGH,
          details: `Failed to delete user: ${err.message}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: {
            targetUserId: req.params.userId,
            adminUserId: req.user._id.toString(),
            error: err.message
          }
        });
      }

      next(err);
    }
  },

  /**
   * Verify user phone number
   */
  async verifyUserPhone(req, res, next) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!user.phone) {
        return res.status(400).json({ success: false, message: 'User has no phone number' });
      }

      user.phoneVerified = true;
      user.phoneVerifiedAt = new Date();
      await user.save();

      // Log admin action
      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'user_phone_verified',
          category: ACTION_CATEGORIES.AUTHORIZATION,
          severity: SEVERITY_LEVELS.LOW,
          details: `Admin ${req.user.username} verified phone for user ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            targetUserId: user._id.toString(),
            targetUsername: user.username,
            adminUserId: req.user._id.toString()
          }
        });
      }

      logger.info(`User phone verified by admin`, {
        targetUserId: user._id,
        targetUsername: user.username,
        adminId: req.user._id
      });

      res.json({
        success: true,
        message: 'Phone verified successfully',
        data: {
          userId: user._id,
          username: user.username,
          phone: user.phone,
          phoneVerified: user.phoneVerified
        }
      });
    } catch (err) {
      logger.error('Error verifying phone', { error: err.message });
      next(err);
    }
  },

  /**
   * Verify user address
   */
  async verifyUserAddress(req, res, next) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (!user.address || !user.address.street) {
        return res.status(400).json({ success: false, message: 'User has no address' });
      }

      user.addressVerified = true;
      user.addressVerifiedAt = new Date();
      await user.save();

      // Log admin action
      if (req.user && req.user._id) {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'user_address_verified',
          category: ACTION_CATEGORIES.AUTHORIZATION,
          severity: SEVERITY_LEVELS.LOW,
          details: `Admin ${req.user.username} verified address for user ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            targetUserId: user._id.toString(),
            targetUsername: user.username,
            adminUserId: req.user._id.toString()
          }
        });
      }

      logger.info(`User address verified by admin`, {
        targetUserId: user._id,
        targetUsername: user.username,
        adminId: req.user._id
      });

      res.json({
        success: true,
        message: 'Address verified successfully',
        data: {
          userId: user._id,
          username: user.username,
          address: user.address,
          addressVerified: user.addressVerified
        }
      });
    } catch (err) {
      logger.error('Error verifying address', { error: err.message });
      next(err);
    }
  },

  /**
   * Export users to CSV or PDF
   */
  async exportUsers(req, res, next) {
    try {
      const { format = 'pdf', includeSensitive = false } = req.body;

      // Get only regular users (not admins or moderators)
      const users = await User.find({ role: 'user' })
        .select('username email firstName lastName fullName phone address role active createdAt lastLogin phoneVerified addressVerified')
        .lean();

      if (format === 'pdf') {
        // Use a simple approach: send HTML that can be printed as PDF
        // or generate PDF content as HTML with styled table
        const pdfHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Users Export Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: white;
    }
    .header {
      border-bottom: 3px solid #dc2626;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #dc2626;
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .report-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .report-info-item {
      display: flex;
      flex-direction: column;
    }
    .report-info-item label {
      font-weight: 600;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .report-info-item value {
      font-size: 16px;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    thead {
      background: #dc2626;
      color: white;
    }
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      border: 1px solid #ddd;
    }
    td {
      padding: 12px 15px;
      border: 1px solid #ddd;
      font-size: 13px;
    }
    tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    tbody tr:hover {
      background: #f0f0f0;
    }
    .status-active {
      color: #16a34a;
      font-weight: 600;
    }
    .status-inactive {
      color: #dc2626;
      font-weight: 600;
    }
    .verified-yes {
      color: #16a34a;
    }
    .verified-no {
      color: #dc2626;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
    @media print {
      body {
        background: white;
      }
      .container {
        max-width: 100%;
        padding: 0;
      }
      table {
        page-break-inside: avoid;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Users Export Report</h1>
      <p>Wondertravelers - Admin Dashboard</p>
    </div>
    
    <div class="report-info">
      <div class="report-info-item">
        <label>Total Users</label>
        <value>${users.length}</value>
      </div>
      <div class="report-info-item">
        <label>Generated Date</label>
        <value>${new Date().toLocaleDateString()}</value>
      </div>
      <div class="report-info-item">
        <label>Generated Time</label>
        <value>${new Date().toLocaleTimeString()}</value>
      </div>
      <div class="report-info-item">
        <label>Data Type</label>
        <value>${includeSensitive ? 'Full (Sensitive)' : 'Standard'}</value>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Full Name</th>
          <th>Username</th>
          <th>Email</th>
          <th>Phone Number</th>
          <th>Address</th>
          <th>Created Date</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((user, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${
              user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.fullName || user.firstName || user.lastName || '-'
            }</strong></td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.address ? (typeof user.address === 'string' ? user.address : user.address.street || '-') : '-'}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>This report was automatically generated by Wondertravelers Admin Dashboard.</p>
      <p>© 2026 Wondertravelers. All rights reserved.</p>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog when loaded
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
        `;

        // Set response headers for HTML (browser will render it)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="users-export-${Date.now()}.html"`);
        
        // Log the export
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'data_exported',
          category: ACTION_CATEGORIES.DATA,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: `Admin ${req.user.username} exported ${users.length} users as PDF (sensitive: ${includeSensitive})`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            totalExported: users.length,
            format: 'pdf',
            includeSensitive,
            adminUserId: req.user._id.toString(),
            adminUsername: req.user.username
          }
        });

        logger.info(`Users exported by admin as PDF`, {
          adminId: req.user._id,
          totalExported: users.length,
          includeSensitive
        });

        res.send(pdfHtml);
      } else if (format === 'csv') {
        // CSV export (keeping original CSV logic)
        const headers = includeSensitive
          ? ['ID', 'Username', 'Email', 'Phone', 'Address', 'Role', 'Status', 'Phone Verified', 'Address Verified', 'Created At', 'Last Login']
          : ['ID', 'Username', 'Email', 'Role', 'Status', 'Phone Verified', 'Address Verified', 'Created At', 'Last Login'];

        const rows = users.map(user => {
          const baseRow = [
            user._id.toString(),
            user.username,
            user.email,
            ...(includeSensitive ? [user.phone || 'N/A', JSON.stringify(user.address || {})] : []),
            user.role,
            user.active ? 'Active' : 'Inactive',
            user.phoneVerified ? 'Yes' : 'No',
            user.addressVerified ? 'Yes' : 'No',
            new Date(user.createdAt).toISOString(),
            user.lastLogin ? new Date(user.lastLogin).toISOString() : 'Never'
          ];
          return baseRow;
        });

        const csvContent = [
          headers.map(h => `"${h}"`).join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
        res.send(csvContent);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Only PDF and CSV formats are supported'
        });
      }
    } catch (error) {
      logger.error('Error exporting users', { error: error.message });
      
      try {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'data_export_failed',
          category: ACTION_CATEGORIES.DATA,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: `Failed to export users: ${error.message}`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: {
            adminUserId: req.user._id.toString(),
            error: error.message
          }
        });
      } catch (auditError) {
        logger.error('Failed to log export failure', { error: auditError.message });
      }

      next(error);
    }
  },

  // Export moderators as PDF
  async exportModerators(req, res, next) {
    try {
      const { format = 'pdf', includePermissions = false } = req.body;

      // Get only moderators (not admins or regular users)
      const moderators = await User.find({ role: 'moderator' })
        .select('username email firstName lastName fullName phone address role active createdAt lastLogin phoneVerified addressVerified')
        .lean();

      if (format === 'pdf') {
        // Use a simple approach: send HTML that can be printed as PDF
        const pdfHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Moderators Export Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      color: #333;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #1e40af;
      font-size: 28px;
      margin-bottom: 5px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .report-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
      padding: 15px;
      background: #f3f4f6;
      border-radius: 8px;
    }
    .report-info-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .report-info-item label {
      font-weight: 600;
      color: #1e40af;
      font-size: 12px;
      text-transform: uppercase;
    }
    .report-info-item value {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    thead {
      background: #2563eb;
      color: white;
    }
    th {
      padding: 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #ddd;
    }
    td {
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      font-size: 13px;
    }
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    tbody tr:hover {
      background: #eff6ff;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
    @media print {
      body {
        background: white;
      }
      .container {
        max-width: 100%;
        padding: 0;
      }
      table {
        page-break-inside: avoid;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>👨‍💼 Moderators Export Report</h1>
      <p>Wondertravelers - Admin Dashboard</p>
    </div>
    
    <div class="report-info">
      <div class="report-info-item">
        <label>Total Moderators</label>
        <value>${moderators.length}</value>
      </div>
      <div class="report-info-item">
        <label>Generated Date</label>
        <value>${new Date().toLocaleDateString()}</value>
      </div>
      <div class="report-info-item">
        <label>Generated Time</label>
        <value>${new Date().toLocaleTimeString()}</value>
      </div>
      <div class="report-info-item">
        <label>Permissions Included</label>
        <value>${includePermissions ? 'Yes' : 'No'}</value>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Full Name</th>
          <th>Username</th>
          <th>Email</th>
          <th>Phone Number</th>
          <th>Address</th>
          <th>Created Date</th>
        </tr>
      </thead>
      <tbody>
        ${moderators.map((mod, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${
              mod.firstName && mod.lastName 
                ? mod.firstName + ' ' + mod.lastName
                : mod.fullName || mod.firstName || mod.lastName || '-'
            }</strong></td>
            <td>${mod.username}</td>
            <td>${mod.email}</td>
            <td>${mod.phone || '-'}</td>
            <td>${mod.address ? (typeof mod.address === 'string' ? mod.address : mod.address.street || '-') : '-'}</td>
            <td>${new Date(mod.createdAt).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <p>This report was automatically generated by Wondertravelers Admin Dashboard.</p>
      <p>© 2026 Wondertravelers. All rights reserved.</p>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog when loaded
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
        `;

        // Set response headers for HTML (browser will render it)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="moderators-export-' + Date.now() + '.html"');
        
        // Log the export
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'data_exported',
          category: ACTION_CATEGORIES.DATA,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: 'Admin ' + req.user.username + ' exported ' + moderators.length + ' moderators as PDF',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: true,
          metadata: {
            adminUserId: req.user._id.toString(),
            adminUsername: req.user.username,
            moderatorsExported: moderators.length,
            format: 'pdf',
            includePermissions
          }
        }).catch(err => logger.error('Failed to log audit', { error: err.message }));

        return res.send(pdfHtml);
      }

      // CSV format
      throw new Error('CSV format not supported yet');
    } catch (err) {
      logger.error('Error exporting moderators', { error: err.message });

      try {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'data_export_failed',
          category: ACTION_CATEGORIES.DATA,
          severity: SEVERITY_LEVELS.MEDIUM,
          details: 'Failed to export moderators: ' + err.message,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: {
            adminUserId: req.user._id.toString(),
            error: err.message
          }
        });
      } catch (auditError) {
        logger.error('Failed to log export failure', { error: auditError.message });
      }

      next(err);
    }
  },

  /**
   * Get comprehensive dashboard statistics
   * GET /api/admin/dashboard/stats (with auth)
   * GET /api/admin/dashboard/stats-debug (dev mode, no auth)
   * Fetches REAL data from the database
   */
  async getDashboardStats(req, res, next) {
    try {
      console.log('\n[DASHBOARD] ============= STATS REQUEST =============');
      console.log('[DASHBOARD] User:', req.user?.username || 'NO_USER (DEBUG MODE)');
      console.log('[DASHBOARD] Timestamp:', new Date().toISOString());
      console.log('[DASHBOARD] Fetching real data from database...\n');
      
      const startTime = Date.now();
      let totalUsers = 0;
      let adminCount = 0;
      let moderatorCount = 0;
      let regularUserCount = 0;
      let activeUsers = 0;
      let inactiveUsers = 0;
      let totalBlogs = 0;
      let publishedBlogs = 0;
      let draftBlogs = 0;
      let blogTypeCount = 0;
      let newsTypeCount = 0;
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalAds = 0;
      let activeAds = 0;
      let inactiveAds = 0;
      let totalAdClicks = 0;
      let activeCategories = 0;
      let criticalEvents = 0;
      let failedLogins = 0;

      // Query 1: User Statistics
      try {
        console.log('[DASHBOARD] Querying users...');
        totalUsers = await User.countDocuments({}).maxTimeMS(5000);
        adminCount = await User.countDocuments({ role: 'admin' }).maxTimeMS(5000);
        moderatorCount = await User.countDocuments({ role: 'moderator' }).maxTimeMS(5000);
        regularUserCount = await User.countDocuments({ role: 'user' }).maxTimeMS(5000);
        activeUsers = await User.countDocuments({ active: true }).maxTimeMS(5000);
        inactiveUsers = await User.countDocuments({ active: false }).maxTimeMS(5000);
        console.log('[DASHBOARD] ✓ Users:', { total: totalUsers, active: activeUsers });
      } catch (err) {
        console.error('[DASHBOARD] User query error:', err.message);
      }

      // Query 2: Blog Statistics
      try {
        console.log('[DASHBOARD] Querying blogs...');
        totalBlogs = await Blog.countDocuments({}).maxTimeMS(5000);
        publishedBlogs = await Blog.countDocuments({ status: 'published' }).maxTimeMS(5000);
        draftBlogs = await Blog.countDocuments({ status: 'draft' }).maxTimeMS(5000);
        blogTypeCount = await Blog.countDocuments({ type: 'blog', status: 'published' }).maxTimeMS(5000);
        newsTypeCount = await Blog.countDocuments({ type: 'news', status: 'published' }).maxTimeMS(5000);
        console.log('[DASHBOARD] ✓ Blogs:', { total: totalBlogs, published: publishedBlogs });
      } catch (err) {
        console.error('[DASHBOARD] Blog query error:', err.message);
      }

      // Query 3: Blog Engagement (Simple Sum)
      try {
        console.log('[DASHBOARD] Querying engagement...');
        const blogs = await Blog.find({ status: 'published' })
          .select('views likesCount commentsCount')
          .maxTimeMS(5000)
          .lean();
        
        totalViews = blogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
        totalLikes = blogs.reduce((sum, blog) => sum + (blog.likesCount || 0), 0);
        totalComments = blogs.reduce((sum, blog) => sum + (blog.commentsCount || 0), 0);
        console.log('[DASHBOARD] ✓ Engagement:', { views: totalViews, likes: totalLikes });
      } catch (err) {
        console.error('[DASHBOARD] Engagement query error:', err.message);
      }

      // Query 4: Advertisement Statistics
      try {
        console.log('[DASHBOARD] Querying ads...');
        totalAds = await Advertisement.countDocuments({}).maxTimeMS(5000);
        activeAds = await Advertisement.countDocuments({ isActive: true }).maxTimeMS(5000);
        inactiveAds = await Advertisement.countDocuments({ isActive: false }).maxTimeMS(5000);
        
        const ads = await Advertisement.find({})
          .select('clicks')
          .maxTimeMS(5000)
          .lean();
        
        totalAdClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
        console.log('[DASHBOARD] ✓ Ads:', { total: totalAds, clicks: totalAdClicks });
      } catch (err) {
        console.error('[DASHBOARD] Ad query error:', err.message);
      }

      // Query 5: Categories
      try {
        console.log('[DASHBOARD] Querying categories...');
        activeCategories = await Category.countDocuments({ isActive: true }).maxTimeMS(5000);
        console.log('[DASHBOARD] ✓ Categories:', { active: activeCategories });
      } catch (err) {
        console.error('[DASHBOARD] Category query error:', err.message);
      }

      // Query 6: Security Stats
      try {
        console.log('[DASHBOARD] Querying security...');
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        
        criticalEvents = await SecurityAudit.countDocuments({
          severity: { $in: [SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.CRITICAL] },
          timestamp: { $gte: oneDayAgo }
        }).maxTimeMS(5000);
        
        failedLogins = await SecurityAudit.countDocuments({
          action: 'failed_login',
          timestamp: { $gte: oneDayAgo }
        }).maxTimeMS(5000);
        console.log('[DASHBOARD] ✓ Security:', { critical: criticalEvents, failed: failedLogins });
      } catch (err) {
        console.error('[DASHBOARD] Security query error:', err.message);
      }

      // Build response
      const responseData = {
        success: true,
        data: {
          users: {
            total: totalUsers,
            admins: adminCount,
            moderators: moderatorCount,
            regularUsers: regularUserCount,
            active: activeUsers,
            inactive: inactiveUsers,
            locked: inactiveUsers
          },
          content: {
            blogs: {
              total: totalBlogs,
              published: publishedBlogs,
              draft: draftBlogs,
              blog: blogTypeCount,
              news: newsTypeCount,
              engagement: {
                totalViews: totalViews,
                totalLikes: totalLikes,
                totalComments: totalComments
              }
            },
            advertisements: {
              total: totalAds,
              active: activeAds,
              inactive: inactiveAds,
              totalClicks: totalAdClicks
            },
            categories: {
              active: activeCategories
            }
          },
          security: {
            criticalEvents: criticalEvents,
            failedAuthAttempts: failedLogins,
            lockedUsers: inactiveUsers
          },
          timestamp: new Date().toISOString()
        }
      };
      
      const duration = Date.now() - startTime;
      console.log('\n[DASHBOARD] ✅ Stats fetched successfully in', duration + 'ms');
      console.log('[DASHBOARD] Summary:', {
        users: totalUsers,
        blogs: publishedBlogs,
        views: totalViews,
        ads: totalAds
      });
      console.log('[DASHBOARD] =============================================\n');
      
      return res.status(200).json(responseData);
      
    } catch (err) {
      console.error('[DASHBOARD] ❌ ERROR:', err.message);
      console.error('[DASHBOARD] Stack:', err.stack);
      console.log('[DASHBOARD] =============================================\n');
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
};

export default adminController;