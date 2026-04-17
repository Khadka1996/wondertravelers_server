// src/middleware/admin-privilege.middleware.js
import { logger } from '../utils/logger.util.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../features/auth/audit.model.js';

/**
 * Admin privilege hierarchy validation middleware
 * Prevents lower-level admins from modifying higher-level admins
 * 
 * Hierarchy: super-admin > admin > moderator > user
 */

const ADMIN_HIERARCHY = {
  'super-admin': 3,
  'admin': 2,
  'moderator': 1,
  'user': 0
};

/**
 * Check if admin has permission to modify target user
 * @param {string} adminRole - Role of the admin making the request
 * @param {string} targetRole - Role of the user being modified
 * @returns {boolean} - true if admin can modify target
 */
const canModifyUser = (adminRole, targetRole) => {
  const adminLevel = ADMIN_HIERARCHY[adminRole] || 0;
  const targetLevel = ADMIN_HIERARCHY[targetRole] || 0;
  
  // Can only modify users at lower level than themselves
  return adminLevel > targetLevel;
};

/**
 * Simple admin role check (without user hierarchy validation)
 * Use this for non-user resources like authors, blogs, etc.
 */
export const requireAdminRole = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has at least admin role
    const userLevel = ADMIN_HIERARCHY[req.user.role] || 0;
    if (userLevel < ADMIN_HIERARCHY['admin']) {
      logger.warn('Non-admin user attempted privileged operation', {
        userId: req.user._id,
        role: req.user.role,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (err) {
    logger.error('Admin role validation error', { error: err.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to validate admin privilege before sensitive operations
 */
export const validateAdminPrivilege = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has at least admin role
    const userLevel = ADMIN_HIERARCHY[req.user.role] || 0;
    if (userLevel < ADMIN_HIERARCHY['admin']) {
      logger.warn('Non-admin user attempted privileged operation', {
        userId: req.user._id,
        role: req.user.role,
        path: req.path,
        method: req.method
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Get target user ID from params or body (for hierarchy checks on modifications)
    const targetUserId = req.params.userId || req.params.id;
    if (!targetUserId) {
      return next(); // No target user, admin role already verified above
    }

    // Import User model
    const { User } = await import('../features/auth/auth.model.js');
    
    const targetUser = await User.findById(targetUserId).select('role username');
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Check hierarchy
    if (!canModifyUser(req.user.role, targetUser.role)) {
      logger.warn('Admin privilege violation attempt', {
        adminId: req.user._id,
        adminRole: req.user.role,
        targetId: targetUser._id,
        targetRole: targetUser.role,
        path: req.path,
        method: req.method
      });

      // Log security audit
      try {
        await SecurityAudit.create({
          userId: req.user._id,
          action: 'admin_privilege_violation',
          category: ACTION_CATEGORIES.SECURITY,
          severity: SEVERITY_LEVELS.CRITICAL,
          details: `Admin ${req.user.username} (${req.user.role}) attempted to modify ${targetUser.username} (${targetUser.role})`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.path,
          method: req.method,
          success: false,
          metadata: {
            adminId: req.user._id.toString(),
            adminRole: req.user.role,
            targetId: targetUser._id.toString(),
            targetRole: targetUser.role
          }
        });
      } catch (auditErr) {
        logger.error('Failed to log privilege violation audit', { error: auditErr.message });
      }

      return res.status(403).json({
        success: false,
        message: 'Insufficient privileges to modify this user'
      });
    }

    next();
  } catch (err) {
    logger.error('Admin privilege validation error', { error: err.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error during privilege check'
    });
  }
};

/**
 * Strict super-admin only middleware
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super-admin') {
    logger.warn('Super-admin access denied', {
      userId: req.user?._id,
      role: req.user?.role,
      path: req.path
    });

    return res.status(403).json({
      success: false,
      message: 'Super-admin access required'
    });
  }

  next();
};

/**
 * Get admin privilege level
 */
export const getPrivilegeLevel = (role) => {
  return ADMIN_HIERARCHY[role] || 0;
};

export default {
  validateAdminPrivilege,
  requireAdminRole,
  requireSuperAdmin,
  getPrivilegeLevel,
  ADMIN_HIERARCHY
};
