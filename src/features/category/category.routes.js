// src/features/category/category.routes.js

import express from 'express';
import {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from './category.controller.js';
import { requireSuperAdmin, validateAdminPrivilege, requireAdminRole } from '../../middleware/admin-privilege.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = express.Router();

// Create a new category (Admin or Super Admin)
router.post('/', authMiddleware.protect, requireAdminRole, createCategory);

// Get all categories
router.get('/', getCategories);

// Update a category (Admin or Super Admin)
router.put('/:id', authMiddleware.protect, requireAdminRole, updateCategory);

// Delete a category (Admin or Super Admin)
router.delete('/:id', authMiddleware.protect, requireAdminRole, deleteCategory);

export default router;