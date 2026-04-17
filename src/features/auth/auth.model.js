// src/features/auth/auth.model.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    // Core identity
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username too long'],
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return by default
    },

    // Profile
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name too long'],
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name too long'],
      default: null,
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [100, 'Name too long'],
    },
    avatar: {
      type: String, // URL from /uploads
      default: null,
    },

    // Role & Status
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },

    // Session & Token Management
    refreshToken: {
      type: String,
      select: false,
    },
    refreshTokenExpires: {
      type: Date,
      select: false,
      index: { expires: '7d' }, // Auto-cleanup after 7 days
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    lastLogoutAt: {
      type: Date,
      default: null,
    },

    // Device Trust (Zero-Trust Ready)
    trustedDevices: [
      {
        fingerprint: { type: String, required: true },
        name: { type: String, default: 'Unknown Device' },
        userAgent: String,
        ip: String,
        lastUsed: { type: Date, default: Date.now },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // Password Security
    passwordHistory: [
      {
        hash: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    passwordLastChanged: {
      type: Date,
      default: Date.now,
    },

    // Password Reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false, index: { expires: '10m' } },

    // Security Tracking
    loginAttempts: [
      {
        ip: String,
        timestamp: { type: Date, default: Date.now },
        success: Boolean,
      }
    ],
    lastFailedLogin: Date,

    // Notification preferences
    notificationPreferences: {
      email: {
        loginAlerts: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true },
        promotional: { type: Boolean, default: false }
      },
      sms: {
        loginAlerts: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
      }
      ,
      // Order-specific notification preferences and channels
      order: {
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

    // Phone Verification
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number'],
      default: null,
      sparse: true,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    phoneVerificationOtp: {
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false },
      lastAttempt: { type: Date, select: false },
    },
    phoneVerificationHistory: [
      {
        phone: String,
        verifiedAt: { type: Date, default: Date.now },
        method: { type: String, enum: ['otp', 'manual'], default: 'otp' }
      }
    ],

    // Simple Address Field (for admin display)
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address too long'],
      default: null,
    },

    // Address Management (structured addresses)
    addresses: [
      {
        _id: { type: Schema.Types.ObjectId, auto: true },
        label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
        street: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        zipCode: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true, default: 'US' },
        verified: { type: Boolean, default: false },
        verifiedAt: Date,
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      }
    ],

    // Two-Factor Authentication (2FA)
    twoFactorAuth: {
      enabled: { type: Boolean, default: false, index: true },
      secret: { type: String, select: false },
      backupCodes: [{ type: String, select: false }],
      enabledAt: Date,
      method: { type: String, enum: ['authenticator', 'sms'], default: 'authenticator' },
      tempSecret: { type: String, select: false },
      tempSecretExpiresAt: { type: Date, select: false },
    },

    // Login Alerts & Unusual Activity Tracking
    loginSecurity: {
      enableAlerts: { type: Boolean, default: true },
      alertChannels: { type: [String], enum: ['email', 'sms'], default: ['email'] },
      lastAlertSent: Date,
      trustedLocations: [
        {
          ip: String,
          country: String,
          city: String,
          lastSeen: Date,
          addedAt: { type: Date, default: Date.now }
        }
      ]
    },

    // OAuth / Social Login
    oauth: {
      google: {
        id: String,
        email: String,
        name: String,
        picture: String,
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null }
      },
      facebook: {
        id: String,
        email: String,
        name: String,
        picture: String,
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null }
      },
      twitter: {
        id: String,
        email: String,
        name: String,
        picture: String,
        createdAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null }
      }
    },
    lastLoginProvider: {
      type: String,
      enum: ['email', 'google', 'facebook', 'twitter'],
      default: 'email'
    },
    signupMethod: {
      type: String,
      enum: ['email', 'google', 'facebook', 'twitter'],
      default: 'email'
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.refreshTokenExpires;
        delete ret.refreshTokenVersion;
        delete ret.sessionVersion;
        delete ret.passwordHistory;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.loginAttempts;
        delete ret.lastFailedLogin;
        delete ret.lastLogoutAt;
        delete ret.phoneVerificationOtp;
        delete ret['twoFactorAuth.secret'];
        delete ret['twoFactorAuth.backupCodes'];
        delete ret['twoFactorAuth.tempSecret'];
        delete ret['twoFactorAuth.tempSecretExpiresAt'];
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ======================== Indexes ========================
UserSchema.index({ email: 1, username: 1 });
UserSchema.index({ 'trustedDevices.fingerprint': 1 });
UserSchema.index({ role: 1, active: 1 });
UserSchema.index({ lastFailedLogin: 1 });
UserSchema.index({ 'loginAttempts.timestamp': -1 });
// NOTE: phone, phoneVerified, and twoFactorAuth.enabled already have index: true in field definitions
UserSchema.index({ 'loginSecurity.lastAlertSent': -1 });
// OAuth indexes
UserSchema.index({ 'oauth.google.id': 1, _id: 1 });
UserSchema.index({ 'oauth.facebook.id': 1, _id: 1 });
UserSchema.index({ 'oauth.twitter.id': 1, _id: 1 });

// ======================== Virtuals ========================
UserSchema.virtual('passwordAgeDays').get(function () {
  return Math.floor((Date.now() - this.passwordLastChanged) / (1000 * 60 * 60 * 24));
});

UserSchema.virtual('recentFailedAttempts').get(function () {
  if (!this.loginAttempts || this.loginAttempts.length === 0) return 0;
  
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.loginAttempts.filter(attempt => 
    !attempt.success && attempt.timestamp > fifteenMinutesAgo
  ).length;
});

UserSchema.virtual('loginAttemptsCount').get(function () {
  return this.loginAttempts?.length || 0;
});

UserSchema.virtual('failedLoginAttemptsCount').get(function () {
  if (!this.loginAttempts) return 0;
  return this.loginAttempts.filter(attempt => !attempt.success).length;
});

UserSchema.virtual('successfulLoginAttemptsCount').get(function () {
  if (!this.loginAttempts) return 0;
  return this.loginAttempts.filter(attempt => attempt.success).length;
});

// ======================== Methods ========================

// Constant-time password comparison (timing attack safe)
UserSchema.methods.comparePassword = async function (candidate) {
  if (!candidate || !this.password) return false;
  return await bcrypt.compare(candidate, this.password);
};

// Check if new password was used recently
// SECURITY FIX: Prevent password history bypass by checking enough history
UserSchema.methods.isPasswordReused = async function (candidate) {
  const HISTORY_LIMIT = 12; // Increased from 5 to 12 to prevent cycling attacks
  const recent = this.passwordHistory.slice(-HISTORY_LIMIT);

  for (const entry of recent) {
    if (await bcrypt.compare(candidate, entry.hash)) return true;
  }
  return false;
};

// Device trust
UserSchema.methods.isDeviceTrusted = function (fingerprint) {
  return this.trustedDevices.some((d) => d.fingerprint === fingerprint);
};

UserSchema.methods.addTrustedDevice = async function (fingerprint, info = {}) {
  const existing = this.trustedDevices.find((d) => d.fingerprint === fingerprint);

  if (existing) {
    existing.lastUsed = new Date();
    existing.ip = info.ip;
    existing.userAgent = info.userAgent;
  } else {
    this.trustedDevices.push({
      fingerprint,
      name: info.name || 'New Device',
      userAgent: info.userAgent || 'Unknown',
      ip: info.ip,
      lastUsed: new Date(),
    });

    // Keep only 10 most recent
    if (this.trustedDevices.length > 10) {
      this.trustedDevices.sort((a, b) => b.lastUsed - a.lastUsed);
      this.trustedDevices = this.trustedDevices.slice(0, 10);
    }
  }

  await this.save();
};

// Remove trusted device
UserSchema.methods.removeTrustedDevice = async function (fingerprint) {
  this.trustedDevices = this.trustedDevices.filter(
    device => device.fingerprint !== fingerprint
  );
  await this.save();
};

// Session invalidation - CORRECTED VERSION
UserSchema.methods.invalidateAllSessions = async function (invalidateDevices = false) {
  this.sessionVersion = (this.sessionVersion || 0) + 1;
  this.refreshToken = null;
  this.refreshTokenExpires = null;
  this.refreshTokenVersion = (this.refreshTokenVersion || 0) + 1;
  this.lastLogoutAt = new Date();
  
  if (invalidateDevices) {
    this.trustedDevices = [];
  }
  
  await this.save();
};

// Set refresh token with expiry
UserSchema.methods.setRefreshToken = async function (refreshToken, expiresInDays = 7) {
  const salt = await bcrypt.genSalt(10);
  const hashedToken = await bcrypt.hash(refreshToken, salt);
  
  // Calculate expiry
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  
  // Store
  this.refreshToken = hashedToken;
  this.refreshTokenExpires = expiresAt;
  this.refreshTokenVersion = (this.refreshTokenVersion || 0) + 1;
  
  await this.save();
};

// Verify refresh token with expiry check
UserSchema.methods.verifyRefreshToken = async function (refreshToken) {
  if (!this.refreshToken || !refreshToken) return false;
  
  // Check expiry first (fast check)
  if (this.refreshTokenExpires && this.refreshTokenExpires < new Date()) {
    return false;
  }
  
  // Verify bcrypt hash
  return await bcrypt.compare(refreshToken, this.refreshToken);
};

// Check if refresh token was revoked/expired
UserSchema.methods.isRefreshTokenRevoked = function () {
  return !this.refreshToken || 
         (this.refreshTokenExpires && this.refreshTokenExpires < new Date());
};

// Password reset token - SIMPLIFIED (bcrypt only)
UserSchema.methods.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash with bcrypt only
  const salt = await bcrypt.genSalt(10);
  this.passwordResetToken = await bcrypt.hash(resetToken, salt);
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Verify password reset token
UserSchema.methods.verifyPasswordResetToken = async function (token) {
  if (!this.passwordResetToken || !token) return false;
  
  // Check expiry
  if (!this.passwordResetExpires || this.passwordResetExpires < Date.now()) {
    return false;
  }
  
  // Verify bcrypt hash
  return await bcrypt.compare(token, this.passwordResetToken);
};

// Update last login
UserSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  await this.save();
};

// Record login attempt (monitoring + future lockout support)
UserSchema.methods.recordLoginAttempt = async function (ip, success) {
  this.loginAttempts.push({
    ip,
    timestamp: new Date(),
    success
  });
  
  if (!success) {
    this.lastFailedLogin = new Date();
  }
  
  // Auto-prune old attempts (older than 30 days) to prevent unbounded growth
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  this.loginAttempts = this.loginAttempts.filter(attempt => 
    attempt.timestamp > thirtyDaysAgo
  );
  
  // Keep only last 50 attempts (safety limit)
  if (this.loginAttempts.length > 50) {
    this.loginAttempts = this.loginAttempts.slice(-50);
  }
  
  await this.save();
};

// ======================== Phone Verification Methods ========================
UserSchema.methods.setPhoneVerificationOtp = async function (otp) {
  const salt = await bcrypt.genSalt(10);
  this.phoneVerificationOtp.code = await bcrypt.hash(otp, salt);
  this.phoneVerificationOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.phoneVerificationOtp.attempts = 0;
  this.phoneVerificationOtp.lastAttempt = new Date();
  await this.save();
};

UserSchema.methods.verifyPhoneOtp = async function (otp) {
  if (!this.phoneVerificationOtp.code || !otp) return false;
  
  // Check expiry
  if (!this.phoneVerificationOtp.expiresAt || 
      this.phoneVerificationOtp.expiresAt < new Date()) {
    return false;
  }
  
  // Check attempts (max 5 attempts)
  if (this.phoneVerificationOtp.attempts >= 5) {
    return false;
  }
  
  // Increment attempts
  this.phoneVerificationOtp.attempts += 1;
  
  // Verify OTP
  const isValid = await bcrypt.compare(otp, this.phoneVerificationOtp.code);
  
  if (isValid) {
    // Clear OTP on successful verification
    this.phoneVerified = true;
    this.phoneVerificationHistory.push({
      phone: this.phone,
      verifiedAt: new Date(),
      method: 'otp'
    });
    this.phoneVerificationOtp = {};
  }
  
  await this.save();
  return isValid;
};

UserSchema.methods.clearPhoneVerificationOtp = async function () {
  this.phoneVerificationOtp = {};
  await this.save();
};

// ======================== Address Management Methods ========================
UserSchema.methods.addAddress = async function (addressData) {
  const newAddress = {
    label: addressData.label || 'home',
    street: addressData.street,
    city: addressData.city,
    state: addressData.state,
    zipCode: addressData.zipCode,
    country: addressData.country || 'US',
    verified: false,
    isDefault: this.addresses.length === 0 // First address is default
  };
  
  this.addresses.push(newAddress);
  await this.save();
  return newAddress;
};

UserSchema.methods.updateAddress = async function (addressId, updates) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  if (updates.label) address.label = updates.label;
  if (updates.street) address.street = updates.street;
  if (updates.city) address.city = updates.city;
  if (updates.state) address.state = updates.state;
  if (updates.zipCode) address.zipCode = updates.zipCode;
  if (updates.country) address.country = updates.country;
  
  address.updatedAt = new Date();
  await this.save();
  return address;
};

UserSchema.methods.deleteAddress = async function (addressId) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  const wasDefault = address.isDefault;
  this.addresses.id(addressId).deleteOne();
  
  // If deleted address was default, make first address default
  if (wasDefault && this.addresses.length > 0) {
    this.addresses[0].isDefault = true;
  }
  
  await this.save();
};

UserSchema.methods.setDefaultAddress = async function (addressId) {
  // Remove default from all addresses
  this.addresses.forEach(addr => {
    addr.isDefault = false;
  });
  
  // Set new default
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  address.isDefault = true;
  await this.save();
  return address;
};

UserSchema.methods.verifyAddress = async function (addressId) {
  const address = this.addresses.id(addressId);
  if (!address) throw new Error('Address not found');
  
  address.verified = true;
  address.verifiedAt = new Date();
  await this.save();
  return address;
};

UserSchema.methods.getDefaultAddress = function () {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0] || null;
};

UserSchema.methods.hasVerifiedAddress = function () {
  return this.addresses.some(addr => addr.verified);
};

// ======================== Two-Factor Authentication Methods ========================
UserSchema.methods.enable2FA = async function (secret, backupCodes) {
  this.twoFactorAuth.enabled = true;
  this.twoFactorAuth.secret = secret;
  this.twoFactorAuth.backupCodes = backupCodes;
  this.twoFactorAuth.enabledAt = new Date();
  this.twoFactorAuth.tempSecret = null;
  this.twoFactorAuth.tempSecretExpiresAt = null;
  await this.save();
};

UserSchema.methods.disable2FA = async function () {
  this.twoFactorAuth.enabled = false;
  this.twoFactorAuth.secret = null;
  this.twoFactorAuth.backupCodes = [];
  this.twoFactorAuth.enabledAt = null;
  await this.save();
};

UserSchema.methods.setTempSecret = async function (secret) {
  this.twoFactorAuth.tempSecret = secret;
  this.twoFactorAuth.tempSecretExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await this.save();
};

UserSchema.methods.getTempSecret = function () {
  if (!this.twoFactorAuth.tempSecret ||
      !this.twoFactorAuth.tempSecretExpiresAt ||
      this.twoFactorAuth.tempSecretExpiresAt < new Date()) {
    return null;
  }
  return this.twoFactorAuth.tempSecret;
};

UserSchema.methods.is2FAEnabled = function () {
  return this.twoFactorAuth && this.twoFactorAuth.enabled === true;
};

UserSchema.methods.useBackupCode = async function (code) {
  const index = this.twoFactorAuth.backupCodes.indexOf(code);
  if (index === -1) return false;
  
  this.twoFactorAuth.backupCodes.splice(index, 1);
  await this.save();
  return true;
};

// ======================== Login Security Methods ========================
UserSchema.methods.recordLoginLocation = async function (ip, location = {}) {
  const existing = this.loginSecurity.trustedLocations.find(loc => loc.ip === ip);
  
  if (existing) {
    existing.lastSeen = new Date();
  } else {
    this.loginSecurity.trustedLocations.push({
      ip,
      country: location.country || 'Unknown',
      city: location.city || 'Unknown',
      lastSeen: new Date(),
      addedAt: new Date()
    });
    
    // Keep only 20 most recent locations
    if (this.loginSecurity.trustedLocations.length > 20) {
      this.loginSecurity.trustedLocations = 
        this.loginSecurity.trustedLocations.slice(-20);
    }
  }
  
  await this.save();
};

UserSchema.methods.isUnusualLocation = function (ip) {
  return !this.loginSecurity.trustedLocations.some(loc => loc.ip === ip);
};

UserSchema.methods.recordLoginAlert = async function () {
  this.loginSecurity.lastAlertSent = new Date();
  await this.save();
};

// ======================== Pre-save Middleware ========================
UserSchema.pre('save', async function () {
  // Only run if password was modified
  if (!this.isModified('password')) {
    return;
  }

  // Prevent password reuse
  if (!this.isNew && (await this.isPasswordReused(this.password))) {
    throw new Error('Cannot reuse any of your last 5 passwords');
  }

  // Hash password with configurable cost
  const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);

  // Update password history for existing users
  if (!this.isNew) {
    const oldUser = await this.constructor.findById(this._id).select('+password');
    if (oldUser && oldUser.password) {
      this.passwordHistory.push({
        hash: oldUser.password,
        changedAt: new Date(),
      });

      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory.shift();
      }
    }
  }

  this.passwordLastChanged = new Date();
});

// Password changed after token issuance check
UserSchema.methods.passwordChangedAfter = function (jwtTimestamp) {
  if (this.passwordLastChanged) {
    const changedTimestamp = parseInt(this.passwordLastChanged.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// ======================== Export ========================
export const User = mongoose.model('User', UserSchema);