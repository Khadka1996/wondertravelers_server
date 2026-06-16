// src/server.js
import dotenv from 'dotenv';
dotenv.config();

import http from 'node:http';
import mongoose from 'mongoose';
import { logger } from './utils/logger.util.js';
import app from './app.js';
import { startServer } from './utils/mnz.js';
import { startMemoryMonitoring } from './utils/memory-leak.util.js';

// Cluster mode support
import { initializeCluster, getClusterInfo } from './utils/cluster.util.js';

// Import audit system initializer
import { initializeAuditSystem } from './middleware/audit.middleware.js';

// Import audit cleanup utility
import { cleanupOldAuditLogs } from './utils/audit-cleanup.util.js';

// Import settings initializer
import { initializeSettings } from './features/settings/settings.controller.js';

// Redis client - import as named export
import redisClient from './utils/redis.util.js';

// Socket.IO
import { initializeSocket } from './socket/socket.handler.js';

import emailCron from './utils/emailCron.js';
import PerfScheduler from './features/perf/perf.scheduler.js';

const PORT = process.env.PORT || 5000;

// Define isProd based on NODE_ENV
const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// ========================
// CLUSTER MODE SETUP
// ========================
const isPrimaryProcess = initializeCluster();

// If this is primary process in cluster mode, it won't continue
// (worker processes will handle Express)
if (isPrimaryProcess && isProd) {
  logger.info('✅ Cluster mode active - Primary process managing workers');
  process.exit(0); // Primary exits after spawning workers
}

// Global state singleton
class GlobalState {
  constructor() {
    this.cancelUnpaidJobHandle = null;
    this.perfScheduler = null;
  }
}

const globalState = new GlobalState();

// Early exit on missing critical env vars
const required = ['MONGO_URI'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const server = http.createServer(app);

// MongoDB connection with modern options + retry
const connectDB = async (retries = 5, delay = 4000) => {
  try {
    // Production should handle 10,000+ concurrent users
    const maxPoolSize = isProd ? 250 : 25;
    const minPoolSize = isProd ? 75 : 4;
    
    logger.info(`🗄️  MongoDB pool size - Min: ${minPoolSize}, Max: ${maxPoolSize}`);
    
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 9000,
      socketTimeoutMS: 45000,
      maxPoolSize,        // Increased for 10K users
      minPoolSize,        // More warm connections
      maxIdleTimeMS: isProd ? 15000 : 30000,  // Clean up faster in prod
      family: 4,
      // Optimizations for high throughput
      retryWrites: true,
      ...(isProd ? {
        readPreference: 'secondaryPreferred', // Read from replicas if available
        w: 0, // Don't wait for acknowledge (faster writes, riskier)
      } : {
        readPreference: 'primary'
      })
    });

    logger.info('✅ MongoDB connected successfully');
    logger.info(`📊 Connection pool: ${minPoolSize}-${maxPoolSize} connections`);

    // Initialize audit system after successful DB connection
    try {
      await initializeAuditSystem();
      logger.info('✅ Audit system initialized');
    } catch (auditErr) {
      logger.error('Audit system initialization failed', {
        error: auditErr.message,
        ...(isProd ? {} : { stack: auditErr.stack }),
      });
      // Don't exit for audit system failure - app can still function
    }

    // Initialize settings (contact info, business details, etc.)
    try {
      await initializeSettings();
    } catch (settingsErr) {
      logger.error('Settings initialization failed', {
        error: settingsErr.message,
        ...(isProd ? {} : { stack: settingsErr.stack }),
      });
      // Don't exit for settings initialization failure
    }

    if (emailCron?.start && typeof emailCron.start === 'function') {
      emailCron.start();
      logger.info('✅ Email cron jobs started');
    }

    // Schedule audit log cleanup (daily at 2 AM)
    try {
      const cron = await import('node-cron');
      cron.schedule('0 2 * * *', async () => {
        logger.info('🧹 Running scheduled audit log cleanup...');
        await cleanupOldAuditLogs();
      });
      logger.info('✅ Audit cleanup job scheduled (daily at 2 AM)');
    } catch (cronErr) {
      logger.warn('Failed to schedule audit cleanup job', { error: cronErr.message });
    }
  } catch (err) {
    logger.error('MongoDB connection failed', {
      message: err.message,
      retriesLeft: retries,
      ...(isProd ? {} : { stack: err.stack }),
    });

    if (retries > 0) {
      const nextDelay = Math.min(delay * 1.6, 30000);
      logger.info(`Retry in ${nextDelay / 1000}s...`);
      setTimeout(() => connectDB(retries - 1, nextDelay), delay);
      return;
    }

    logger.error('MongoDB retries exhausted → exiting');
    process.exit(1);
  }
};

// Mongoose events
mongoose.connection.on('connected', () => logger.info('Mongoose → DB connected'));
mongoose.connection.on('error', err => logger.error('Mongoose → error', err));
mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose → disconnected → auto-reconnect attempt');
  setTimeout(() => connectDB(3, 4000), 4000);
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} → graceful shutdown started`);

  // Set a timeout to force exit if graceful shutdown takes too long
  const forceExitTimeout = setTimeout(() => {
    logger.error('Shutdown timeout → force exit');
    process.exit(1);
  }, isProd ? 25000 : 9000);

  server.close(async () => {
    clearTimeout(forceExitTimeout);
    
    logger.info('HTTP server → closed');

    // Close Socket.IO
    try {
      const { getIO } = await import('./socket/socket.handler.js');
      const io = getIO();
      io.close();
      logger.info('Socket.IO → closed');
    } catch (socketErr) {
      logger.warn('Failed to close Socket.IO:', socketErr.message);
    }

    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB → connection closed');
    } catch (err) {
      logger.error('MongoDB close failed', err);
    }

    // Log system shutdown to audit system
    try {
      const { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } = await import('./features/auth/audit.model.js');
      await SecurityAudit.create({
        action: 'system_shutdown',
        category: ACTION_CATEGORIES.SYSTEM,
        severity: SEVERITY_LEVELS.LOW,
        details: `System shutdown initiated by ${signal}`,
        ipAddress: '127.0.0.1',
        endpoint: '/system/shutdown',
        method: 'SYSTEM',
        success: true,
        source: 'system',
        metadata: {
          signal,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      });
      logger.info('Audit system → shutdown logged');
    } catch (auditErr) {
      logger.error('Failed to log shutdown audit', { error: auditErr.message });
    }

    if (emailCron?.stop && typeof emailCron.stop === 'function') {
      emailCron.stop();
      logger.info('Email cron → stopped');
    }

    // Stop cancel unpaid orders job
    try {
      if (globalState.cancelUnpaidJobHandle) {
        clearInterval(globalState.cancelUnpaidJobHandle);
        globalState.cancelUnpaidJobHandle = null;
        logger.info('Cancel unpaid orders job → stopped');
      }
    } catch (cancelUnpaidErr) {
      logger.warn('Failed to stop cancel unpaid orders job during shutdown', { error: cancelUnpaidErr.message });
    }

    // Stop perf monitoring scheduler
    try {
      if (globalState.perfScheduler) {
        globalState.perfScheduler.stop();
        logger.info('Perf scheduler → stopped');
      }
    } catch (perfErr) {
      logger.warn('Failed to stop perf scheduler during shutdown', { error: perfErr.message });
    }

    // Disconnect Redis if active
    try {
      if (redisClient.isOpen) {
        await redisClient.disconnect();
        logger.info('Redis → disconnected');
      }
    } catch (redisErr) {
      logger.warn('Failed to disconnect Redis during shutdown', { error: redisErr.message });
    }

    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Forcefully close all connections after timeout
  if (server.closeAllConnections) {
    server.closeAllConnections(); // Node.js 18+
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Global error handlers
process.on('uncaughtException', async (err) => {
  logger.error('UNCAUGHT EXCEPTION', { message: err.message, stack: err.stack });
  
  // Log uncaught exceptions to audit system
  try {
    const { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } = await import('./features/auth/audit.model.js');
    await SecurityAudit.create({
      action: 'uncaught_exception',
      category: ACTION_CATEGORIES.SYSTEM,
      severity: SEVERITY_LEVELS.CRITICAL,
      details: `Uncaught exception: ${err.message}`,
      ipAddress: '127.0.0.1',
      endpoint: '/system/error',
      method: 'SYSTEM',
      success: false,
      source: 'system',
      metadata: {
        error: err.message,
        name: err.name,
        stack: isProd ? undefined : err.stack,
        timestamp: new Date().toISOString()
      }
    });
  } catch (auditErr) {
    logger.error('Failed to log uncaught exception audit', { error: auditErr.message });
  }
  
  if (!isProd) process.exit(1);
  // In production, let the process continue (orchestrator will restart if needed)
});

const formatRejectionReason = (reason) => {
  if (reason instanceof Error) {
    return {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
    };
  }
  if (typeof reason === 'object' && reason !== null) {
    try {
      return JSON.parse(JSON.stringify(reason));
    } catch {
      return { ...reason, detail: String(reason) };
    }
  }
  return String(reason);
};

process.on('unhandledRejection', async (reason, promise) => {
  const formattedReason = formatRejectionReason(reason);
  logger.error('UNHANDLED REJECTION', {
    reason: formattedReason,
    promise: typeof promise === 'object' ? String(promise) : promise,
  });
  
  // Log unhandled rejections to audit system
  try {
    const { SecurityAudit, SEVERITY_LEVELS, ACTION_CATEGORIES } = await import('./features/auth/audit.model.js');
    await SecurityAudit.create({
      action: 'unhandled_rejection',
      category: ACTION_CATEGORIES.SYSTEM,
      severity: SEVERITY_LEVELS.HIGH,
      details: `Unhandled promise rejection: ${formattedReason.message || formattedReason}`,
      ipAddress: '127.0.0.1',
      endpoint: '/system/error',
      method: 'SYSTEM',
      success: false,
      source: 'system',
      metadata: {
        reason: typeof formattedReason === 'string' ? formattedReason : formattedReason.message || JSON.stringify(formattedReason),
        stack: formattedReason.stack,
        timestamp: new Date().toISOString()
      }
    });
  } catch (auditErr) {
    logger.error('Failed to log unhandled rejection audit', { error: auditErr.message });
  }
  
  // In prod → log only, orchestrator (PM2/Docker/K8s) restarts
});

// Start sequence
const bootstrap = async () => {
  // Initialize Redis early so other modules may use it during startup
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    logger.info('Redis → initialized before DB connection');
  } catch (err) {
    logger.warn('Redis initialization failed during bootstrap', { error: err.message });
  }

  await connectDB();
  
  // Initialize perf monitoring
  try {
    const perfScheduler = new PerfScheduler(redisClient);
    
    // Store scheduler globally for shutdown
    globalState.perfScheduler = perfScheduler;
    
    // Start health checks
    perfScheduler.start();
    
    logger.info('Perf monitoring → initialized (metrics & health checks)');
  } catch (perfErr) {
    logger.warn('Perf monitoring initialization failed', { error: perfErr.message });
  }
  
  startMemoryMonitoring();

  // ========================
  // Initialize Socket.IO
  // ========================
  // COMMENTED OUT FOR DEBUGGING - may be hanging
  // try {
  //   initializeSocket(server);
  //   logger.info('✅ Socket.IO initialized for real-time notifications');
  // } catch (socketErr) {
  //   logger.warn('Socket.IO initialization failed', { error: socketErr.message });
  //   // Don't exit - app works without WebSocket
  // }

  startServer(server, PORT, isProd, process.env.NODE_ENV);
};

bootstrap().catch(err => {
  logger.error('Bootstrap failed', err);
  process.exit(1);
});

export { server, app };