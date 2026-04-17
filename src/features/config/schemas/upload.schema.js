// src/config/schemas/upload.schema.js
import { z } from 'zod';

export const uploadBodySchema = z.object({
  // If you send metadata with upload (optional)
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().min(2).max(30)).max(10).optional(),
});

export const uploadFileSchema = z.object({
  file: z.any().refine(
    (file) => file?.mimetype?.match(/^(image\/jpeg|image\/png|image\/webp)$/),
    { message: 'Only JPEG, PNG, WEBP allowed' }
  ).refine(
    (file) => file?.size <= 10 * 1024 * 1024,
    { message: 'File too large (max 10MB)' }
  ),
});