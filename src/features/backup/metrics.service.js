// src/features/backup/metrics.service.js
import client from 'prom-client';

// Create a registry to register metrics
const register = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register });

// Custom metric: HTTP request duration
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 3, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

const backupCreated = new client.Counter({
  name: 'chrono_backup_created_total',
  help: 'Total number of successful backups created',
  labelNames: ['type'],
  registers: [register],
});

const backupFailed = new client.Counter({
  name: 'chrono_backup_failed_total',
  help: 'Total number of failed backup attempts',
  labelNames: ['type'],
  registers: [register],
});

const backupDuration = new client.Histogram({
  name: 'chrono_backup_duration_seconds',
  help: 'Backup duration in seconds',
  labelNames: ['type'],
  buckets: [1,5,10,30,60,120,300,600,1800],
  registers: [register],
});

export function incBackupCreated(type = 'unknown') {
  backupCreated.inc({ type });
}

export function incBackupFailed(type = 'unknown') {
  backupFailed.inc({ type });
}

export function observeBackupDuration(type = 'unknown', seconds = 0) {
  backupDuration.observe({ type }, seconds);
}

export const getPrometheusMetrics = async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
};

export default { incBackupCreated, incBackupFailed, observeBackupDuration, getPrometheusMetrics };
