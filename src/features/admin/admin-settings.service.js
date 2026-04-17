// src/features/admin/admin-settings.service.js
import { AdminSettings } from './admin-settings.model.js';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';

/**
 * Admin Settings Service
 * Handles all admin settings (email, notifications, database, api, cron, maintenance)
 */

export class AdminSettingsService {
  /**
   * Get or create admin settings
   */
  static async getOrCreateSettings(adminId) {
    try {
      let settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        settings = await AdminSettings.create({
          adminId,
          emailSettings: {},
          notificationSettings: {},
          databaseSettings: {},
          apiSettings: {},
          cronSettings: {},
          maintenanceSettings: {}
        });
      }
      return settings;
    } catch (error) {
      throw new Error(`Failed to get/create admin settings: ${error.message}`);
    }
  }

  /**
   * Update email settings
   */
  static async updateEmailSettings(adminId, emailConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'emailSettings.provider': emailConfig.provider,
            'emailSettings.smtpHost': emailConfig.smtpHost,
            'emailSettings.smtpPort': emailConfig.smtpPort,
            'emailSettings.smtpUsername': emailConfig.smtpUsername,
            'emailSettings.smtpPassword': emailConfig.smtpPassword,
            'emailSettings.sendgridApiKey': emailConfig.sendgridApiKey,
            'emailSettings.awsSesRegion': emailConfig.awsSesRegion,
            'emailSettings.fromEmail': emailConfig.fromEmail,
            'emailSettings.fromName': emailConfig.fromName,
            'emailSettings.enabled': emailConfig.enabled ?? true,
            'emailSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update email settings: ${error.message}`);
    }
  }

  /**
   * Get email settings
   */
  static async getEmailSettings(adminId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      return settings?.emailSettings || {};
    } catch (error) {
      throw new Error(`Failed to get email settings: ${error.message}`);
    }
  }

  /**
   * Test email configuration
   */
  static async testEmailConfig(adminId, recipientEmail) {
    try {
      const settings = await this.getEmailSettings(adminId);

      if (!settings || !settings.provider) {
        throw new Error('Email settings not configured');
      }

      let transporter;

      switch (settings.provider) {
        case 'smtp':
          transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpPort === 465,
            auth: {
              user: settings.smtpUsername,
              pass: settings.smtpPassword
            }
          });
          break;

        case 'sendgrid':
          transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
              user: 'apikey',
              pass: settings.sendgridApiKey
            }
          });
          break;

        case 'aws-ses':
          // Requires AWS SDK setup
          throw new Error('AWS SES test requires additional configuration');

        default:
          throw new Error(`Unknown email provider: ${settings.provider}`);
      }

      // Send test email
      const result = await transporter.sendMail({
        from: settings.fromEmail,
        to: recipientEmail,
        subject: 'Wondertravelers Email Settings Test',
        html: `
          <h2>Email Configuration Test</h2>
          <p>If you receive this email, your ${settings.provider} configuration is working correctly.</p>
          <p><strong>From:</strong> ${settings.fromEmail}</p>
          <p><strong>Provider:</strong> ${settings.provider}</p>
          <p><em>Sent at ${new Date().toISOString()}</em></p>
        `
      });

      return {
        success: true,
        messageId: result.messageId,
        provider: settings.provider,
        recipientEmail
      };
    } catch (error) {
      throw new Error(`Email test failed: ${error.message}`);
    }
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(adminId, notificationConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'notificationSettings.channels': notificationConfig.channels,
            'notificationSettings.emailProvider': notificationConfig.emailProvider,
            'notificationSettings.smsProvider': notificationConfig.smsProvider,
            'notificationSettings.whatsappProvider': notificationConfig.whatsappProvider,
            'notificationSettings.inAppEnabled': notificationConfig.inAppEnabled,
            'notificationSettings.templates': notificationConfig.templates,
            'notificationSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update notification settings: ${error.message}`);
    }
  }

  /**
   * Update database settings
   */
  static async updateDatabaseSettings(adminId, dbConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'databaseSettings.poolSize': dbConfig.poolSize,
            'databaseSettings.connectionTimeout': dbConfig.connectionTimeout,
            'databaseSettings.idleTimeout': dbConfig.idleTimeout,
            'databaseSettings.maxQueryTime': dbConfig.maxQueryTime,
            'databaseSettings.backupFrequency': dbConfig.backupFrequency,
            'databaseSettings.backupRetention': dbConfig.backupRetention,
            'databaseSettings.slowQueryThreshold': dbConfig.slowQueryThreshold,
            'databaseSettings.enableQueryLogging': dbConfig.enableQueryLogging,
            'databaseSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update database settings: ${error.message}`);
    }
  }

  /**
   * Update API settings (rate limiting, keys, CORS)
   */
  static async updateApiSettings(adminId, apiConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'apiSettings.rateLimitPerMinute': apiConfig.rateLimitPerMinute,
            'apiSettings.rateLimitPerHour': apiConfig.rateLimitPerHour,
            'apiSettings.corsOrigins': apiConfig.corsOrigins,
            'apiSettings.corsCredentials': apiConfig.corsCredentials,
            'apiSettings.apiKeys': apiConfig.apiKeys,
            'apiSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update API settings: ${error.message}`);
    }
  }

  /**
   * Generate new API key
   */
  static async generateApiKey(adminId) {
    try {
      const apiKey = `sk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const hashedKey = require('crypto').createHash('sha256').update(apiKey).digest('hex');

      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $push: {
            'apiSettings.apiKeys': {
              key: hashedKey,
              label: `API Key ${new Date().toLocaleDateString()}`,
              createdAt: new Date(),
              lastUsed: null,
              active: true
            }
          }
        },
        { new: true }
      );

      return {
        apiKey, // Return plain key once
        hashedKey,
        createdAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to generate API key: ${error.message}`);
    }
  }

  /**
   * Revoke API key
   */
  static async revokeApiKey(adminId, hashedKey) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'apiSettings.apiKeys.$[elem].active': false,
            'apiSettings.apiKeys.$[elem].revokedAt': new Date()
          }
        },
        {
          new: true,
          arrayFilters: [{ 'elem.key': hashedKey }]
        }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
  }

  /**
   * Update cron settings
   */
  static async updateCronSettings(adminId, cronConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'cronSettings.jobs': cronConfig.jobs,
            'cronSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update cron settings: ${error.message}`);
    }
  }

  /**
   * Create or update cron job
   */
  static async createOrUpdateCronJob(adminId, jobId, jobData) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      const existingJobIndex = settings.cronSettings.jobs.findIndex(
        j => j._id.toString() === jobId
      );

      if (existingJobIndex >= 0) {
        settings.cronSettings.jobs[existingJobIndex] = {
          ...settings.cronSettings.jobs[existingJobIndex],
          ...jobData,
          updatedAt: new Date()
        };
      } else {
        settings.cronSettings.jobs.push({
          _id: new mongoose.Types.ObjectId(),
          ...jobData,
          createdAt: new Date()
        });
      }

      await settings.save();
      return settings;
    } catch (error) {
      throw new Error(`Failed to create/update cron job: ${error.message}`);
    }
  }

  /**
   * Delete cron job
   */
  static async deleteCronJob(adminId, jobId) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $pull: {
            'cronSettings.jobs': { _id: jobId }
          }
        },
        { new: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to delete cron job: ${error.message}`);
    }
  }

  /**
   * Toggle cron job status
   */
  static async toggleCronJobStatus(adminId, jobId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      const job = settings.cronSettings.jobs.find(j => j._id.toString() === jobId);
      if (!job) {
        throw new Error('Cron job not found');
      }

      job.paused = !job.paused;
      job.lastToggled = new Date();

      await settings.save();
      return settings;
    } catch (error) {
      throw new Error(`Failed to toggle cron job: ${error.message}`);
    }
  }

  /**
   * Update maintenance settings
   */
  static async updateMaintenanceSettings(adminId, maintenanceConfig) {
    try {
      const settings = await AdminSettings.findOneAndUpdate(
        { adminId },
        {
          $set: {
            'maintenanceSettings.enabled': maintenanceConfig.enabled,
            'maintenanceSettings.mode': maintenanceConfig.mode,
            'maintenanceSettings.title': maintenanceConfig.title,
            'maintenanceSettings.message': maintenanceConfig.message,
            'maintenanceSettings.allowAdminAccess': maintenanceConfig.allowAdminAccess,
            'maintenanceSettings.countdownEnabled': maintenanceConfig.countdownEnabled,
            'maintenanceSettings.scheduledStart': maintenanceConfig.scheduledStart,
            'maintenanceSettings.scheduledEnd': maintenanceConfig.scheduledEnd,
            'maintenanceSettings.updatedAt': new Date()
          }
        },
        { new: true, upsert: true }
      );
      return settings;
    } catch (error) {
      throw new Error(`Failed to update maintenance settings: ${error.message}`);
    }
  }

  /**
   * Get all settings for dashboard
   */
  static async getAllSettings(adminId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        return await this.getOrCreateSettings(adminId);
      }
      return settings;
    } catch (error) {
      throw new Error(`Failed to get all settings: ${error.message}`);
    }
  }

  /**
   * Get payment method settings
   */
  static async getPaymentMethods(adminId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      return settings?.paymentMethods || {};
    } catch (error) {
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }

  /**
   * Get enabled payment methods
   */
  static async getEnabledPaymentMethods(adminId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      return settings?.getEnabledPaymentMethods?.() || [];
    } catch (error) {
      throw new Error(`Failed to get enabled payment methods: ${error.message}`);
    }
  }

  /**
   * Toggle payment method on/off
   */
  static async togglePaymentMethod(adminId, methodName) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      const result = await settings.togglePaymentMethod(methodName);
      return result;
    } catch (error) {
      throw new Error(`Failed to toggle payment method: ${error.message}`);
    }
  }

  /**
   * Update payment method configuration
   */
  static async updatePaymentMethod(adminId, methodName, updates) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      const result = await settings.updatePaymentMethod(methodName, updates);
      return result;
    } catch (error) {
      throw new Error(`Failed to update payment method: ${error.message}`);
    }
  }

  /**
   * Update order notification settings
   */
  static async updateOrderNotifications(adminId, notifications) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      if (!settings) {
        throw new Error('Admin settings not found');
      }

      const result = await settings.updateOrderNotifications(notifications);
      return result;
    } catch (error) {
      throw new Error(`Failed to update order notifications: ${error.message}`);
    }
  }

  /**
   * Get order notification settings
   */
  static async getOrderNotifications(adminId) {
    try {
      const settings = await AdminSettings.findOne({ adminId });
      return settings?.orderNotifications || {};
    } catch (error) {
      throw new Error(`Failed to get order notifications: ${error.message}`);
    }
  }
}

export default AdminSettingsService;
