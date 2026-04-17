// src/features/photo/photo.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const photoSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    // Watermarked image (only version stored - for display & download, fully optimized)
    watermarkedImage: {
      url: String,
      size: Number,
      width: Number,
      height: Number
    },
    // Thumbnail for gallery preview
    thumbnail: {
      url: String,
      size: Number
    },
    // Reference to the watermark template used
    watermarkTemplate: {
      type: Schema.Types.ObjectId,
      ref: 'Watermark'
    },
    // Watermark configuration applied to this photo (snapshot of template at time of upload)
    watermark: {
      type: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
      },
      text: {
        content: { type: String, default: 'Wonder Travelers' },
        xOffset: { type: Number, default: 30 },
        yOffset: { type: Number, default: 30 },
        fontSize: { type: Number, default: 40 },
        opacity: { type: Number, default: 0.7, min: 0, max: 1 },
        color: { type: String, default: '#FFFFFF' }
      },
      imageUrl: String,
      imageXOffset: { type: Number, default: 30 },
      imageYOffset: { type: Number, default: 30 },
      opacity: { type: Number, default: 0.5, min: 0, max: 1 }
    },
    metadata: {
      location: String,
      date: Date,
      camera: String,
      lens: String,
      iso: Number,
      aperture: String,
      shutterSpeed: String
    },
    pricing: {
      price: {
        type: Number,
        required: true,
        min: 0
      },
      currency: { type: String, default: 'NPR' },
      license: { type: String, default: 'Standard' }
    },
    engagement: {
      likes: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      views: { type: Number, default: 0 }
    },
    status: {
      published: { type: Boolean, default: true },
      featured: { type: Boolean, default: false },
      archived: { type: Boolean, default: false }
    },
    seo: {
      keywords: [String],
      metaDescription: String
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Indexes
photoSchema.index({ slug: 1 });
photoSchema.index({ category: 1, 'status.published': 1 });
photoSchema.index({ createdAt: -1 });
photoSchema.index({ 'status.featured': 1, createdAt: -1 });
photoSchema.index({ title: 'text', description: 'text', category: 'text' });
photoSchema.index({ watermarkTemplate: 1 });

// Auto-generate slug from title
photoSchema.pre('save', async function() {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
});

// Get published photos with pagination
photoSchema.statics.getPublishedPhotos = async function(limit = 20, skip = 0, category = null) {
  const query = { 'status.published': true, 'status.archived': false };
  if (category) query.category = category;

  const [photos, total] = await Promise.all([
    this.find(query)
      .select('title slug category description watermarkedImage thumbnail watermarkTemplate watermark pricing engagement metadata')
      .populate('watermarkTemplate', 'name type')
      .sort({ 'status.featured': -1, createdAt: -1 })
      .limit(limit)
      .skip(skip),
    this.countDocuments(query)
  ]);

  return { photos, total };
};

// Get featured photos
photoSchema.statics.getFeaturedPhotos = async function(limit = 8) {
  return this.find({ 'status.published': true, 'status.featured': true, 'status.archived': false })
    .select('title slug category description watermarkedImage thumbnail watermarkTemplate watermark pricing engagement')
    .populate('watermarkTemplate', 'name type')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Increment likes
photoSchema.methods.incrementLikes = function() {
  this.engagement.likes = (this.engagement.likes || 0) + 1;
  return this.save();
};

// Increment downloads
photoSchema.methods.incrementDownloads = function() {
  this.engagement.downloads = (this.engagement.downloads || 0) + 1;
  return this.save();
};

// Increment views
photoSchema.methods.incrementViews = function() {
  this.engagement.views = (this.engagement.views || 0) + 1;
  return this.save();
};

const Photo = mongoose.model('Photo', photoSchema);

export default Photo;
