// src/features/admin/admin-settings.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const AdminSettingsSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // WhatsApp Management
    whatsappNumber: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'],
      default: null,
      sparse: true,
      index: true
    },
    whatsappBusinessId: {
      type: String,
      default: null
    },
    whatsappIntegrationStatus: {
      type: String,
      enum: ['disconnected', 'connected', 'pending'],
      default: 'disconnected'
    },

    // 2FA Settings (Optional)
    twoFactorRequired: {
      type: Boolean,
      default: false
    },
    twoFactorMethod: {
      type: String,
      enum: ['authenticator', 'sms'],
      default: 'authenticator'
    },

    // Login Security Defaults
    loginSecurityDefaults: {
      enableAlerts: { type: Boolean, default: true },
      alertChannels: { type: [String], enum: ['email', 'sms'], default: ['email'] },
      maxLoginAttempts: { type: Number, default: 5 },
      lockoutDuration: { type: Number, default: 30 } // minutes
    },

    // Verification Requirements
    verificationRequirements: {
      phoneRequired: { type: Boolean, default: true },
      addressRequired: { type: Boolean, default: true },
      twoFactorRequired: { type: Boolean, default: false }
    },

    // Email Notification Settings
    emailNotifications: {
      enabled: { type: Boolean, default: true },
      sendLoginAlerts: { type: Boolean, default: true },
      sendSecurityAlerts: { type: Boolean, default: true },
      sendAnomalousActivityAlerts: { type: Boolean, default: true }
    },

    // Payment Method Settings
    paymentMethods: {
      cod: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Cash on Delivery' },
        description: { type: String, default: 'Pay when order arrives' },
        requiresAdminConfirmation: { type: Boolean, default: true }
      },
      bank_transfer: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Bank Transfer' },
        description: { type: String, default: 'Direct bank transfer' },
        requiresAdminConfirmation: { type: Boolean, default: true },
        bankDetails: {
          accountName: { type: String, default: '' },
          accountNumber: { type: String, default: '' },
          bankName: { type: String, default: '' },
          swiftCode: { type: String, default: '' }
        }
      },
      card: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Debit/Credit Card' },
        description: { type: String, default: 'Pay with card' },
        requiresAdminConfirmation: { type: Boolean, default: true }
      },
      esewa: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'eSewa' },
        description: { type: String, default: 'Online payment (Nepal)' },
        requiresAdminConfirmation: { type: Boolean, default: false },
        merchantCode: { type: String, default: '' },
        secretKey: { type: String, default: '' },
        isProduction: { type: Boolean, default: false }
      },
      khalti: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Khalti' },
        description: { type: String, default: 'Online payment (Nepal)' },
        requiresAdminConfirmation: { type: Boolean, default: false },
        publicKey: { type: String, default: '' },
        secretKey: { type: String, default: '' },
        isProduction: { type: Boolean, default: false }
      }
    },

    // Order Notification Settings
    orderNotifications: {
      notifyOnNewOrder: { type: Boolean, default: true },
      notifyOnPaymentConfirmed: { type: Boolean, default: true },
      notifyOnOrderShipped: { type: Boolean, default: true },
      notifyOnOrderDelivered: { type: Boolean, default: true },
      notifyOnCancellation: { type: Boolean, default: true },
      notifyOnRefund: { type: Boolean, default: true },
      notificationChannels: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false }
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// ======================== Indexes ========================
// NOTE: adminId and whatsappNumber already have index: true in field definitions
AdminSettingsSchema.index({ whatsappIntegrationStatus: 1 });

// ======================== Methods ========================
AdminSettingsSchema.methods.updateWhatsAppSettings = async function (updates) {
  if (updates.whatsappNumber) {
    this.whatsappNumber = updates.whatsappNumber;
  }
  if (updates.whatsappBusinessId) {
    this.whatsappBusinessId = updates.whatsappBusinessId;
  }
  if (updates.whatsappIntegrationStatus) {
    this.whatsappIntegrationStatus = updates.whatsappIntegrationStatus;
  }
  
  this.updatedAt = new Date();
  await this.save();
  return this;
};

AdminSettingsSchema.methods.updateVerificationRequirements = async function (requirements) {
  if (requirements.phoneRequired !== undefined) {
    this.verificationRequirements.phoneRequired = requirements.phoneRequired;
  }
  if (requirements.addressRequired !== undefined) {
    this.verificationRequirements.addressRequired = requirements.addressRequired;
  }
  if (requirements.twoFactorRequired !== undefined) {
    this.verificationRequirements.twoFactorRequired = requirements.twoFactorRequired;
  }
  
  this.updatedAt = new Date();
  await this.save();
  return this;
};

AdminSettingsSchema.methods.updateLoginSecurityDefaults = async function (defaults) {
  Object.assign(this.loginSecurityDefaults, defaults);
  this.updatedAt = new Date();
  await this.save();
  return this;
};

AdminSettingsSchema.methods.togglePaymentMethod = async function (methodName) {
  if (!this.paymentMethods[methodName]) {
    throw new Error(`Payment method ${methodName} not found`);
  }
  
  this.paymentMethods[methodName].enabled = !this.paymentMethods[methodName].enabled;
  this.updatedAt = new Date();
  await this.save();
  return this.paymentMethods[methodName];
};

AdminSettingsSchema.methods.updatePaymentMethod = async function (methodName, updates) {
  if (!this.paymentMethods[methodName]) {
    throw new Error(`Payment method ${methodName} not found`);
  }
  
  Object.assign(this.paymentMethods[methodName], updates);
  this.updatedAt = new Date();
  await this.save();
  return this.paymentMethods[methodName];
};

AdminSettingsSchema.methods.getEnabledPaymentMethods = function () {
  return Object.keys(this.paymentMethods).filter(
    method => this.paymentMethods[method].enabled
  ).map(method => ({
    id: method,
    ...this.paymentMethods[method].toObject ? this.paymentMethods[method].toObject() : this.paymentMethods[method]
  }));
};

AdminSettingsSchema.methods.updateOrderNotifications = async function (notifications) {
  Object.assign(this.orderNotifications, notifications);
  this.updatedAt = new Date();
  await this.save();
  return this.orderNotifications;
};

// ======================== Export ========================
export const AdminSettings = mongoose.model('AdminSettings', AdminSettingsSchema);
