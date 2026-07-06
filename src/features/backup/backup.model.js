// src/features/backup/backup.model.js
import mongoose from 'mongoose';

const backupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['automatic', 'manual', 'files', 'mongodump'],
      default: 'manual',
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'success', 'failed', 'corrupted'],
      default: 'pending',
    },
    // File information
    size: {
      original: Number, // Original size in bytes
      compressed: Number, // Compressed size in bytes
    },
    // Security
    encrypted: {
      type: Boolean,
      default: true,
    },
    compressed: {
      type: Boolean,
      default: true,
    },
    encryptionMethod: {
      type: String,
      default: 'aes-256-gcm',
    },
    compressionMethod: {
      type: String,
      default: 'gzip',
    },
    checksum: {
      type: String, // SHA-256 hash for integrity verification
    },
    // Backup content statistics
    statistics: {
      users: { type: Number, default: 0 },
      products: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      categories: { type: Number, default: 0 },
      reviews: { type: Number, default: 0 },
      auditLogs: { type: Number, default: 0 },
      sessions: { type: Number, default: 0 },
      settings: { type: Number, default: 0 },
      transactions: { type: Number, default: 0 },
      totalCollections: { type: Number, default: 0 },
      totalDocuments: { type: Number, default: 0 },
    },
    // Integrity verification
    integrity: {
      status: {
        type: String,
        enum: ['not-verified', 'verified', 'corrupted'],
        default: 'not-verified',
      },
      verifiedAt: Date,
      verificationResult: mongoose.Schema.Types.Mixed,
    },
    // Location and storage
    storagePath: {
      type: String, // Full path to backup file
      required: true,
    },
    backupLocation: {
      type: String,
      enum: ['local', 'cloud', 'external'],
      default: 'local',
    },
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Made optional to support filesystem sync backups
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BackupSchedule',
    },
    // Timing
    startedAt: Date,
    completedAt: Date,
    duration: Number, // Duration in milliseconds
    // Error tracking
    error: {
      message: String,
      code: String,
      stack: String,
    },
    // Restore information
    restoreHistory: [
      {
        restoredBy: mongoose.Schema.Types.ObjectId,
        restoredAt: Date,
        status: String,
        notes: String,
      },
    ],
    // Retention policy
    retentionDays: {
      type: Number,
      default: 90,
    },
    expiresAt: Date,
    isLocked: {
      type: Boolean,
      default: false, // Prevent deletion of critical backups
    },
    tags: [String], // Custom tags for organization
  },
  { timestamps: true }
);

// Index for better querying
backupSchema.index({ createdAt: -1 });
backupSchema.index({ status: 1, createdAt: -1 });
backupSchema.index({ type: 1, createdAt: -1 });
backupSchema.index({ expiresAt: 1 });

// Auto-set expiration date on save
backupSchema.pre('save', async function () {
  if (!this.expiresAt && this.retentionDays) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.retentionDays);
    this.expiresAt = expiryDate;
  }
});

export const Backup = mongoose.model('Backup', backupSchema);

// Backup Schedule Schema
const backupScheduleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    frequency: {
      type: String,
      enum: ['never', 'daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6, // 0 = Sunday
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
    },
    time: {
      type: String, // HH:MM format
      default: '00:00',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    compression: {
      type: Boolean,
      default: true,
    },
    encryption: {
      type: Boolean,
      default: true,
    },
    retentionDays: {
      type: Number,
      default: 90,
    },
    lastRunAt: Date,
    nextRunAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const BackupSchedule = mongoose.model('BackupSchedule', backupScheduleSchema);
