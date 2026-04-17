// src/features/watermark/watermark.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const watermarkSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      unique: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
      required: true
    },
    // Text watermark configuration
    text: {
      content: { type: String, default: 'Wonder Travelers' },
      xOffset: { type: Number, default: 30 }, // pixels from right
      yOffset: { type: Number, default: 30 }, // pixels from bottom
      fontSize: { type: Number, default: 40, min: 10, max: 100 },
      opacity: { type: Number, default: 0.7, min: 0, max: 1 },
      color: { type: String, default: '#FFFFFF' }
    },
    // Image watermark configuration
    imageUrl: String,
    imageXOffset: { type: Number, default: 30 }, // pixels from right
    imageYOffset: { type: Number, default: 30 }, // pixels from bottom
    imageOpacity: { type: Number, default: 0.5, min: 0, max: 1 },
    // Metadata
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

// Index for search
watermarkSchema.index({ name: 'text', description: 'text' });

const Watermark = mongoose.model('Watermark', watermarkSchema);

export default Watermark;
