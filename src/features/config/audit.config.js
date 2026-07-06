// src/config/audit.config.js

/**
 * Audit System Configuration
 * Centralized configuration for the audit logging system
 */

// Environment-based configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Default retention days from environment or default
const DEFAULT_RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;

export const AUDIT_CONFIG = {
  // Environment settings
  environment: {
    isProduction,
    isDevelopment,
    isTest,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  // ========================
  // PAGINATION & LIMITS
  // ========================
  limits: {
    // Pagination limits
    maxPageSize: 200,
    defaultPageSize: 50,
    minPageSize: 1,
    
    // Export limits
    maxExportDays: 90,
    maxExportRecords: 1000000, // Maximum records that can be exported
    exportBatchSize: 1000, // Batch size for streaming exports
    
    // Search limits
    minSearchQueryLength: 2,
    maxSearchQueryLength: 100,
    
    // Stream limits
    streamTimeout: 300000, // 5 minutes in milliseconds
    streamHeartbeatInterval: 30000, // 30 seconds
    streamCheckInterval: 5000, // 5 seconds
    maxConcurrentStreams: 20,
    maxEventsPerStreamBatch: 50,
    
    // Text field limits
    maxDetailsLength: 1000,
    maxMetadataSize: 16384, // 16KB max for metadata
    
    // Query limits
    maxQueryDepth: 3,
    maxQueryDuration: 30000, // 30 seconds
    
    // File limits for exports
    maxExportFileSize: 100 * 1024 * 1024, // 100MB
    tempFileLifetime: 3600000, // 1 hour
  },
  
  // ========================
  // SECURITY SETTINGS
  // ========================
  security: {
    // CSRF protection
    requireCsrfForAuditEndpoints: isProduction,
    csrfCookieName: 'XSRF-TOKEN',
    csrfHeaderName: 'X-CSRF-Token',
    
    // Input sanitization
    sanitizeInput: true,
    sanitizeOptions: {
      allowedTags: [], // No HTML allowed
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    },
    
    // Export security
    allowedExportFormats: ['json', 'csv'],
    requireExportConfirmation: true,
    exportConfirmationPhrase: 'YES_DELETE_OLD_LOGS',
    
    // Cleanup security
    requireCleanupConfirmation: true,
    cleanupConfirmationPhrase: 'YES_DELETE_OLD_LOGS',
    minRetentionDays: 30,
    maxRetentionDays: 365,
    
    // Access control
    requireAdminForAuditAccess: true,
    allowedAdminRoles: ['admin'],
    
    // Rate limiting (requests per 15 minutes)
    rateLimits: {
      auditLogs: 100,
      auditSearch: 50,
      auditExport: 5,
      auditStream: 10,
      auditCleanup: 3,
    },
    
    // IP security
    enableIpFiltering: isProduction,
    allowedIpRanges: process.env.ALLOWED_IP_RANGES ? 
      process.env.ALLOWED_IP_RANGES.split(',') : [],
    blockedIpRanges: process.env.BLOCKED_IP_RANGES ? 
      process.env.BLOCKED_IP_RANGES.split(',') : [],
  },
  
  // ========================
  // PERFORMANCE SETTINGS
  // ========================
  performance: {
    // Query optimization
    queryTimeout: 30000, // 30 seconds
    enableQueryOptimization: true,
    maxConcurrentQueries: 10,
    
    // Caching
    cacheEnabled: true,
    cacheTtl: 300, // 5 minutes in seconds
    cacheMaxSize: 1000, // Maximum cache entries
    
    // Database optimization
    enableIndexing: true,
    indexCreationOnStartup: true,
    batchWriteSize: 100,
    
    // Memory management
    maxRecordsInMemory: 10000, // Threshold for using temp files
    useTempFilesThreshold: 5000, // Use temp files above this count
    enableStreamingForLargeExports: true,
    
    // Compression
    enableCompression: true,
    compressionThreshold: 1024, // 1KB
    compressionLevel: 6, // 0-9 (6 is balanced)
  },
  
  // ========================
  // DATA RETENTION & ARCHIVAL
  // ========================
  retention: {
    // Retention periods (in days)
    defaultRetentionDays: DEFAULT_RETENTION_DAYS,
    
    // Category-based retention
    categoryRetention: {
      authentication: DEFAULT_RETENTION_DAYS,
      authorization: DEFAULT_RETENTION_DAYS,
      user_management: 180, // 6 months for user management
      security: 365, // 1 year for security events
      system: DEFAULT_RETENTION_DAYS,
      data: 730, // 2 years for data access logs
    },
    
    // Severity-based retention
    severityRetention: {
      low: DEFAULT_RETENTION_DAYS,
      medium: 180, // 6 months
      high: 365, // 1 year
      critical: 730, // 2 years
    },
    
    // Archival settings
    enableArchival: true,
    archiveBeforeDeletion: true,
    archiveLocation: process.env.AUDIT_ARCHIVE_PATH || './audit-archives',
    archiveFormat: 'gzip', // 'gzip' or 'zip'
    
    // Cleanup schedule (cron format)
    cleanupSchedule: '0 2 * * *', // Daily at 2 AM
    cleanupBatchSize: 10000,
  },
  
  // ========================
  // MONITORING & ALERTING
  // ========================
  monitoring: {
    // Metrics collection
    enableMetrics: true,
    metricsRetentionDays: 30,
    
    // Performance monitoring
    logSlowQueries: true,
    slowQueryThreshold: 5000, // 5 seconds
    logLargeResults: true,
    largeResultThreshold: 1000, // Records
    
    // Health checks
    enableHealthChecks: true,
    healthCheckInterval: 60000, // 1 minute
    healthCheckTimeout: 5000, // 5 seconds
    
    // Alert thresholds
    alertThresholds: {
      highSeverityEventsPerHour: 100,
      failedAuthenticationPerHour: 50,
      concurrentStreams: 15,
      memoryUsagePercent: 80,
      diskUsagePercent: 85,
    },
    
    // Alert destinations
    alertDestinations: {
      email: process.env.AUDIT_ALERT_EMAIL,
      slack: process.env.AUDIT_ALERT_SLACK_WEBHOOK,
      webhook: process.env.AUDIT_ALERT_WEBHOOK,
    },
    
    // Logging levels
    logLevels: {
      production: 'warn',
      development: 'debug',
      test: 'error'
    }
  },
  
  // ========================
  // EXPORT SETTINGS
  // ========================
  export: {
    // File handling
    tempDirectory: process.env.TEMP_DIR || '/tmp',
    maxTempFileAge: 3600000, // 1 hour
    enableTempFileCleanup: true,
    
    // Format-specific settings
    formats: {
      csv: {
        delimiter: ',',
        includeHeader: true,
        escapeCharacter: '"',
        lineEnding: '\n',
        encoding: 'utf-8',
      },
      json: {
        prettyPrint: !isProduction,
        encoding: 'utf-8',
        maxDepth: 10,
      }
    },
    
    // Compression
    compression: {
      enabled: true,
      level: 6,
      threshold: 10240, // 10KB
      format: 'gzip',
    },
    
    // Security
    requirePasswordForSensitiveExports: true,
    maxExportDuration: 3600000, // 1 hour
    exportTokenExpiry: 3600000, // 1 hour
  },
  
  // ========================
  // STREAMING SETTINGS
  // ========================
  streaming: {
    // Server-Sent Events (SSE)
    sse: {
      retryInterval: 3000, // 3 seconds for client reconnection
      keepAliveInterval: 30000, // 30 seconds
      maxRetries: 3,
      eventBufferSize: 100,
    },
    
    // WebSocket (future implementation)
    websocket: {
      enabled: false,
      path: '/ws/audit',
      pingInterval: 25000,
      pingTimeout: 5000,
      maxPayload: 1048576, // 1MB
    },
    
    // Filters
    defaultFilters: {
      severity: ['high', 'critical'],
      categories: ['security', 'authentication'],
    },
    
    // Rate limiting
    streamRateLimits: {
      eventsPerSecond: 10,
      connectionsPerUser: 3,
      connectionsPerIp: 5,
    }
  },
  
  // ========================
  // DATABASE SETTINGS
  // ========================
  database: {
    // MongoDB-specific settings
    mongo: {
      collectionName: 'securityaudits',
      readPreference: 'secondaryPreferred',
      writeConcern: 'majority',
      maxPoolSize: isProduction ? 50 : 20,
      minPoolSize: isProduction ? 10 : 5,
      maxIdleTimeMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 15000,
    },
    
    // Index configuration
    indexes: {
      ttlIndex: {
        field: 'expiresAt',
        expireAfterSeconds: 0,
        background: true,
      },
      compoundIndexes: [
        ['userId', 'timestamp'],
        ['action', 'timestamp'],
        ['severity', 'timestamp'],
        ['ipAddress', 'timestamp'],
        ['category', 'timestamp'],
      ],
      textIndexes: [
        {
          fields: ['details'],
          weights: { details: 10 },
          default_language: 'english',
        }
      ]
    },
    
    // Sharding (for large-scale deployments)
    sharding: {
      enabled: false,
      shardKey: { timestamp: 1 },
      chunksize: 64, // MB
    }
  },
  
  // ========================
  // FEATURE TOGGLES
  // ========================
  features: {
    // Core features
    enableAuditLogging: true,
    enableRealTimeStreaming: true,
    enableExportFunctionality: true,
    enableCleanupOperations: true,
    enableSearchFunctionality: true,
    
    // Advanced features
    enableGeoIPLookup: process.env.GEOIP_ENABLED === 'true',
    enableUserAgentParsing: true,
    enableAnomalyDetection: false, // Future feature
    enableComplianceReporting: true,
    enableDashboard: true,
    
    // Integration features
    enableWebhookNotifications: process.env.AUDIT_WEBHOOK_URL !== undefined,
    enableEmailNotifications: process.env.SMTP_HOST !== undefined,
    enableSlackNotifications: process.env.SLACK_WEBHOOK_URL !== undefined,
  },
  
  // ========================
  // COMPLIANCE SETTINGS
  // ========================
  compliance: {
    // GDPR settings
    gdpr: {
      enableDataAnonymization: true,
      anonymizationFields: ['ipAddress', 'userAgent', 'geolocation'],
      anonymizationMethod: 'hash', // 'hash', 'mask', or 'remove'
      enableRightToBeForgotten: true,
      deletionGracePeriod: 30, // days
    },
    
    // HIPAA settings
    hipaa: {
      enabled: process.env.HIPAA_COMPLIANT === 'true',
      encryptionRequired: true,
      auditTrailRequired: true,
      retentionPeriod: 365 * 6, // 6 years
    },
    
    // SOX settings
    sox: {
      enabled: process.env.SOX_COMPLIANT === 'true',
      changeManagementRequired: true,
      accessControlRequired: true,
      retentionPeriod: 365 * 7, // 7 years
    },
    
    // PCI-DSS settings
    pcidss: {
      enabled: process.env.PCI_DSS_COMPLIANT === 'true',
      encryptionRequired: true,
      dailyLogReview: true,
      retentionPeriod: 365, // 1 year
    }
  },
  
  // ========================
  // MISCELLANEOUS SETTINGS
  // ========================
  misc: {
    // Timezone
    defaultTimezone: process.env.TZ || 'UTC',
    
    // Date formats
    dateFormats: {
      api: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      display: 'YYYY-MM-DD HH:mm:ss',
      filename: 'YYYY-MM-DD_HH-mm-ss',
    },
    
    // Default values
    defaults: {
      summaryHours: 24,
      summaryDays: 7,
      metricsHours: 24,
      userTrailLimit: 100,
    },
    
    // Debug settings
    debug: {
      enableQueryLogging: isDevelopment,
      enablePerformanceLogging: isDevelopment,
      enableMemoryProfiling: isDevelopment,
      logAllAuditEvents: isTest,
    }
  }
};

// Helper functions
export const AUDIT_HELPERS = {
  /**
   * Get retention days for a specific category
   */
  getRetentionDaysForCategory: (category) => {
    return AUDIT_CONFIG.retention.categoryRetention[category] || 
           AUDIT_CONFIG.retention.defaultRetentionDays;
  },
  
  /**
   * Get retention days for a specific severity
   */
  getRetentionDaysForSeverity: (severity) => {
    return AUDIT_CONFIG.retention.severityRetention[severity] || 
           AUDIT_CONFIG.retention.defaultRetentionDays;
  },
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled: (featureName) => {
    return AUDIT_CONFIG.features[featureName] === true;
  },
  
  /**
   * Get environment-specific log level
   */
  getLogLevel: () => {
    return AUDIT_CONFIG.monitoring.logLevels[AUDIT_CONFIG.environment.nodeEnv] || 'info';
  },
  
  /**
   * Validate export parameters
   */
  validateExportParams: (params) => {
    const errors = [];
    
    if (params.format && !AUDIT_CONFIG.security.allowedExportFormats.includes(params.format)) {
      errors.push(`Invalid export format. Allowed: ${AUDIT_CONFIG.security.allowedExportFormats.join(', ')}`);
    }
    
    if (params.startDate && params.endDate) {
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      const rangeDays = (end - start) / (1000 * 60 * 60 * 24);
      
      if (rangeDays > AUDIT_CONFIG.limits.maxExportDays) {
        errors.push(`Export range cannot exceed ${AUDIT_CONFIG.limits.maxExportDays} days`);
      }
      
      if (end <= start) {
        errors.push('End date must be after start date');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  /**
   * Get rate limit configuration
   */
  getRateLimitConfig: (endpointType) => {
    const config = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: AUDIT_CONFIG.security.rateLimits[endpointType] || 100,
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    };
    
    return config;
  },
  
  /**
   * Generate export filename
   */
  generateExportFilename: (format, timestamp = Date.now()) => {
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    return `audit-logs_${dateStr}_${timeStr}.${format}`;
  }
};

// Export default configuration
export default AUDIT_CONFIG;