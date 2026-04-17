// src/utils/cluster.util.js
/**
 * Cluster Manager for scaling across multiple CPU cores
 * Enables production-grade load distribution
 */

import cluster from 'cluster';
import os from 'os';
import { logger } from './logger.util.js';

const numCPUs = os.cpus().length;
const isProd = process.env.NODE_ENV === 'production';
const enableCluster = process.env.ENABLE_CLUSTER !== 'false';

/**
 * Initialize cluster mode for production
 * Returns true if this is primary, false if worker
 */
export const initializeCluster = () => {
  if (!isProd || !enableCluster) {
    logger.info('Cluster mode disabled (development or explicitly disabled)');
    return false; // Not using cluster
  }

  if (!cluster.isPrimary) {
    // This is a worker process
    return true; // Continue as worker
  }

  // This is the primary/master process
  logger.info(`🎯 Primary process ${process.pid} starting cluster mode`);
  logger.info(`📊 Available CPUs: ${numCPUs}, spawning ${numCPUs} workers`);

  // Spawn workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    logger.info(`✅ Worker ${worker.process.pid} spawned`);
  }

  // Handle worker crashes and restart them
  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      logger.info(`⚠️ Worker ${worker.process.pid} killed by signal: ${signal}`);
    } else if (code !== 0) {
      logger.warn(`⚠️ Worker ${worker.process.pid} exited with code ${code}`);
      logger.info(`🔄 Respawning worker...`);
      cluster.fork();
    } else {
      logger.info(`✅ Worker ${worker.process.pid} exited cleanly`);
    }
  });

  // Print periodic stats
  const statsInterval = setInterval(() => {
    const workers = Object.values(cluster.workers || {});
    const aliveCount = workers.filter(w => w && !w.isDead()).length;
    logger.info(`📈 Cluster status: ${aliveCount}/${numCPUs} workers alive`);
  }, 30000); // Every 30 seconds

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    clearInterval(statsInterval);
    
    Object.values(cluster.workers || {}).forEach(worker => {
      if (worker) worker.kill();
    });
    
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000); // Force exit after 30 seconds
  });

  return true; // Primary process returns true (won't continue with Express)
};

/**
 * Get cluster worker info
 */
export const getClusterInfo = () => {
  if (!isProd || !enableCluster) {
    return {
      mode: 'single',
      pid: process.pid,
      cpus: numCPUs
    };
  }

  if (cluster.isPrimary) {
    const workers = Object.values(cluster.workers || {});
    return {
      mode: 'cluster-primary',
      pid: process.pid,
      workers: workers.map(w => ({
        id: w?.id,
        pid: w?.process.pid,
        alive: !w?.isDead()
      }))
    };
  }

  return {
    mode: 'cluster-worker',
    pid: process.pid,
    workerId: cluster.worker.id
  };
};

export default {
  initializeCluster,
  getClusterInfo
};
