import express from 'express';
import * as advertisementController from './advertisement.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

// ========================
// PUBLIC ROUTES
// ========================
// Get ads by position
router.get('/position/:position', advertisementController.getAdsByPosition);

// Record click
router.post('/:id/click', advertisementController.recordClick);

// ========================
// ADMIN ROUTES
// ========================
// Get all ads
router.get('/', authMiddleware.protect, authMiddleware.restrictTo('admin', 'super-admin'), advertisementController.getAllAds);

// Get single ad
router.get('/:id', authMiddleware.protect, authMiddleware.restrictTo('admin', 'super-admin'), advertisementController.getAd);

// Create ad
router.post('/', authMiddleware.protect, authMiddleware.restrictTo('admin', 'super-admin'), advertisementController.createAd);

// Update ad
router.put('/:id', authMiddleware.protect, authMiddleware.restrictTo('admin', 'super-admin'), advertisementController.updateAd);

// Delete ad
router.delete('/:id', authMiddleware.protect, authMiddleware.restrictTo('admin', 'super-admin'), advertisementController.deleteAd);

export default router;
