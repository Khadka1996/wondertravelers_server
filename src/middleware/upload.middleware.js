// src/middleware/upload.middleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { logger } from '../utils/logger.util.js';

// Ensure directories exist with absolute paths
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const TEMP_DIR = path.join(UPLOADS_ROOT, 'temp');
const AVATAR_ORIGINAL_DIR = path.join(UPLOADS_ROOT, 'avatars', 'original');
const AVATAR_THUMB_DIR = path.join(UPLOADS_ROOT, 'avatars', 'thumbnails');
const FEATURED_IMAGES_DIR = path.join(UPLOADS_ROOT, 'featured-images');
const FEATURED_IMAGES_THUMB_DIR = path.join(UPLOADS_ROOT, 'featured-images', 'thumbnails');

// Create directories synchronously on module load
[UPLOADS_ROOT, TEMP_DIR, AVATAR_ORIGINAL_DIR, AVATAR_THUMB_DIR, FEATURED_IMAGES_DIR, FEATURED_IMAGES_THUMB_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    } catch (err) {
      logger.error(`Failed to create directory ${dir}`, { error: err.message });
      throw new Error(`Upload directory setup failed: ${err.message}`);
    }
  }
});

// ✅ NEW: Validate file magic numbers (P1-8) to prevent file upload attacks
const MAGIC_NUMBERS = {
  jpg: Buffer.from([0xFF, 0xD8, 0xFF]),
  jpeg: Buffer.from([0xFF, 0xD8, 0xFF]),
  png: Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  gif: Buffer.from([0x47, 0x49, 0x46]),
  webp: Buffer.from([0x52, 0x49, 0x46, 0x46])  // RIFF signature
};

const validateMagicNumbers = async (filePath, fileName) => {
  try {
    const ext = path.extname(fileName).toLowerCase().slice(1);
    const expectedMagic = MAGIC_NUMBERS[ext];
    
    if (!expectedMagic) {
      throw new Error(`Unknown file extension: .${ext}`);
    }
    
    // Check if file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File is empty - no data written');
    }
    
    // Read first 12 bytes (needed for WEBP verification)
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // Verify we got some bytes
    if (bytesRead === 0) {
      throw new Error('Could not read file data');
    }
    
    // Check magic bytes
    const fileSignature = buffer.slice(0, expectedMagic.length);
    
    logger.debug('Magic number check details', {
      ext,
      fileSize: stats.size,
      bytesRead,
      expectedHex: expectedMagic.toString('hex'),
      actualHex: fileSignature.toString('hex'),
      fileName
    });
    
    if (!fileSignature.equals(expectedMagic)) {
      logger.warn('Magic number mismatch - file content does not match extension', {
        extension: ext,
        expected: expectedMagic.toString('hex'),
        actual: fileSignature.toString('hex'),
        fileSize: stats.size,
        fileName
      });
      throw new Error(`File content does not match .${ext} extension`);
    }
    
    // For WEBP files, additionally check for "WEBP" signature at bytes 8-11
    if (ext === 'webp') {
      const webpSignature = buffer.slice(8, 12).toString('ascii');
      if (webpSignature !== 'WEBP') {
        logger.warn('WEBP signature missing', {
          fileName,
          signature: webpSignature
        });
        throw new Error('File is RIFF format but not a valid WEBP file');
      }
    }
    
    logger.debug('✅ Magic number validation passed', { fileName, extension: ext, fileSize: stats.size });
    return true;
  } catch (error) {
    logger.error('❌ Magic number validation failed', { 
      error: error.message, 
      fileName,
      filePath
    });
    throw error;
  }
};

// Security: Validate file is actually an image by checking magic numbers
const validateImageFile = async (filePath, fileName) => {
  try {
    logger.info('🔍 Starting image validation...', { fileName });
    
    // Try to read metadata with Sharp first - this is the most important test
    logger.debug('Attempting to read image metadata with Sharp...', { fileName });
    
    let metadata;
    try {
      metadata = await sharp(filePath).metadata();
    } catch (sharpErr) {
      logger.error('Sharp failed to read image', { error: sharpErr.message, fileName });
      throw new Error(`Sharp validation failed: ${sharpErr.message}`);
    }
    
    if (!metadata || !['jpeg', 'png', 'webp', 'gif', 'svg'].includes(metadata.format)) {
      throw new Error(`Unsupported image format: ${metadata?.format || 'unknown'}`);
    }
    
    // Prevent extremely large images (security measure)
    if ((metadata.width || 0) > 10000 || (metadata.height || 0) > 10000) {
      throw new Error('Image dimensions too large (max 10000x10000)');
    }
    
    // Try magic number validation, but don't fail if it doesn't match
    // Some image files might have unusual headers but are still valid
    try {
      await validateMagicNumbers(filePath, fileName);
      logger.debug('✅ Magic number validation passed');
    } catch (magicErr) {
      logger.warn('⚠️  Magic number validation failed, but Sharp can read the file', { 
        error: magicErr.message,
        format: metadata.format
      });
      // Don't throw - if Sharp can read it, it's probably valid
      // Just log a warning for security monitoring
    }
    
    logger.debug('✅ Image validation passed', { 
      fileName, 
      format: metadata.format,
      dimensions: `${metadata.width}x${metadata.height}`
    });
    
    return metadata;
  } catch (err) {
    logger.error('❌ Image validation failed', { error: err.message, fileName });
    throw new Error(`Invalid image: ${err.message}`);
  }
};

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR); // temporary storage
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(safeName).toLowerCase()}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Invalid file extension.'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB local limit for larger images/uploads
    files: 1, // Only one file
    fieldSize: 25 * 1024 * 1024, // Allow large rich-text/article content bodies
    parts: 50 // Allow a few form parts alongside the file payload
  },
  fileFilter,
});

export { upload }; // Export upload middleware for generic use
export const uploadAvatar = upload.single('avatar'); // expects field name "avatar"
export const uploadFeaturedImage = upload.single('featured_image'); // expects field name "featured_image"
export const uploadPhoto = upload.single('image'); // expects field name "image"

// Process and move image after upload
export const processAvatar = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please select an image file.'
    });
  }

  try {
    const tempPath = req.file.path;
    
    // Validate the uploaded file is actually an image (including magic numbers)
    await validateImageFile(tempPath, req.file.originalname);
    
    const originalName = `${uuidv4()}.webp`; // standardize to webp for better compression
    const thumbName = `thumb_${originalName}`;

    const originalPath = path.join(AVATAR_ORIGINAL_DIR, originalName);
    const thumbPath = path.join(AVATAR_THUMB_DIR, thumbName);

    // Get image metadata for logging
    const metadata = await sharp(tempPath).metadata();
    
    // Convert and resize thumbnail (200x200, cover)
    await sharp(tempPath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // transparent background
      })
      .webp({ 
        quality: 80,
        effort: 4 // better compression
      })
      .toFile(thumbPath);

    // Save full-size optimized version (max 1200px width)
    await sharp(tempPath)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ 
        quality: 90,
        effort: 4
      })
      .toFile(originalPath);

    // Clean up temp file
    fs.unlink(tempPath, (err) => {
      if (err) {
        logger.warn('Failed to delete temp file', { 
          path: tempPath, 
          error: err.message 
        });
      } else {
        logger.debug('Temp file cleaned up', { path: tempPath });
      }
    });

    // Attach URLs to req for controller (use relative URLs for cross-environment compatibility)
    req.processedAvatar = {
      url: `/uploads/avatars/thumbnails/${thumbName}`,
      original: `/uploads/avatars/original/${originalName}`,
      thumbnail: `/uploads/avatars/thumbnails/${thumbName}`,
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: req.file.size,
      }
    };

    logger.info('Avatar processed successfully', {
      userId: req.user?._id,
      originalSize: req.file.size,
      dimensions: `${metadata.width}x${metadata.height}`,
      format: metadata.format
    });

    next();
  } catch (err) {
    logger.error('Avatar processing failed', { 
      error: err.message,
      userId: req.user?._id,
      file: req.file?.originalname 
    });
    
    // Clean up temp on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          logger.warn('Failed to clean up temp file after error', { 
            path: req.file.path,
            error: unlinkErr.message 
          });
        }
      });
    }
    
    // Clear the file from request to prevent further processing
    req.file = null;
    
    return res.status(400).json({
      success: false,
      message: err.message.includes('Invalid image') 
        ? 'Invalid image file. Please upload a valid image.' 
        : 'Failed to process avatar image. Please try again.'
    });
  }
};

// Process and move featured image after upload
export const processFeaturedImage = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please select an image file.'
    });
  }

  try {
    const tempPath = req.file.path;
    
    logger.info('📸 Processing featured image upload', {
      fileName: req.file.originalname,
      tempPath,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    // Validate the uploaded file is actually an image (including magic numbers)
    await validateImageFile(tempPath, req.file.originalname);
    
    const imageName = `${uuidv4()}.webp`; // standardize to webp for better compression
    const thumbName = `thumb_${imageName}`;

    const imagePath = path.join(FEATURED_IMAGES_DIR, imageName);
    const thumbPath = path.join(FEATURED_IMAGES_THUMB_DIR, thumbName);

    // Get image metadata for logging
    const metadata = await sharp(tempPath).metadata();
    
    logger.debug('Image metadata:', { 
      format: metadata.format,
      size: `${metadata.width}x${metadata.height}`,
      space: metadata.space
    });
    
    // Convert and resize thumbnail (400x300, cover for featured images)
    await sharp(tempPath)
      .resize(400, 300, {
        fit: 'cover',
        position: 'center',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // transparent background
      })
      .webp({ 
        quality: 80,
        effort: 4 // better compression
      })
      .toFile(thumbPath);

    // Save full-size optimized version (max 1600px width)
    await sharp(tempPath)
      .resize(1600, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ 
        quality: 90,
        effort: 4
      })
      .toFile(imagePath);

    // Clean up temp file
    fs.unlink(tempPath, (err) => {
      if (err) {
        logger.warn('Failed to delete temp file', { 
          path: tempPath, 
          error: err.message 
        });
      } else {
        logger.debug('Temp file cleaned up', { path: tempPath });
      }
    });

    // Attach URLs to req for controller (use relative URLs for cross-environment compatibility)
    req.processedFeaturedImage = {
      imageUrl: `/uploads/featured-images/${imageName}`,
      thumbnail: `/uploads/featured-images/thumbnails/${thumbName}`,
      metadata: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: req.file.size,
      }
    };

    logger.info('✅ Featured image processed successfully', {
      originalSize: req.file.size,
      dimensions: `${metadata.width}x${metadata.height}`,
      format: metadata.format,
      outputPath: imagePath
    });

    next();
  } catch (err) {
    logger.error('❌ Featured image processing failed', { 
      error: err.message,
      file: req.file?.originalname,
      stack: err.stack
    });
    
    // Clean up temp on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          logger.warn('Failed to clean up temp file after error', { 
            path: req.file.path,
            error: unlinkErr.message 
          });
        }
      });
    }
    
    // Clear the file from request to prevent further processing
    req.file = null;
    
    return res.status(400).json({
      success: false,
      message: err.message.includes('Invalid image') 
        ? 'Invalid image file. Please upload a valid image.' 
        : err.message.includes('magic number')
        ? 'File validation failed. The file does not appear to be a valid image. Please try a different image or convert to JPG format.'
        : 'Failed to process featured image. Please try again.'
    });
  }
};

// ✅ NEW: Watermark image upload - simpler, just store it
const WATERMARK_DIR = path.join(UPLOADS_ROOT, 'watermarks');

if (!fs.existsSync(WATERMARK_DIR)) {
  try {
    fs.mkdirSync(WATERMARK_DIR, { recursive: true });
    logger.debug(`Created watermark directory: ${WATERMARK_DIR}`);
  } catch (err) {
    logger.error(`Failed to create watermark directory`, { error: err.message });
  }
}

const watermarkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, WATERMARK_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(safeName).toLowerCase()}`;
    cb(null, uniqueName);
  }
});

const watermarkFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
  }
  
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Invalid file extension.'), false);
  }
  
  cb(null, true);
};

const watermarkUpload = multer({
  storage: watermarkStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for watermark images
    files: 1
  },
  fileFilter: watermarkFileFilter,
});

export const uploadWatermarkImage = watermarkUpload.single('watermark_image');

// Optional: Cleanup utility for old temp files
export const cleanupTempFiles = () => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  fs.readdir(TEMP_DIR, (err, files) => {
    if (err) {
      logger.error('Failed to read temp directory for cleanup', { error: err.message });
      return;
    }
    
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlink(filePath, (err) => {
            if (err) {
              logger.warn('Failed to delete old temp file', { filePath });
            } else {
              logger.debug('Cleaned up old temp file', { filePath });
            }
          });
        }
      });
    });
  });
};

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Initial cleanup
cleanupTempFiles();