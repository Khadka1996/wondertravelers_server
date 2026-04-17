// src/utils/memory-leak.util.js
import { logger } from './logger.util.js';

const isProd = process.env.NODE_ENV === 'production';

const THRESHOLD_MB = isProd ? 1800 : 1200;
const CHECK_INTERVAL_MS = 45000;
const WINDOW_SIZE = 12;           // ~9 minutes of history
const GROWTH_ALERT_THRESHOLD = 1.15;  // 15%+ sustained growth

let heapHistory = [];
let leakAlertCount = 0;

export const startMemoryMonitoring = () => {
  setInterval(() => {
    const { heapUsed, heapTotal, external, rss } = process.memoryUsage();
    const usedMB = Math.round(heapUsed / 1024 / 1024);

    heapHistory.push(usedMB);
    if (heapHistory.length > WINDOW_SIZE) {
      heapHistory.shift();
    }

    // Simple linear regression slope on last window
    if (heapHistory.length >= 5) {
      const n = heapHistory.length;
      const sumX = (n * (n - 1)) / 2;
      const sumY = heapHistory.reduce((a, b) => a + b, 0);
      const sumXY = heapHistory.reduce((sum, y, i) => sum + i * y, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * (n * (n - 1) / 2) - sumX ** 2);

      if (slope > 2 && usedMB > THRESHOLD_MB * 0.7) {
        leakAlertCount++;
        if (leakAlertCount >= 3) {
          logger.warn('⚠️  POSSIBLE MEMORY LEAK DETECTED', {
            heapUsedMB: usedMB,
            slopePerCheck: slope.toFixed(2),
            history: heapHistory,
            threshold: THRESHOLD_MB,
          });
          leakAlertCount = 2; // don't spam every interval
        }
      } else if (slope < 0.5) {
        leakAlertCount = Math.max(0, leakAlertCount - 1);
      }
    }

    if (usedMB > THRESHOLD_MB) {
      logger.warn('High memory usage detected', {
        heapUsed: `${usedMB} MB`,
        heapTotal: `${Math.round(heapTotal / 1024 / 1024)} MB`,
        rss: `${Math.round(rss / 1024 / 1024)} MB`,
        external: `${Math.round(external / 1024 / 1024)} MB`,
      });
    }
  }, CHECK_INTERVAL_MS);

  logger.info(`Memory leak monitoring started (threshold: ${THRESHOLD_MB} MB)`);
};