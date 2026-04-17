// src/features/admin/admin-settings.schema.js
import { z } from 'zod';

export const adminSettingsSchemas = {
  // Email Settings Schemas
  emailSettingsSchema: z.object({
    provider: z.enum(['smtp', 'sendgrid', 'aws-ses']),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUsername: z.string().optional(),
    smtpPassword: z.string().optional(),
    sendgridApiKey: z.string().optional(),
    awsSesRegion: z.string().optional(),
    fromEmail: z.string().email(),
    fromName: z.string().min(1)
  }),

  testEmailSchema: z.object({
    recipientEmail: z.string().email()
  }),

  // Notification Settings Schemas
  notificationSettingsSchema: z.object({
    channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'in-app'])).optional(),
    emailProvider: z.enum(['smtp', 'sendgrid', 'aws-ses']).optional(),
    smsProvider: z.string().optional(),
    whatsappProvider: z.string().optional(),
    inAppEnabled: z.boolean().optional(),
    templates: z.array(z.object({
      name: z.string(),
      subject: z.string().optional(),
      body: z.string(),
      enabled: z.boolean()
    })).optional()
  }),

  // Database Settings Schemas
  databaseSettingsSchema: z.object({
    poolSize: z.number().min(1).max(100).optional(),
    connectionTimeout: z.number().min(1000).optional(),
    idleTimeout: z.number().min(1000).optional(),
    maxQueryTime: z.number().min(100).optional(),
    backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    backupRetention: z.number().min(1).optional(),
    slowQueryThreshold: z.number().min(100).optional(),
    enableQueryLogging: z.boolean().optional()
  }),

  // API Settings Schemas
  apiSettingsSchema: z.object({
    rateLimitPerMinute: z.number().min(10).optional(),
    rateLimitPerHour: z.number().min(100).optional(),
    corsOrigins: z.array(z.string()).optional(),
    corsCredentials: z.boolean().optional()
  }),

  revokeApiKeySchema: z.object({
    hashedKey: z.string()
  }),

  // Cron Settings Schemas
  cronJobSchema: z.object({
    name: z.string().min(1),
    schedule: z.string().min(1), // cron expression
    description: z.string().optional(),
    enabled: z.boolean().optional()
  }),

  cronJobIdSchema: z.object({
    jobId: z.string()
  }),

  // Maintenance Settings Schemas
  maintenanceSettingsSchema: z.object({
    enabled: z.boolean(),
    mode: z.enum(['maintenance', 'restricted']).optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    allowAdminAccess: z.boolean().optional(),
    countdownEnabled: z.boolean().optional(),
    scheduledStart: z.string().datetime().optional(),
    scheduledEnd: z.string().datetime().optional()
  })
};

export default adminSettingsSchemas;
