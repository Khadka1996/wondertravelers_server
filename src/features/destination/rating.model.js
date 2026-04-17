import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination',
      required: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number between 1 and 5'
      }
    },

    review: {
      type: String,
      maxlength: [500, 'Review cannot exceed 500 characters'],
      trim: true
    },

    helpful: {
      type: Number,
      default: 0,
      min: 0
    },

    unhelpful: {
      type: Number,
      default: 0,
      min: 0
    },

    // Instant ratings - no approval needed
  },
  { timestamps: true }
);

// Compound unique index - one rating per user per destination
ratingSchema.index({ destination: 1, user: 1 }, { unique: true });

// Index for finding ratings by destination
ratingSchema.index({ destination: 1, createdAt: -1 });

// pre-save hook to update destination average rating
ratingSchema.pre('save', async function () {
  if (this.isNew || this.isModified('rating')) {
    const Rating = this.constructor;
    const stats = await Rating.aggregate([
      { $match: { destination: this.destination } },
      {
        $group: {
          _id: '$destination',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      const Destination = mongoose.model('Destination');
      await Destination.findByIdAndUpdate(this.destination, {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        reviewCount: stats[0].count
      });
    }
  }
});

// post-save hook to invalidate cache
ratingSchema.post('save', async function () {
  const cache = (await import('../../utils/cache.util.js')).default;
  const Destination = mongoose.model('Destination');
  const dest = await Destination.findById(this.destination).lean();
  if (dest) {
    await cache.del(`destination:${dest.slug}`);
    await cache.del('destinations:*');
  }
});

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
