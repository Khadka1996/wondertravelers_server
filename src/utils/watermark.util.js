import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.util.js';

/**
 * Apply text watermark to image with custom x/y offsets
 */
const applyTextWatermark = async (inputBuffer, options = {}) => {
  try {
    const {
      content = 'Wonder Travelers',
      xOffset = 30,
      yOffset = 30,
      fontSize = 40,
      opacity = 0.7,
      color = '#FFFFFF'
    } = options;

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // Create SVG text watermark (positioned at specified offsets)
    const textSvg = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .watermark {
              font-family: Arial, sans-serif;
              font-size: ${fontSize}px;
              font-weight: bold;
              fill: ${color};
              opacity: ${opacity};
            }
          </style>
        </defs>
        <text class="watermark" x="${width - xOffset}" y="${height - yOffset}" text-anchor="end">${content}</text>
      </svg>
    `);

    return image.composite([
      {
        input: textSvg
      }
    ]).toBuffer();
  } catch (error) {
    logger.error('Text watermark error:', { error: error.message });
    throw error;
  }
};

/**
 * Apply image watermark to image with custom x/y offsets
 */
const applyImageWatermark = async (inputBuffer, watermarkBuffer, xOffset = 30, yOffset = 30, opacity = 0.5) => {
  try {
    // Validate watermark buffer
    if (!watermarkBuffer || !Buffer.isBuffer(watermarkBuffer)) {
      throw new Error(`Invalid watermark buffer: expected Buffer, got ${typeof watermarkBuffer}`);
    }

    if (watermarkBuffer.length === 0) {
      throw new Error('Watermark buffer is empty');
    }

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // Resize watermark to 15% of image width
    const watermarkSize = Math.floor(width * 0.15);
    const watermarkImage = await sharp(watermarkBuffer)
      .resize(watermarkSize, watermarkSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Overlay image watermark at specified offsets (from bottom-right)
    return image.composite([
      {
        input: watermarkImage,
        left: width - watermarkSize - xOffset,
        top: height - watermarkSize - yOffset,
        opacity: opacity
      }
    ]).toBuffer();
  } catch (error) {
    logger.error('Image watermark error:', { 
      error: error.message,
      bufferType: watermarkBuffer ? typeof watermarkBuffer : 'undefined',
      isBuffer: watermarkBuffer ? Buffer.isBuffer(watermarkBuffer) : false,
      bufferLength: watermarkBuffer ? watermarkBuffer.length : 0
    });
    throw error;
  }
};

/**
 * Process photo: create optimized watermarked image and thumbnail
 * SIMPLIFIED: Single watermarked JPEG for display & download (no redundancy)
 */
export const processPhotoWithWatermark = async (
  inputBuffer,
  watermarkConfig = {},
  options = {}
) => {
  try {
    // Validate input buffer
    if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      throw new Error(`Invalid input buffer: ${inputBuffer ? 'not a buffer or empty' : 'undefined'}`);
    }

    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const { width: originalWidth, height: originalHeight } = metadata;

    logger.debug('Processing photo with watermark', {
      watermarkType: watermarkConfig.type,
      hasImageBuffer: !!watermarkConfig.imageBuffer,
      imageBufferType: watermarkConfig.imageBuffer ? typeof watermarkConfig.imageBuffer : 'undefined',
      imageBufferIsBuffer: watermarkConfig.imageBuffer ? Buffer.isBuffer(watermarkConfig.imageBuffer) : false,
      imageBufferSize: watermarkConfig.imageBuffer ? watermarkConfig.imageBuffer.length : 0,
      hasTextConfig: !!watermarkConfig.text,
      originalDimensions: `${originalWidth}x${originalHeight}`
    });

    // Step 1: Apply watermark (text or image)
    let watermarkedBuffer;
    
    // Validate and decide watermark type
    if (watermarkConfig.type === 'image' && watermarkConfig.imageBuffer && Buffer.isBuffer(watermarkConfig.imageBuffer)) {
      logger.debug('Applying image watermark', {
        bufferSize: watermarkConfig.imageBuffer.length,
        xOffset: watermarkConfig.imageXOffset || 30,
        yOffset: watermarkConfig.imageYOffset || 30
      });
      
      watermarkedBuffer = await applyImageWatermark(
        inputBuffer,
        watermarkConfig.imageBuffer,
        watermarkConfig.imageXOffset || 30,
        watermarkConfig.imageYOffset || 30,
        watermarkConfig.opacity || 0.5
      );
    } else {
      if (watermarkConfig.type === 'image' && !Buffer.isBuffer(watermarkConfig.imageBuffer)) {
        logger.warn('Image watermark configured but buffer invalid, falling back to text watermark', {
          bufferType: watermarkConfig.imageBuffer ? typeof watermarkConfig.imageBuffer : 'undefined',
          isBuffer: watermarkConfig.imageBuffer ? Buffer.isBuffer(watermarkConfig.imageBuffer) : false
        });
      }
      
      logger.debug('Applying text watermark', {
        content: watermarkConfig.text?.content || 'Wonder Travelers',
        xOffset: watermarkConfig.text?.xOffset || 30,
        yOffset: watermarkConfig.text?.yOffset || 30
      });
      
      watermarkedBuffer = await applyTextWatermark(
        inputBuffer,
        watermarkConfig.text || {}
      );
    }

    // Step 2: Create thumbnail (400px) - gallery preview
    const thumbnailBuffer = await sharp(watermarkedBuffer)
      .resize(400, 400, { fit: 'cover' })
      .toFormat('jpeg', { quality: 70, progressive: true })
      .toBuffer();

    // Step 3: Create main watermarked image - optimized for display & download
    // Scale down to 1600px max width if larger (high quality, fully optimized)
    const optimizedBuffer = await sharp(watermarkedBuffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .toFormat('jpeg', { quality: 88, progressive: true, mozjpeg: true })
      .toBuffer();

    // Get final dimensions for metadata
    const optimizedMetadata = await sharp(optimizedBuffer).metadata();

    return {
      watermarked: {
        buffer: optimizedBuffer,
        size: optimizedBuffer.length,
        width: optimizedMetadata.width,
        height: optimizedMetadata.height
      },
      thumbnail: {
        buffer: thumbnailBuffer,
        size: thumbnailBuffer.length
      }
    };
  } catch (error) {
    logger.error('Photo processing error:', { error: error.message });
    throw error;
  }
};

/**
 * Upload photo to local storage
 */
export const uploadPhotoFile = async (buffer, filename, subdir = 'photos') => {
  try {
    const uploadsDir = `./uploads/${subdir}`;
    
    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);

    // Return relative URL path
    return `/uploads/${subdir}/${filename}`;
  } catch (error) {
    logger.error('Photo upload error:', { error: error.message });
    throw error;
  }
};

/**
 * Delete photo files
 */
export const deletePhotoFiles = async (urls) => {
  try {
    for (const url of urls) {
      if (!url) continue;
      const filepath = path.join('.', url);
      try {
        await fs.unlink(filepath);
      } catch (err) {
        logger.warn('Could not delete file:', { filepath });
      }
    }
  } catch (error) {
    logger.error('Photo deletion error:', { error: error.message });
  }
};

export default {
  processPhotoWithWatermark,
  uploadPhotoFile,
  deletePhotoFiles
};
