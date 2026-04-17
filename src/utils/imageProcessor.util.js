/**
 * Image Processing Utility
 * Handles converting base64 images to data URLs and generating thumbnails
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../../public/uploads');

/**
 * Ensure uploads directory exists
 */
export async function ensureUploadsDir() {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create uploads directory:', error);
  }
}

/**
 * Process base64 image and create thumbnail
 * For now, returns the base64 data URL as both full and thumbnail
 */
export async function processImageData(imageData) {
  if (!imageData) {
    return null;
  }

  // If it's already a stored image with thumbnail, return as is
  if (imageData.thumbnail && !imageData.data) {
    return {
      key: imageData.key,
      thumbnail: imageData.thumbnail,
      hasWatermark: imageData.hasWatermark || false
    };
  }

  // If it's new image data with base64
  if (imageData.data) {
    const dataUrl = imageData.data;
    
    // For now, use the base64 data URL directly as thumbnail
    // In production, you would:
    // 1. Save to disk or S3
    // 2. Generate actual thumbnails
    // 3. Return proper URLs

    return {
      key: imageData.key,
      thumbnail: dataUrl, // Use base64 as thumbnail for now
      hasWatermark: imageData.hasWatermark || false,
      type: imageData.type,
      size: imageData.size
    };
  }

  return null;
}

/**
 * Process multiple secondary images
 */
export async function processSecondaryImages(images) {
  if (!images || !Array.isArray(images)) {
    return [];
  }

  const processed = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const processedImg = await processImageData(img);
    if (processedImg) {
      processedImg.order = img.order !== undefined ? img.order : i;
      processed.push(processedImg);
    }
  }

  return processed;
}

/**
 * Validate image data
 */
export function validateImageData(imageData) {
  const errors = [];

  if (!imageData) {
    return errors;
  }

  if (!imageData.key) {
    errors.push('Image key is required');
  }

  if (imageData.size && imageData.size > 5 * 1024 * 1024) {
    errors.push('Image must be less than 5MB');
  }

  if (imageData.type && !imageData.type.startsWith('image/')) {
    errors.push('File must be an image');
  }

  return errors;
}

/**
 * Delete image file from disk (if stored)
 */
export async function deleteImageFile(imageKey) {
  if (!imageKey) return;

  try {
    const filePath = path.join(uploadsDir, imageKey);
    // Prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      return;
    }
    
    await fs.unlink(filePath);
  } catch (error) {
    // File may not exist or already deleted
    console.debug('Image file not found or already deleted:', imageKey);
  }
}
