import express from 'express';
import * as photoController from './photo.controller.js';
import { authMiddleware } from '../../features/auth/auth.middleware.js';
import { uploadPhoto } from '../../middleware/upload.middleware.js';

const router = express.Router();

// Public routes
router.get('/public', photoController.getPhotos);
router.get('/featured', photoController.getFeaturedPhotos);
router.get('/categories', photoController.getPhotoCategories);
router.get('/public/:slug', photoController.getPhotoBySlug);

// Protected routes (requires login)
router.post('/public/:id/like',
  (req, res, next) => authMiddleware.protect(req, res, next),
  photoController.likePhoto
);

router.post('/public/:id/download',
  (req, res, next) => authMiddleware.protect(req, res, next),
  photoController.recordDownload
);

router.get('/:id/download-watermarked',
  (req, res, next) => authMiddleware.protect(req, res, next),
  photoController.downloadWatermarkedPhoto
);

// Admin routes - get all photos (for management)
router.get('/admin/all',
  (req, res, next) => authMiddleware.protect(req, res, next),
  (req, res, next) => authMiddleware.restrictTo('admin', 'super-admin')(req, res, next),
  photoController.getAdminPhotos
);

// Admin routes - create, update, delete
router.post('/', 
  (req, res, next) => authMiddleware.protect(req, res, next),
  (req, res, next) => authMiddleware.restrictTo('admin', 'super-admin')(req, res, next),
  uploadPhoto,
  photoController.uploadPhoto
);

router.put('/:id', 
  (req, res, next) => authMiddleware.protect(req, res, next),
  (req, res, next) => authMiddleware.restrictTo('admin', 'super-admin')(req, res, next),
  uploadPhoto,
  photoController.updatePhoto
);

router.delete('/:id', 
  (req, res, next) => authMiddleware.protect(req, res, next),
  (req, res, next) => authMiddleware.restrictTo('admin', 'super-admin')(req, res, next),
  photoController.deletePhoto
);

export default router;
