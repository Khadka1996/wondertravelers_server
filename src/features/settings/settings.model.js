import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    // App-wide settings (singleton)
    appName: {
      type: String,
      default: 'Wonder Travelers'
    },

    // Contact information
    contact: {
      email: {
        type: String,
        required: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      whatsAppNumber: {
        type: String,
        sparse: true,
        trim: true,
        default: null,
        match: /^(\+)?(\d{1,3})?[-.\s]?(\d{1,4})[-.\s]?(\d{1,4})[-.\s]?(\d{1,4})$/ // Accepts various formats
      },
      phone: {
        type: String,
        sparse: true,
        default: null
      },
      address: {
        type: String,
        sparse: true,
        default: null
      }
    },

    // Social media links
    socialLinks: {
      facebook: { type: String, sparse: true },
      instagram: { type: String, sparse: true },
      twitter: { type: String, sparse: true },
      youtube: { type: String, sparse: true },
      tiktok: { type: String, sparse: true }
    },

    // Business information
    businessInfo: {
      description: { type: String, sparse: true },
      tagline: { type: String, sparse: true },
      operatingHours: { type: String, sparse: true },
      timezone: { type: String, default: 'UTC' }
    },

    // Logo and branding
    branding: {
      logoUrl: { type: String, sparse: true },
      faviconUrl: { type: String, sparse: true },
      primaryColor: { type: String, default: '#1F2937' },
      secondaryColor: { type: String, default: '#8B5CF6' }
    },

    // Audit information
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    }
  },
  {
    timestamps: true,
    collection: 'settings'
  }
);

// Ensure only one settings document exists
settingsSchema.pre('save', async function () {
  try {
    if (this.isNew) {
      const existingSettings = await mongoose.model('Settings').countDocuments();
      if (existingSettings > 0) {
        throw new Error('Only one settings document can exist');
      }
    }
  } catch (error) {
    throw error;
  }
});

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
