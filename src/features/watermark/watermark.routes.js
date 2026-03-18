// src/features/watermark/watermark.routes.js
import express from 'express';
import * as watermarkController from './watermark.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { uploadWatermarkImage } from '../../middleware/upload.middleware.js';

const router = express.Router();

// All watermark routes require authentication and admin role
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('admin'));

// Image upload endpoint
router.post('/upload-image', uploadWatermarkImage, watermarkController.uploadWatermarkImage);

// CRUD operations
router.post('/', watermarkController.createWatermark);
router.get('/', watermarkController.getWatermarks);
router.get('/:id', watermarkController.getWatermarkById);
router.put('/:id', watermarkController.updateWatermark);
router.delete('/:id', watermarkController.deleteWatermark);

// Toggle active status
router.patch('/:id/toggle', watermarkController.toggleWatermarkStatus);

export default router;
