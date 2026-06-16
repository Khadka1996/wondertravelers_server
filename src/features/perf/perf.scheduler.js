import axios from 'axios';
import { NetworkLatency, UptimeEvent } from './perf.model.js';

/**
 * Scheduler for periodic health checks and network latency tests
 */
class PerfScheduler {
  constructor(redisClient = null) {
    this.redisClient = redisClient;
    this.intervals = [];
    this.targetEndpoints = [
      { url: 'https://api.wondertravelers.com/api/perf/health', service: 'backend-api' },
      { url: 'http://localhost:3000/api/health', service: 'frontend-api' },
    ];
    this.checkInterval = 30000; // 30 seconds
  }

  /**
   * Start periodic checks
   */
  start() {
    console.log('[PerfScheduler] Starting performance monitoring...');

    // Health check every 30 seconds
    this.intervals.push(
      setInterval(() => {
        this.runHealthChecks().catch((err) => {
          console.error('[PerfScheduler] Interval health check failed', err?.message || err, err?.stack || '');
        });
      }, this.checkInterval)
    );

    // Run immediately on start
    this.runHealthChecks().catch((err) => {
      console.error('[PerfScheduler] Initial health check failed', err?.message || err, err?.stack || '');
    });

    console.log('[PerfScheduler] Health checks scheduled.');
  }

  /**
   * Stop all intervals
   */
  stop() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];
    console.log('[PerfScheduler] Stopped.');
  }

  /**
   * Perform HTTP health check and measure latency
   */
  async checkEndpoint(target) {
    const start = Date.now();
    try {
      const res = await axios.get(target.url, {
        timeout: 5000,
        validateStatus: () => true, // accept any status
      });
      const latency = Date.now() - start;
      const success = res.status >= 200 && res.status < 300;

      // Record to network latency collection
      await NetworkLatency.create({
        timestamp: new Date(),
        target: target.url,
        latency,
        status: res.status,
        success,
      });

      // Record uptime event
      await UptimeEvent.create({
        timestamp: new Date(),
        service: target.service,
        status: success ? 'up' : 'degraded',
        responseTime: latency,
        statusCode: res.status,
      });

      return { success, latency, status: res.status };
    } catch (err) {
      const latency = Date.now() - start;

      await NetworkLatency.create({
        timestamp: new Date(),
        target: target.url,
        latency,
        status: 0,
        success: false,
        error: err.message || 'Check failed',
      });

      await UptimeEvent.create({
        timestamp: new Date(),
        service: target.service,
        status: 'down',
        responseTime: latency,
        reason: err.message || 'Connection failed',
      });

      return { success: false, latency, error: err.message };
    }
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    try {
      await Promise.all(
        this.targetEndpoints.map((target) => this.checkEndpoint(target))
      );
    } catch (err) {
      console.error('[PerfScheduler] Error running health checks:', err.message);
    }
  }

  /**
   * Add endpoint to monitor
   */
  addEndpoint(url, service) {
    if (!this.targetEndpoints.find((e) => e.url === url)) {
      this.targetEndpoints.push({ url, service });
      console.log(`[PerfScheduler] Added endpoint: ${url} (${service})`);
    }
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(url) {
    this.targetEndpoints = this.targetEndpoints.filter((e) => e.url !== url);
    console.log(`[PerfScheduler] Removed endpoint: ${url}`);
  }
}

export default PerfScheduler;
