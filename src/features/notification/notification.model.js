import mongoose from 'mongoose';

/**
 * Notification Schema - Simplified for Travel App
 * Real-time notifications via WebSocket
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'blog_liked',           // Someone liked your blog post
        'blog_commented',       // Someone commented on your blog
        'photo_purchase',       // Someone wants to buy your photo
        'user_registered',      // New user registered (admin only)
        'admin_alert'           // General admin alerts
      ],
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    relatedId: {
      blogId: mongoose.Schema.Types.ObjectId,
      photoId: mongoose.Schema.Types.ObjectId,
      userId: mongoose.Schema.Types.ObjectId,
      commentId: mongoose.Schema.Types.ObjectId
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: Date,
    sentAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// ========================
// INDEXES
// ========================
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

// ========================
// METHODS
// ========================
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// ========================
// STATICS
// ========================
notificationSchema.statics.notifyBlogLike = async function (userId, blogData, likedBy) {
  return this.create({
    userId,
    type: 'blog_liked',
    subject: `${likedBy.name} liked your blog`,
    message: `"${blogData.title}" was liked by ${likedBy.name}`,
    relatedId: { blogId: blogData._id },
    actionBy: likedBy._id
  });
};

notificationSchema.statics.notifyBlogComment = async function (userId, blogData, commentedBy, commentText) {
  return this.create({
    userId,
    type: 'blog_commented',
    subject: `${commentedBy.name} commented on your blog`,
    message: `"${commentedBy.name}" commented: "${commentText.substring(0, 50)}..."`,
    relatedId: { blogId: blogData._id },
    actionBy: commentedBy._id
  });
};

notificationSchema.statics.notifyPhotoRequest = async function (userId, photoData, requestedBy) {
  return this.create({
    userId,
    type: 'photo_purchase',
    subject: `${requestedBy.name} wants to buy your photo`,
    message: `"${photoData.title || 'Your photo'}" - Purchase request from ${requestedBy.name}`,
    relatedId: { photoId: photoData._id, userId: requestedBy._id },
    actionBy: requestedBy._id
  });
};

notificationSchema.statics.notifyNewUser = async function (newUser) {
  // Notify admins about new registration
  const adminId = process.env.ADMIN_USER_ID || null;
  if (!adminId) return null;

  return this.create({
    userId: adminId,
    type: 'user_registered',
    subject: 'New user registered',
    message: `${newUser.name} (${newUser.email}) just registered`,
    relatedId: { userId: newUser._id },
    actionBy: newUser._id
  });
};

notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, read: false });
};

notificationSchema.statics.getUserNotifications = async function (userId, skip = 0, limit = 20) {
  const notifications = await this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('actionBy', 'name avatar')
    .lean();

  const total = await this.countDocuments({ userId });

  return { notifications, total };
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
