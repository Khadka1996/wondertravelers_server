import express from 'express';
import * as perfController from './perf.controller.js';

const router = express.Router();

// Health check (no auth)
router.get('/health', perfController.healthCheck);

// Performance metrics (admin only)
router.get('/overview', perfController.getOverview);
router.get('/server-metrics', perfController.getServerMetrics);
router.get('/network-latency', perfController.getNetworkLatency);
router.get('/uptime', perfController.getUptime);

export default router;
