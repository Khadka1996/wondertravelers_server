import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['page_view', 'product_view', 'auction_view', 'order', 'user_signup'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: String,
    country: String,
    countryCode: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String,
    isp: String,
    path: String,
    referrer: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true, collection: 'analytics' }
);

// Index for efficient queries
analyticsSchema.index({ country: 1, timestamp: -1 });
analyticsSchema.index({ countryCode: 1, timestamp: -1 });
analyticsSchema.index({ type: 1, timestamp: -1 });
analyticsSchema.index({ timestamp: -1 });

export default mongoose.model('Analytics', analyticsSchema);
