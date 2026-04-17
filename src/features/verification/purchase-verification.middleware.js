// src/features/verification/purchase-verification.middleware.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';

// ======================== Verify Purchase Eligibility ========================
export const verifyPurchaseEligibility = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get user with verification details
    const user = await User.findById(userId)
      .select('phoneVerified addresses twoFactorAuth');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check phone verification
    if (!user.phoneVerified) {
      return res.status(403).json({
        success: false,
        message: 'Phone verification required before purchase',
        code: 'PHONE_NOT_VERIFIED',
        requiredVerifications: {
          phoneVerified: false,
          addressVerified: user.hasVerifiedAddress()
        }
      });
    }

    // Check address verification
    if (!user.hasVerifiedAddress()) {
      return res.status(403).json({
        success: false,
        message: 'Address verification required before purchase',
        code: 'ADDRESS_NOT_VERIFIED',
        requiredVerifications: {
          phoneVerified: true,
          addressVerified: false
        }
      });
    }

    // Store verification status on request for use in purchase flow
    req.verificationStatus = {
      phoneVerified: true,
      addressVerified: true,
      defaultAddress: user.getDefaultAddress(),
      phone: user.phone
    };

    // Log purchase attempt
    await SecurityAudit.create({
      userId,
      action: 'PURCHASE_VERIFIED',
      resource: 'purchase_flow',
      details: {
        phone: user.phone,
        defaultAddress: user.getDefaultAddress()?._id,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    next();
  } catch (error) {
    logger.error('Purchase Verification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying purchase eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Check Phone Verification Only ========================
export const checkPhoneVerified = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('phoneVerified phone');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.phoneVerified) {
      // Log failed check
      await SecurityAudit.create({
        userId,
        action: 'PHONE_VERIFICATION_CHECK_FAILED',
        resource: 'purchase_flow',
        details: {
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(403).json({
        success: false,
        message: 'Phone verification required',
        code: 'PHONE_NOT_VERIFIED'
      });
    }

    req.userPhone = user.phone;
    next();
  } catch (error) {
    logger.error('Check Phone Verified Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking phone verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Check Address Verification Only ========================
export const checkAddressVerified = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('addresses');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const defaultAddress = user.getDefaultAddress();
    
    if (!defaultAddress || !defaultAddress.verified) {
      // Log failed check
      await SecurityAudit.create({
        userId,
        action: 'ADDRESS_VERIFICATION_CHECK_FAILED',
        resource: 'purchase_flow',
        details: {
          hasAddress: !!defaultAddress,
          isVerified: defaultAddress?.verified || false,
          ip: req.ip
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        status: 'failed'
      });

      return res.status(403).json({
        success: false,
        message: 'Address verification required',
        code: 'ADDRESS_NOT_VERIFIED'
      });
    }

    req.userAddress = defaultAddress;
    next();
  } catch (error) {
    logger.error('Check Address Verified Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking address verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Validate Purchase Details ========================
export const validatePurchaseDetails = async (req, res, next) => {
  try {
    const { items, addressId, paymentMethod } = req.body;
    const userId = req.user._id;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid items. Must be a non-empty array.'
      });
    }

    // Validate payment method
    const validMethods = ['card', 'wallet', 'bank_transfer'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
      });
    }

    // Get user for address validation
    const user = await User.findById(userId).select('addresses');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate address if provided
    if (addressId) {
      const address = user.addresses.id(addressId);
      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Address not found'
        });
      }

      if (!address.verified) {
        return res.status(403).json({
          success: false,
          message: 'Selected address is not verified',
          code: 'ADDRESS_NOT_VERIFIED'
        });
      }

      req.purchaseAddress = address;
    } else {
      // Use default address
      const defaultAddress = user.getDefaultAddress();
      if (!defaultAddress || !defaultAddress.verified) {
        return res.status(403).json({
          success: false,
          message: 'No verified default address. Please set one.',
          code: 'NO_DEFAULT_ADDRESS'
        });
      }

      req.purchaseAddress = defaultAddress;
    }

    // Store purchase details on request
    req.purchaseDetails = {
      items,
      paymentMethod,
      addressId: req.purchaseAddress._id,
      address: req.purchaseAddress
    };

    next();
  } catch (error) {
    logger.error('Validate Purchase Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating purchase details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Log Purchase Action ========================
export const logPurchaseAction = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // This middleware logs the purchase action for audit trail
    // Call next() first, then log after response
    const originalSend = res.send;
    
    res.send = function (data) {
      // Log on success (if response will be successful)
      const statusCode = res.statusCode;
      
      if (statusCode >= 200 && statusCode < 300) {
        // Create audit log for successful purchase
        SecurityAudit.create({
          userId,
          action: 'PURCHASE_COMPLETED',
          resource: 'purchase_flow',
          details: {
            items: req.purchaseDetails?.items?.length || 0,
            paymentMethod: req.purchaseDetails?.paymentMethod,
            addressId: req.purchaseDetails?.addressId,
            ip: req.ip
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status: 'success'
        }).catch(err => logger.error('Audit log error:', err));
      } else if (statusCode >= 400) {
        // Log failed purchase attempt
        SecurityAudit.create({
          userId,
          action: 'PURCHASE_FAILED',
          resource: 'purchase_flow',
          details: {
            statusCode,
            ip: req.ip
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status: 'failed'
        }).catch(err => logger.error('Audit log error:', err));
      }

      // Call original send
      res.send = originalSend;
      return originalSend.call(this, data);
    };

    next();
  } catch (error) {
    logger.error('Log Purchase Action Error:', error);
    next();
  }
};

// ======================== Get Verification Status ========================
export const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('phoneVerified phone addresses twoFactorAuth');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const defaultAddress = user.getDefaultAddress();

    res.status(200).json({
      success: true,
      data: {
        phoneVerified: user.phoneVerified,
        phone: user.phoneVerified ? user.phone : null,
        addressVerified: defaultAddress?.verified || false,
        defaultAddress: defaultAddress ? {
          _id: defaultAddress._id,
          label: defaultAddress.label,
          city: defaultAddress.city,
          state: defaultAddress.state,
          country: defaultAddress.country,
          verified: defaultAddress.verified
        } : null,
        twoFactorEnabled: user.twoFactorAuth?.enabled || false,
        canPurchase: user.phoneVerified && (defaultAddress?.verified || false),
        missingVerifications: {
          phone: !user.phoneVerified,
          address: !defaultAddress?.verified
        }
      }
    });
  } catch (error) {
    logger.error('Get Verification Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching verification status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
