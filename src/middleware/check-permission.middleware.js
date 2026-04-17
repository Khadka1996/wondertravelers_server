// src/middleware/check-permission.middleware.js
import { ModulePermission } from '../features/admin/permission.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../features/auth/audit.model.js';
import { logger } from '../utils/logger.util.js';

/**
 * Check if user has required permission
 * Works for both moderators (checks database) and admins (auto-allowed)
 * 
 * Usage: checkPermission('users:view'), checkPermission(['users:list', 'users:view'])
 */
export const checkPermission = (requiredPermissions) => {
  // Normalize to array
  const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // User must be authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admins always have all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      // Moderators need to check database
      if (req.user.role === 'moderator') {
        const modPermission = await ModulePermission.findActiveByModerator(req.user._id);

        // No permissions assigned
        if (!modPermission) {
          logger.warn('Moderator with no permissions attempted access', {
            userId: req.user._id,
            username: req.user.username,
            requiredPermissions: perms,
            endpoint: req.path,
            method: req.method
          });

          await SecurityAudit.create({
            userId: req.user._id,
            action: 'permission_denied_no_assignment',
            category: ACTION_CATEGORIES.SECURITY,
            severity: SEVERITY_LEVELS.MEDIUM,
            details: `Moderator attempted to access ${req.path} without any permissions assigned`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: false,
            metadata: {
              requiredPermissions: perms
            }
          }).catch(err => logger.error('Failed to log permission audit', { error: err.message }));

          return res.status(403).json({
            success: false,
            message: 'You have no permissions assigned. Contact an administrator.'
          });
        }

        // Check if expired
        if (modPermission.isExpired) {
          // Auto-deactivate if expired
          modPermission.isActive = false;
          await modPermission.save();

          logger.warn('Moderator permissions expired', {
            userId: req.user._id,
            username: req.user.username,
            endpoint: req.path,
            expiredAt: modPermission.expiresAt
          });

          await SecurityAudit.create({
            userId: req.user._id,
            action: 'permission_denied_expired',
            category: ACTION_CATEGORIES.SECURITY,
            severity: SEVERITY_LEVELS.MEDIUM,
            details: `Moderator permissions expired at ${modPermission.expiresAt}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: false,
            metadata: {
              expiredAt: modPermission.expiresAt
            }
          }).catch(err => logger.error('Failed to log permission audit', { error: err.message }));

          return res.status(403).json({
            success: false,
            message: 'Your permissions have expired. Contact an administrator.'
          });
        }

        // Check if has all required permissions (AND logic)
        if (!modPermission.hasAllPermissions(perms)) {
          const missingPerms = perms.filter(p => !modPermission.hasPermission(p));

          logger.warn('Moderator permission check failed', {
            userId: req.user._id,
            username: req.user.username,
            requiredPermissions: perms,
            grantedPermissions: modPermission.permissions,
            missingPermissions: missingPerms,
            endpoint: req.path,
            method: req.method
          });

          await SecurityAudit.create({
            userId: req.user._id,
            action: 'permission_denied',
            category: ACTION_CATEGORIES.SECURITY,
            severity: SEVERITY_LEVELS.MEDIUM,
            details: `Moderator lacks permissions: ${missingPerms.join(', ')}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: false,
            metadata: {
              requiredPermissions: perms,
              missingPermissions: missingPerms,
              grantedPermissions: modPermission.permissions
            }
          }).catch(err => logger.error('Failed to log permission audit', { error: err.message }));

          return res.status(403).json({
            success: false,
            message: `Missing required permissions: ${missingPerms.join(', ')}`,
            missingPermissions: missingPerms
          });
        }

        // Log successful permission check
        logger.debug('Permission check passed', {
          userId: req.user._id,
          username: req.user.username,
          permissions: perms,
          endpoint: req.path
        });

        // Attach permission info to request for logging
        req.permissionVerified = {
          permissions: perms,
          timestamp: new Date()
        };

        return next();
      }

      // Regular users cannot access restricted endpoints
      logger.warn('Regular user attempted restricted access', {
        userId: req.user._id,
        username: req.user.username,
        role: req.user.role,
        requiredPermissions: perms,
        endpoint: req.path,
        method: req.method
      });

      await SecurityAudit.create({
        userId: req.user._id,
        action: 'permission_denied_insufficient_role',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.MEDIUM,
        details: `User (role: ${req.user.role}) attempted restricted access`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: false,
        metadata: {
          userRole: req.user.role,
          requiredPermissions: perms
        }
      }).catch(err => logger.error('Failed to log permission audit', { error: err.message }));

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. User role does not have access.'
      });
    } catch (error) {
      logger.error('Permission check error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id,
        endpoint: req.path
      });

      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Check if user has ANY of the required permissions (OR logic)
 * Useful when multiple permissions can satisfy a requirement
 */
export const checkPermissionAny = (requiredPermissions) => {
  const perms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Admins always have all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      // Moderators need to check database
      if (req.user.role === 'moderator') {
        const modPermission = await ModulePermission.findActiveByModerator(req.user._id);

        if (!modPermission || !modPermission.hasAnyPermission(perms)) {
          const missingPerms = perms.filter(p => !modPermission?.hasPermission(p));

          logger.warn('Moderator permission check failed (ANY)', {
            userId: req.user._id,
            username: req.user.username,
            requiredPermissions: perms,
            endpoint: req.path
          });

          await SecurityAudit.create({
            userId: req.user._id,
            action: 'permission_denied',
            category: ACTION_CATEGORIES.SECURITY,
            severity: SEVERITY_LEVELS.MEDIUM,
            details: `Moderator lacks required permissions`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.path,
            method: req.method,
            success: false,
            metadata: {
              requiredPermissions: perms,
              checkType: 'ANY'
            }
          }).catch(err => logger.error('Failed to log permission audit', { error: err.message }));

          return res.status(403).json({
            success: false,
            message: `Missing at least one required permission from: ${perms.join(', ')}`
          });
        }

        req.permissionVerified = {
          permissions: perms,
          checkType: 'ANY',
          timestamp: new Date()
        };

        return next();
      }

      // Regular users denied
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    } catch (error) {
      logger.error('Permission check error', {
        error: error.message,
        userId: req.user?._id,
        endpoint: req.path
      });

      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

export default {
  checkPermission,
  checkPermissionAny
};
