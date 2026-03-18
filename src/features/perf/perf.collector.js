import os from 'os';
import { ServerMetric } from './perf.model.js';

/**
 * Collects server metrics: CPU, memory, load, uptime
 */
class MetricsCollector {
  constructor() {
    this.lastCPUUsage = null;
    this.lastTimestamp = null;
  }

  /**
   * Estimate CPU usage via process.cpuUsage() + os.cpus()
   */
  async getCPUUsage() {
    try {
      const cpus = os.cpus();
      const totalIdle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
      const totalTick = cpus.reduce(
        (sum, cpu) =>
          sum +
          Object.values(cpu.times).reduce((a, b) => a + b, 0),
        0
      );

      if (this.lastCPUUsage === null) {
        this.lastCPUUsage = { totalIdle, totalTick };
        return 0;
      }

      const idleDiff = totalIdle - this.lastCPUUsage.totalIdle;
      const tickDiff = totalTick - this.lastCPUUsage.totalTick;

      this.lastCPUUsage = { totalIdle, totalTick };

      const cpuUsage = (1 - idleDiff / tickDiff) * 100;
      return Math.max(0, Math.min(100, parseFloat(cpuUsage.toFixed(2))));
    } catch (err) {
      console.error('Error collecting CPU usage:', err.message);
      return 0;
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercent = (usedMemory / totalMemory) * 100;

      return {
        memoryPercent: parseFloat(memoryPercent.toFixed(2)),
        memoryUsed: usedMemory,
        memoryTotal: totalMemory,
        freeMemory,
      };
    } catch (err) {
      console.error('Error collecting memory:', err.message);
      return {
        memoryPercent: 0,
        memoryUsed: 0,
        memoryTotal: os.totalmem(),
        freeMemory: os.freemem(),
      };
    }
  }

  /**
   * Get load averages
   */
  getLoadAverage() {
    try {
      const [load1, load5, load15] = os.loadavg();
      return { load1, load5, load15 };
    } catch (err) {
      console.error('Error collecting load:', err.message);
      return { load1: 0, load5: 0, load15: 0 };
    }
  }

  /**
   * Get uptime in seconds
   */
  getUptime() {
    try {
      return os.uptime();
    } catch (err) {
      console.error('Error getting uptime:', err.message);
      return 0;
    }
  }

  /**
   * Estimate event loop lag (simple blocking detection)
   */
  async getEventLoopLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(Math.max(0, lag));
      });
    });
  }

  /**
   * Collect all metrics and return as object
   */
  async collectMetrics() {
    try {
      const [cpu, memory, load, uptime, lag] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryUsage(),
        this.getLoadAverage(),
        this.getUptime(),
        this.getEventLoopLag(),
      ]);

      return {
        timestamp: new Date(),
        cpu,
        memory: memory.memoryPercent,
        memoryUsed: memory.memoryUsed,
        memoryTotal: memory.memoryTotal,
        freeMemory: memory.freeMemory,
        load1: load.load1,
        load5: load.load5,
        load15: load.load15,
        uptime: Math.round(uptime),
        eventLoopLag: lag,
        processCount: os.cpus().length,
      };
    } catch (err) {
      console.error('Error collecting metrics:', err.message);
      return null;
    }
  }

  /**
   * Save metrics to database
   */
  async saveMetrics(metrics) {
    if (!metrics) return null;

    try {
      const saved = await ServerMetric.create(metrics);
      return saved;
    } catch (err) {
      console.error('Error saving metrics to DB:', err.message);
      return null;
    }
  }

  /**
   * Collect and save metrics in one call
   */
  async run() {
    const metrics = await this.collectMetrics();
    if (metrics) {
      return await this.saveMetrics(metrics);
    }
    return null;
  }
}

export default MetricsCollector;
