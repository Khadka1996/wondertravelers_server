// src/utils/logger.util.js
import pino from 'pino';
import pinoPretty from 'pino-pretty';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Pretty printing only in development (human-readable console)
const pretty = pinoPretty({
  colorize: true,
  ignore: 'pid,hostname',
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l o', // local time + offset
  messageFormat: '{msg} {if reqId}→ {reqId}{end}',
  singleLine: true,
  hideObject: false,
  levelFirst: true,           // shows level before timestamp
  destination: process.stdout
});

// Destination: pretty in dev, raw JSON in prod/test
const destination = isProd || isTest ? undefined : pretty;

// Root Pino logger configuration
const rootLogger = pino(
  {
    level: isProd ? 'info' : isTest ? 'silent' : 'debug',

    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
        app: 'chrono-vault',
        version: process.env.npm_package_version || 'development',
      }),
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        'token',
        'refreshToken',
        'accessToken',
        '*.password',
        '*.token',
      ],
      remove: true,
    },

    nestingKey: 'payload',
  },
  destination
);

// ── Helper: Create child logger for a request context ───────────────
export const createRequestLogger = (req) => {
  const reqId = req?.id || 'no-request-id';
  const method = req?.method || 'UNKNOWN';
  const url = req?.originalUrl || req?.url || 'unknown';

  return rootLogger.child({
    reqId,
    req: { method, url },
    module: 'http',
  });
};

// ── Convenience logger with same API as rootLogger ────────────────
export const logger = {
  fatal: (msg, obj = {}) => rootLogger.fatal(obj, msg),
  error: (msg, obj = {}) => rootLogger.error(obj, msg),
  warn:  (msg, obj = {}) => rootLogger.warn(obj, msg),
  info:  (msg, obj = {}) => rootLogger.info(obj, msg),
  debug: (msg, obj = {}) => rootLogger.debug(obj, msg),
  trace: (msg, obj = {}) => rootLogger.trace(obj, msg),

  // Special HTTP/morgan style logging
  http: (msg) => rootLogger.info({ http: true }, msg.trim()),
};

// Export raw Pino instance for advanced use
export const pinoInstance = rootLogger;

// Startup log
if (!isTest) {
  if (isProd) {
    rootLogger.info('Logger initialized → PRODUCTION mode (structured JSON)');
  } else {
    rootLogger.info('Logger initialized → DEVELOPMENT mode (pretty console output)');
  }
}
