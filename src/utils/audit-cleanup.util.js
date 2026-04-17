// src/utils/audit-cleanup.util.js
import { SecurityAudit } from '../features/auth/audit.model.js';
import { logger } from './logger.util.js';

/**
 * Clean up old audit logs based on retention policy
 * Runs as a periodic CRON job
 */

const AUDIT_RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS) || 90;

/**
 * Delete audit logs older than retention period
 */
export const cleanupOldAuditLogs = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);

    const result = await SecurityAudit.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    if (result.deletedCount > 0) {
      logger.info('Audit log cleanup completed', {
        deletedCount: result.deletedCount,
        retentionDays: AUDIT_RETENTION_DAYS,
        cutoffDate: cutoffDate.toISOString()
      });
    }

    return {
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate: cutoffDate.toISOString()
    };
  } catch (err) {
    logger.error('Audit log cleanup failed', {
      error: err.message,
      retentionDays: AUDIT_RETENTION_DAYS
    });

    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * Get audit log statistics
 */
export const getAuditStats = async () => {
  try {
    const totalCount = await SecurityAudit.countDocuments();
    const oldestLog = await SecurityAudit.findOne().sort({ createdAt: 1 }).lean();
    const newestLog = await SecurityAudit.findOne().sort({ createdAt: -1 }).lean();
    
    const criticalCount = await SecurityAudit.countDocuments({ 
      severity: 'critical' 
    });
    const highCount = await SecurityAudit.countDocuments({ 
      severity: 'high' 
    });
    const mediumCount = await SecurityAudit.countDocuments({ 
      severity: 'medium' 
    });

    return {
      totalCount,
      criticalCount,
      highCount,
      mediumCount,
      oldestLog: oldestLog?.createdAt,
      newestLog: newestLog?.createdAt,
      retentionDays: AUDIT_RETENTION_DAYS
    };
  } catch (err) {
    logger.error('Failed to get audit stats', { error: err.message });
    return { error: err.message };
  }
};

export default {
  cleanupOldAuditLogs,
  getAuditStats,
  AUDIT_RETENTION_DAYS
};
