// src/features/featured-image/featured-image.controller.js
import FeaturedImage from './featured-image.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

// Get all active featured images (public)
export const getFeaturedImages = async (req, res) => {
  try {
    const { limit = 4 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 4), 20);

    // Try cache first
    const cacheKey = `featured-images:active:limit:${parsedLimit}`;
    const cachedImages = await cache.get(cacheKey);
    
    if (cachedImages) {
      // Set aggressive cache headers for public data
      res.set({
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
        'ETag': Buffer.from(JSON.stringify(cachedImages)).toString('base64').substring(0, 32),
        'X-Cache': 'HIT'
      });
      return res.status(200).json({
        success: true,
        data: cachedImages,
        cached: true
      });
    }

    // Get from database
    const images = await FeaturedImage.getActiveFeaturedImages(parsedLimit);

    // Cache for 1 hour
    await cache.set(cacheKey, images, 3600);

    // Set cache headers for browser and CDN
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, immutable',
      'ETag': Buffer.from(JSON.stringify(images)).toString('base64').substring(0, 32),
      'X-Cache': 'MISS',
      'Vary': 'Accept-Encoding'
    });

    res.status(200).json({
      success: true,
      data: images,
      cached: false
    });
  } catch (error) {
    logger.error('Error in getFeaturedImages:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured images'
    });
  }
};

// Get single featured image
export const getFeaturedImageById = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await FeaturedImage.findById(id).select('imageUrl order isActive');

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Featured image not found'
      });
    }

    res.status(200).json({
      success: true,
      data: image
    });
  } catch (error) {
    logger.error('Error in getFeaturedImageById:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured image'
    });
  }
};

// Get all featured images - Admin only
export const getAllFeaturedImages = async (req, res) => {
  try {
    const images = await FeaturedImage.getAllFeaturedImagesAdmin();

    res.status(200).json({
      success: true,
      data: images,
      total: images.length
    });
  } catch (error) {
    logger.error('Error in getAllFeaturedImages:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured images'
    });
  }
};

// Create featured image - Admin only
export const createFeaturedImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    // Get next order number
    const maxOrderImage = await FeaturedImage.findOne().sort({ order: -1 });
    const nextOrder = (maxOrderImage?.order || 0) + 1;

    const newImage = new FeaturedImage({
      imageUrl,
      order: nextOrder,
      isActive: true
    });

    const savedImage = await newImage.save();

    // Invalidate cache
    await cache.delPattern('featured-images:*');

    res.status(201).json({
      success: true,
      message: 'Featured image uploaded successfully',
      data: savedImage
    });
  } catch (error) {
    logger.error('Error in createFeaturedImage:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upload featured image'
    });
  }
};

// Upload featured image file - Admin only
export const uploadFeaturedImage = async (req, res) => {
  try {
    if (!req.processedFeaturedImage) {
      return res.status(400).json({
        success: false,
        error: 'No image processed'
      });
    }

    const { imageUrl } = req.processedFeaturedImage;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    // Get next order number
    const maxOrderImage = await FeaturedImage.findOne().sort({ order: -1 });
    const nextOrder = (maxOrderImage?.order || 0) + 1;

    const newImage = new FeaturedImage({
      imageUrl,
      order: nextOrder,
      isActive: true,
      createdBy: req.user._id
    });

    const savedImage = await newImage.save();
    
    // Populate user info before sending response
    await savedImage.populate('createdBy', 'username fullName email');

    // Invalidate cache
    await cache.delPattern('featured-images:*');

    logger.info('Featured image uploaded and saved successfully', {
      id: savedImage._id,
      order: nextOrder,
      url: imageUrl,
      uploadedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Featured image uploaded successfully',
      data: savedImage
    });
  } catch (error) {
    logger.error('Error in uploadFeaturedImage:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to upload featured image'
    });
  }
};

// Update featured image - Admin only
export const updateFeaturedImage = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Parse order and isActive from body (JSON) or formData fields
    let order = req.body?.order;
    let isActive = req.body?.isActive;

    // If coming from FormData, values are strings
    if (typeof order === 'string') {
      order = JSON.parse(order);
    }
    if (typeof isActive === 'string') {
      isActive = JSON.parse(isActive);
    }

    const image = await FeaturedImage.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Featured image not found'
      });
    }

    // If new image was uploaded, use it; otherwise keep the old one
    if (req.processedFeaturedImage?.imageUrl) {
      // Delete old image files from disk
      try {
        const oldImageUrl = image.imageUrl;
        const oldFileName = oldImageUrl.substring(oldImageUrl.lastIndexOf('/') + 1);
        
        const oldImagePath = path.join(UPLOADS_ROOT, 'featured-images', oldFileName);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          logger.info('Old featured image file deleted', { path: oldImagePath });
        }

        const oldThumbName = `thumb_${oldFileName}`;
        const oldThumbPath = path.join(UPLOADS_ROOT, 'featured-images', 'thumbnails', oldThumbName);
        if (fs.existsSync(oldThumbPath)) {
          fs.unlinkSync(oldThumbPath);
          logger.info('Old featured image thumbnail deleted', { path: oldThumbPath });
        }
      } catch (fsError) {
        logger.warn('Failed to delete old image files', { 
          error: fsError.message,
          imageId: id
        });
      }

      image.imageUrl = req.processedFeaturedImage.imageUrl;
    }

    // Update other fields
    if (order !== undefined && order !== null) image.order = order;
    if (isActive !== undefined && isActive !== null) image.isActive = isActive;

    // Ensure createdBy is set (for legacy images or new ones)
    if (!image.createdBy) {
      image.createdBy = req.user._id;
    }

    const updatedImage = await image.save();
    
    // Populate user info before sending response
    await updatedImage.populate('createdBy', 'username fullName email');

    // Invalidate cache
    await cache.delPattern('featured-images:*');

    res.status(200).json({
      success: true,
      message: 'Featured image updated successfully',
      data: updatedImage
    });
  } catch (error) {
    logger.error('Error in updateFeaturedImage:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update featured image'
    });
  }
};

// Delete featured image - Admin only
export const deleteFeaturedImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await FeaturedImage.findByIdAndDelete(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Featured image not found'
      });
    }

    // Delete the actual image files from disk
    try {
      // Extract filename from imageUrl (e.g., /uploads/featured-images/filename.webp -> filename.webp)
      const imageUrlPath = image.imageUrl;
      const fileName = imageUrlPath.substring(imageUrlPath.lastIndexOf('/') + 1);
      
      // Delete main image
      const imagePath = path.join(UPLOADS_ROOT, 'featured-images', fileName);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        logger.info('Featured image file deleted', { path: imagePath });
      }

      // Delete thumbnail
      const thumbName = `thumb_${fileName}`;
      const thumbPath = path.join(UPLOADS_ROOT, 'featured-images', 'thumbnails', thumbName);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
        logger.info('Featured image thumbnail deleted', { path: thumbPath });
      }
    } catch (fsError) {
      logger.warn('Failed to delete image files from disk', { 
        error: fsError.message,
        imageId: id,
        imageUrl: image.imageUrl
      });
      // Continue anyway - DB record is already deleted
    }

    // Invalidate cache
    await cache.delPattern('featured-images:*');

    res.status(200).json({
      success: true,
      message: 'Featured image deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteFeaturedImage:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete featured image'
    });
  }
};

// Reorder featured images - Admin only
export const reorderFeaturedImages = async (req, res) => {
  try {
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid imageIds array'
      });
    }

    // Update order for each image
    await Promise.all(
      imageIds.map((id, index) =>
        FeaturedImage.findByIdAndUpdate(id, { order: index })
      )
    );

    // Invalidate cache
    await cache.delPattern('featured-images:*');

    res.status(200).json({
      success: true,
      message: 'Featured images reordered successfully'
    });
  } catch (error) {
    logger.error('Error in reorderFeaturedImages:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reorder featured images'
    });
  }
};

// Placeholder functions for compatibility
export const recordView = async (req, res) => {
  res.status(200).json({ success: true, message: 'View recording disabled' });
};

export const recordClick = async (req, res) => {
  res.status(200).json({ success: true, message: 'Click recording disabled' });
};

