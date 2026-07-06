// src/features/video/video.routes.js
import express from 'express';
import { body } from 'express-validator';
import {
  getVideos,
  getVideoById,
  getAllVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  reorderVideos
} from './video.controller.js';
import { requireAdminRole } from '../../middleware/admin-privilege.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

// Validation middleware
const validateVideo = [
  body('videoUrl')
    .trim()
    .notEmpty()
    .withMessage('Video URL is required')
    .matches(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/)
    .withMessage('Please provide a valid YouTube URL'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must not exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
];

// Public routes
router.get('/public', getVideos);
router.get('/public/:id', getVideoById);

// Admin routes
router.get('/', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, getAllVideos);
router.post(
  '/',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  validateVideo,
  createVideo
);
router.put(
  '/:id',
  (req, res, next) => authMiddleware.protect(req, res, next),
  requireAdminRole,
  updateVideo
);
router.delete('/:id', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, deleteVideo);
router.post('/reorder', (req, res, next) => authMiddleware.protect(req, res, next), requireAdminRole, reorderVideos);

export default router;
