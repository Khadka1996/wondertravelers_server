// src/features/verification/whatsapp.controller.js
import { AdminSettings } from '../admin/admin-settings.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';
import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ======================== Get WhatsApp Settings ========================
export const getWhatsAppSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can manage WhatsApp settings'
      });
    }

    // Get admin settings
    let settings = await AdminSettings.findOne({ adminId: userId });
    
    if (!settings) {
      settings = await AdminSettings.create({
        adminId: userId,
        whatsappNumber: null,
        whatsappBusinessId: null
      });
    }

    res.status(200).json({
      success: true,
      data: {
        whatsappNumber: settings.whatsappNumber || null,
        whatsappBusinessId: settings.whatsappBusinessId || null,
        configured: !!settings.whatsappNumber,
        lastUpdated: settings.updatedAt
      }
    });
  } catch (error) {
    logger.error('Get WhatsApp Settings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching WhatsApp settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Set WhatsApp Number ========================
export const setWhatsAppNumber = async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    const userId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can manage WhatsApp settings'
      });
    }

    // Validate phone number
    if (!whatsappNumber || !/^\+?[1-9]\d{1,14}$/.test(whatsappNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use E.164 format (+country code...)'
      });
    }

    // Verify number with Twilio if needed
    try {
      // Optional: Verify the number exists in Twilio
      const lookupResult = await twilioClient.lookups.v1
        .phoneNumbers(whatsappNumber)
        .fetch({ countryCode: 'US' });

      if (!lookupResult) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number'
        });
      }
    } catch (twilioError) {
      logger.warn('Twilio lookup warning (non-critical):', twilioError.message);
      // Continue even if lookup fails - number might still be valid
    }

    // Get or create admin settings
    let settings = await AdminSettings.findOne({ adminId: userId });
    
    if (!settings) {
      settings = await AdminSettings.create({
        adminId: userId,
        whatsappNumber,
        whatsappBusinessId: null
      });
    } else {
      settings.whatsappNumber = whatsappNumber;
      settings.updatedAt = new Date();
      await settings.save();
    }

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'WHATSAPP_NUMBER_SET',
      resource: 'whatsapp_management',
      details: {
        whatsappNumber: whatsappNumber.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*'),
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp number set successfully',
      data: {
        whatsappNumber,
        configured: true,
        instructions: [
          'Share this WhatsApp number with your customers',
          'Frontend will redirect users to WhatsApp chat with this number',
          'Ensure the number is an active WhatsApp Business account'
        ]
      }
    });
  } catch (error) {
    logger.error('Set WhatsApp Number Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting WhatsApp number',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Update WhatsApp Number ========================
export const updateWhatsAppNumber = async (req, res) => {
  try {
    const { whatsappNumber } = req.body;
    const userId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can manage WhatsApp settings'
      });
    }

    // Validate phone number
    if (!whatsappNumber || !/^\+?[1-9]\d{1,14}$/.test(whatsappNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use E.164 format (+country code...)'
      });
    }

    // Get admin settings
    const settings = await AdminSettings.findOne({ adminId: userId });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Admin settings not found'
      });
    }

    const oldNumber = settings.whatsappNumber;
    
    // Update number
    settings.whatsappNumber = whatsappNumber;
    settings.updatedAt = new Date();
    await settings.save();

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'WHATSAPP_NUMBER_UPDATED',
      resource: 'whatsapp_management',
      details: {
        oldNumber: oldNumber ? oldNumber.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*') : 'None',
        newNumber: whatsappNumber.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*'),
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp number updated successfully',
      data: {
        whatsappNumber,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    logger.error('Update WhatsApp Number Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating WhatsApp number',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get WhatsApp Number (For Frontend) ========================
export const getWhatsAppNumberPublic = async (req, res) => {
  try {
    // This endpoint is public - doesn't require authentication
    // Used by frontend to get the WhatsApp number for redirect

    // Get first admin's WhatsApp settings
    const settings = await AdminSettings.findOne({ 
      whatsappNumber: { $exists: true, $ne: null } 
    }).select('whatsappNumber');

    if (!settings || !settings.whatsappNumber) {
      return res.status(404).json({
        success: false,
        message: 'WhatsApp support not available'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        whatsappNumber: settings.whatsappNumber,
        whatsappUrl: `https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=Hello%20Wondertravelers`,
        message: 'Contact us on WhatsApp'
      }
    });
  } catch (error) {
    logger.error('Get WhatsApp Number Public Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching WhatsApp settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Test WhatsApp Message ========================
export const testWhatsAppMessage = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can test WhatsApp'
      });
    }

    // Get admin settings
    const settings = await AdminSettings.findOne({ adminId: userId });
    if (!settings || !settings.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp number not configured'
      });
    }

    // Send test message via Twilio WhatsApp
    try {
      const message = await twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${settings.whatsappNumber}`,
        body: 'Test message from Wondertravelers. If you received this, WhatsApp integration is working!'
      });

      // Log action
      await SecurityAudit.create({
        userId,
        action: 'WHATSAPP_TEST_SENT',
        resource: 'whatsapp_management',
        details: {
          messageSid: message.sid,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'success'
      });

      res.status(200).json({
        success: true,
        message: 'Test message sent successfully',
        data: {
          messageSid: message.sid,
          status: message.status
        }
      });
    } catch (twilioError) {
      logger.error('Twilio WhatsApp Error:', twilioError);
      
      // Log failed attempt
      await SecurityAudit.create({
        userId,
        action: 'WHATSAPP_TEST_FAILED',
        resource: 'whatsapp_management',
        details: {
          error: twilioError.message,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(503).json({
        success: false,
        message: 'Failed to send test message',
        error: twilioError.message
      });
    }
  } catch (error) {
    logger.error('Test WhatsApp Message Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing WhatsApp',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Clear WhatsApp Settings ========================
export const clearWhatsAppSettings = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can manage WhatsApp settings'
      });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Verify password
    const { User } = await import('../auth/auth.model.js');
    const user = await User.findById(userId).select('+password');
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Clear WhatsApp settings
    const settings = await AdminSettings.findOne({ adminId: userId });
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Admin settings not found'
      });
    }

    settings.whatsappNumber = null;
    settings.whatsappBusinessId = null;
    settings.updatedAt = new Date();
    await settings.save();

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'WHATSAPP_SETTINGS_CLEARED',
      resource: 'whatsapp_management',
      details: {
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp settings cleared successfully'
    });
  } catch (error) {
    logger.error('Clear WhatsApp Settings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing WhatsApp settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
