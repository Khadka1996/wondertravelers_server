import express from 'express';
import {
  getSettings,
  updateSettings,
  getContactInfo
} from './settings.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
// Get all settings (cached for 24 hours)
router.get('/', getSettings);

// Get only contact information
router.get('/contact', getContactInfo);

/**
 * ADMIN ONLY ROUTES
 */
// Update settings (admin-only)
router.put(
  '/',
  authMiddleware.protect,
  authMiddleware.restrictTo('admin', 'super-admin'),
  updateSettings
);

export default router;
