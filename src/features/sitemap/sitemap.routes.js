// src/features/sitemap/sitemap.routes.js
// Everything the website's sitemap.xml needs, in one small response:
// slugs, dates and the main image of every public post and destination.

import express from 'express';
import Blog from '../blog/blog.model.js';
import Destination from '../destination/destination.model.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [posts, destinations] = await Promise.all([
      Blog.find({ status: 'published', slug: { $exists: true, $ne: '' } })
        .select('slug type title featuredImage publishedAt updatedAt -_id')
        .sort({ publishedAt: -1 })
        .lean(),
      Destination.find({ published: true, slug: { $exists: true, $ne: '' } })
        .select('slug name image.url updatedAt -_id')
        .lean(),
    ]);

    res.set('Cache-Control', 'public, max-age=900');
    res.json({
      success: true,
      posts,
      destinations: destinations.map(({ image, ...rest }) => ({
        ...rest,
        // Inline base64 images are not URLs; leave them out until migrated.
        image: image?.url && !image.url.startsWith('data:') ? image.url : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
