import Photo from './photo.model.js';
import Watermark from '../watermark/watermark.model.js';
import { processPhotoWithWatermark, uploadPhotoFile, deletePhotoFiles } from '../../utils/watermark.util.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';
import ExifParser from 'exif-parser';
import fs from 'fs/promises';
import path from 'path';

const CACHE_TTL = 7200; // 2 hours
const FEATURED_CACHE_TTL = 10800; // 3 hours

/**
 * Get default active watermark
 */
const getDefaultWatermark = async () => {
  try {
    // Try to get from cache first
    const cacheKey = 'watermark:default:active';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database - get the first active watermark
    const watermark = await Watermark.findOne({ isActive: true })
      .lean();

    if (watermark) {
      // Cache for 1 hour
      await cache.set(cacheKey, JSON.stringify(watermark), 3600);
    }

    return watermark;
  } catch (error) {
    logger.warn('Failed to get default watermark:', { error: error.message });
    // Return default text watermark if database fails
    return {
      type: 'text',
      text: {
        content: 'Wonder Travelers',
        xOffset: 30,
        yOffset: 30,
        fontSize: 40,
        opacity: 0.7,
        color: '#FFFFFF'
      }
    };
  }
};

/**
 * Extract EXIF metadata from image buffer
 */
const extractExifData = (buffer, mimetype = '') => {
  // exif-parser only reads JPEG/TIFF containers; PNG/WebP/GIF just throw noise.
  if (mimetype && !/jpe?g|tiff?/i.test(mimetype)) {
    return {};
  }
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    const tags = result.tags;

    return {
      camera: tags.Model || null,
      lens: tags.LensModel || null,
      iso: tags.ISO || null,
      aperture: tags.FNumber ? `f/${tags.FNumber.toFixed(1)}` : null,
      shutterSpeed: tags.ExposureTime ? `1/${Math.round(1 / tags.ExposureTime)}s` : null,
      date: tags.DateTime ? new Date(tags.DateTime * 1000) : null
    };
  } catch (error) {
    logger.warn('EXIF extraction failed:', { error: error.message });
    return {};
  }
};

/**
 * @desc   Get all photos for admin management (no status filter)
 * @route  GET /api/admin/photos
 * @access Admin
 * @query  skip, limit, category
 */
export const getAdminPhotos = async (req, res) => {
  try {
    const { skip = 0, limit = 10, category } = req.query;
    
    let query = Photo.find({});
    
    if (category) {
      query = query.where('category').equals(category);
    }

    // Get total count
    const total = await Photo.countDocuments(query);

    // Execute query with pagination - use lean() to get plain objects
    const photos = await query
      .select('title slug category description watermarkedImage thumbnail watermarkTemplate watermark pricing engagement metadata status uploadedBy createdAt')
      .populate('uploadedBy', 'username fullName email')
      .populate('watermarkTemplate', 'name type')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain JavaScript objects

    const result = {
      success: true,
      total,
      count: photos.length,
      photos,
      hasMore: parseInt(skip) + parseInt(limit) < total
    };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .json(result);
  } catch (error) {
    logger.error('Get admin photos error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get all published photos
 * @route  GET /api/photos/public
 * @access Public
 * @query  category, skip, limit
 */
export const getPhotos = async (req, res) => {
  try {
    const { category, skip = 0, limit = 15 } = req.query;
    
    // Build query - check nested status fields
    let query = Photo.find({ 'status.published': true, 'status.archived': false });
    
    if (category) {
      query = query.where('category').equals(category);
    }

    // Get total count
    const total = await Photo.countDocuments(query);

    // Execute query with pagination
    const photos = await query
      .select('title slug category description watermarkedImage originalImage thumbnail pricing likes downloads views metadata createdAt _id')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const result = {
      success: true,
      total,
      count: photos.length,
      photos,
      hasMore: parseInt(skip) + parseInt(limit) < total
    };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    logger.error('Get photos error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get featured photos
 * @route  GET /api/photos/featured
 * @access Public
 */
export const getFeaturedPhotos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    
    const photos = await Photo.find({
      'status.published': true,
      'status.archived': false,
      isFeatured: true
    })
      .select('title slug category description watermarkedImage thumbnail pricing likes downloads _id')
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const result = {
      success: true,
      count: photos.length,
      photos
    };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    console.error('Error fetching featured photos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured photos',
      error: error.message
    });
  }
};

/**
 * @desc   Get single photo by slug
 * @route  GET /api/photos/public/:slug
 * @access Public
 */
export const getPhotoBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `photo:${slug}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return res
        .set('X-Cache', 'HIT')
        .set('Cache-Control', `public, max-age=3600, s-maxage=3600`)
        .json(cached);
    }

    const photo = await Photo.findOne({ slug, 'status.published': true, 'status.archived': false })
      .select('-__v')
      .populate('watermarkTemplate', 'name type')
      .lean();

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Increment views
    await Photo.updateOne({ _id: photo._id }, { $inc: { 'engagement.views': 1 } });

    const result = { success: true, photo };

    await cache.set(cacheKey, 3600, result);

    res
      .set('X-Cache', 'MISS')
      .set('Cache-Control', `public, max-age=3600, s-maxage=3600`)
      .json(result);
  } catch (error) {
    logger.error('Get photo by slug error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Upload photo with automatic watermarking
 * @route  POST /api/photos
 * @access Admin
 */
export const uploadPhoto = async (req, res) => {
  let tempFilePath = null; // Track temp file for cleanup
  const uploadedFiles = []; // Track written output files so we can roll them back on error

  try {
    if (!req.file) {
      logger.error('No file provided in upload request', {
        body: req.body,
        files: req.files,
        fields: Object.keys(req.body || {})
      });
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Store temp file path for cleanup
    tempFilePath = req.file.path;

    logger.debug('File uploaded to temp location', {
      fileName: req.file.filename,
      tempPath: req.file.path,
      fileSize: req.file.size,
      mimetype: req.file.mimetype
    });

    const {
      title,
      description,
      category,
      location,
      price,
      currency = 'NPR',
      license,
      isFeatured = false,
      status = 'published'
    } = req.body;

    logger.info('Photo upload request received', {
      title,
      category,
      description: description ? 'provided' : 'not provided',
      price,
      license,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    // Validate required fields
    if (!title || !category) {
      logger.warn('Missing required fields', {
        title: title ? 'provided' : 'missing',
        category: category ? 'provided' : 'missing'
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Title and category are required'
      });
    }

    // Auto-extract EXIF metadata from image
    // Read file buffer from disk (multer stores file on disk, not in memory)
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(req.file.path);
      logger.debug('Read file buffer from disk', {
        fileName: req.file.filename,
        bufferSize: fileBuffer.length
      });
    } catch (readError) {
      logger.error('Failed to read uploaded file from disk', {
        error: readError.message,
        filePath: req.file.path
      });
      return res.status(400).json({
        success: false,
        message: 'Failed to read uploaded file',
        error: 'File read error'
      });
    }

    const exifData = extractExifData(fileBuffer, req.file.mimetype);
    
    // Use EXIF data or fallback to request body
    const metadata = {
      camera: exifData.camera || req.body.camera || null,
      lens: exifData.lens || req.body.lens || null,
      iso: exifData.iso || (req.body.iso ? parseInt(req.body.iso) : null),
      aperture: exifData.aperture || req.body.aperture || null,
      shutterSpeed: exifData.shutterSpeed || req.body.shutterSpeed || null,
      date: exifData.date || (req.body.date ? new Date(req.body.date) : new Date()),
      location: location || null
    };

    // Get default active watermark from database
    const defaultWatermark = await getDefaultWatermark();

    // Check if watermark is configured
    if (!defaultWatermark) {
      logger.error('No active watermark found', {
        title,
        uploadedBy: req.user._id
      });
      return res.status(400).json({
        success: false,
        message: 'Watermark not configured',
        error: 'No active watermark found. Please configure a watermark in the admin panel before uploading photos.',
        errorCode: 'WATERMARK_NOT_CONFIGURED'
      });
    }
    
    let watermarkConfig = {
      type: defaultWatermark.type,
      ...(defaultWatermark.type === 'text' ? {
        text: defaultWatermark.text
      } : {
        imageUrl: defaultWatermark.imageUrl,
        imageXOffset: defaultWatermark.imageXOffset || 30,
        imageYOffset: defaultWatermark.imageYOffset || 30,
        opacity: defaultWatermark.imageOpacity
      })
    };

    // Load image watermark buffer if using image watermark
    if (defaultWatermark.type === 'image' && defaultWatermark.imageUrl) {
      try {
        const watermarkFilePath = path.join(process.cwd(), 'uploads', defaultWatermark.imageUrl.replace(/^\/uploads\//, ''));
        
        logger.debug('Attempting to load watermark image', {
          originalUrl: defaultWatermark.imageUrl,
          filePath: watermarkFilePath
        });

        watermarkConfig.imageBuffer = await fs.readFile(watermarkFilePath);
        
        logger.debug('Loaded image watermark buffer successfully', { 
          imageUrl: defaultWatermark.imageUrl,
          fileSize: watermarkConfig.imageBuffer.length,
          isBuffer: Buffer.isBuffer(watermarkConfig.imageBuffer)
        });
      } catch (error) {
        logger.warn('Failed to load image watermark file, falling back to text watermark', { 
          error: error.message,
          imageUrl: defaultWatermark.imageUrl,
          errno: error.errno,
          code: error.code
        });
        // Fallback to text watermark
        watermarkConfig = {
          type: 'text',
          text: {
            content: 'Wonder Travelers',
            xOffset: 30,
            yOffset: 30,
            fontSize: 40,
            opacity: 0.7,
            color: '#FFFFFF'
          }
        };
      }
    } else if (defaultWatermark.type === 'image' && !defaultWatermark.imageUrl) {
      // Image watermark type set but no imageUrl - fallback to text
      logger.warn('Image watermark type set but no imageUrl provided, using text watermark instead', {
        defaultWatermark
      });
      watermarkConfig = {
        type: 'text',
        text: {
          content: 'Wonder Travelers',
          xOffset: 30,
          yOffset: 30,
          fontSize: 40,
          opacity: 0.7,
          color: '#FFFFFF'
        }
      };
    }

    // Validate watermarks before processing
    if (watermarkConfig.type === 'image') {
      if (!watermarkConfig.imageBuffer || !Buffer.isBuffer(watermarkConfig.imageBuffer)) {
        logger.warn('Image watermark buffer is invalid or missing, forcing text watermark', {
          hasImageBuffer: !!watermarkConfig.imageBuffer,
          isBuffer: Buffer.isBuffer(watermarkConfig.imageBuffer)
        });
        watermarkConfig = {
          type: 'text',
          text: {
            content: 'Wonder Travelers',
            xOffset: 30,
            yOffset: 30,
            fontSize: 40,
            opacity: 0.7,
            color: '#FFFFFF'
          }
        };
      }
    }

    logger.info('Processing photo with watermark...', {
      title,
      watermarkType: watermarkConfig.type,
      watermarkContent: watermarkConfig.text?.content || 'image watermark'
    });

    // Process image with watermark
    const processed = await processPhotoWithWatermark(
      fileBuffer,
      watermarkConfig,
      { quality: 88 }
    );

    // Generate unique filename
    const timestamp = Date.now();
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    // Upload both thumbnail and watermarked image
    const [thumbnailUrl, watermarkedUrl] = await Promise.all([
      uploadPhotoFile(processed.thumbnail.buffer, `thumbnail-${slug}-${timestamp}.jpg`, 'photos'),
      uploadPhotoFile(processed.watermarked.buffer, `watermarked-${slug}-${timestamp}.jpg`, 'photos')
    ]);
    uploadedFiles.push(thumbnailUrl, watermarkedUrl);

    // Create photo document with watermark info
    // Clean up watermarkConfig - remove imageBuffer before saving to DB
    const watermarkDataForDb = {
      type: watermarkConfig.type,
      ...(watermarkConfig.type === 'text' ? {
        text: watermarkConfig.text
      } : {
        imageUrl: watermarkConfig.imageUrl,
        imageXOffset: watermarkConfig.imageXOffset || 30,
        imageYOffset: watermarkConfig.imageYOffset || 30,
        opacity: watermarkConfig.opacity
      })
    };

    const photo = new Photo({
      title,
      slug: `${slug}-${timestamp}`,
      description,
      category,
      watermarkTemplate: defaultWatermark._id || null, // Reference to watermark template
      watermark: watermarkDataForDb,
      watermarkedImage: {
        url: watermarkedUrl,
        size: processed.watermarked.size,
        width: processed.watermarked.width,
        height: processed.watermarked.height
      },
      thumbnail: {
        url: thumbnailUrl,
        size: processed.thumbnail.size
      },
      metadata,
      pricing: {
        price: parseFloat(price) || 0,
        currency,
        license
      },
      status: {
        published: status === 'published',
        featured: isFeatured,
        archived: false
      },
      uploadedBy: req.user._id
    });

    await photo.save();

    // Cleanup temp file after successful processing
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        logger.debug('Cleaned up temp file', { tempPath: tempFilePath });
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file', {
          tempPath: tempFilePath,
          error: cleanupError.message
        });
      }
    }

    // Invalidate cache
    await cache.delPattern(`photos:published:*`);
    await cache.del('photos:featured');

    logger.info('Photo uploaded successfully with watermark', {
      photoId: photo._id,
      slug: photo.slug,
      watermarkType: watermarkConfig.type
    });

    res.status(201).json({
      success: true,
      message: 'Photo uploaded and watermarked successfully',
      photo: {
        _id: photo._id,
        title: photo.title,
        slug: photo.slug,
        thumbnail: photo.thumbnail.url,
        watermarked: photo.watermarkedImage.url,
        watermarkType: watermarkConfig.type,
        metadata: photo.metadata
      }
    });
  } catch (error) {
    // Cleanup temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        logger.debug('Cleaned up temp file after error', { tempPath: tempFilePath });
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file', {
          tempPath: tempFilePath,
          error: cleanupError.message
        });
      }
    }

    // Roll back any output files already written to disk (DB save failed etc.)
    if (uploadedFiles.length) {
      await deletePhotoFiles(uploadedFiles);
      logger.debug('Rolled back orphaned upload files after error', { files: uploadedFiles });
    }

    logger.error('Upload photo error:', {
      error: error.message,
      stack: error.stack,
      errorCode: error.code
    });

    // Determine error type from error message
    let errorMessage = error.message;
    let statusCode = 500;

    if (error.message.includes('Invalid input')) {
      errorMessage = 'Failed to process image with watermark. This usually means the watermark is misconfigured.';
      statusCode = 400;
    } else if (error.message.includes('Buffer')) {
      errorMessage = 'Image processing error: Watermark buffer is invalid.';
      statusCode = 400;
    } else if (error.message.includes('ENOENT')) {
      errorMessage = 'Watermark file not found. Please reconfigure your watermark in the admin panel.';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: 'Photo upload failed',
      error: errorMessage,
      errorCode: 'PHOTO_UPLOAD_ERROR'
    });
  }
};

/**
 * @desc   Update photo metadata (without re-processing image)
 * @route  PUT /api/photos/:id
 * @access Admin
 */
export const updatePhoto = async (req, res) => {
  let tempFilePath = null; // Track temp file for cleanup
  const uploadedFiles = []; // Track written output files so we can roll them back on error

  try {
    const { id } = req.params;
    const updateData = {};

    // If there's a file upload, process it with watermark
    if (req.file) {
      tempFilePath = req.file.path;

      logger.debug('File upload detected in update request', {
        fileName: req.file.filename,
        tempPath: req.file.path,
        fileSize: req.file.size
      });

      // Read file buffer from disk
      let fileBuffer;
      try {
        fileBuffer = await fs.readFile(req.file.path);
        logger.debug('Read updated file buffer from disk', {
          fileName: req.file.filename,
          bufferSize: fileBuffer.length
        });
      } catch (readError) {
        logger.error('Failed to read updated file from disk', {
          error: readError.message,
          filePath: req.file.path
        });
        return res.status(400).json({
          success: false,
          message: 'Failed to read uploaded file',
          error: 'File read error'
        });
      }

      // Get active watermark
      const defaultWatermark = await getDefaultWatermark();

      if (!defaultWatermark) {
        logger.error('No active watermark found during photo update');
        return res.status(400).json({
          success: false,
          message: 'Watermark not configured',
          error: 'No active watermark found. Please configure a watermark in the admin panel.',
          errorCode: 'WATERMARK_NOT_CONFIGURED'
        });
      }

      let watermarkConfig = {
        type: defaultWatermark.type,
        ...(defaultWatermark.type === 'text' ? {
          text: defaultWatermark.text
        } : {
          imageUrl: defaultWatermark.imageUrl,
          imageXOffset: defaultWatermark.imageXOffset || 30,
          imageYOffset: defaultWatermark.imageYOffset || 30,
          opacity: defaultWatermark.imageOpacity
        })
      };

      // Load image watermark buffer if using image watermark
      if (defaultWatermark.type === 'image' && defaultWatermark.imageUrl) {
        try {
          const watermarkFilePath = path.join(process.cwd(), 'uploads', defaultWatermark.imageUrl.replace(/^\/uploads\//, ''));
          
          logger.debug('Loading watermark image for update', {
            originalUrl: defaultWatermark.imageUrl,
            filePath: watermarkFilePath
          });

          watermarkConfig.imageBuffer = await fs.readFile(watermarkFilePath);
          
          logger.debug('Loaded watermark buffer for update', { 
            imageUrl: defaultWatermark.imageUrl,
            fileSize: watermarkConfig.imageBuffer.length
          });
        } catch (error) {
          logger.warn('Failed to load image watermark, falling back to text', { 
            error: error.message
          });
          watermarkConfig = {
            type: 'text',
            text: {
              content: 'Wonder Travelers',
              xOffset: 30,
              yOffset: 30,
              fontSize: 40,
              opacity: 0.7,
              color: '#FFFFFF'
            }
          };
        }
      }

      // Process the photo with watermark
      logger.info('Processing updated photo with watermark', {
        photoId: id,
        watermarkType: watermarkConfig.type
      });

      const processed = await processPhotoWithWatermark(fileBuffer, watermarkConfig);

      if (!processed.watermarked || !Buffer.isBuffer(processed.watermarked.buffer)) {
        throw new Error('Failed to process watermark on photo');
      }

      // Upload processed files
      const timestamp = Date.now();
      
      // Get existing photo to get slug
      const existingPhoto = await Photo.findById(id);
      if (!existingPhoto) {
        return res.status(404).json({ success: false, message: 'Photo not found' });
      }

      const slug = existingPhoto.slug;

      // Upload new files
      const thumbnailPath = await uploadPhotoFile(
        processed.thumbnail.buffer, 
        `thumbnail-${slug}-${timestamp}.jpg`,
        'photos'
      );
      
      const watermarkedPath = await uploadPhotoFile(
        processed.watermarked.buffer,
        `watermarked-${slug}-${timestamp}.jpg`,
        'photos'
      );
      uploadedFiles.push(thumbnailPath, watermarkedPath);

      logger.debug('Photo files uploaded during update', {
        thumbnailPath,
        watermarkedPath
      });

      updateData.thumbnail = { url: thumbnailPath };
      updateData.watermarkedImage = { url: watermarkedPath };
      updateData.watermarkTemplate = defaultWatermark._id;
    }

    // Handle title, description, category
    const simpleFields = ['title', 'description', 'category', 'location', 'date'];
    simpleFields.forEach(field => {
      if (field in req.body && req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Handle metadata fields (camera, lens, iso, aperture, shutterSpeed)
    const metadataFields = ['camera', 'lens', 'iso', 'aperture', 'shutterSpeed'];
    metadataFields.forEach(field => {
      if (field in req.body && req.body[field] !== undefined) {
        if (!updateData.metadata) updateData.metadata = {};
        updateData.metadata[field] = req.body[field];
      }
    });

    // Handle pricing object
    if (req.body.pricing) {
      updateData.pricing = req.body.pricing;
    } else {
      // Support old format: pricing.price, pricing.currency, pricing.license
      if ('price' in req.body && req.body.price !== undefined) {
        if (!updateData.pricing) updateData.pricing = {};
        updateData.pricing.price = req.body.price;
      }
      if ('currency' in req.body && req.body.currency !== undefined) {
        if (!updateData.pricing) updateData.pricing = {};
        updateData.pricing.currency = req.body.currency;
      }
      if ('license' in req.body && req.body.license !== undefined) {
        if (!updateData.pricing) updateData.pricing = {};
        updateData.pricing.license = req.body.license;
      }
    }

    // Handle status object
    if (req.body.status) {
      updateData.status = req.body.status;
    } else {
      // Support old format: individual status fields
      if ('published' in req.body && req.body.published !== undefined) {
        if (!updateData.status) updateData.status = {};
        updateData.status.published = req.body.published;
      }
      if ('featured' in req.body && req.body.featured !== undefined) {
        if (!updateData.status) updateData.status = {};
        updateData.status.featured = req.body.featured;
      }
      if ('archived' in req.body && req.body.archived !== undefined) {
        if (!updateData.status) updateData.status = {};
        updateData.status.archived = req.body.archived;
      }
    }

    // Handle watermark object
    if (req.body.watermark) {
      updateData.watermark = req.body.watermark;
    }

    const photo = await Photo.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).select('-__v')
      .populate('uploadedBy', 'username fullName email')
      .populate('watermarkTemplate', 'name type')
      .lean(); // Use lean for better performance

    if (!photo) {
      if (uploadedFiles.length) await deletePhotoFiles(uploadedFiles);
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Invalidate cache
    await cache.del(`photo:${photo.slug}`);
    await cache.delPattern(`photos:published:*`);
    await cache.del(`photos:featured`);

    logger.info('Photo updated successfully', {
      photoId: id,
      fileUpdated: !!req.file,
      fieldsUpdated: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: req.file ? 'Photo updated with new watermarked image' : 'Photo updated successfully',
      photo
    });
  } catch (error) {
    // Roll back any newly written output files - the DB update never landed
    if (uploadedFiles.length) {
      await deletePhotoFiles(uploadedFiles);
      logger.debug('Rolled back orphaned upload files after update error', { files: uploadedFiles });
    }
    logger.error('Update photo error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  } finally {
    // Cleanup temp file if it exists
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        logger.debug('Cleaned up temp file after update', { tempFilePath });
      } catch (cleanupError) {
        logger.debug('Failed to cleanup temp file', { tempFilePath, error: cleanupError.message });
      }
    }
  }
};

/**
 * @desc   Delete photo
 * @route  DELETE /api/photos/:id
 * @access Admin
 */
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findByIdAndDelete(id);

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Delete files
    const filesToDelete = [
      photo.thumbnail?.url,
      photo.watermarkedImage?.jpegUrl,
      photo.watermarkedImage?.webpUrl,
      photo.hdImage?.url
    ];

    await deletePhotoFiles(filesToDelete);

    // Invalidate cache
    await cache.del(`photo:${photo.slug}`);
    await cache.delPattern(`photos:published:*`);
    await cache.del('photos:featured');

    logger.info('Photo deleted', { photoId: photo._id });

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    logger.error('Delete photo error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Increment likes
 * @route  POST /api/photos/:id/like
 * @access Public
 */
export const likePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findByIdAndUpdate(
      id,
      { $inc: { 'engagement.likes': 1 } },
      { new: true }
    ).select('engagement');

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Invalidate cache
    await cache.del(`photo:${photo.slug}`);

    res.json({
      success: true,
      message: 'Photo liked',
      likes: photo.engagement.likes
    });
  } catch (error) {
    logger.error('Like photo error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Record download/purchase
 * @route  POST /api/photos/:id/download
 * @access Public
 */
export const recordDownload = async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await Photo.findByIdAndUpdate(
      id,
      { $inc: { 'engagement.downloads': 1 } },
      { new: true }
    ).select('engagement pricing watermarkedImage');

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    // Invalidate cache
    await cache.del(`photo:${photo.slug}`);

    res.json({
      success: true,
      message: 'Download recorded',
      downloads: photo.engagement.downloads
    });
  } catch (error) {
    logger.error('Record download error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Download watermarked photo (only watermarked available)
 * @route  GET /api/photos/:id/download-watermarked
 * @access Public
 */
export const downloadWatermarkedPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'jpeg' } = req.query;

    const photo = await Photo.findById(id).select('title slug watermarkedImage');

    if (!photo) {
      return res.status(404).json({ success: false, message: 'Photo not found' });
    }

    const downloadUrl = photo.watermarkedImage?.url;

    if (!downloadUrl) {
      return res.status(404).json({ success: false, message: 'Watermarked image not available' });
    }

    // Record download
    await Photo.updateOne({ _id: id }, { $inc: { 'engagement.downloads': 1 } });
    await cache.del(`photo:${photo.slug}`);

    res.json({
      success: true,
      message: 'Download link generated for watermarked photo',
      downloadUrl,
      fileName: `${photo.title.replace(/\s+/g, '-')}-watermarked.${format === 'webp' ? 'webp' : 'jpg'}`,
      format
    });
  } catch (error) {
    logger.error('Download watermarked photo error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get all unique photo categories
 * @route  GET /api/photos/categories
 * @access Public
 */
export const getPhotoCategories = async (req, res) => {
  try {
    const categories = await Photo.distinct('category', { 'status.published': true, 'status.archived': false });

    const result = {
      success: true,
      count: categories.length,
      categories: categories.sort() || []
    };

    res
      .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .json(result);
  } catch (error) {
    logger.error('Get photo categories error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getPhotos,
  getFeaturedPhotos,
  getPhotoBySlug,
  uploadPhoto,
  updatePhoto,
  deletePhoto,
  likePhoto,
  recordDownload,
  downloadWatermarkedPhoto,
  getPhotoCategories
};
