// src/utils/inline-images.util.js
// Rich-text editors paste images as base64 data URLs. Stored in MongoDB they
// made blog documents up to 1 MB and every page slow. These helpers move such
// images into uploads/ as WebP files and put a normal URL in their place.

import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs-extra';
import sharp from 'sharp';
import { logger } from './logger.util.js';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i;
const INLINE_SRC_PATTERN = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi;
const MAX_WIDTH = 1920;

export const isDataUrlImage = (value) => typeof value === 'string' && DATA_URL_PATTERN.test(value);

/**
 * Saves one data:image URL under uploads/<folder>/ and returns its public path
 * (/uploads/<folder>/inline-<hash>.webp). The name is a content hash, so the
 * same image is stored once and re-running is harmless.
 */
export async function saveDataUrlImage(dataUrl, folder) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1).replace(/\s/g, '');
  const input = Buffer.from(base64, 'base64');
  const hash = crypto.createHash('sha1').update(input).digest('hex').slice(0, 20);
  const fileName = `inline-${hash}.webp`;
  const targetDir = path.join(UPLOADS_ROOT, folder);
  const targetPath = path.join(targetDir, fileName);

  if (!(await fs.pathExists(targetPath))) {
    await fs.ensureDir(targetDir);
    const output = await sharp(input, { animated: true })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await fs.writeFile(targetPath, output);
  }

  return `/uploads/${folder}/${fileName}`;
}

/** Replaces every inline data:image in an HTML string with a saved file URL. */
export async function replaceInlineImages(html, folder) {
  if (typeof html !== 'string' || !html.includes('data:image')) return html;

  const matches = [...new Set(html.match(INLINE_SRC_PATTERN) || [])];
  let result = html;
  for (const dataUrl of matches) {
    try {
      const url = await saveDataUrlImage(dataUrl, folder);
      result = result.split(dataUrl).join(url);
    } catch (err) {
      // Keep the original (still renders) rather than lose the image.
      logger.warn('Could not extract inline image', { folder, error: err.message });
    }
  }
  return result;
}

/** For `{ url }` image fields: saves a data URL and returns the file URL; other values pass through. */
export async function resolveImageUrl(value, folder) {
  if (!isDataUrlImage(value)) return value;
  try {
    return await saveDataUrlImage(value, folder);
  } catch (err) {
    logger.warn('Could not save image data URL', { folder, error: err.message });
    return value;
  }
}

/** Applies resolveImageUrl to `{ url }` objects and arrays of them. */
export async function resolveImageObjects(value, folder) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveImageObjects(item, folder)));
  if (value && typeof value === 'object' && 'url' in value) {
    return { ...value, url: await resolveImageUrl(value.url, folder) };
  }
  return value;
}
