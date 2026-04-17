import { ServerMetric, NetworkLatency, UptimeEvent, MetricAggregate } from './perf.model.js';

/**
 * Service for querying and aggregating performance metrics
 */
class PerfService {
  /**
   * Get server metrics for a time range
   */
  static async getServerMetrics(startDate, endDate, limit = 100) {
    try {
      const metrics = await ServerMetric.find({
        timestamp: { $gte: startDate, $lte: endDate },
      })
        .sort({ timestamp: -1 })
        .limit(limit);

      return metrics;
    } catch (err) {
      console.error('Error fetching server metrics:', err.message);
      return [];
    }
  }

  /**
   * Get latest server metric
   */
  static async getLatestServerMetric() {
    try {
      const metric = await ServerMetric.findOne().sort({ timestamp: -1 });
      return metric || null;
    } catch (err) {
      console.error('Error fetching latest metric:', err.message);
      return null;
    }
  }

  /**
   * Get server metrics summary (current + averages)
   */
  static async getServerMetricsSummary(daysBack = 1) {
    try {
      const startDate = new Date(Date.now() - daysBack * 86400000);

      const current = await this.getLatestServerMetric();

      const aggregates = await ServerMetric.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            avgCpu: { $avg: '$cpu' },
            maxCpu: { $max: '$cpu' },
            avgMemory: { $avg: '$memory' },
            maxMemory: { $max: '$memory' },
            avgLoad1: { $avg: '$load1' },
            avgLoad5: { $avg: '$load5' },
            avgLoad15: { $avg: '$load15' },
            count: { $sum: 1 },
          },
        },
      ]);

      const agg = aggregates[0] || {};

      return {
        current: {
          cpu: current?.cpu || 0,
          memory: current?.memory || 0,
          memoryUsed: current?.memoryUsed || 0,
          memoryTotal: current?.memoryTotal || 0,
          load1: current?.load1 || 0,
          uptime: current?.uptime || 0,
          eventLoopLag: current?.eventLoopLag || 0,
          timestamp: current?.timestamp,
        },
        avgCpu: parseFloat((agg.avgCpu || 0).toFixed(2)),
        maxCpu: parseFloat((agg.maxCpu || 0).toFixed(2)),
        avgMemory: parseFloat((agg.avgMemory || 0).toFixed(2)),
        maxMemory: parseFloat((agg.maxMemory || 0).toFixed(2)),
        avgLoad1: parseFloat((agg.avgLoad1 || 0).toFixed(2)),
        samples: agg.count || 0,
        period: `${daysBack}d`,
      };
    } catch (err) {
      console.error('Error computing server summary:', err.message);
      return null;
    }
  }

  /**
   * Get network latency for a target
   */
  static async getNetworkLatency(target, startDate, endDate, limit = 100) {
    try {
      const latencies = await NetworkLatency.find({
        target,
        timestamp: { $gte: startDate, $lte: endDate },
      })
        .sort({ timestamp: -1 })
        .limit(limit);

      return latencies;
    } catch (err) {
      console.error('Error fetching network latency:', err.message);
      return [];
    }
  }

  /**
   * Get network latency summary (avg, min, max, p95, p99)
   */
  static async getNetworkLatencySummary(daysBack = 1) {
    try {
      const startDate = new Date(Date.now() - daysBack * 86400000);

      const summaries = await NetworkLatency.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate },
            success: true,
          },
        },
        {
          $group: {
            _id: '$target',
            avgLatency: { $avg: '$latency' },
            minLatency: { $min: '$latency' },
            maxLatency: { $max: '$latency' },
            count: { $sum: 1 },
            latencies: { $push: '$latency' },
          },
        },
      ]);

      const results = summaries.map((summary) => {
        const sorted = summary.latencies.sort((a, b) => a - b);
        const p95Idx = Math.ceil(sorted.length * 0.95) - 1;
        const p99Idx = Math.ceil(sorted.length * 0.99) - 1;

        return {
          target: summary._id,
          avgLatency: parseFloat((summary.avgLatency || 0).toFixed(2)),
          minLatency: summary.minLatency || 0,
          maxLatency: summary.maxLatency || 0,
          p95: sorted[Math.max(0, p95Idx)] || 0,
          p99: sorted[Math.max(0, p99Idx)] || 0,
          samples: summary.count || 0,
        };
      });

      return results;
    } catch (err) {
      console.error('Error computing network latency summary:', err.message);
      return [];
    }
  }

  /**
   * Get uptime for a service
   */
  static async getUptimeStatus(service, daysBack = 1) {
    try {
      const startDate = new Date(Date.now() - daysBack * 86400000);

      const events = await UptimeEvent.find({
        service,
        timestamp: { $gte: startDate },
      }).sort({ timestamp: -1 });

      const totalTime = daysBack * 24 * 60; // minutes
      let downtime = 0;
      let incidents = [];

      // Calculate downtime windows
      let downSince = null;

      for (const event of events.reverse()) {
        if (event.status === 'down' && !downSince) {
          downSince = event.timestamp;
        } else if (event.status === 'up' && downSince) {
          downtime += (downSince.getTime() - event.timestamp.getTime()) / 60000;
          incidents.push({
            service,
            startTime: event.timestamp,
            endTime: downSince,
            duration: (downSince.getTime() - event.timestamp.getTime()) / 1000,
            reason: event.reason,
          });
          downSince = null;
        }
      }

      if (downSince) {
        downtime += (Date.now() - downSince.getTime()) / 60000;
        incidents.push({
          service,
          startTime: downSince,
          endTime: new Date(),
          duration: (Date.now() - downSince.getTime()) / 1000,
          reason: 'Still down',
        });
      }

      const uptime = ((totalTime - downtime) / totalTime) * 100;

      return {
        service,
        uptime: parseFloat(uptime.toFixed(2)),
        downtime: parseFloat(downtime.toFixed(2)),
        totalTime,
        incidents: incidents.slice(0, 10), // last 10 incidents
        period: `${daysBack}d`,
      };
    } catch (err) {
      console.error('Error computing uptime status:', err.message);
      return null;
    }
  }

  /**
   * Get overview: combined summary of all metrics
   */
  static async getOverview(daysBack = 1) {
    try {
      const [serverSummary, networkSummary, uptimeStatus] = await Promise.all([
        this.getServerMetricsSummary(daysBack),
        this.getNetworkLatencySummary(daysBack),
        this.getUptimeStatus('backend-api', daysBack),
      ]);

      return {
        period: `${daysBack}d`,
        server: serverSummary,
        network: networkSummary,
        uptime: uptimeStatus,
        generatedAt: new Date(),
      };
    } catch (err) {
      console.error('Error generating overview:', err.message);
      return null;
    }
  }
}

export default PerfService;
