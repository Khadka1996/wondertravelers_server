// src/features/admin/permission.controller.js
import { User } from '../auth/auth.model.js';
import { ModulePermission, AVAILABLE_PERMISSIONS } from './permission.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';
import mongoose from 'mongoose';

export const permissionController = {
  /**
   * GET /api/admin/permissions/available
   * Get list of all available permissions
   */
  async listAvailablePermissions(req, res, next) {
    try {
      const permissions = ModulePermission.getAvailablePermissions();
      const byCategory = ModulePermission.getPermissionsByCategory();

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'available_permissions_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed available permissions`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString()
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: {
          all: permissions,
          byCategory,
          totalPermissions: Object.keys(permissions).length
        }
      });
    } catch (error) {
      logger.error('Error listing available permissions', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/admin/moderators/:modId/permissions
   * Get a moderator's current permissions
   */
  async getModeratorPermissions(req, res, next) {
    try {
      const { modId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(modId)) {
        return res.status(400).json({ success: false, message: 'Invalid moderator ID' });
      }

      const mod = await User.findById(modId).select('username email role');
      if (!mod) {
        return res.status(404).json({ success: false, message: 'Moderator not found' });
      }

      if (!['moderator', 'admin'].includes(mod.role)) {
        return res.status(400).json({
          success: false,
          message: 'User is not a moderator or admin'
        });
      }

      // Admin always has all permissions
      if (mod.role === 'admin') {
        return res.json({
          success: true,
          data: {
            moderatorId: mod._id,
            username: mod.username,
            role: mod.role,
            permissions: Object.keys(AVAILABLE_PERMISSIONS),
            isActive: true,
            isAdmin: true,
            totalPermissions: Object.keys(AVAILABLE_PERMISSIONS).length,
            note: 'Admin users have all permissions by default'
          }
        });
      }

      // Get moderator's permissions
      const modPermission = await ModulePermission.findOne({ moderatorId: modId });

      if (!modPermission) {
        return res.json({
          success: true,
          data: {
            moderatorId: mod._id,
            username: mod.username,
            role: mod.role,
            permissions: [],
            isActive: false,
            totalPermissions: 0,
            note: 'No permissions assigned to this moderator'
          }
        });
      }

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'moderator_permissions_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed permissions for moderator ${mod.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetModId: modId,
          permissionCount: modPermission.permissions.length
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: {
          moderatorId: mod._id,
          username: mod.username,
          role: mod.role,
          permissions: modPermission.permissions,
          isActive: modPermission.isActive,
          expiresAt: modPermission.expiresAt,
          daysUntilExpiry: modPermission.daysUntilExpiry,
          grantedAt: modPermission.grantedAt,
          grantedBy: modPermission.grantedBy,
          totalPermissions: modPermission.permissions.length,
          notes: modPermission.notes
        }
      });
    } catch (error) {
      logger.error('Error getting moderator permissions', { error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/admin/moderators/:modId/permissions/grant
   * Grant permissions to a moderator
   */
  async grantPermissions(req, res, next) {
    try {
      const { modId } = req.params;
      const { permissions, expiresAt, notes } = req.body;

      // Validate input
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Permissions must be a non-empty array'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(modId)) {
        return res.status(400).json({ success: false, message: 'Invalid moderator ID' });
      }

      // Validate moderator exists
      const mod = await User.findById(modId).select('username email role');
      if (!mod) {
        return res.status(404).json({ success: false, message: 'Moderator not found' });
      }

      if (mod.role !== 'moderator') {
        return res.status(400).json({
          success: false,
          message: 'User is not a moderator. Only moderators can have dynamic permissions.'
        });
      }

      // Validate all permissions exist
      const invalidPerms = permissions.filter(p => !AVAILABLE_PERMISSIONS[p]);
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid permissions: ${invalidPerms.join(', ')}`,
          validPermissions: Object.keys(AVAILABLE_PERMISSIONS)
        });
      }

      // Grant permissions
      const modPermission = await ModulePermission.grantPermissionsToMod(
        modId,
        permissions,
        req.user._id,
        { expiresAt: expiresAt ? new Date(expiresAt) : null, notes }
      );

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'permissions_granted',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} granted ${permissions.length} permissions to moderator ${mod.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetModId: modId,
          grantedPermissions: permissions,
          expiresAt: expiresAt || null,
          totalPermissions: modPermission.permissions.length
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      logger.info('Permissions granted to moderator', {
        modId,
        modUsername: mod.username,
        permissions,
        adminId: req.user._id
      });

      res.json({
        success: true,
        message: `Granted ${permissions.length} permission(s) to ${mod.username}`,
        data: {
          moderatorId: mod._id,
          username: mod.username,
          permissions: modPermission.permissions,
          expiresAt: modPermission.expiresAt,
          daysUntilExpiry: modPermission.daysUntilExpiry
        }
      });
    } catch (error) {
      logger.error('Error granting permissions', { error: error.message });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'permission_grant_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to grant permissions: ${error.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetModId: req.params.modId,
          error: error.message
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      next(error);
    }
  },

  /**
   * DELETE /api/admin/moderators/:modId/permissions/revoke
   * Revoke specific permissions from moderator
   */
  async revokePermissions(req, res, next) {
    try {
      const { modId } = req.params;
      const { permissions, reason } = req.body;

      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Permissions must be a non-empty array'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(modId)) {
        return res.status(400).json({ success: false, message: 'Invalid moderator ID' });
      }

      const mod = await User.findById(modId).select('username email role');
      if (!mod) {
        return res.status(404).json({ success: false, message: 'Moderator not found' });
      }

      if (mod.role !== 'moderator') {
        return res.status(400).json({
          success: false,
          message: 'User is not a moderator'
        });
      }

      // Revoke permissions
      const modPermission = await ModulePermission.revokePermissionsFromMod(
        modId,
        permissions,
        reason
      );

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'permissions_revoked',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Admin ${req.user.username} revoked ${permissions.length} permissions from moderator ${mod.username}${reason ? ` - Reason: ${reason}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetModId: modId,
          revokedPermissions: permissions,
          reason: reason || null
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      logger.info('Permissions revoked from moderator', {
        modId,
        modUsername: mod.username,
        permissions,
        adminId: req.user._id
      });

      const message = modPermission.isActive
        ? `Revoked ${permissions.length} permission(s) from ${mod.username}`
        : `Revoked ${permissions.length} permission(s) from ${mod.username}. User now has NO permissions.`;

      res.json({
        success: true,
        message,
        data: {
          moderatorId: mod._id,
          username: mod.username,
          permissions: modPermission.permissions,
          isActive: modPermission.isActive
        }
      });
    } catch (error) {
      logger.error('Error revoking permissions', { error: error.message });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'permission_revoke_failed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `Failed to revoke permissions: ${error.message}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          adminUserId: req.user._id.toString(),
          targetModId: req.params.modId,
          error: error.message
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      next(error);
    }
  },

  /**
   * GET /api/admin/moderators/with-permissions
   * List all moderators and their current permissions
   */
  async listModeratorsWithPermissions(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Get ALL moderators from User model
      const [allModerators, total] = await Promise.all([
        User.find({ role: 'moderator' })
          .select('_id username email firstName lastName phone address phoneVerified addressVerified active createdAt lastLogin')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments({ role: 'moderator' })
      ]);

      // Get permissions for all these moderators
      const moderatorIds = allModerators.map(m => m._id);
      const permissions = await ModulePermission.find({ moderatorId: { $in: moderatorIds } })
        .select('moderatorId permissions isActive expiresAt grantedAt grantedBy')
        .populate('grantedBy', 'username email')
        .lean();

      // Create a map of permissions by moderatorId
      const permissionsMap = {};
      permissions.forEach(p => {
        permissionsMap[p.moderatorId.toString()] = p;
      });

      // Combine moderators with their permissions
      const data = allModerators.map(mod => {
        const perm = permissionsMap[mod._id.toString()];
        return {
          _id: mod._id,
          username: mod.username,
          email: mod.email,
          firstName: mod.firstName,
          lastName: mod.lastName,
          fullName: mod.firstName && mod.lastName ? `${mod.firstName} ${mod.lastName}` : mod.username,
          phone: mod.phone,
          address: mod.address,
          phoneVerified: mod.phoneVerified,
          addressVerified: mod.addressVerified,
          active: mod.active,
          createdAt: mod.createdAt,
          lastLogin: mod.lastLogin,
          permissions: perm ? perm.permissions : [],
          totalPermissions: perm ? perm.permissions.length : 0,
          hasPermissions: !!perm,
          permissionStatus: perm ? (perm.isActive ? 'active' : 'inactive') : 'no-permissions',
          expiresAt: perm ? perm.expiresAt : null,
          grantedBy: perm ? perm.grantedBy.username : null,
          grantedAt: perm ? perm.grantedAt : null
        };
      });

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'moderators_permissions_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed list of moderators with permissions`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          modsRetrieved: data.length
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Error listing moderators with permissions', { error: error.message });
      next(error);
    }
  }
};

export default permissionController;
