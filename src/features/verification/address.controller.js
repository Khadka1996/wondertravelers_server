// src/features/verification/address.controller.js
import { User } from '../auth/auth.model.js';
import { SecurityAudit } from '../auth/audit.model.js';
import { logger } from '../../utils/logger.util.js';

// ======================== Add Address ========================
export const addAddress = async (req, res) => {
  try {
    const { label, street, city, state, zipCode, country } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!street || !city || !state || !zipCode) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: street, city, state, zipCode'
      });
    }

    // Validate address data
    if (label && !['home', 'work', 'other'].includes(label)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid label. Must be one of: home, work, other'
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

    // Check max addresses (limit to 5)
    if (user.addresses.length >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 addresses allowed'
      });
    }

    // Add address
    const address = await user.addAddress({
      label,
      street,
      city,
      state,
      zipCode,
      country
    });

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'ADDRESS_ADDED',
      resource: 'address_management',
      details: {
        addressId: address._id,
        label: address.label,
        city: address.city,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: {
        addressId: address._id,
        ...address.toObject ? address.toObject() : address
      }
    });
  } catch (error) {
    logger.error('Add Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Update Address ========================
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, street, city, state, zipCode, country } = req.body;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate address exists
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Validate label if provided
    if (label && !['home', 'work', 'other'].includes(label)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid label. Must be one of: home, work, other'
      });
    }

    // Update address
    const updated = await user.updateAddress(addressId, {
      label,
      street,
      city,
      state,
      zipCode,
      country
    });

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'ADDRESS_UPDATED',
      resource: 'address_management',
      details: {
        addressId,
        label: updated.label,
        city: updated.city,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: updated.toObject ? updated.toObject() : updated
    });
  } catch (error) {
    logger.error('Update Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Delete Address ========================
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate address exists
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Store info before deletion
    const deletedCity = address.city;
    const deletedLabel = address.label;

    // Delete address
    await user.deleteAddress(addressId);

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'ADDRESS_DELETED',
      resource: 'address_management',
      details: {
        addressId,
        label: deletedLabel,
        city: deletedCity,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    logger.error('Delete Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Set Default Address ========================
export const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate address exists
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Set default
    const updated = await user.setDefaultAddress(addressId);

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'DEFAULT_ADDRESS_SET',
      resource: 'address_management',
      details: {
        addressId,
        label: updated.label,
        city: updated.city,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Default address set successfully',
      data: updated.toObject ? updated.toObject() : updated
    });
  } catch (error) {
    logger.error('Set Default Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get All Addresses ========================
export const getAllAddresses = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('addresses');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        total: user.addresses.length,
        addresses: user.addresses.map(addr => ({
          ...addr.toObject ? addr.toObject() : addr,
          isDefault: addr.isDefault || false
        })),
        defaultAddress: user.getDefaultAddress()
      }
    });
  } catch (error) {
    logger.error('Get All Addresses Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching addresses',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Get Address by ID ========================
export const getAddressById = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      data: address.toObject ? address.toObject() : address
    });
  } catch (error) {
    logger.error('Get Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================== Verify Address ========================
export const verifyAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate address exists
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Mark as verified (in production, this would involve address validation service)
    const verified = await user.verifyAddress(addressId);

    // Log action
    await SecurityAudit.create({
      userId,
      action: 'ADDRESS_VERIFIED',
      resource: 'address_management',
      details: {
        addressId,
        label: verified.label,
        city: verified.city,
        ip: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'success'
    });

    res.status(200).json({
      success: true,
      message: 'Address verified successfully',
      data: verified.toObject ? verified.toObject() : verified
    });
  } catch (error) {
    logger.error('Verify Address Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying address',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
