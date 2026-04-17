import mongoose from 'mongoose';

/**
 * Activity Log Schema - Track all server-wide activities
 */
const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    action: {
      type: String,
      enum: [
        // User actions
        'user_login',
        'user_logout',
        'user_register',
        'user_update_profile',
        'user_change_password',

        // Blog actions
        'blog_created',
        'blog_updated',
        'blog_deleted',
        'blog_liked',
        'blog_unliked',
        'blog_commented',
        'blog_comment_deleted',

        // Photo actions
        'photo_uploaded',
        'photo_deleted',
        'photo_purchase_request',

        // Destination actions
        'destination_created',
        'destination_updated',
        'destination_deleted',
        'destination_rated',

        // Video actions
        'video_uploaded',
        'video_deleted',

        // Admin actions
        'admin_login',
        'admin_created_ad',
        'admin_updated_ad',
        'admin_deleted_ad',
        'admin_moderation_action',

        // System actions
        'system_backup',
        'system_error'
      ],
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true
    },
    resourceType: {
      type: String,
      enum: ['user', 'blog', 'photo', 'destination', 'video', 'advertisement', 'system'],
      index: true
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    metadata: {
      ip: String,
      userAgent: String,
      endpoint: String,
      method: String,
      statusCode: Number,
      duration: Number,
      details: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success'
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  },
  { timestamps: true }
);

// ========================
// INDEXES - Optimized for queries
// ========================
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ resourceType: 1, resourceId: 1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

// ========================
// STATICS
// ========================
activitySchema.statics.logActivity = async function (activityData) {
  try {
    return await this.create({
      userId: activityData.userId,
      action: activityData.action,
      description: activityData.description,
      resourceType: activityData.resourceType,
      resourceId: activityData.resourceId,
      metadata: activityData.metadata,
      status: activityData.status || 'success',
      severity: activityData.severity || 'low'
    });
  } catch (error) {
    console.error('Activity log error:', error);
    // Don't throw - don't break main functionality
  }
};

activitySchema.statics.getUserActivity = async function (userId, skip = 0, limit = 50) {
  const activities = await this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await this.countDocuments({ userId });
  return { activities, total };
};

activitySchema.statics.getSystemActivity = async function (skip = 0, limit = 100, filters = {}) {
  const query = {};
  if (filters.action) query.action = filters.action;
  if (filters.resourceType) query.resourceType = filters.resourceType;
  if (filters.status) query.status = filters.status;

  const activities = await this.find(query)
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);
  return { activities, total };
};

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
