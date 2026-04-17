// src/features/category/category.controller.js

import Category from './category.model.js';
import cache from '../../utils/cache.util.js';

// Create a new category
export const createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    
    // Clear the categories cache after creating
    await cache.del('categories');
    
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all categories
export const getCategories = async (req, res) => {
  try {
    const cacheKey = 'categories';

    // Check cache
    const cachedCategories = await cache.get(cacheKey);
    if (cachedCategories) {
      // Cache returns already parsed data
      const categoriesArray = Array.isArray(cachedCategories) ? cachedCategories : JSON.parse(cachedCategories);
      return res.status(200).json(categoriesArray);
    }

    const categories = await Category.find().lean();

    // Set cache - pass the array directly, cache utility handles stringification
    await cache.set(cacheKey, categories, 3600);

    res.status(200).json(categories);
  } catch (error) {
    console.error('Error in getCategories:', error);
    res.status(500).json({ error: 'Failed to fetch categories. Please try again.' });
  }
};

// Update a category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndUpdate(id, req.body, { new: true });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Clear the categories cache after updating
    await cache.del('categories');
    
    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Clear the categories cache after deleting
    await cache.del('categories');
    
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};