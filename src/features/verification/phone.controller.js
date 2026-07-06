// src/features/verification/phone.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import twilio from 'twilio';
import crypto from 'crypto';
import { logger } from '../../utils/logger.util.js';

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+15551234567';

// ======================== Send OTP ========================
export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user._id;

    // Validate phone number
    if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use E.164 format (+country code...)'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check rate limiting (max 3 OTP requests per 5 minutes)
    if (user.phoneVerificationOtp.lastAttempt) {
      const timeSinceLastAttempt = Date.now() - user.phoneVerificationOtp.lastAttempt;
      const fiveMinutes = 5 * 60 * 1000;
      
      if (timeSinceLastAttempt < fiveMinutes) {
        const recentAttempts = user.phoneVerificationHistory.filter(h =>
          h.createdAt && h.createdAt > new Date(Date.now() - fiveMinutes)
        ).length;

        if (recentAttempts >= 3) {
          // Log suspicious activity
          await SecurityAudit.create({
            userId,
            action: 'OTP_RATE_LIMIT_EXCEEDED',
            resource: 'phone_verification',
            details: {
              phone,
              attempts: recentAttempts,
              ip: req.ip
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            status: 'failed'
          });

          return res.status(429).json({
            success: false,
            message: 'Too many OTP requests. Please try again later.'
          });
        }
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send SMS via Twilio (or log to console in development)
    try {
      if (process.env.NODE_ENV === 'development' && process.env.DEV_LOG_SMS_TO_CONSOLE === 'true') {
        // Log OTP to console in development mode
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║  📱 SMS OTP (Development Mode)         ║');
        console.log('╠════════════════════════════════════════╣');
        console.log(`║ Phone: ${phone.padEnd(37)}║`);
        console.log(`║ OTP Code: ${otp.padEnd(30)}║`);
        console.log(`║ Expires: 10 minutes                    ║`);
        console.log('╚════════════════════════════════════════╝\n');
      } else {
        // Send real SMS via Twilio
        await twilioClient.messages.create({
          body: `Your Wondertravelers phone verification code is: ${otp}. Valid for 10 minutes.`,
          from: TWILIO_PHONE_NUMBER,
          to: phone
        });
      }
    } catch (twilioError) {
      logger.error('Twilio SMS Error:', twilioError);
      
      // Log failed OTP attempt
      await SecurityAudit.create({
        userId,
        action: 'OTP_SEND_FAILED',
        resource: 'phone_verification',
        details: {
          phone,
          error: twilioError.message,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(503).json({
        success: false,
        message: 'Failed to send OTP. Please try again.'
      });
    }

    // Store OTP hash in user document
    user.phone = phone;
    await user.setPhoneVerificationOtp(otp);

    // Log OTP sent
    await SecurityAudit.create({
      userId,
      action: 'OTP_SENT',
      resource: 'phone_verification',
      details: {
        phone,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone: phone.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*'),
        expiresIn: '10 minutes'
      }
    });
  } catch (error) {
    logger.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Verify OTP ========================
export const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user._id;

    // Validate OTP
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format. Must be 6 digits.'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+phoneVerificationOtp');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP exists
    if (!user.phoneVerificationOtp.code) {
      return res.status(400).json({
        success: false,
        message: 'No pending OTP. Please request a new one.'
      });
    }

    // Verify OTP
    const isValid = await user.verifyPhoneOtp(otp);

    if (!isValid) {
      // Log failed verification attempt
      await SecurityAudit.create({
        userId,
        action: 'OTP_VERIFICATION_FAILED',
        resource: 'phone_verification',
        details: {
          phone: user.phone,
          attempts: user.phoneVerificationOtp.attempts,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
        data: {
          attemptsRemaining: Math.max(0, 5 - (user.phoneVerificationOtp.attempts || 0))
        }
      });
    }

    // Log successful verification
    await SecurityAudit.create({
      userId,
      action: 'PHONE_VERIFIED',
      resource: 'phone_verification',
      details: {
        phone: user.phone,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully',
      data: {
        phone: user.phone,
        verified: user.phoneVerified,
        verifiedAt: user.phoneVerificationHistory[user.phoneVerificationHistory.length - 1]?.verifiedAt
      }
    });
  } catch (error) {
    logger.error('Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Resend OTP ========================
export const resendOTP = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId).select('+phoneVerificationOtp');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if phone is set
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number first'
      });
    }

    // Check rate limiting (max 1 resend per minute)
    if (user.phoneVerificationOtp.lastAttempt) {
      const timeSinceLastAttempt = Date.now() - user.phoneVerificationOtp.lastAttempt;
      const oneMinute = 60 * 1000;

      if (timeSinceLastAttempt < oneMinute) {
        return res.status(429).json({
          success: false,
          message: 'Please wait before requesting another OTP',
          data: {
            waitSeconds: Math.ceil((oneMinute - timeSinceLastAttempt) / 1000)
          }
        });
      }
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send SMS
    try {
      await twilioClient.messages.create({
        body: `Your Wondertravelers phone verification code is: ${otp}. Valid for 10 minutes.`,
        from: TWILIO_PHONE_NUMBER,
        to: user.phone
      });
    } catch (twilioError) {
      logger.error('Twilio SMS Error (Resend):', twilioError);
      
      await SecurityAudit.create({
        userId,
        action: 'OTP_RESEND_FAILED',
        resource: 'phone_verification',
        details: {
          phone: user.phone,
          error: twilioError.message,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(503).json({
        success: false,
        message: 'Failed to resend OTP. Please try again.'
      });
    }

    // Store new OTP
    await user.setPhoneVerificationOtp(otp);

    // Log OTP resent
    await SecurityAudit.create({
      userId,
      action: 'OTP_RESENT',
      resource: 'phone_verification',
      details: {
        phone: user.phone,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        phone: user.phone.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*'),
        expiresIn: '10 minutes'
      }
    });
  } catch (error) {
    logger.error('Resend OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get Phone Status ========================
export const getPhoneStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('phone phoneVerified phoneVerificationHistory');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        phone: user.phone || null,
        verified: user.phoneVerified,
        verificationHistory: user.phoneVerificationHistory,
        lastVerified: user.phoneVerificationHistory[user.phoneVerificationHistory.length - 1]?.verifiedAt || null
      }
    });
  } catch (error) {
    logger.error('Get Phone Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching phone status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Update Phone Number ========================
export const updatePhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user._id;

    // Validate phone number
    if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use E.164 format (+country code...)'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update phone
    user.phone = phone;
    user.phoneVerified = false;
    user.phoneVerificationOtp = {};
    await user.save();

    // Log phone change
    await SecurityAudit.create({
      userId,
      action: 'PHONE_UPDATED',
      resource: 'phone_verification',
      details: {
        newPhone: phone,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Phone number updated. Please verify it.',
      data: {
        phone: phone.replace(/(\d)(?=(\d{4})+(?!\d))/g, '*'),
        verified: false
      }
    });
  } catch (error) {
    logger.error('Update Phone Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating phone number',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
