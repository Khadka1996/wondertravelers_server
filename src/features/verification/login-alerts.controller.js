// src/features/verification/login-alerts.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';
import nodemailer from 'nodemailer';

// Initialize email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// ======================== Check for Unusual Login ========================
export const isUnusualLogin = async (userId, ip, userAgent) => {
  try {
    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) return false;

    // Check if IP is in trusted locations
    const isTrustedIP = user.loginSecurity.trustedLocations?.some(loc => loc.ip === ip);
    
    // If not trusted and we have trusted locations, it's unusual
    if (!isTrustedIP && user.loginSecurity.trustedLocations?.length > 0) {
      return true;
    }

    // Check if last login was very recent (same IP, same session)
    if (user.lastLogin) {
      const timeSinceLastLogin = Date.now() - user.lastLogin;
      const fiveMinutes = 5 * 60 * 1000;
      
      // If last login was less than 5 minutes ago from same IP, not unusual
      if (timeSinceLastLogin < fiveMinutes) {
        const lastLoginIP = user.loginAttempts?.[user.loginAttempts.length - 1]?.ip;
        if (lastLoginIP === ip) {
          return false;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error('Check Unusual Login Error:', error);
    return false;
  }
};

// ======================== Send Login Alert Email ========================
export const sendLoginAlertEmail = async (user, loginDetails) => {
  try {
    const subject = 'New Login to Your Wondertravelers Account';
    const html = `
      <h2>New Login Detected</h2>
      <p>Your account was accessed with the following details:</p>
      <ul>
        <li><strong>Time:</strong> ${new Date(loginDetails.timestamp).toLocaleString()}</li>
        <li><strong>IP Address:</strong> ${loginDetails.ip}</li>
        <li><strong>Location:</strong> ${loginDetails.location?.city || 'Unknown'}, ${loginDetails.location?.country || 'Unknown'}</li>
        <li><strong>Device:</strong> ${loginDetails.device || 'Unknown Device'}</li>
      </ul>
      <p>If this wasn't you, please secure your account immediately by:</p>
      <ol>
        <li>Changing your password</li>
        <li>Enabling two-factor authentication</li>
        <li>Reviewing your login activity</li>
      </ol>
      <p>
        <a href="${process.env.FRONTEND_URL}/settings/security">View Security Settings</a>
      </p>
      <p>Stay safe!</p>
    `;

    // Log to console in development mode
    if (process.env.NODE_ENV === 'development' && process.env.DEV_LOG_SMS_TO_CONSOLE === 'true') {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║  📧 Login Alert Email (Dev Mode)       ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║ To: ${user.email.padEnd(33)}║`);
      console.log(`║ Subject: ${subject.padEnd(28)}║`);
      console.log('╠════════════════════════════════════════╣');
      console.log('║ Details:                               ║');
      console.log(`║  Time: ${new Date(loginDetails.timestamp).toLocaleString().padEnd(28)}║`);
      console.log(`║  IP: ${loginDetails.ip.padEnd(33)}║`);
      console.log(`║  Location: ${(loginDetails.location?.city || 'Unknown').padEnd(27)}║`);
      console.log(`║  Device: ${(loginDetails.device || 'Unknown').padEnd(29)}║`);
      console.log('╚════════════════════════════════════════╝\n');
    } else {
      // Send real email via SMTP
      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: user.email,
        subject,
        html
      });
    }

    return true;
  } catch (error) {
    logger.error('Send Login Alert Email Error:', error);
    return false;
  }
};

// ======================== Record Login and Send Alert ========================
export const recordLoginWithAlert = async (userId, ip, location = {}, userAgent = '') => {
  try {
    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) return false;

    // Check if unusual login
    const isUnusual = await isUnusualLogin(userId, ip, userAgent);

    // Record location
    await user.recordLoginLocation(ip, location);

    // Send alert if unusual and alerts enabled
    if (isUnusual && user.loginSecurity.enableAlerts) {
      await sendLoginAlertEmail(user, {
        timestamp: Date.now(),
        ip,
        location,
        device: userAgent
      });

      await user.recordLoginAlert();
    }

    return { recorded: true, isUnusual, alertSent: isUnusual && user.loginSecurity.enableAlerts };
  } catch (error) {
    logger.error('Record Login Error:', error);
    return { recorded: false, isUnusual: false, alertSent: false };
  }
};

// ======================== Get Login Security Settings ========================
export const getLoginSecuritySettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        enableAlerts: user.loginSecurity.enableAlerts,
        alertChannels: user.loginSecurity.alertChannels,
        trustedLocations: user.loginSecurity.trustedLocations?.map(loc => ({
          ip: loc.ip,
          country: loc.country,
          city: loc.city,
          lastSeen: loc.lastSeen,
          addedAt: loc.addedAt
        })) || [],
        lastAlertSent: user.loginSecurity.lastAlertSent || null
      }
    });
  } catch (error) {
    logger.error('Get Login Security Settings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching login security settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Update Login Alert Preferences ========================
export const updateLoginAlertPreferences = async (req, res) => {
  try {
    const { enableAlerts, alertChannels } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (typeof enableAlerts !== 'boolean' && enableAlerts !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'enableAlerts must be a boolean'
      });
    }

    if (alertChannels && !Array.isArray(alertChannels)) {
      return res.status(400).json({
        success: false,
        message: 'alertChannels must be an array'
      });
    }

    if (alertChannels) {
      const validChannels = ['email', 'sms'];
      const invalidChannels = alertChannels.filter(ch => !validChannels.includes(ch));
      if (invalidChannels.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid alert channels: ${invalidChannels.join(', ')}. Must be: email, sms`
        });
      }
    }

    // Find user
    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update preferences
    if (typeof enableAlerts === 'boolean') {
      user.loginSecurity.enableAlerts = enableAlerts;
    }
    if (alertChannels) {
      user.loginSecurity.alertChannels = alertChannels;
    }
    await user.save();

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'LOGIN_ALERT_PREFERENCES_UPDATED',
      resource: 'login_security',
      details: {
        enableAlerts: user.loginSecurity.enableAlerts,
        alertChannels: user.loginSecurity.alertChannels,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Login alert preferences updated successfully',
      data: {
        enableAlerts: user.loginSecurity.enableAlerts,
        alertChannels: user.loginSecurity.alertChannels
      }
    });
  } catch (error) {
    logger.error('Update Login Alert Preferences Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating login alert preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get Login Activity ========================
export const getLoginActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const user = await User.findById(userId).select('+loginAttempts');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent successful logins
    const recentLogins = (user.loginAttempts || [])
      .filter(attempt => attempt.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit))
      .map(attempt => ({
        timestamp: attempt.timestamp,
        ip: attempt.ip,
        success: attempt.success
      }));

    res.status(200).json({
      success: true,
      data: {
        total: user.loginAttemptsCount,
        recentLogins
      }
    });
  } catch (error) {
    logger.error('Get Login Activity Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching login activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Trust Location ========================
export const trustLocation = async (req, res) => {
  try {
    const { ip } = req.body;
    const userId = req.user._id;

    // Validate IP
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add to trusted locations if not already there
    const existing = user.loginSecurity.trustedLocations?.find(loc => loc.ip === ip);
    if (!existing) {
      user.loginSecurity.trustedLocations.push({
        ip,
        country: 'Unknown',
        city: 'Unknown',
        lastSeen: new Date(),
        addedAt: new Date()
      });
      await user.save();
    }

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'LOCATION_TRUSTED',
      resource: 'login_security',
      details: {
        ip,
        trustedAt: new Date()
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Location added to trusted list'
    });
  } catch (error) {
    logger.error('Trust Location Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error trusting location',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Remove Trusted Location ========================
export const removeTrustedLocation = async (req, res) => {
  try {
    const { ip } = req.params;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId).select('+loginSecurity');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove location
    user.loginSecurity.trustedLocations = 
      user.loginSecurity.trustedLocations?.filter(loc => loc.ip !== ip) || [];
    await user.save();

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'TRUSTED_LOCATION_REMOVED',
      resource: 'login_security',
      details: {
        ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Location removed from trusted list'
    });
  } catch (error) {
    logger.error('Remove Trusted Location Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing trusted location',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
