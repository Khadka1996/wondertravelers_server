// src/config/schemas/audit.schema.js
import { z } from 'zod';
import { SEVERITY_LEVELS, ACTION_CATEGORIES } from '../../features/auth/audit.model.js';

// ========================
// Get Audit Logs Schema
// ========================
export const getAuditLogsSchema = z.object({
  // Pagination
  page: z
    .string()
    .regex(/^\d+$/, { message: 'Page must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'Page must be greater than 0' })
    .default('1'),
    
  limit: z
    .string()
    .regex(/^\d+$/, { message: 'Limit must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 200, { 
      message: 'Limit must be between 1 and 200' 
    })
    .default('50'),
    
  // Filters
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid user ID format' })
    .optional(),
    
  action: z
    .string()
    .max(100, { message: 'Action name too long' })
    .optional(),
    
  category: z
    .enum(Object.values(ACTION_CATEGORIES))
    .optional(),
    
  severity: z
    .enum(Object.values(SEVERITY_LEVELS))
    .optional(),
    
  ipAddress: z
    .string()
    .ip({ version: 'v4', message: 'Invalid IPv4 address' })
    .optional(),
    
  success: z
    .enum(['true', 'false'])
    .optional(),
    
  statusCode: z
    .string()
    .regex(/^\d{3}$/, { message: 'Invalid status code format' })
    .refine(val => {
      const code = parseInt(val, 10);
      return code >= 100 && code <= 599;
    }, { message: 'Status code must be between 100 and 599' })
    .optional(),
    
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
    .optional(),
    
  endpoint: z
    .string()
    .max(500, { message: 'Endpoint too long' })
    .optional(),
    
  tag: z
    .string()
    .max(100, { message: 'Tag too long' })
    .optional(),
    
  source: z
    .string()
    .max(100, { message: 'Source too long' })
    .optional(),
    
  // Date range
  startDate: z
    .string()
    .datetime({ message: 'Invalid start date format' })
    .optional(),
    
  endDate: z
    .string()
    .datetime({ message: 'Invalid end date format' })
    .optional(),
    
  defaultDays: z
    .string()
    .regex(/^\d+$/, { message: 'Default days must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 365, {
      message: 'Default days must be between 1 and 365'
    })
    .optional(),
});

// ========================
// Security Summary Schema
// ========================
export const securitySummarySchema = z.object({
  hours: z
    .string()
    .regex(/^\d+$/, { message: 'Hours must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 720, {
      message: 'Hours must be between 1 and 720 (30 days)'
    })
    .default('24'),
    
  days: z
    .string()
    .regex(/^\d+$/, { message: 'Days must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 30, {
      message: 'Days must be between 1 and 30'
    })
    .default('7'),
});

// ========================
// Search Audit Logs Schema
// ========================
export const searchAuditSchema = z.object({
  q: z
    .string()
    .min(2, { message: 'Search query must be at least 2 characters' })
    .max(100, { message: 'Search query too long (max 100 characters)' }),
    
  page: z
    .string()
    .regex(/^\d+$/, { message: 'Page must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'Page must be greater than 0' })
    .default('1'),
    
  limit: z
    .string()
    .regex(/^\d+$/, { message: 'Limit must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 200, {
      message: 'Limit must be between 1 and 200'
    })
    .default('50'),
});

// ========================
// Export Audit Logs Schema
// ========================
export const exportAuditSchema = z.object({
  startDate: z
    .string()
    .datetime({ message: 'Invalid start date format' })
    .optional(),
    
  endDate: z
    .string()
    .datetime({ message: 'Invalid end date format' })
    .optional(),
    
  format: z
    .enum(['json', 'csv'])
    .default('json'),
})
.refine(data => {
  // Validate date range if both are provided
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    // Maximum range: 90 days
    const maxRangeDays = 90;
    const rangeDays = (end - start) / (1000 * 60 * 60 * 24);
    
    if (rangeDays > maxRangeDays) {
      throw new Error(`Export range cannot exceed ${maxRangeDays} days`);
    }
    
    if (end <= start) {
      throw new Error('End date must be after start date');
    }
  }
  return true;
});

// ========================
// Cleanup Audit Logs Schema
// ========================
export const cleanupAuditSchema = z.object({
  days: z
    .number()
    .int()
    .min(30, { message: 'Minimum retention period is 30 days for compliance' })
    .max(365, { message: 'Maximum retention period is 365 days' })
    .optional(),
    
  confirm: z
    .literal('YES_DELETE_OLD_LOGS')
    .refine(val => val === 'YES_DELETE_OLD_LOGS', {
      message: 'Confirmation required. Set confirm="YES_DELETE_OLD_LOGS" to proceed',
    }),
});

// ========================
// Get User Audit Trail Schema
// ========================
export const getUserAuditTrailSchema = z.object({
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid user ID format' }),
    
  limit: z
    .string()
    .regex(/^\d+$/, { message: 'Limit must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 500, {
      message: 'Limit must be between 1 and 500'
    })
    .optional()
    .default('100'),
    
  startDate: z
    .string()
    .datetime({ message: 'Invalid start date format' })
    .optional(),
    
  endDate: z
    .string()
    .datetime({ message: 'Invalid end date format' })
    .optional(),
});

// ========================
// Get Audit Metrics Schema
// ========================
export const getAuditMetricsSchema = z.object({
  hours: z
    .string()
    .regex(/^\d+$/, { message: 'Hours must be a positive integer' })
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 720, {
      message: 'Hours must be between 1 and 720 (30 days)'
    })
    .default('24'),
});

// ========================
// Stream Audit Events Schema
// ========================
export const streamAuditSchema = z.object({
  // Optional: Add filters for streaming specific events
  severity: z
    .enum(['high', 'critical'])
    .optional(),
    
  category: z
    .enum(Object.values(ACTION_CATEGORIES))
    .optional(),
    
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid user ID format' })
    .optional(),
});

// ========================
// Create Custom Audit Log Schema (for manual logging)
// ========================
export const createAuditLogSchema = z.object({
  userId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid user ID format' })
    .optional(),
    
  action: z
    .string()
    .min(1, { message: 'Action is required' })
    .max(100, { message: 'Action name too long' }),
    
  category: z
    .enum(Object.values(ACTION_CATEGORIES))
    .default(ACTION_CATEGORIES.SYSTEM),
    
  severity: z
    .enum(Object.values(SEVERITY_LEVELS))
    .default(SEVERITY_LEVELS.LOW),
    
  details: z
    .string()
    .min(1, { message: 'Details are required' })
    .max(1000, { message: 'Details too long (max 1000 characters)' }),
    
  metadata: z
    .record(z.any())
    .optional()
    .default({}),
    
  ipAddress: z
    .string()
    .ip({ version: 'v4', message: 'Invalid IPv4 address' })
    .optional(),
    
  userAgent: z
    .string()
    .max(500, { message: 'User agent too long' })
    .optional(),
    
  success: z
    .boolean()
    .default(true),
});

// ========================
// Bulk Delete Audit Logs Schema
// ========================
export const bulkDeleteAuditSchema = z.object({
  filters: z.object({
    userId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid user ID format' })
      .optional(),
      
    action: z
      .string()
      .max(100, { message: 'Action name too long' })
      .optional(),
      
    severity: z
      .enum(Object.values(SEVERITY_LEVELS))
      .optional(),
      
    startDate: z
      .string()
      .datetime({ message: 'Invalid start date format' })
      .optional(),
      
    endDate: z
      .string()
      .datetime({ message: 'Invalid end date format' })
      .optional(),
  }),
  
  confirm: z
    .literal('YES_DELETE_BULK_LOGS')
    .refine(val => val === 'YES_DELETE_BULK_LOGS', {
      message: 'Confirmation required. Set confirm="YES_DELETE_BULK_LOGS" to proceed',
    }),
});

// ========================
// Export All Schemas
// ========================
export const auditSchemas = {
  getAuditLogsSchema,
  securitySummarySchema,
  searchAuditSchema,
  exportAuditSchema,
  cleanupAuditSchema,
  getUserAuditTrailSchema,
  getAuditMetricsSchema,
  streamAuditSchema,
  createAuditLogSchema,
  bulkDeleteAuditSchema,
};

export default auditSchemas;