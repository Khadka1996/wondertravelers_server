import Advertisement from './advertisement.model.js';
import cache from '../../utils/cache.util.js';

const CACHE_TTL = 3600; // 1 hour

/**
 * Get advertisements by position (public)
 * GET /api/advertisements/position/:position
 */
export const getAdsByPosition = async (req, res) => {
  try {
    const { position } = req.params;

    // Validate position
    const validPositions = [
      'homepage_top', 'homepage_banner', 'homepage_bottom',
      'photo_top', 'photo_bottom', 'photo_sidebar',
      'video_top', 'video_bottom', 'video_sidebar',
      'destination_top', 'destination_sidebar_1', 'destination_sidebar_2',
      'destination_inside',
      'explore_top', 'explore_bottom',
      'blog_top', 'blog_bottom', 'blog_sidebar', 'blog_sidebar_1', 'blog_sidebar_2', 'blog_popup', 
      'blog_content_paragraph_1', 'blog_content_paragraph_2', 'blog_content_paragraph_3',
      'blog_content_paragraph_4', 'blog_content_paragraph_6', 'blog_content_paragraph_8', 
      'news_top', 'news_bottom', 'news_sidebar',
      'footer'
    ];

    if (!validPositions.includes(position)) {
      return res.status(400).json({ success: false, message: 'Invalid position' });
    }

    // Get active ads (lean for speed)
    const ads = await Advertisement.find({ position, isActive: true })
      .select('title image weblink clicks _id')
      .lean();

    const result = { success: true, position, count: ads.length, advertisements: ads };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record advertisement click
 * POST /api/advertisements/:id/click
 */
export const recordClick = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Advertisement.findByIdAndUpdate(
      id,
      { $inc: { clicks: 1 } },
      { new: true, select: 'clicks weblink' }
    ).lean();

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    res.json({ success: true, clicks: ad.clicks, redirect: ad.weblink });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all advertisements (admin)
 * GET /api/advertisements
 */
export const getAllAds = async (req, res) => {
  try {
    const { position, skip = 0, limit = 50 } = req.query;

    let query = {};
    if (position) query.position = position;

    const ads = await Advertisement.find(query)
      .select('title image weblink clicks isActive position createdAt')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await Advertisement.countDocuments(query);

    res.json({
      success: true,
      total,
      count: ads.length,
      advertisements: ads
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single advertisement (admin)
 * GET /api/advertisements/:id
 */
export const getAd = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id).lean();

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    res.json({ success: true, advertisement: ad });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create advertisement (admin)
 * POST /api/advertisements
 */
export const createAd = async (req, res) => {
  try {
    const { title, image, weblink, position, isActive } = req.body;

    if (!title || !image?.url || !weblink || !position) {
      return res.status(400).json({
        success: false,
        message: 'Title, image, weblink, and position are required'
      });
    }

    const ad = new Advertisement({
      title,
      image,
      weblink,
      position,
      isActive: isActive !== false,
      createdBy: req.user._id
    });

    await ad.save();

    res.status(201).json({
      success: true,
      message: 'Advertisement created',
      advertisement: ad
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update advertisement (admin)
 * PUT /api/advertisements/:id
 */
export const updateAd = async (req, res) => {
  try {
    const { title, image, weblink, position, isActive } = req.body;
    const allowedFields = { title, image, weblink, position, isActive };

    // Remove undefined fields
    Object.keys(allowedFields).forEach(
      key => allowedFields[key] === undefined && delete allowedFields[key]
    );

    const ad = await Advertisement.findByIdAndUpdate(
      req.params.id,
      allowedFields,
      { new: true, runValidators: true }
    );

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    res.json({
      success: true,
      message: 'Advertisement updated',
      advertisement: ad
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete advertisement (admin)
 * DELETE /api/advertisements/:id
 */
export const deleteAd = async (req, res) => {
  try {
    const ad = await Advertisement.findByIdAndDelete(req.params.id);

    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    res.json({ success: true, message: 'Advertisement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getAdsByPosition,
  recordClick,
  getAllAds,
  getAd,
  createAd,
  updateAd,
  deleteAd
};
