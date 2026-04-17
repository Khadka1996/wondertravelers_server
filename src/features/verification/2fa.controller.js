// src/features/verification/2fa.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { logger } from '../../utils/logger.util.js';

// Generate backup codes
const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();
    codes.push(code);
  }
  return codes;
};

// ======================== Enable 2FA - Generate Secret ========================
export const generateSecret = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId).select('+twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled. Disable it first to generate a new secret.'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Wondertravelers (${user.email})`,
      issuer: 'Wondertravelers',
      length: 32
    });

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Store temp secret (expires in 15 minutes)
    await user.setTempSecret(secret.base32);
    user.twoFactorAuth.backupCodes = backupCodes;
    await user.save();

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Log 2FA secret to console in development mode
    if (process.env.NODE_ENV === 'development' && process.env.DEV_LOG_2FA_TO_CONSOLE === 'true') {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║  🔐 2FA Secret (Development Mode)      ║');
      console.log('╠════════════════════════════════════════╣');
      console.log(`║ Email: ${user.email.padEnd(31)}║`);
      console.log(`║ Secret: ${secret.base32.padEnd(30)}║`);
      console.log('╠════════════════════════════════════════╣');
      console.log('║ Backup Codes:                          ║');
      backupCodes.forEach((code, idx) => {
        console.log(`║   ${idx + 1}. ${code.padEnd(33)}║`);
      });
      console.log('╠════════════════════════════════════════╣');
      console.log('║ OTP Auth URL:                          ║');
      console.log(`║ ${secret.otpauth_url.substring(0, 36)}... ║`);
      console.log('╚════════════════════════════════════════╝\n');
    }

    // Log action
    await SecurityAudit.create({
      userId,
      action: '2FA_SECRET_GENERATED',
      resource: '2fa_management',
      details: {
        method: 'authenticator',
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: '2FA secret generated. Scan QR code or enter the secret manually.',
      data: {
        secret: secret.base32,
        qrCode,
        backupCodes,
        expiresIn: '15 minutes',
        instructions: [
          'Scan QR code with Authenticator app (Google Authenticator, Authy, etc)',
          'Or enter the secret manually',
          'Save the backup codes in a safe place',
          'Enter a 6-digit code to verify'
        ]
      }
    });
  } catch (error) {
    logger.error('Generate Secret Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating 2FA secret',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Verify and Enable 2FA ========================
export const verifyAndEnable2FA = async (req, res) => {
  try {
    const { code, password } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code format. Must be 6 digits.'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to enable 2FA'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+password +twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log failed attempt
      await SecurityAudit.create({
        userId,
        action: '2FA_ENABLE_FAILED',
        resource: '2fa_management',
        details: {
          reason: 'Invalid password',
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Get temp secret
    const tempSecret = user.getTempSecret();
    if (!tempSecret) {
      return res.status(400).json({
        success: false,
        message: 'Secret expired. Generate a new one.'
      });
    }

    // Verify code
    const isCodeValid = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isCodeValid) {
      // Log failed verification
      await SecurityAudit.create({
        userId,
        action: '2FA_VERIFICATION_FAILED',
        resource: '2fa_management',
        details: {
          reason: 'Invalid code',
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Enable 2FA
    await user.enable2FA(tempSecret, user.twoFactorAuth.backupCodes);

    // Log successful enable
    await SecurityAudit.create({
      userId,
      action: '2FA_ENABLED',
      resource: '2fa_management',
      details: {
        method: 'authenticator',
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: '2FA enabled successfully',
      data: {
        enabled: true,
        method: 'authenticator',
        backupCodes: user.twoFactorAuth.backupCodes,
        warning: 'Save your backup codes in a secure location'
      }
    });
  } catch (error) {
    logger.error('Verify and Enable 2FA Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling 2FA',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Disable 2FA ========================
export const disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable 2FA'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+password +twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if 2FA is enabled
    if (!user.is2FAEnabled()) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log failed attempt
      await SecurityAudit.create({
        userId,
        action: '2FA_DISABLE_FAILED',
        resource: '2fa_management',
        details: {
          reason: 'Invalid password',
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Disable 2FA
    await user.disable2FA();

    // Log action
    await SecurityAudit.create({
      userId,
      action: '2FA_DISABLED',
      resource: '2fa_management',
      details: {
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('Disable 2FA Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling 2FA',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get 2FA Status ========================
export const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('+twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: user.twoFactorAuth.enabled || false,
        method: user.twoFactorAuth.method || 'authenticator',
        enabledAt: user.twoFactorAuth.enabledAt || null,
        backupCodesCount: (user.twoFactorAuth.backupCodes || []).length
      }
    });
  } catch (error) {
    logger.error('Get 2FA Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching 2FA status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Verify 2FA Code (for login) ========================
export const verify2FACode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    // Validate code
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if 2FA is enabled
    if (!user.is2FAEnabled()) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Check if code is a backup code
    if (/^\w{8}$/.test(code)) {
      const isBackupCodeValid = await user.useBackupCode(code);
      if (isBackupCodeValid) {
        return res.status(200).json({
          success: true,
          message: 'Backup code verified successfully',
          data: { type: 'backup' }
        });
      }
    }

    // Verify TOTP code
    const isCodeValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code or backup code'
      });
    }

    res.status(200).json({
      success: true,
      message: '2FA code verified successfully',
      data: { type: 'authenticator' }
    });
  } catch (error) {
    logger.error('Verify 2FA Code Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying 2FA code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get Backup Codes ========================
export const getBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to view backup codes'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+password +twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        backupCodes: user.twoFactorAuth.backupCodes || [],
        message: 'Keep these codes safe. Each code can only be used once.'
      }
    });
  } catch (error) {
    logger.error('Get Backup Codes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching backup codes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Regenerate Backup Codes ========================
export const regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    // Validate password
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to regenerate backup codes'
      });
    }

    // Find user
    const user = await User.findById(userId).select('+password +twoFactorAuth');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if 2FA is enabled
    if (!user.is2FAEnabled()) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    user.twoFactorAuth.backupCodes = backupCodes;
    await user.save();

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'BACKUP_CODES_REGENERATED',
      resource: '2fa_management',
      details: {
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes,
        warning: 'Old backup codes are no longer valid'
      }
    });
  } catch (error) {
    logger.error('Regenerate Backup Codes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error regenerating backup codes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
