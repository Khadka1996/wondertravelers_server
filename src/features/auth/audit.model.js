// src/features/auth/audit.model.js
import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema } = mongoose;

// Define severity levels for better type safety
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Define audit action categories
const ACTION_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  USER_MANAGEMENT: 'user_management',
  SECURITY: 'security',
  SYSTEM: 'system',
  DATA: 'data',
  CATEGORY: 'category'
};

const SecurityAuditSchema = new Schema(
  {
    // Unique audit ID for easy reference
    auditId: {
      type: String,
      unique: true,
      default: () => `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      index: true,
    },
    
    // User who performed the action (if authenticated)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: false,
    },
    
    // Type of security event
    action: {
      type: String,
      required: true,
      enum: [
        // === AUTHENTICATION EVENTS ===
        'login_success',
        'login_failed',
        'logout',
        'session_expired',
        'token_refresh',
        'token_refresh_failed',
        'token_verification_failed',
        'wrong_token_type',
        'user_not_found',
        'inactive_account_access',
        'password_changed_after_token',
        'session_version_mismatch',
        'authentication_failed',
        'authentication_success',
        'authentication_error',
        'cookie_auth_failed',
        'cookie_auth_error',
        'auto_token_refresh',
        'auto_token_refresh_failed',
        
        // === AUTHORIZATION EVENTS ===
        'permission_denied',
        'role_change',
        'admin_action',
        'privilege_escalation_attempt',
        
        // === USER MANAGEMENT EVENTS ===
        'registration',
        'registration_failed',
        'profile_update',
        'profile_update_failed',
        'avatar_upload',
        'avatar_upload_failed',
        'avatar_deleted',
        'account_deactivated',
        'account_reactivated',
        'account_deletion_failed',
        'account_deletion_error',
        'account_deleted',
        'user_suspended',
        'user_unsuspended',
        'user_edited',
        'user_phone_verified',
        'user_phone_verification_failed',
        'user_address_verified',
        'user_address_verification_failed',
        
        // === PASSWORD EVENTS ===
        'password_change',
        'password_change_failed',
        'password_change_error',
        'password_reset_request',
        'password_reset_success',
        'password_reset_failed',
        'password_reuse_attempt',
        
        // === DEVICE & SESSION EVENTS ===
        'device_verified',
        'device_verification_failed',
        'device_removed',
        'device_not_trusted',
        'device_fingerprint_invalid',
        'device_check_error',
        'device_check_user_not_found',
        'device_trust_check_passed',
        'untrusted_device_access',
        'session_created',
        'session_destroyed',
        'session_hijack_attempt',
        
        // === SECURITY EVENTS ===
        'csrf_attempt',
        'csrf_validation_failed',
        'rate_limit_exceeded',
        'brute_force_attempt',
        'suspicious_activity',
        'ip_blocked',
        'ip_allowed',
        'malicious_payload_detected',
        'sql_injection_attempt',
        'xss_attempt',
        
        // === ADMINISTRATIVE EVENTS ===
        'user_deleted',
        'audit_logs_cleaned',
        'configuration_changed',
        'backup_created',
        'backup_failed',
        'system_maintenance',
        
        // === SYSTEM EVENTS ===
        'system_startup',
        'system_shutdown',
        'database_connection_lost',
        'database_reconnected',
        'high_memory_usage',
        'high_cpu_usage',
        'disk_space_low',
        
        // === DATA ACCESS EVENTS ===
        'data_exported',
        'data_export_failed',
        'data_imported',
        'sensitive_data_accessed',
        'bulk_data_deleted',
        'data_modified',
        
        // === ADMIN DASHBOARD EVENTS ===
        'security_dashboard_accessed',
        'user_login_history_viewed',
        'user_audit_trail_viewed',
        'user_locked',
        'user_unlocked',
        'admin_force_logout',
        
        // === MODERATOR EVENTS ===
        'user_list_viewed',
        'all_users_list_viewed',
        'user_details_viewed',
        'user_activity_viewed',
        'user_deactivated_by_moderator',
        'user_reactivated_by_moderator',
        'moderator_force_logout',
        'security_summary_viewed',
        'security_summary_accessed',
        'security_summary_access_failed',
        'audit_logs_filtered',
        'audit_logs_accessed',  // Added: when audit logs are fetched
        'audit_logs_access_failed',  // Added: when audit log fetch fails
        
        // === DEVICE & PROFILE EVENTS ===
        'trusted_devices_accessed',
        'trusted_devices_access_failed',
        'profile_accessed',
        'profile_access_failed',
        'avatar_updated',
        'avatar_update_failed',
        'avatar_uploaded',
        'avatar_deletion_failed',
        'device_removal_failed',
        
        // === ERROR & SYSTEM EVENTS ===
        'route_not_found',
        'request_processed',
        'unhandled_error',
        'unhandled_rejection',  // Added: for unhandled promise rejections
        'uncaught_exception',
        'jwt_error',
        'token_expired',
        'duplicate_key_error',
        'mongodb_validation_error',
        'file_upload_error',
        'validation_error',
        'password_reset_request_failed',
        'csrf_validation_failed',
        'rate_limit_exceeded'
      ],
      index: true,
    },
    
    // Category for grouping events
    category: {
      type: String,
      enum: Object.values(ACTION_CATEGORIES),
      required: true,
      index: true,
    },
    
    // Severity level
    severity: {
      type: String,
      enum: Object.values(SEVERITY_LEVELS),
      default: SEVERITY_LEVELS.MEDIUM,
      index: true,
    },
    
    // Detailed description
    details: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    
    // IP address of the request
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    
    // Geolocation data (can be populated by middleware)
    geolocation: {
      country: String,
      countryCode: String,
      region: String,
      regionName: String,
      city: String,
      zip: String,
      lat: Number,
      lon: Number,
      timezone: String,
      isp: String,
      org: String,
      as: String,
    },
    
    // User agent string
    userAgent: {
      type: String,
      default: null,
      maxlength: 500,
    },
    
    // Parsed user agent info
    userAgentInfo: {
      browser: String,
      browserVersion: String,
      os: String,
      osVersion: String,
      device: String,
      deviceType: String,
      isMobile: Boolean,
      isTablet: Boolean,
      isDesktop: Boolean,
      isBot: Boolean,
    },
    
    // Endpoint that was accessed
    endpoint: {
      type: String,
      required: true,
      index: true,
      maxlength: 500,
    },
    
    // HTTP method
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'SYSTEM'],
      required: true,
      index: true,
    },
    
    // HTTP status code
    statusCode: {
      type: Number,
      index: true,
    },
    
    // Request ID for correlation
    requestId: {
      type: String,
      index: true,
    },
    
    // Session ID
    sessionId: {
      type: String,
      index: true,
    },
    
    // Additional metadata (for flexibility)
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    
    // Success/failure status
    success: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Response time in milliseconds
    responseTime: {
      type: Number,
      min: 0,
    },
    
    // Request size in bytes
    requestSize: {
      type: Number,
      min: 0,
    },
    
    // Response size in bytes
    responseSize: {
      type: Number,
      min: 0,
    },
    
    // Automatic timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    // User timezone offset (in minutes)
    timezoneOffset: {
      type: Number,
      default: 0,
    },
    
    // Tags for easy filtering
    tags: [{
      type: String,
      index: true,
    }],
    
    // Correlation ID for distributed tracing
    correlationId: {
      type: String,
      index: true,
    },
    
    // Source of the audit (e.g., 'auth-middleware', 'controller', 'cron-job')
    source: {
      type: String,
      default: 'unknown',
      index: true,
    },
    
    // Expiry for automatic cleanup (GDPR compliance)
    expiresAt: {
      type: Date,
      default: () => {
        const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
        return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
      },
      index: { expires: 0 }, // TTL index will be set dynamically
    },
  },
  {
    timestamps: true,
    // Optimized indexes for common queries
    indexes: [
      // Composite indexes for common query patterns
      { userId: 1, timestamp: -1 },
      { action: 1, timestamp: -1 },
      { severity: 1, timestamp: -1 },
      { ipAddress: 1, timestamp: -1 },
      { success: 1, timestamp: -1 },
      { category: 1, timestamp: -1 },
      { endpoint: 1, timestamp: -1 },
      { method: 1, timestamp: -1 },
      { statusCode: 1, timestamp: -1 },
      
      // Text index for searching details
      { details: 'text' },
      
      // Geospatial index for location-based queries
      { 'geolocation.lat': 1, 'geolocation.lon': 1 },
    ],
  }
);

// Pre-save middleware to set category based on action
SecurityAuditSchema.pre('save', async function() {
  // Map action to category
  const categoryMap = {
    // Authentication
    'login_success': ACTION_CATEGORIES.AUTHENTICATION,
    'login_failed': ACTION_CATEGORIES.AUTHENTICATION,
    'logout': ACTION_CATEGORIES.AUTHENTICATION,
    'session_expired': ACTION_CATEGORIES.AUTHENTICATION,
    'token_refresh': ACTION_CATEGORIES.AUTHENTICATION,
    'token_refresh_failed': ACTION_CATEGORIES.AUTHENTICATION,
    'token_verification_failed': ACTION_CATEGORIES.AUTHENTICATION,
    'wrong_token_type': ACTION_CATEGORIES.AUTHENTICATION,
    'user_not_found': ACTION_CATEGORIES.AUTHENTICATION,
    'inactive_account_access': ACTION_CATEGORIES.AUTHENTICATION,
    'password_changed_after_token': ACTION_CATEGORIES.AUTHENTICATION,
    'session_version_mismatch': ACTION_CATEGORIES.AUTHENTICATION,
    
    // Authorization
    'permission_denied': ACTION_CATEGORIES.AUTHORIZATION,
    'role_change': ACTION_CATEGORIES.AUTHORIZATION,
    
    // User Management
    'registration': ACTION_CATEGORIES.USER_MANAGEMENT,
    'profile_update': ACTION_CATEGORIES.USER_MANAGEMENT,
    'avatar_upload': ACTION_CATEGORIES.USER_MANAGEMENT,
    'account_deactivated': ACTION_CATEGORIES.USER_MANAGEMENT,
    
    // Security
    'csrf_attempt': ACTION_CATEGORIES.SECURITY,
    'rate_limit_exceeded': ACTION_CATEGORIES.SECURITY,
    'brute_force_attempt': ACTION_CATEGORIES.SECURITY,
    'device_not_trusted': ACTION_CATEGORIES.SECURITY,
    'security_dashboard_accessed': ACTION_CATEGORIES.SECURITY,
    'user_login_history_viewed': ACTION_CATEGORIES.SECURITY,
    'user_locked': ACTION_CATEGORIES.SECURITY,
    'user_unlocked': ACTION_CATEGORIES.SECURITY,
    'admin_force_logout': ACTION_CATEGORIES.SECURITY,
    'user_list_viewed': ACTION_CATEGORIES.SECURITY,
    'user_details_viewed': ACTION_CATEGORIES.SECURITY,
    'user_activity_viewed': ACTION_CATEGORIES.SECURITY,
    'user_deactivated_by_moderator': ACTION_CATEGORIES.SECURITY,
    'user_reactivated_by_moderator': ACTION_CATEGORIES.SECURITY,
    'moderator_force_logout': ACTION_CATEGORIES.SECURITY,
    'security_summary_viewed': ACTION_CATEGORIES.SECURITY,
    'audit_logs_filtered': ACTION_CATEGORIES.SECURITY,
    
    // System
    'system_startup': ACTION_CATEGORIES.SYSTEM,
    'system_shutdown': ACTION_CATEGORIES.SYSTEM,
    
    // Default fallback
  };
  
  // Set category if not already set
  if (!this.category && categoryMap[this.action]) {
    this.category = categoryMap[this.action];
  } else if (!this.category) {
    // Default to security for unknown actions
    this.category = ACTION_CATEGORIES.SECURITY;
  }
  
  // Set tags based on severity and success
  this.tags = this.tags || [];
  
  // Add severity tag
  if (this.severity) {
    this.tags.push(`severity:${this.severity}`);
  }
  
  // Add success/failure tag
  this.tags.push(this.success ? 'status:success' : 'status:failure');
  
  // Add category tag
  this.tags.push(`category:${this.category}`);
  
  // Add timestamp-based tags (for easy time-based queries)
  const hour = this.timestamp.getHours();
  this.tags.push(`hour:${hour}`);
  
  const dayOfWeek = this.timestamp.getDay(); // 0 = Sunday
  this.tags.push(`day:${dayOfWeek}`);
  
  // Ensure tags are unique
  this.tags = [...new Set(this.tags)];
});

// Static methods for easy querying
SecurityAuditSchema.statics = {
  // Find events by user
  findByUser(userId, limit = 100, startDate = null, endDate = null) {
    const query = { userId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Find events by IP
  findByIp(ipAddress, limit = 100, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({ 
      ipAddress,
      timestamp: { $gte: cutoff }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Find failed login attempts
  findFailedLogins(limit = 50, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({ 
      action: 'login_failed',
      timestamp: { $gte: cutoff }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Find suspicious activity
  findSuspiciousActivity(hours = 24, limit = 100) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({
      severity: { $in: [SEVERITY_LEVELS.HIGH, SEVERITY_LEVELS.CRITICAL] },
      timestamp: { $gte: cutoff }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  },
  
  // Count events by type
  countByAction(action, hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.countDocuments({
      action,
      timestamp: { $gte: cutoff }
    });
  },
  
  // Get statistics for dashboard
  getDashboardStats(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return Promise.all([
      this.countDocuments({ timestamp: { $gte: cutoff } }),
      this.countDocuments({ 
        timestamp: { $gte: cutoff },
        success: false 
      }),
      this.countDocuments({ 
        timestamp: { $gte: cutoff },
        severity: SEVERITY_LEVELS.HIGH 
      }),
      this.countDocuments({ 
        timestamp: { $gte: cutoff },
        severity: SEVERITY_LEVELS.CRITICAL 
      }),
      this.aggregate([
        {
          $match: {
            timestamp: { $gte: cutoff }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ]),
      this.aggregate([
        {
          $match: {
            timestamp: { $gte: cutoff }
          }
        },
        {
          $group: {
            _id: '$ipAddress',
            count: { $sum: 1 },
            failedAttempts: {
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
            }
          }
        },
        {
          $match: {
            failedAttempts: { $gte: 5 }
          }
        },
        {
          $sort: { failedAttempts: -1 }
        },
        {
          $limit: 10
        }
      ])
    ]).then(([
      totalEvents,
      failedEvents,
      highSeverity,
      criticalSeverity,
      topActions,
      suspiciousIPs
    ]) => ({
      totalEvents,
      failedEvents,
      highSeverity,
      criticalSeverity,
      topActions,
      suspiciousIPs
    }));
  },
  
  // Search audit logs with full-text search
  search(query, limit = 50, skip = 0) {
    return this.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .lean();
  },
  
  // Cleanup old records (for GDPR compliance)
  cleanupOldRecords(days = null) {
    const retentionDays = days || parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
    if (retentionDays < 30) {
      throw new Error('Minimum retention period is 30 days for compliance');
    }
    
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return this.deleteMany({ timestamp: { $lt: cutoff } });
  },
  
  // Export audit logs for compliance reporting
  exportForCompliance(startDate, endDate, format = 'json') {
    const query = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
      .sort({ timestamp: 1 })
      .select('-__v -_id')
      .lean();
  },
  
  // Get activity heatmap data
  getActivityHeatmap(hours = 168) { // 7 days
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.aggregate([
      {
        $match: {
          timestamp: { $gte: cutoff }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            day: { $dayOfWeek: '$timestamp' }
          },
          count: { $sum: 1 },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.day': 1, '_id.hour': 1 }
      }
    ]);
  }
};

// Instance methods
SecurityAuditSchema.methods = {
  // Get human-readable representation
  toHumanReadable() {
    const timeAgo = this.getTimeAgo();
    return `${timeAgo} - ${this.action} - ${this.details} (${this.ipAddress})`;
  },
  
  // Check if this event requires immediate attention
  requiresAttention() {
    return this.severity === SEVERITY_LEVELS.CRITICAL || 
           (this.severity === SEVERITY_LEVELS.HIGH && !this.success);
  },
  
  // Get related events (same user/IP within time window)
  getRelatedEvents(timeWindowMinutes = 60) {
    const cutoff = new Date(this.timestamp.getTime() - timeWindowMinutes * 60 * 1000);
    
    const query = {
      _id: { $ne: this._id },
      timestamp: { $gte: cutoff },
      $or: [
        { userId: this.userId },
        { ipAddress: this.ipAddress }
      ]
    };
    
    return this.constructor.find(query)
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();
  }
};

// Virtual for human-readable time ago
SecurityAuditSchema.virtual('timeAgo').get(function() {
  const seconds = Math.floor((new Date() - this.timestamp) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} year${interval > 1 ? 's' : ''} ago`;
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} month${interval > 1 ? 's' : ''} ago`;
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} day${interval > 1 ? 's' : ''} ago`;
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} hour${interval > 1 ? 's' : ''} ago`;
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} minute${interval > 1 ? 's' : ''} ago`;
  
  return `${Math.floor(seconds)} second${seconds > 1 ? 's' : ''} ago`;
});

// Virtual for ISO date string
SecurityAuditSchema.virtual('isoDate').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for formatted date
SecurityAuditSchema.virtual('formattedDate').get(function() {
  return this.timestamp.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
});

// Query helper to find events by severity
SecurityAuditSchema.query.bySeverity = function(severity) {
  return this.where({ severity });
};

// Query helper to find events by success status
SecurityAuditSchema.query.bySuccess = function(success) {
  return this.where({ success });
};

// Query helper to find events within time range
SecurityAuditSchema.query.withinTimeRange = function(startDate, endDate) {
  const query = {};
  if (startDate) query.timestamp.$gte = new Date(startDate);
  if (endDate) query.timestamp.$lte = new Date(endDate);
  return this.where(query);
};

// Create indexes on startup if they don't exist
SecurityAuditSchema.statics.createIndexesIfNeeded = async function() {
  const collection = this.collection;
  const existingIndexes = await collection.indexes();
  
  // Check if TTL index exists
  const ttlIndexExists = existingIndexes.some(index => 
    index.key.expiresAt === 1
  );
  
  if (!ttlIndexExists) {
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;
    await collection.createIndex(
      { expiresAt: 1 },
      { 
        expireAfterSeconds: 0,
        name: 'audit_ttl_index',
        background: true,
        partialFilterExpression: {
          expiresAt: { $exists: true, $type: 'date' }
        }
      }
    );
    console.log(`Created TTL index for audit logs with ${retentionDays} days retention`);
  }
};

export const SecurityAudit = mongoose.model('SecurityAudit', SecurityAuditSchema);
export { SEVERITY_LEVELS, ACTION_CATEGORIES };