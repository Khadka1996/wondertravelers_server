// src/features/featured-image/featured-image.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const featuredImageSchema = new Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      default: 0,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Indexes for performance
featuredImageSchema.index({ isActive: 1, order: 1 });
featuredImageSchema.index({ createdAt: -1 });

// Get active featured images sorted by order
featuredImageSchema.statics.getActiveFeaturedImages = async function(limit = 4) {
  return this.find({ isActive: true })
    .select('imageUrl order')
    .sort({ order: 1, createdAt: -1 })
    .limit(limit)
    .lean();
};

// Get all featured images (for admin)
featuredImageSchema.statics.getAllFeaturedImagesAdmin = async function() {
  return this.find()
    .select('imageUrl order isActive createdAt createdBy')
    .populate('createdBy', 'username fullName email')
    .sort({ order: 1 })
    .lean();
};

const FeaturedImage = mongoose.model('FeaturedImage', featuredImageSchema);

export default FeaturedImage;
