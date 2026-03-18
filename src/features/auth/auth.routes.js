// src/features/auth/auth.routes.js
import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { loginRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { authController } from './auth.controller.js';
import { authMiddleware } from './auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { uploadAvatar, processAvatar } from '../../middleware/upload.middleware.js';
import { User } from './auth.model.js';
import { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } from './audit.model.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  updateAvatarSchema,      
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyDeviceSchema,
  removeDeviceSchema,
  deleteMeSchema,
} from '../config/schemas/auth.schema.js';

const router = express.Router();

// ========================
// Rate Limiters
// ========================
// `loginRateLimiter` imported from central middleware
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, message: 'Too many reset requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { success: false, message: 'Too many refresh requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Avatar upload limiter (prevent abuse)
const avatarUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 avatar uploads per hour
  message: { success: false, message: 'Too many avatar upload attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================
// Response time tracking - FIXED VERSION
// ========================
router.use((req, res, next) => {
  const start = Date.now();
  
  // Store original send method
  const originalSend = res.send;
  
  // Override send method to add timing
  res.send = function(body) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalSend.call(this, body);
  };
  
  next();
});

// ========================
// Public Routes
// ========================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               username: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshTokenSchema), authController.refresh);
router.post('/request-password-reset', resetLimiter, validate(requestPasswordResetSchema), authController.requestPasswordReset);
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), authController.resetPassword);

// ========================
// User Profile & Authentication

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/me', authMiddleware.protect, authController.getMe);

/**
 * @swagger
 * /api/auth/check:
 *   get:
 *     summary: Check authentication status (optional auth endpoint)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns current user if authenticated, null otherwise
 */
router.get('/check', authMiddleware.optional, authController.checkAuth);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authMiddleware.protect, authController.logout);

// Profile updates (with optional device trust for extra security)
router.patch('/profile', 
  authMiddleware.protect, 
  // authMiddleware.checkDeviceTrust, // Optional: enable for production
  validate(updateProfileSchema), 
  authController.updateProfile
);

// Password change (with rate limiting)
router.post('/change-password', 
  authMiddleware.protect, 
  // authMiddleware.checkDeviceTrust, // Optional: enable for production
  loginRateLimiter, 
  validate(changePasswordSchema), 
  authController.changePassword
);

// Self-deletion
router.delete('/me',
  authMiddleware.protect,
  loginRateLimiter,
  validate(deleteMeSchema),
  authController.deleteMe
);

// Avatar management
router.patch('/avatar',
  authMiddleware.protect,
  validate(updateAvatarSchema),
  authController.updateAvatar
);

// Avatar upload (file upload)
router.post('/avatar/upload',
  authMiddleware.protect,
  avatarUploadLimiter,
  uploadAvatar,        // multer handles file upload to temp
  processAvatar,       // sharp processes and moves file
  authController.uploadAvatar // new controller method
);

router.delete('/avatar',
  authMiddleware.protect,
  authController.deleteAvatar
);

// Device Trust Management
router.post('/verify-device', 
  authMiddleware.protect, 
  validate(verifyDeviceSchema),
  authController.verifyDevice
);

router.get('/trusted-devices', 
  authMiddleware.protect, 
  authController.getTrustedDevices
);

router.delete('/trusted-devices/:fingerprint', 
  authMiddleware.protect, 
  validate(removeDeviceSchema, 'params'), 
  authController.removeTrustedDevice
);

// ========================
// Admin/Moderator Routes
// ========================

// User management (admin only)
router.get('/users', 
  authMiddleware.protect, 
  authMiddleware.restrictTo('admin'),
  async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const users = await User.find()
        .select('username email role active lastLogin createdAt avatar')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      const total = await User.countDocuments();

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
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch users',
        error: error.message 
      });
    }
  }
);

// Get single user (admin only)
router.get('/users/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-password -refreshToken -passwordHistory')
        .lean();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch user',
        error: error.message 
      });
    }
  }
);

// Delete user (admin only)
router.delete('/users/:id',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  authController.deleteUser
);

// User status management (admin/moderator - active/inactive only)
router.patch('/users/:id/status', 
  authMiddleware.protect, 
  authMiddleware.restrictTo('admin', 'moderator'), 
  async (req, res) => {
    try {
      const { active } = req.body;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { active: Boolean(active) },
        { new: true, runValidators: true }
      ).select('username email role active avatar').lean();

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({ 
        success: true, 
        message: `User ${active ? 'activated' : 'deactivated'} successfully`,
        data: user 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update user status',
        error: error.message 
      });
    }
  }
);

// Change user role (admin only)
router.patch('/users/:id/role',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin'),
  async (req, res) => {
    try {
      const { role } = req.body;
      const validRoles = ['user', 'moderator', 'admin'];

      // Validate role
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Prevent changing own role
      if (req.user._id.toString() === req.params.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Cannot change your own role'
        });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const oldRole = user.role;
      user.role = role;
      
      // SECURITY FIX: Invalidate all sessions when role changes (prevent privilege escalation)
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      user.refreshTokenExpires = null;
      user.trustedDevices = [];
      
      await user.save({ runValidators: true });

      // Log role change
      await SecurityAudit.create({
        userId: req.user._id,
        action: 'user_role_changed',
        category: ACTION_CATEGORIES.SECURITY,
        severity: SEVERITY_LEVELS.HIGH,
        details: `Role changed from ${oldRole} to ${role} for user ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.path,
        method: req.method,
        success: true,
        metadata: {
          targetUserId: user._id.toString(),
          targetUsername: user.username,
          oldRole,
          newRole: role,
          adminId: req.user._id.toString()
        }
      });

      res.json({ 
        success: true, 
        message: `User role changed to ${role} successfully. User sessions invalidated for security.`,
        data: user 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update user role',
        error: error.message 
      });
    }
  }
);

// ========================
// Health Check & Status
// ========================
router.get('/status', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      success: true,
      message: 'Auth API is operational',
      status: {
        api: 'healthy',
        database: dbStatus,
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heap: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        },
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API status check failed',
      error: error.message
    });
  }
});

export default router;