// src/app.js
import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import fs from 'node:fs/promises';

import redisClient from './utils/redis.util.js';
import { logger } from './utils/logger.util.js';
import { sanitizeBody, sanitizeQuery, sanitizeParams } from './middleware/sanitize.middleware.js';
import requestDeduplication from './middleware/request-deduplication.middleware.js';
import { authMiddleware } from './features/auth/auth.middleware.js';

// ========================
// Auto-connect Redis
// ========================
(async () => {
  try {
    if (!redisClient.getClient()) {
      await redisClient.connect();
      logger.info('Redis client connected in app.js');
    }
  } catch (err) {
    logger.error('Redis connection error in app.js:', err);
  }
})();

// ========================
// Complete Environment Validation
// ========================
const validateEnvironment = () => {
  const required = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'BACKUP_ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please check your .env file');
    process.exit(1);
  }

  const backupKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (backupKey && backupKey.length < 32) {
    logger.error('❌ BACKUP_ENCRYPTION_KEY must be at least 32 characters long');
    process.exit(1);
  }
  if (backupKey.includes('change-me') || backupKey === 'default-backup-key') {
    logger.error('❌ BACKUP_ENCRYPTION_KEY contains a default value - change it immediately!');
    process.exit(1);
  }

  const cookieSecret = process.env.COOKIE_SECRET;
  if (cookieSecret && cookieSecret.length < 32) {
    logger.error('❌ COOKIE_SECRET must be at least 32 characters long in production');
    process.exit(1);
  }

  if (!isProd) {
    if (process.env.JWT_SECRET?.includes('change-me') || process.env.JWT_SECRET?.length < 16) {
      logger.warn('⚠️ Using weak JWT_SECRET in development - change for production!');
    }
    if (!cookieSecret && !isTest) {
      logger.warn('⚠️ COOKIE_SECRET not set - using temporary development secret');
      process.env.COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
    }
  }

  if (isProd) {
    if (!cookieSecret) {
      logger.error('❌ COOKIE_SECRET is required in production');
      process.exit(1);
    }
    if (process.env.JWT_SECRET?.length < 32) {
      logger.error('❌ JWT_SECRET must be at least 32 characters in production');
      process.exit(1);
    }
  }

  const auditRetentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
  if (auditRetentionDays < 30) {
    logger.warn('⚠️ AUDIT_RETENTION_DAYS is less than 30 days - may not meet compliance requirements');
  }
  if (auditRetentionDays > 365) {
    logger.warn('⚠️ AUDIT_RETENTION_DAYS is greater than 365 days - consider data storage costs');
  }
};

validateEnvironment();

const app = express();

// ========================
// Cache Middleware
// ========================
export const cacheMiddleware = async (req, res, next) => {
  const cacheKey = req.originalUrl;
  try {
    const client = redisClient.getClient();
    if (!client) return next();
    
    const cachedData = await client.get(cacheKey);
    if (cachedData) return res.json(JSON.parse(cachedData));

    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        await client.set(cacheKey, JSON.stringify(body), { EX: 3600 });
      } catch (err) {
        logger.error('Cache set failed:', err.message);
      }
      originalJson(body);
    };
    next();
  } catch (err) {
    logger.error('Cache middleware error:', err.message);
    next();
  }
};

// ========================
// Security Configuration
// ========================
app.set('trust proxy', isProd ? 1 : 0);

const helmetDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
  connectSrc: [
    "'self'",
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.API_BASE_URL || process.env.API_URL || 'https://api.wondertravelers.com',
    process.env.AUDIT_STREAM_URL
  ].filter(Boolean),
  fontSrc: ["'self'", 'https:', 'data:'],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'self'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
};

if (isProd) {
  helmetDirectives.upgradeInsecureRequests = [];
}

app.use(helmet({
  contentSecurityPolicy: { directives: helmetDirectives, useDefaults: false },
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: [],
    }
  },
  crossOriginEmbedderPolicy: isProd,
  crossOriginOpenerPolicy: isProd ? { policy: 'same-origin' } : false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' },
}));

// ========================
// CORS with Detailed Logging
// ========================
const normalizeOrigins = (values = []) => values
  .flatMap((value) => String(value || '').split(','))
  .map((value) => value.trim())
  .filter(Boolean);

const getConfiguredOrigins = () => normalizeOrigins([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://api.wondertravelers.com',
  'http://127.0.0.1:5000',
  // Production Frontend Origins
  'https://www.wondertravelers.com',
  'https://wondertravelers.com',
  'https://wondertravelers-m90s9nruv-khadka1996s-projects.vercel.app',
  'https://wondertravelers-git-main-khadka1996s-projects.vercel.app',
  // Environment-based URLs
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.AUDIT_DASHBOARD_URL,
  process.env.CORS_ORIGINS,
  process.env.BACKEND_API_URL,
]);

const allowedOrigins = [...new Set(getConfiguredOrigins())];

const isSameOriginRequest = (origin) => {
  if (!origin) return false;

  try {
    const requestOrigin = new URL(origin);
    const configuredHosts = new Set(
      normalizeOrigins([
        process.env.FRONTEND_URL,
        process.env.ADMIN_URL,
        process.env.AUDIT_DASHBOARD_URL,
        process.env.BACKEND_API_URL,
      ])
        .map((value) => {
          try {
            return new URL(value).host;
          } catch {
            return value;
          }
        })
        .filter(Boolean)
    );

    return configuredHosts.has(requestOrigin.host);
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      if (isProd) {
        logger.warn('CORS: Missing origin header in production');
        return callback(null, false); // Block requests without origin in production
      }
      logger.info('CORS: Missing origin header in development');
      return callback(null, true); // Allow requests without origin in development
    }

    if (allowedOrigins.includes(origin) || isSameOriginRequest(origin)) {
      logger.info('CORS allowed origin', { origin });
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin, allowedOrigins });
      // Don't expose origin details to client - log server-side only
      callback(new Error('Request origin not allowed'));
    }
  },
  credentials: true, // Critical: Allow credentials (cookies, HttpOnly cookies, etc.)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Device-Fingerprint',
    'X-CSRF-Token',
    'X-Response-Time',
    'X-Audit-Source',
    'X-Audit-Correlation-Id',
  ],
  exposedHeaders: ['X-Response-Time', 'X-Request-ID', 'X-Audit-Event-Id'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200, // Some clients require 200 instead of 204
}));

// ========================
// Rate Limiting with Logging
// ========================
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 250 : 1000,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, options) => {
    logger.warn('Rate limit exceeded', { 
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    const statusCode = Number.isInteger(options?.statusCode) ? options.statusCode : 429;
    res.status(statusCode).json(options.message);
  },
}));

// ========================
// Standard Middleware
// ========================
// 🔄 Request Deduplication (prevent same request storm)
// TEMPORARILY DISABLED FOR DEBUGGING
// app.use(requestDeduplication);

// 📦 Response Compression with Brotli (better than gzip for high concurrency)
app.use(compression({
  level: isProd ? 11 : 6,  // Mode 11 = max compression in prod
  threshold: 512,          // Only compress responses > 512 bytes
  filter: (req, res) => {
    // Don't compress these content types
    if (req.headers['x-no-compression']) { return false; }
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ========================
// CUSTOM MongoDB Sanitization Middleware (SAFE - no read-only issues)
// ========================
app.use((req, res, next) => {
  // Function to recursively sanitize objects
  const sanitizeObject = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check for MongoDB operators ($) or dots (.) in keys
      if (key.startsWith('$') || key.includes('.')) {
        const safeKey = key.replace(/[$.]/g, '_');
        logger.warn(`⚠️ NoSQL injection attempt blocked: ${key} → ${safeKey} at ${path}`);
        sanitized[safeKey] = sanitizeObject(value, `${path}.${key}`);
      } else {
        sanitized[key] = sanitizeObject(value, `${path}.${key}`);
      }
    }
    return sanitized;
  };

  try {
    // Only sanitize body and params - NOT query (which is read-only)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, 'body');
    }
    
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, 'params');
    }
    
    // Headers might also need sanitization in some cases
    if (req.headers && typeof req.headers === 'object') {
      // Headers are case-insensitive, so we need to be careful
      // This is optional - only if you expect MongoDB operators in headers
    }
    
    next();
  } catch (err) {
    logger.error('Sanitization middleware error:', err);
    next();
  }
});

// Request logging
if (!isTest) {
  app.use(morgan('combined', { 
    stream: { write: msg => logger.info(msg.trim()) } 
  }));
}

// ========================
// Analytics Tracking Middleware
// ========================
// Track all page views for analytics (must be before static files and routes)
// Skip analytics during `test` to avoid DB writes and timeouts
if (!isTest) {
  app.use(analyticsTrackingMiddleware);
}

// ========================
// Static Files
// ========================
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ========================
// Import Routes
// ========================
import authRoutes from './features/auth/auth.routes.js';
import oauthRoutes from './features/auth/oauth.routes.js';
import auditRoutes from './features/auth/audit.routes.js';
import adminRoutes from './features/admin/admin.routes.js';
import { adminController } from './features/admin/admin.controller.js';
import userRoutes from './features/user/user.routes.js';
import moderatorRoutes from './features/moderator/moderator.routes.js';
import notificationRoutes from './features/notification/notification.routes.js';
import verificationRoutes from './features/verification/verification.routes.js';
import backupRoutes from './features/backup/backup.routes.js';
import analyticsRoutes from './features/analytics/analytics.routes.js';
import perfRoutes from './features/perf/perf.routes.js';
import { auditSensitiveRequests, addGeolocation } from './middleware/audit.middleware.js';
import { analyticsTrackingMiddleware } from './middleware/analytics-tracking.middleware.js';
import authorRoutes from './features/author/author.routes.js';
import categoryRoutes from './features/category/category.routes.js';
import blogRoutes from './features/blog/blog.routes.js';
import featuredImageRoutes from './features/featured-image/featured-image.routes.js';
import videoRoutes from './features/video/video.routes.js';
import photoRoutes from './features/photo/photo.routes.js';
import watermarkRoutes from './features/watermark/watermark.routes.js';
import destinationRoutes from './features/destination/destination.routes.js';
import settingsRoutes from './features/settings/settings.routes.js';
import advertisementRoutes from './features/advertisement/advertisement.routes.js';
import activityRoutes from './features/activity/activity.routes.js';
import { getNews } from './features/blog/blog.controller.js';

// Import Blog Scheduler for auto-publishing scheduled blogs
import { initializeBlogScheduler } from './utils/blog-scheduler.util.js';

// ========================
// Swagger with Full Options
// ========================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Complete API documentation',
    },
    servers: [
      {
        url: process.env.API_BASE_PATH || '/api',
        description: 'Base API server',
      },
    ],
  },
  apis: ['./src/features/**/*.routes.js'],
};

const swaggerUIOptions = {
  explorer: true,
  customSiteTitle: 'API Docs',
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUIOptions));

// ========================
// Public Routes
// ========================
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

app.get('/grafana-dashboard', async (req, res) => {
  try {
    const dashboard = JSON.parse(await fs.readFile('grafana-dashboard.json', 'utf-8'));
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load dashboard',
      error: isProd ? undefined : err.message 
    });
  }
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// ========================
// DEBUG & PROTECTED ENDPOINTS (Direct routes - bypass problematic middleware)
// ========================
if (process.env.NODE_ENV === 'development') {
  // Debug endpoint (no auth)
  app.get('/api/admin/dashboard/stats-debug', adminController.getDashboardStats);
}

// Protected endpoint (with auth middleware)
app.get('/api/admin/dashboard/stats', authMiddleware.protect, authMiddleware.restrictTo('admin'), adminController.getDashboardStats);

// ========================
// API Routes with Middleware
// ========================
app.use('/api/auth', authRoutes);
app.use('/api/auth/oauth', addGeolocation, oauthRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', auditSensitiveRequests, adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/moderator', moderatorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/perf', perfRoutes);

// Connect routes to the root
app.use('/api/authors', authorRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/news', (req, res, next) => {
  if (req.method === 'GET') {
    return getNews(req, res, next);
  }
  return res.status(405).json({ success: false, message: 'Method not allowed on /api/news' });
});
app.use('/api/featured-images', featuredImageRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/watermarks', watermarkRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/advertisements', advertisementRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/settings', settingsRoutes);

// ========================
// Initialize Blog Scheduler
// ========================
initializeBlogScheduler();

// ========================
// 404 Handler
// ========================
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// ========================
// Error Handler
// ========================
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  // In production, hide internal error details; in dev, show them for debugging
  const message = isProd ? 'Internal server error' : (err.message || 'Internal server error');
  
  res.status(err.status || 500).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

export default app;