// src/features/author/author.routes.js

import express from 'express';
import multer from 'multer';
import Author from './author.model.js';
import {
  createAuthor,
  getAuthors,
  updateAuthor,
  deleteAuthor,
} from './author.controller.js';
import { requireAdminRole } from '../../middleware/admin-privilege.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

// Configure Multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/'); // Directory for storing uploaded photos
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024, fieldSize: 25 * 1024 * 1024, parts: 20 }, // 15MB local limit
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Error handler for multer
const handleMulterError = (middleware) => {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'FILE_TOO_LARGE') {
          return res.status(400).json({ error: 'File is too large. Maximum size is 15MB.' });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

// Create a new author (Admin only)
router.post('/', authMiddleware.protect, requireAdminRole, createAuthor);

// Get all authors
router.get('/', getAuthors);

// Update an author (Admin only)
router.put('/:id', authMiddleware.protect, requireAdminRole, updateAuthor);

// Delete an author (Admin only)
router.delete('/:id', authMiddleware.protect, requireAdminRole, deleteAuthor);

// Upload author photo (Admin only - no user hierarchy check)
router.post('/:id/photo', authMiddleware.protect, requireAdminRole, handleMulterError(upload.single('photo')), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { id } = req.params;
    // Store relative path from web root (uploads/avatars/filename)
    const photoPath = `uploads/avatars/${req.file.filename}`;

    console.log('[Author Photo] Uploading photo:', { id, filename: req.file.filename, path: photoPath, fileSize: req.file.size });

    // Update author's profile image
    const author = await Author.findByIdAndUpdate(id, { profileImage: photoPath }, { new: true });
    if (!author) {
      return res.status(404).json({ error: 'Author not found' });
    }

    console.log('[Author Photo] Photo uploaded successfully for author:', id);
    res.status(200).json({ message: 'Photo uploaded successfully', author });
  } catch (error) {
    console.error('[Author Photo] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;