import PerfService from './perf.service.js';

/**
 * Controller for performance metrics endpoints
 */

// GET /api/perf/overview
export const getOverview = async (req, res) => {
  try {
    const { days = 1 } = req.query;
    const daysBack = Math.max(1, Math.min(90, parseInt(days) || 1));

    const overview = await PerfService.getOverview(daysBack);

    if (!overview) {
      return res.status(500).json({ error: 'Failed to fetch overview' });
    }

    res.json({
      success: true,
      data: overview,
    });
  } catch (err) {
    console.error('Error in getOverview:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/perf/server-metrics
export const getServerMetrics = async (req, res) => {
  try {
    const { days = 1 } = req.query;
    const daysBack = Math.max(1, Math.min(90, parseInt(days) || 1));

    const summary = await PerfService.getServerMetricsSummary(daysBack);

    if (!summary) {
      return res.status(404).json({ error: 'No metrics found' });
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error('Error in getServerMetrics:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/perf/network-latency
export const getNetworkLatency = async (req, res) => {
  try {
    const { days = 1 } = req.query;
    const daysBack = Math.max(1, Math.min(90, parseInt(days) || 1));

    const summary = await PerfService.getNetworkLatencySummary(daysBack);

    if (!summary || summary.length === 0) {
      return res.status(404).json({ error: 'No latency data found' });
    }

    res.json({
      success: true,
      data: {
        period: `${daysBack}d`,
        targets: summary,
      },
    });
  } catch (err) {
    console.error('Error in getNetworkLatency:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/perf/uptime
export const getUptime = async (req, res) => {
  try {
    const { service = 'backend-api', days = 1 } = req.query;
    const daysBack = Math.max(1, Math.min(90, parseInt(days) || 1));

    const status = await PerfService.getUptimeStatus(service, daysBack);

    if (!status) {
      return res.status(404).json({ error: 'No uptime data found' });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    console.error('Error in getUptime:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Health check endpoint (used by scheduler)
export const healthCheck = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Backend is healthy',
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
