// src/features/admin/user-list.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';

export const userListController = {
  /**
   * GET /api/admin/users/list-admins
   * List only admin users
   */
  async listAdmins(req, res, next) {
    try {
      const { page = 1, limit = 20, search, active } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter = { role: 'admin' };

      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      if (active !== undefined) {
        filter.active = active === 'true';
      }

      // Get admins
      const [admins, total] = await Promise.all([
        User.find(filter)
          .select('username email fullName role active lastLogin avatar createdAt')
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(filter)
      ]);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'admin_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed admin users list`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          adminsRetrieved: admins.length,
          total
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: admins,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Error listing admins', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/admin/users/list-mods
   * List only moderator users
   */
  async listMods(req, res, next) {
    try {
      const { page = 1, limit = 20, search, active } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter = { role: 'moderator' };

      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      if (active !== undefined) {
        filter.active = active === 'true';
      }

      // Get mods
      const [mods, total] = await Promise.all([
        User.find(filter)
          .select('username email fullName role active lastLogin avatar createdAt')
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(filter)
      ]);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'moderator_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed moderators list`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          modsRetrieved: mods.length,
          total
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: mods,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Error listing mods', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/admin/users/list-users
   * List only regular users (not admin or mod)
   */
  async listUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search, active } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter = { role: 'user' };

      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      if (active !== undefined) {
        filter.active = active === 'true';
      }

      // Get users
      const [users, total] = await Promise.all([
        User.find(filter)
          .select('username email fullName role active lastLogin avatar createdAt')
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(filter)
      ]);

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed users list`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          usersRetrieved: users.length,
          total
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Error listing users', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/admin/users/summary
   * Get summary of all users by role
   */
  async getUsersSummary(req, res, next) {
    try {
      const [admins, mods, users, totalActive] = await Promise.all([
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ role: 'moderator' }),
        User.countDocuments({ role: 'user' }),
        User.countDocuments({ active: true })
      ]);

      const total = admins + mods + users;

      // Log audit
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'users_summary_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed users summary`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          admins,
          mods,
          users,
          total,
          totalActive
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: {
          admins,
          moderators: mods,
          regularUsers: users,
          total,
          active: totalActive,
          inactive: total - totalActive,
          breakdown: {
            'Admin': { count: admins, percentage: ((admins / total) * 100).toFixed(2) + '%' },
            'Moderator': { count: mods, percentage: ((mods / total) * 100).toFixed(2) + '%' },
            'User': { count: users, percentage: ((users / total) * 100).toFixed(2) + '%' }
          }
        }
      });
    } catch (error) {
      logger.error('Error getting users summary', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/admin/users/all
   * List all users (any role) with ability to filter by role, status, search
   * Supports: page, limit, search, role, active
   */
  async getAllUsers(req, res, next) {
    console.log('❌ [DEBUG] getAllUsers handler called at', new Date().toISOString());
    try {
      console.log('✅ [DEBUG] Inside try block');
      const { page = 1, limit = 20, search, role, active } = req.query;
      console.log('✅ [DEBUG] Query params parsed:', { page, limit, search, role, active });

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter = {};

      // Filter by role if specified
      if (role && ['admin', 'moderator', 'user'].includes(role)) {
        filter.role = role;
      }

      // Filter by search term (username, email, fullName)
      if (search) {
        filter.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      // Filter by active status
      if (active !== undefined) {
        filter.active = active === 'true';
      }

      // Get users
      const [allUsers, total] = await Promise.all([
        User.find(filter)
          .select('_id username email fullName role active lastLogin avatar createdAt phone phoneVerified')
          .skip(skip)
          .limit(limitNum)
          .sort({ createdAt: -1 })
          .lean(),
        User.countDocuments(filter)
      ]);

      // Log audit (fire-and-forget to avoid blocking response)
      SecurityAudit.create({
        userId: req.user._id,
        action: 'all_users_list_viewed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.LOW,
        details: `Admin ${req.user.username} viewed all users list${role ? ` (role: ${role})` : ''}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          adminUserId: req.user._id.toString(),
          usersRetrieved: allUsers.length,
          total,
          filters: { role: role || 'all', active: active || 'all', search: search || null }
        }
      }).catch(err => logger.error('Failed to log audit', { error: err.message }));

      res.json({
        success: true,
        data: allUsers.map(user => ({
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          active: user.active,
          lastLogin: user.lastLogin,
          avatar: user.avatar,
          createdAt: user.createdAt,
          phone: user.phone || null,
          phoneVerified: user.phoneVerified || false
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Error listing all users', { error: error.message });
      next(error);
    }
  }
};

export default userListController;
