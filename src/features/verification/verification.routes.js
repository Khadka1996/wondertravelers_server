// src/features/verification/verification.routes.js
import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import {
  sendOTP,
  verifyOTP,
  resendOTP,
  getPhoneStatus,
  updatePhone
} from './phone.controller.js';
import {
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAllAddresses,
  getAddressById,
  verifyAddress
} from './address.controller.js';
import {
  generateSecret,
  verifyAndEnable2FA,
  disable2FA,
  get2FAStatus,
  verify2FACode,
  getBackupCodes,
  regenerateBackupCodes
} from './2fa.controller.js';
import {
  getLoginSecuritySettings,
  updateLoginAlertPreferences,
  getLoginActivity,
  trustLocation,
  removeTrustedLocation
} from './login-alerts.controller.js';
import {
  getWhatsAppSettings,
  setWhatsAppNumber,
  updateWhatsAppNumber,
  getWhatsAppNumberPublic,
  testWhatsAppMessage,
  clearWhatsAppSettings
} from './whatsapp.controller.js';
import {
  verifyPurchaseEligibility,
  checkPhoneVerified,
  checkAddressVerified,
  getVerificationStatus
} from './purchase-verification.middleware.js';

const router = express.Router();

// ======================== Phone Verification Routes ========================

/**
 * @swagger
 * /api/verification/phone/send-otp:
 *   post:
 *     summary: Send OTP to phone
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
router.post('/phone/send-otp', authMiddleware.protect, sendOTP);

/**
 * @swagger
 * /api/verification/phone/verify-otp:
 *   post:
 *     summary: Verify phone OTP
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp: { type: string }
 *     responses:
 *       200:
 *         description: Phone verified
 */
router.post('/phone/verify-otp', authMiddleware.protect, verifyOTP);

/**
 * @swagger
 * /api/verification/phone/resend-otp:
 *   post:
 *     summary: Resend OTP to phone
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post('/phone/resend-otp', authMiddleware.protect, resendOTP);

/**
 * @swagger
 * /api/verification/phone/status:
 *   get:
 *     summary: Get phone verification status
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Phone status retrieved
 */
router.get('/phone/status', authMiddleware.protect, getPhoneStatus);

/**
 * @swagger
 * /api/verification/phone/update:
 *   put:
 *     summary: Update phone number
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Phone updated
 */
router.put('/phone/update', authMiddleware.protect, updatePhone);

// ======================== Address Management Routes ========================

/**
 * @swagger
 * /api/verification/address:
 *   post:
 *     summary: Add address
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Address added
 */
router.post('/address', authMiddleware.protect, addAddress);

/**
 * @swagger
 * /api/verification/addresses:
 *   get:
 *     summary: Get all addresses
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved
 */
router.get('/addresses', authMiddleware.protect, getAllAddresses);

/**
 * @swagger
 * /api/verification/address/{addressId}:
 *   get:
 *     summary: Get address by ID
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address retrieved
 */
router.get('/address/:addressId', authMiddleware.protect, getAddressById);

/**
 * @swagger
 * /api/verification/address/{addressId}:
 *   put:
 *     summary: Update address
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Address updated
 */
router.put('/address/:addressId', authMiddleware.protect, updateAddress);

/**
 * @swagger
 * /api/verification/address/{addressId}:
 *   delete:
 *     summary: Delete address
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address deleted
 */
router.delete('/address/:addressId', authMiddleware.protect, deleteAddress);

/**
 * @swagger
 * /api/verification/address/{addressId}/set-default:
 *   post:
 *     summary: Set default address
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Default address set
 */
router.post('/address/:addressId/set-default', authMiddleware.protect, setDefaultAddress);

/**
 * @swagger
 * /api/verification/address/{addressId}/verify:
 *   post:
 *     summary: Verify address
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Address verified
 */
router.post('/address/:addressId/verify', authMiddleware.protect, verifyAddress);

// ======================== Two-Factor Authentication Routes ========================

/**
 * @swagger
 * /api/verification/2fa/generate-secret:
 *   post:
 *     summary: Generate 2FA secret
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Secret generated
 */
router.post('/2fa/generate-secret', authMiddleware.protect, generateSecret);

/**
 * @swagger
 * /api/verification/2fa/enable:
 *   post:
 *     summary: Enable 2FA
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 2FA enabled
 */
router.post('/2fa/enable', authMiddleware.protect, verifyAndEnable2FA);

/**
 * @swagger
 * /api/verification/2fa/disable:
 *   post:
 *     summary: Disable 2FA
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled
 */
router.post('/2fa/disable', authMiddleware.protect, disable2FA);

/**
 * @swagger
 * /api/verification/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status retrieved
 */
router.get('/2fa/status', authMiddleware.protect, get2FAStatus);

/**
 * @swagger
 * /api/verification/2fa/verify:
 *   post:
 *     summary: Verify 2FA code
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: 2FA code verified
 */
router.post('/2fa/verify', authMiddleware.protect, verify2FACode);

/**
 * @swagger
 * /api/verification/2fa/backup-codes:
 *   post:
 *     summary: Get backup codes
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup codes retrieved
 */
router.post('/2fa/backup-codes', authMiddleware.protect, getBackupCodes);

/**
 * @swagger
 * /api/verification/2fa/backup-codes/regenerate:
 *   post:
 *     summary: Regenerate backup codes
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup codes regenerated
 */
router.post('/2fa/backup-codes/regenerate', authMiddleware.protect, regenerateBackupCodes);

// ======================== Login Security Routes ========================

/**
 * @swagger
 * /api/verification/login-security:
 *   get:
 *     summary: Get login security settings
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved
 */
router.get('/login-security', authMiddleware.protect, getLoginSecuritySettings);

/**
 * @swagger
 * /api/verification/login-security/preferences:
 *   put:
 *     summary: Update login alert preferences
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.put('/login-security/preferences', authMiddleware.protect, updateLoginAlertPreferences);

/**
 * @swagger
 * /api/verification/login-activity:
 *   get:
 *     summary: Get login activity
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity retrieved
 */
router.get('/login-activity', authMiddleware.protect, getLoginActivity);

/**
 * @swagger
 * /api/verification/login-security/trust-location:
 *   post:
 *     summary: Trust location
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Location trusted
 */
router.post('/login-security/trust-location', authMiddleware.protect, trustLocation);

/**
 * @swagger
 * /api/verification/login-security/trusted-locations/{ip}:
 *   delete:
 *     summary: Remove trusted location
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Location removed
 */
router.delete('/login-security/trusted-locations/:ip', authMiddleware.protect, removeTrustedLocation);

// ======================== WhatsApp Management Routes ========================
// Admin routes

/**
 * @swagger
 * /api/verification/whatsapp/settings:
 *   get:
 *     summary: Get WhatsApp settings (admin)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved
 */
router.get('/whatsapp/settings', authMiddleware.protect, authMiddleware.restrictTo('admin'), getWhatsAppSettings);

/**
 * @swagger
 * /api/verification/whatsapp/number:
 *   post:
 *     summary: Set WhatsApp number (admin)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: WhatsApp number set
 */
router.post('/whatsapp/number', authMiddleware.protect, authMiddleware.restrictTo('admin'), setWhatsAppNumber);

/**
 * @swagger
 * /api/verification/whatsapp/number:
 *   put:
 *     summary: Update WhatsApp number (admin)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: WhatsApp number updated
 */
router.put('/whatsapp/number', authMiddleware.protect, authMiddleware.restrictTo('admin'), updateWhatsAppNumber);

/**
 * @swagger
 * /api/verification/whatsapp/test:
 *   post:
 *     summary: Test WhatsApp message (admin)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Message sent
 */
router.post('/whatsapp/test', authMiddleware.protect, authMiddleware.restrictTo('admin'), testWhatsAppMessage);

/**
 * @swagger
 * /api/verification/whatsapp/clear:
 *   delete:
 *     summary: Clear WhatsApp settings (admin)
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings cleared
 */
router.delete('/whatsapp/clear', authMiddleware.protect, authMiddleware.restrictTo('admin'), clearWhatsAppSettings);

// Public route for frontend to get WhatsApp number

/**
 * @swagger
 * /api/verification/whatsapp/public:
 *   get:
 *     summary: Get WhatsApp number (public)
 *     tags: [Verification]
 *     responses:
 *       200:
 *         description: WhatsApp number retrieved
 */
router.get('/whatsapp/public', getWhatsAppNumberPublic);

// ======================== Verification Status Routes ========================

/**
 * @swagger
 * /api/verification/status:
 *   get:
 *     summary: Get verification status
 *     tags: [Verification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status retrieved
 */
router.get('/status', authMiddleware.protect, getVerificationStatus);

// ======================== Purchase Verification Routes ========================
// These are used as middleware in purchase/checkout routes
router.get('/purchase-eligibility', authMiddleware.protect, verifyPurchaseEligibility, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'User is eligible for purchase',
    data: req.verificationStatus
  });
});

export default router;
