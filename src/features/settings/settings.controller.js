import Settings from './settings.model.js';
import cache from '../../utils/cache.util.js';

// Cache key for settings
const SETTINGS_CACHE_KEY = 'app_settings';
const SETTINGS_CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Get application settings (public endpoint, cached)
 * GET /api/settings
 */
export const getSettings = async (req, res) => {
  try {
    // Try to get from cache first
    const cachedSettings = await cache.get(SETTINGS_CACHE_KEY);
    
    if (cachedSettings) {
      return res.status(200).json({
        status: 'success',
        data: cachedSettings,
        cached: true
      });
    }

    // If not in cache, fetch from database
    let settings = await Settings.findOne().lean();

    // If settings don't exist, create default ones
    if (!settings) {
      settings = await Settings.create({
        appName: 'Wonder Travelers',
        contact: {
          email: 'info@wondertravelers.com',
          whatsAppNumber: '+1234567890'
        }
      });
    }

    // Cache the settings for 24 hours
    await cache.set(SETTINGS_CACHE_KEY, settings.toObject ? settings.toObject() : settings, SETTINGS_CACHE_TTL);

    const response = {
      status: 'success',
      data: settings,
      cached: false
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

/**
 * Update application settings (admin-only)
 * PUT /api/settings
 */
export const updateSettings = async (req, res) => {
  try {
    const { appName, contact, socialLinks, businessInfo, branding } = req.body;

    // Validate required fields
    if (!contact || !contact.email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    let settings = await Settings.findOne();

    if (!settings) {
      // Create new settings if none exist
      settings = new Settings({
        appName: appName || 'Wonder Travelers',
        contact,
        socialLinks,
        businessInfo,
        branding
      });
    } else {
      // Update existing settings
      if (appName) settings.appName = appName;
      if (contact) {
        // Clean empty strings to null for optional fields
        const cleanContact = {
          email: contact.email,
          whatsAppNumber: contact.whatsAppNumber ? contact.whatsAppNumber.trim() : null,
          phone: contact.phone ? contact.phone.trim() : null,
          address: contact.address ? contact.address.trim() : null
        };
        settings.contact = { ...settings.contact, ...cleanContact };
      }
      if (socialLinks) settings.socialLinks = { ...settings.socialLinks, ...socialLinks };
      if (businessInfo) settings.businessInfo = { ...settings.businessInfo, ...businessInfo };
      if (branding) settings.branding = { ...settings.branding, ...branding };

      settings.updatedAt = new Date();
      settings.updatedBy = req.user?._id || null;
    }

    await settings.save();

    // Invalidate cache - MUST AWAIT this before responding
    await cache.del(SETTINGS_CACHE_KEY);

    // Convert to plain object for response
    const settingsObject = settings.toObject();
    
    res.status(200).json({
      status: 'success',
      message: 'Settings updated successfully',
      data: settingsObject
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

/**
 * Get only contact information (useful for download/purchase flows)
 * GET /api/settings/contact
 */
export const getContactInfo = async (req, res) => {
  try {
    let settings = await Settings.findOne().lean();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    const contact = {
      email: settings.contact?.email,
      whatsapp: settings.contact?.whatsAppNumber,
      phone: settings.contact?.phone,
      address: settings.contact?.address
    };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .json({
        success: true,
        contact
      });
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact information',
      error: error.message
    });
  }
};

/**
 * Initialize settings if they don't exist
 * Called during server startup
 */
export const initializeSettings = async () => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        appName: 'Wonder Travelers',
        contact: {
          email: process.env.ADMIN_EMAIL || 'contact@wondertravelers.com',
          whatsAppNumber: process.env.ADMIN_WHATSAPP || '+1234567890'
        },
        businessInfo: {
          description: 'Your travel companion for amazing journeys',
          timezone: 'UTC'
        }
      });

      console.log('✅ Settings initialized');
      cache.set(SETTINGS_CACHE_KEY, settings, SETTINGS_CACHE_TTL);
    } else {
      // Update cache on server start
      cache.set(SETTINGS_CACHE_KEY, settings.toObject ? settings.toObject() : settings, SETTINGS_CACHE_TTL);
      console.log('✅ Settings loaded from database');
    }
  } catch (error) {
    console.error('❌ Failed to initialize settings:', error.message);
  }
};
