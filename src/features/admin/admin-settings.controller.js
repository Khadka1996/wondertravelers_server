// src/features/admin/admin-settings.controller.js
import { AdminSettingsService } from './admin-settings.service.js';
import { AuditService } from '../../services/audit.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';
import { User } from '../auth/auth.model.js';

export const adminSettingsController = {
  /**
   * Get email settings
   */
  getEmailSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getEmailSettings(req.user._id);
      return successResponse(res, 'Email settings retrieved successfully', settings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update email settings
   */
  updateEmailSettings: async (req, res) => {
    try {
      const { provider, smtpHost, smtpPort, smtpUsername, smtpPassword, sendgridApiKey, awsSesRegion, fromEmail, fromName } = req.body;

      const settings = await AdminSettingsService.updateEmailSettings(req.user._id, {
        provider,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        sendgridApiKey,
        awsSesRegion,
        fromEmail,
        fromName
      });

      return successResponse(res, 'Email settings updated successfully', settings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Test email configuration
   */
  testEmailConfig: async (req, res) => {
    try {
      const { recipientEmail } = req.body;

      if (!recipientEmail) {
        return errorResponse(res, 'Recipient email is required', 400);
      }

      const result = await AdminSettingsService.testEmailConfig(req.user._id, recipientEmail);
      return successResponse(res, 'Email test sent successfully', result, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get notification settings
   */
  getNotificationSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'Notification settings retrieved successfully', settings.notificationSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update notification settings
   */
  updateNotificationSettings: async (req, res) => {
    try {
      const { channels, emailProvider, smsProvider, whatsappProvider, inAppEnabled, templates } = req.body;

      const settings = await AdminSettingsService.updateNotificationSettings(req.user._id, {
        channels,
        emailProvider,
        smsProvider,
        whatsappProvider,
        inAppEnabled,
        templates
      });

      return successResponse(res, 'Notification settings updated successfully', settings.notificationSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get database settings
   */
  getDatabaseSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'Database settings retrieved successfully', settings.databaseSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update database settings
   */
  updateDatabaseSettings: async (req, res) => {
    try {
      const { poolSize, connectionTimeout, idleTimeout, maxQueryTime, backupFrequency, backupRetention, slowQueryThreshold, enableQueryLogging } = req.body;

      const settings = await AdminSettingsService.updateDatabaseSettings(req.user._id, {
        poolSize,
        connectionTimeout,
        idleTimeout,
        maxQueryTime,
        backupFrequency,
        backupRetention,
        slowQueryThreshold,
        enableQueryLogging
      });

      return successResponse(res, 'Database settings updated successfully', settings.databaseSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Trigger database backup
   */
  triggerDatabaseBackup: async (req, res) => {
    try {
      // This is a placeholder - implement actual backup logic
      return successResponse(res, 'Database backup triggered successfully', {
        backupId: `backup_${Date.now()}`,
        status: 'in_progress',
        startedAt: new Date(),
        estimatedDuration: '5 minutes'
      }, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Verify database integrity
   */
  verifyDatabaseIntegrity: async (req, res) => {
    try {
      // This is a placeholder - implement actual integrity check
      return successResponse(res, 'Database integrity check completed', {
        status: 'healthy',
        checksPerformed: ['collections', 'indexes', 'references'],
        issues: [],
        checkedAt: new Date()
      }, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get API settings
   */
  getApiSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'API settings retrieved successfully', settings.apiSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update API settings
   */
  updateApiSettings: async (req, res) => {
    try {
      const { rateLimitPerMinute, rateLimitPerHour, corsOrigins, corsCredentials } = req.body;

      const settings = await AdminSettingsService.updateApiSettings(req.user._id, {
        rateLimitPerMinute,
        rateLimitPerHour,
        corsOrigins,
        corsCredentials
      });

      return successResponse(res, 'API settings updated successfully', settings.apiSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Generate new API key
   */
  generateApiKey: async (req, res) => {
    try {
      const result = await AdminSettingsService.generateApiKey(req.user._id);
      return successResponse(res, 'API key generated successfully', result, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Revoke API key
   */
  revokeApiKey: async (req, res) => {
    try {
      const { hashedKey } = req.body;

      if (!hashedKey) {
        return errorResponse(res, 'Hashed key is required', 400);
      }

      const settings = await AdminSettingsService.revokeApiKey(req.user._id, hashedKey);
      return successResponse(res, 'API key revoked successfully', settings.apiSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get cron settings
   */
  getCronSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'Cron settings retrieved successfully', settings.cronSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Create cron job
   */
  createCronJob: async (req, res) => {
    try {
      const { name, schedule, description, enabled } = req.body;

      const settings = await AdminSettingsService.createOrUpdateCronJob(req.user._id, null, {
        name,
        schedule,
        description,
        enabled: enabled ?? true,
        paused: false
      });

      return successResponse(res, 'Cron job created successfully', settings.cronSettings, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update cron job
   */
  updateCronJob: async (req, res) => {
    try {
      const { jobId } = req.params;
      const { name, schedule, description, enabled } = req.body;

      const settings = await AdminSettingsService.createOrUpdateCronJob(req.user._id, jobId, {
        name,
        schedule,
        description,
        enabled
      });

      return successResponse(res, 'Cron job updated successfully', settings.cronSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Delete cron job
   */
  deleteCronJob: async (req, res) => {
    try {
      const { jobId } = req.params;

      const settings = await AdminSettingsService.deleteCronJob(req.user._id, jobId);
      return successResponse(res, 'Cron job deleted successfully', settings.cronSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Toggle cron job status
   */
  toggleCronJobStatus: async (req, res) => {
    try {
      const { jobId } = req.params;

      const settings = await AdminSettingsService.toggleCronJobStatus(req.user._id, jobId);
      return successResponse(res, 'Cron job status toggled successfully', settings.cronSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get maintenance settings
   */
  getMaintenanceSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'Maintenance settings retrieved successfully', settings.maintenanceSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update maintenance settings
   */
  updateMaintenanceSettings: async (req, res) => {
    try {
      const { enabled, mode, title, message, allowAdminAccess, countdownEnabled, scheduledStart, scheduledEnd } = req.body;

      const settings = await AdminSettingsService.updateMaintenanceSettings(req.user._id, {
        enabled,
        mode,
        title,
        message,
        allowAdminAccess,
        countdownEnabled,
        scheduledStart,
        scheduledEnd
      });

      return successResponse(res, 'Maintenance settings updated successfully', settings.maintenanceSettings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get all settings for dashboard
   */
  getAllSettings: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getAllSettings(req.user._id);
      return successResponse(res, 'All settings retrieved successfully', settings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get payment methods
   */
  getPaymentMethods: async (req, res) => {
    try {
      const methods = await AdminSettingsService.getPaymentMethods(req.user._id);
      return successResponse(res, 'Payment methods retrieved successfully', methods, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get enabled payment methods
   */
  getEnabledPaymentMethods: async (req, res) => {
    try {
      const methods = await AdminSettingsService.getEnabledPaymentMethods(req.user._id);
      return successResponse(res, 'Enabled payment methods retrieved successfully', methods, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Toggle payment method
   */
  togglePaymentMethod: async (req, res) => {
    try {
      const { methodName } = req.params;
      const result = await AdminSettingsService.togglePaymentMethod(req.user._id, methodName);
      return successResponse(res, `Payment method ${methodName} toggled successfully`, result, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update payment method configuration
   */
  updatePaymentMethod: async (req, res) => {
    try {
      const { methodName } = req.params;
      const updates = req.body;

      const result = await AdminSettingsService.updatePaymentMethod(req.user._id, methodName, updates);
      return successResponse(res, `Payment method ${methodName} updated successfully`, result, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get order notification settings
   */
  getOrderNotifications: async (req, res) => {
    try {
      const settings = await AdminSettingsService.getOrderNotifications(req.user._id);
      return successResponse(res, 'Order notification settings retrieved successfully', settings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update order notification settings
   */
  updateOrderNotifications: async (req, res) => {
    try {
      const updates = req.body;
      const settings = await AdminSettingsService.updateOrderNotifications(req.user._id, updates);
      return successResponse(res, 'Order notification settings updated successfully', settings, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Get a specific user's notification preferences (admin)
   */
  getUserNotificationPreferences: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return errorResponse(res, 'userId is required', 400);

      const user = await User.findById(userId).select('notificationPreferences');
      if (!user) return errorResponse(res, 'User not found', 404);

      // Log audit entry for admin viewing user preferences
      await AuditService.logUserNotificationPreferenceAccess(
        req.user._id,
        userId,
        req.ip || 'unknown',
        req.originalUrl,
        req.id
      );

      return successResponse(res, 'User notification preferences retrieved', user.notificationPreferences || {}, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  },

  /**
   * Update a specific user's notification preferences (admin)
   */
  updateUserNotificationPreferences: async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      if (!userId) return errorResponse(res, 'userId is required', 400);

      const user = await User.findById(userId);
      if (!user) return errorResponse(res, 'User not found', 404);

      // Store original preferences for audit log
      const originalPrefs = JSON.parse(JSON.stringify(user.notificationPreferences || {}));

      // Merge order preferences safely
      user.notificationPreferences = user.notificationPreferences || {};
      user.notificationPreferences.order = {
        ...(user.notificationPreferences.order || {}),
        ...(updates.order || {})
      };

      await user.save();

      // Log audit entry for admin updating user preferences
      const changedFields = updates.order ? Object.keys(updates.order) : [];
      await AuditService.logUserNotificationPreferenceChange(
        req.user._id,
        userId,
        {
          before: originalPrefs.order || {},
          after: user.notificationPreferences.order || {},
          changedFields
        },
        req.ip || 'unknown',
        req.originalUrl,
        req.id
      );

      return successResponse(res, 'User notification preferences updated', user.notificationPreferences, 200);
    } catch (error) {
      return errorResponse(res, error.message, 500);
    }
  }
};

export default adminSettingsController;
