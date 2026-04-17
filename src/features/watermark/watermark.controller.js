// src/features/watermark/watermark.controller.js
import Watermark from './watermark.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';

/**
 * @desc   Create a new watermark template
 * @route  POST /api/watermarks
 * @access Admin
 */
export const createWatermark = async (req, res) => {
  try {
    const { name, description, type, text, imageUrl, imageXOffset, imageYOffset, imageOpacity } = req.body;

    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and watermark type are required' 
      });
    }

    // Validate watermark type
    if (!['text', 'image'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Watermark type must be either "text" or "image"'
      });
    }

    // Check if watermark with same name exists
    const existingWatermark = await Watermark.findOne({ name: name.trim() });
    if (existingWatermark) {
      return res.status(400).json({ 
        success: false, 
        error: 'Watermark with this name already exists' 
      });
    }

    const watermarkData = {
      name: name.trim(),
      description: description?.trim(),
      type,
      createdBy: req.user._id
    };

    if (type === 'text') {
      // Text watermark must have text configuration
      if (!text || !text.content) {
        return res.status(400).json({
          success: false,
          error: 'Text watermark requires text content'
        });
      }
      watermarkData.text = {
        content: text.content || 'Wonder Travelers',
        xOffset: text.xOffset || 30,
        yOffset: text.yOffset || 30,
        fontSize: text.fontSize || 40,
        opacity: text.opacity || 0.7,
        color: text.color || '#FFFFFF'
      };
    } else if (type === 'image') {
      // Image watermark must have imageUrl
      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Image watermark requires an image URL'
        });
      }
      watermarkData.imageUrl = imageUrl;
      watermarkData.imageXOffset = imageXOffset || 30;
      watermarkData.imageYOffset = imageYOffset || 30;
      watermarkData.imageOpacity = imageOpacity || 0.5;
    }

    const watermark = await Watermark.create(watermarkData);

    // Invalidate default watermark cache
    await cache.del('watermark:default:active');

    logger.info('Watermark created successfully', {
      watermarkId: watermark._id,
      watermarkName: watermark.name,
      watermarkType: watermark.type
    });

    res.status(201).json({
      success: true,
      message: 'Watermark created successfully',
      watermark
    });
  } catch (error) {
    logger.error('Create watermark error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc   Get all watermarks
 * @route  GET /api/watermarks
 * @access Admin
 * @query  skip, limit, active
 */
export const getWatermarks = async (req, res) => {
  try {
    const { skip = 0, limit = 20, active } = req.query;

    let query = Watermark.find({});

    if (active !== undefined) {
      query = query.where('isActive').equals(active === 'true');
    }

    const total = await Watermark.countDocuments(query);

    const watermarks = await query
      .populate('createdBy', 'username fullName email')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      total,
      count: watermarks.length,
      watermarks,
      hasMore: parseInt(skip) + parseInt(limit) < total
    });
  } catch (error) {
    logger.error('Get watermarks error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc   Get single watermark by ID
 * @route  GET /api/watermarks/:id
 * @access Admin
 */
export const getWatermarkById = async (req, res) => {
  try {
    const watermark = await Watermark.findById(req.params.id)
      .populate('createdBy', 'username fullName email');

    if (!watermark) {
      return res.status(404).json({ 
        success: false, 
        error: 'Watermark not found' 
      });
    }

    res.json({
      success: true,
      watermark
    });
  } catch (error) {
    logger.error('Get watermark by ID error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc   Update watermark
 * @route  PUT /api/watermarks/:id
 * @access Admin
 */
export const updateWatermark = async (req, res) => {
  try {
    const { name, description, type, text, imageUrl, imageXOffset, imageYOffset, imageOpacity, isActive } = req.body;

    let watermark = await Watermark.findById(req.params.id);

    if (!watermark) {
      return res.status(404).json({ 
        success: false, 
        error: 'Watermark not found' 
      });
    }

    // Validate watermark type if provided
    if (type && !['text', 'image'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Watermark type must be either "text" or "image"'
      });
    }

    // Check if new name is unique (if changed)
    if (name && name !== watermark.name) {
      const existingWatermark = await Watermark.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingWatermark) {
        return res.status(400).json({ 
          success: false, 
          error: 'Watermark with this name already exists' 
        });
      }
    }

    // Update fields
    if (name) watermark.name = name.trim();
    if (description !== undefined) watermark.description = description?.trim();
    if (type) {
      watermark.type = type;
      logger.info('Watermark type changed', {
        watermarkId: req.params.id,
        previousType: watermark.type,
        newType: type
      });
    }
    if (isActive !== undefined) watermark.isActive = isActive;

    // Update type-specific fields
    if (type === 'text' && text) {
      if (!text.content) {
        return res.status(400).json({
          success: false,
          error: 'Text watermark requires text content'
        });
      }
      watermark.text = {
        content: text.content || watermark.text.content,
        xOffset: text.xOffset !== undefined ? text.xOffset : watermark.text.xOffset,
        yOffset: text.yOffset !== undefined ? text.yOffset : watermark.text.yOffset,
        fontSize: text.fontSize || watermark.text.fontSize,
        opacity: text.opacity !== undefined ? text.opacity : watermark.text.opacity,
        color: text.color || watermark.text.color
      };
    } else if (type === 'image') {
      if (!imageUrl && !watermark.imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Image watermark requires an image URL'
        });
      }
      if (imageUrl) watermark.imageUrl = imageUrl;
      if (imageXOffset !== undefined) watermark.imageXOffset = imageXOffset;
      if (imageYOffset !== undefined) watermark.imageYOffset = imageYOffset;
      if (imageOpacity !== undefined) watermark.imageOpacity = imageOpacity;
    }

    await watermark.save();

    // Invalidate default watermark cache
    await cache.del('watermark:default:active');

    logger.info('Watermark updated successfully', {
      watermarkId: watermark._id,
      watermarkName: watermark.name,
      watermarkType: watermark.type
    });

    res.json({
      success: true,
      message: 'Watermark updated successfully',
      watermark
    });
  } catch (error) {
    logger.error('Update watermark error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc   Delete watermark
 * @route  DELETE /api/watermarks/:id
 * @access Admin
 */
export const deleteWatermark = async (req, res) => {
  try {
    const watermark = await Watermark.findByIdAndDelete(req.params.id);

    if (!watermark) {
      return res.status(404).json({ 
        success: false, 
        error: 'Watermark not found' 
      });
    }

    res.json({
      success: true,
      message: 'Watermark deleted successfully'
    });
  } catch (error) {
    logger.error('Delete watermark error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc   Upload watermark image file
 * @route  POST /api/watermarks/upload-image
 * @access Admin
 */
export const uploadWatermarkImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // Return the file path/URL
    const imageUrl = `/uploads/watermarks/${req.file.filename}`;

    logger.info('Watermark image uploaded successfully', {
      fileName: req.file.filename,
      size: req.file.size,
      imageUrl
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl
    });
  } catch (error) {
    logger.error('Upload watermark image error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc   Toggle watermark active status
 * @route  PATCH /api/watermarks/:id/toggle
 * @access Admin
 */
export const toggleWatermarkStatus = async (req, res) => {
  try {
    const watermark = await Watermark.findById(req.params.id);

    if (!watermark) {
      return res.status(404).json({ 
        success: false, 
        error: 'Watermark not found' 
      });
    }

    if (!watermark.isActive) {
      // If activating this watermark, deactivate all others
      await Watermark.updateMany(
        { _id: { $ne: req.params.id }, isActive: true },
        { isActive: false }
      );
      
      watermark.isActive = true;
      logger.info('Activated watermark', {
        watermarkId: req.params.id,
        watermarkName: watermark.name
      });
    } else {
      // If deactivating, just set to inactive
      watermark.isActive = false;
      logger.info('Deactivated watermark', {
        watermarkId: req.params.id,
        watermarkName: watermark.name
      });
    }

    await watermark.save();

    // Invalidate default watermark cache
    await cache.del('watermark:default:active');

    res.json({
      success: true,
      message: `Watermark ${watermark.isActive ? 'activated' : 'deactivated'} successfully`,
      watermark
    });
  } catch (error) {
    logger.error('Toggle watermark status error:', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
