import mongoose from 'mongoose';

const advertisementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    image: {
      url: {
        type: String,
        required: true
      },
      size: Number,
      width: Number,
      height: Number,
      alt: String
    },
    weblink: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^https?:\/\/.+/.test(v),
        message: 'Invalid URL format'
      }
    },
    position: {
      type: String,
      enum: [
        'homepage_top',
        'homepage_banner',
        'homepage_bottom',
        'premium',
        'photo_top',
        'photo_bottom',
        'photo_sidebar',
        'video_top',
        'video_bottom',
        'video_sidebar',
        'above_videosection',
        'below_videosection',
        'destination_top',
        'destination_sidebar_1',
        'destination_sidebar_2',
        'sidebar_exploresection',
        'destination_inside',
        'explore_top',
        'explore_bottom',
        'blog_top',
        'blog_bottom',
        'blog_sidebar',
        'above_blogsection',
        'below_blogsection',
        'sidebar_blogsection',
        'blog_sidebar_1',
        'blog_sidebar_2',
        'blog_popup',
        'blog_content_paragraph_1',
        'blog_content_paragraph_2',
        'blog_content_paragraph_3',
        'blog_content_paragraph_4',
        'blog_content_paragraph_6',
        'blog_content_paragraph_8',
        'news_top',
        'news_bottom',
        'news_sidebar',
        'above_latest',
        'below_latest',
        'latest_sidebar',
        'above_photosection',
        'below_photosection',
        'above_getinsection',
        'footer'
      ],
      required: true,
      index: true
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

// ========================
// INDEXES - Optimized for speed
// ========================
advertisementSchema.index({ position: 1, isActive: 1 });

// ========================
// POST SAVE HOOK - Clear cache
// ========================
advertisementSchema.post('save', async function () {
  try {
    const cache = (await import('../../utils/cache.util.js')).default;
    await cache.delPattern('advertisements:*');
  } catch (err) {
    // Silently fail cache invalidation
  }
});

// ========================
// POST DELETE HOOK - Clear cache
// ========================
advertisementSchema.post('findByIdAndDelete', async function () {
  try {
    const cache = (await import('../../utils/cache.util.js')).default;
    await cache.delPattern('advertisements:*');
  } catch (err) {
    // Silently fail cache invalidation
  }
});

// Clear position caches when an advertisement is edited.
advertisementSchema.post('findOneAndUpdate', async function () {
  try {
    const cache = (await import('../../utils/cache.util.js')).default;
    await cache.delPattern('advertisements:*');
  } catch (err) {
    // Silently fail cache invalidation
  }
});

const Advertisement = mongoose.model('Advertisement', advertisementSchema);

export default Advertisement;
