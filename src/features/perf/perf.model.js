import mongoose from 'mongoose';

// Server Metrics: CPU, memory, load, disk, uptime
const serverMetricSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    cpu: { type: Number, default: 0 }, // percentage 0-100
    memory: { type: Number, default: 0 }, // percentage 0-100
    memoryUsed: { type: Number, default: 0 }, // bytes
    memoryTotal: { type: Number, default: 0 }, // bytes
    load1: { type: Number, default: 0 },
    load5: { type: Number, default: 0 },
    load15: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 }, // seconds
    freeMemory: { type: Number, default: 0 },
    eventLoopLag: { type: Number, default: 0 }, // milliseconds
    processCount: { type: Number, default: 0 },
  },
  { collection: 'server_metrics', timestamps: true }
);

// TTL index: auto-delete old metrics after 90 days
serverMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Network Latency: ping/RTT to endpoints
const networkLatencySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    target: { type: String, required: true, index: true }, // endpoint URL
    latency: { type: Number, default: 0 }, // milliseconds
    status: { type: Number, default: 0 }, // HTTP status code
    success: { type: Boolean, default: false },
    error: { type: String },
  },
  { collection: 'network_latency', timestamps: true }
);

networkLatencySchema.index({ target: 1, timestamp: -1 });

// Uptime/Health Check: tracks service availability
const uptimeEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    service: { type: String, required: true, index: true }, // e.g., "api", "backend", "frontend"
    status: { type: String, enum: ['up', 'down', 'degraded'], default: 'up' },
    reason: { type: String }, // error message if down
    responseTime: { type: Number }, // milliseconds
    statusCode: { type: Number },
  },
  { collection: 'uptime_events', timestamps: true }
);

uptimeEventSchema.index({ service: 1, timestamp: -1 });

// Aggregated metrics (for faster querying)
const metricAggregateSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    period: { type: String, enum: ['5m', '1h', '1d'], default: '5m' }, // aggregation granularity
    type: { type: String, enum: ['server', 'network', 'uptime'], required: true },
    avg: { type: Number },
    min: { type: Number },
    max: { type: Number },
    p50: { type: Number },
    p95: { type: Number },
    p99: { type: Number },
    count: { type: Number, default: 0 },
    target: { type: String }, // for network metrics
    service: { type: String }, // for uptime metrics
  },
  { collection: 'metric_aggregates', timestamps: true }
);

metricAggregateSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 }); // 1 year
metricAggregateSchema.index({ type: 1, timestamp: -1 });
metricAggregateSchema.index({ service: 1, timestamp: -1 });
metricAggregateSchema.index({ target: 1, timestamp: -1 });

// Alert rules and incidents
const alertIncidentSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    alertRule: { type: String, required: true }, // e.g., "cpu_high", "latency_high"
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    service: { type: String },
    metric: { type: String }, // e.g., "cpu", "network_latency"
    value: { type: Number },
    threshold: { type: Number },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    resolvedAt: { type: Date },
    message: { type: String },
    notified: { type: Boolean, default: false },
  },
  { collection: 'alert_incidents', timestamps: true }
);

alertIncidentSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });
alertIncidentSchema.index({ status: 1, timestamp: -1 });
alertIncidentSchema.index({ alertRule: 1, timestamp: -1 });

const ServerMetric = mongoose.model('ServerMetric', serverMetricSchema);
const NetworkLatency = mongoose.model('NetworkLatency', networkLatencySchema);
const UptimeEvent = mongoose.model('UptimeEvent', uptimeEventSchema);
const MetricAggregate = mongoose.model('MetricAggregate', metricAggregateSchema);
const AlertIncident = mongoose.model('AlertIncident', alertIncidentSchema);

export { ServerMetric, NetworkLatency, UptimeEvent, MetricAggregate, AlertIncident };
