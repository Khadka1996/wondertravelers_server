import mongoose from 'mongoose';

const destinationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Destination name is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Mountains', 'Lakes & Adventure', 'Cultural Heritage', 'Trekking', 'Wildlife & Jungle', 'Other'],
      index: true
    },

    shortDesc: {
      type: String,
      required: [true, 'Short description is required']
    },

    longDesc: {
      type: String
    },

    // Featured image for destination
    image: {
      url: {
        type: String,
        required: true
      },
      size: Number,
      width: Number,
      height: Number
    },

    // Gallery images
    gallery: [
      {
        url: String,
        caption: String,
        order: Number
      }
    ],

    // Ratings and reviews
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Destination details
    location: {
      region: String,
      coordinates: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] // [longitude, latitude]
      }
    },

    bestToVisit: {
      months: [String],
      description: String
    },

    activities: [
      {
        type: String,
        maxlength: 100
      }
    ],

    difficulty: {
      type: String,
      enum: ['Easy', 'Moderate', 'Challenging', 'Extreme'],
      default: 'Moderate'
    },

    duration: {
      min: Number, // days
      max: Number
    },

    altitude: {
      min: Number, // meters
      max: Number
    },

    // Engagement
    engagement: {
      views: {
        type: Number,
        default: 0,
        min: 0
      },
      saves: {
        type: Number,
        default: 0,
        min: 0
      }
    },

    // Status and visibility
    featured: {
      type: Boolean,
      default: false,
      index: true
    },

    published: {
      type: Boolean,
      default: false,
      index: true
    },

    // SEO
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String]
    },

    // Admin tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true, indexes: [{ location: '2dsphere' }] }
);

// Index for search and filtering
destinationSchema.index({ name: 'text', shortDesc: 'text', longDesc: 'text' });
destinationSchema.index({ category: 1, published: 1 });
destinationSchema.index({ featured: 1, published: 1 });

// To JSON transformation
destinationSchema.methods.toJSON = function () {
  const dest = this.toObject();
  return dest;
};

const Destination = mongoose.model('Destination', destinationSchema);

export default Destination;
