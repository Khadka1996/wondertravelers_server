import Destination from './destination.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';

const CACHE_TTL = 3600; // 1 hour for destinations
const FEATURED_CACHE_TTL = 7200; // 2 hours for featured

/**
 * @desc   Get all published destinations (with filters & pagination)
 * @route  GET /api/destinations/public
 * @access Public
 * @query  category, skip, limit, sort, search
 */
export const getDestinations = async (req, res) => {
  try {
    const { category, skip = 0, limit = 12, sort = '-createdAt', search } = req.query;

    // Build query
    let query = Destination.find({ published: true });
    
    if (category && category !== 'All') {
      query = query.where('category').equals(category);
    }

    // Add search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
      query = query.where('$or', [
        { name: searchRegex },
        { shortDesc: searchRegex },
        { longDesc: searchRegex },
        { category: searchRegex }
      ]);
      console.log(`🔍 Search filter applied for: "${search}"`);
    }

    // Get total count
    const total = await Destination.countDocuments(query);

    // Execute query
    const destinations = await query
      .select('name slug category shortDesc image rating reviewCount featured _id')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort(sort)
      .lean();

    const result = {
      success: true,
      total,
      count: destinations.length,
      destinations,
      hasMore: parseInt(skip) + parseInt(limit) < total
    };

    console.log(`✅ Destinations fetched: ${destinations.length} out of ${total} total`);

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    logger.error('Get destinations error:', { error: error.message });
    console.error('❌ Destinations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get featured destinations only
 * @route  GET /api/destinations/featured
 * @access Public
 */
export const getFeaturedDestinations = async (req, res) => {
  try {
    const destinations = await Destination.find({
      published: true,
      featured: true
    })
      .select('name slug category shortDesc image rating reviewCount featured _id')
      .limit(6)
      .sort('-createdAt')
      .lean();

    const result = {
      success: true,
      count: destinations.length,
      destinations
    };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    logger.error('Get featured destinations error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get all available categories
 * @route  GET /api/destinations/categories
 * @access Public
 */
export const getCategories = async (req, res) => {
  try {
    const categories = await Destination.distinct('category', { published: true });
    const sorted = categories.sort();

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .json({
        success: true,
        categories: sorted
      });
  } catch (error) {
    logger.error('Get categories error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get all destinations (published & unpublished) - ADMIN ONLY
 * @route  GET /api/destinations/admin/all
 * @access Admin/Super Admin
 * @query  category, skip, limit, sort
 */
export const getAllDestinationsAdmin = async (req, res) => {
  try {
    const { category, skip = 0, limit = 100, sort = '-createdAt' } = req.query;

    // Build query - NO published filter
    let query = Destination.find();
    
    if (category && category !== 'All') {
      query = query.where('category').equals(category);
    }

    // Get total count
    const total = await Destination.countDocuments(query);

    // Execute query with all fields
    const destinations = await query
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort(sort)
      .lean();

    const result = {
      success: true,
      total,
      count: destinations.length,
      destinations,
      hasMore: parseInt(skip) + parseInt(limit) < total
    };

    res.json(result);
  } catch (error) {
    logger.error('Get all destinations (admin) error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get single destination by slug
 * @route  GET /api/destinations/public/:slug
 * @access Public
 */
export const getDestinationBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const destination = await Destination.findOne({ slug, published: true })
      .select('-__v')
      .lean();

    if (!destination) {
      return res.status(404).json({ success: false, message: 'Destination not found' });
    }

    // Increment views
    await Destination.updateOne({ _id: destination._id }, { $inc: { 'engagement.views': 1 } });

    const result = { success: true, destination };

    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .set('X-Cache', 'MISS')
      .json(result);
  } catch (error) {
    logger.error('Get destination by slug error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Create new destination (admin only)
 * @route  POST /api/destinations
 * @access Admin
 */
export const createDestination = async (req, res) => {
  try {
    const { name, category, shortDesc, longDesc, image, featured = false, published = false } = req.body;

    // Validate required fields
    if (!name || !category || !shortDesc || !image) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, shortDesc, and image are required'
      });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    // Check if slug already exists
    const existing = await Destination.findOne({ slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A destination with this name already exists'
      });
    }

    const destination = new Destination({
      name,
      slug,
      category,
      shortDesc,
      longDesc,
      image,
      featured,
      published,
      createdBy: req.user._id
    });

    await destination.save();

    // Invalidate caches
    await cache.del('destinations:*');
    await cache.del('destinations:categories');

    logger.info('Destination created', { destId: destination._id, slug: destination.slug });

    res.status(201).json({
      success: true,
      message: 'Destination created successfully',
      destination
    });
  } catch (error) {
    logger.error('Create destination error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Update destination (admin only)
 * @route  PUT /api/destinations/:id
 * @access Admin
 */
export const updateDestination = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'name', 'category', 'shortDesc', 'longDesc', 'image',
      'rating', 'reviewCount', 'gallery', 'activities',
      'difficulty', 'duration', 'altitude', 'location',
      'bestToVisit', 'featured', 'published', 'seo'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    });

    updateData.updatedBy = req.user._id;

    const destination = await Destination.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    // Invalidate caches
    await cache.del(`destination:${destination.slug}`);
    await cache.del('destinations:*');
    await cache.del('destinations:categories');

    logger.info('Destination updated', { destId: destination._id });

    res.json({
      success: true,
      message: 'Destination updated successfully',
      destination
    });
  } catch (error) {
    logger.error('Update destination error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Delete destination (admin only)
 * @route  DELETE /api/destinations/:id
 * @access Admin
 */
export const deleteDestination = async (req, res) => {
  try {
    const { id } = req.params;

    const destination = await Destination.findByIdAndDelete(id);

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    // Invalidate caches
    await cache.del(`destination:${destination.slug}`);
    await cache.del('destinations:*');
    await cache.del('destinations:categories');

    logger.info('Destination deleted', { destId: id });

    res.json({
      success: true,
      message: 'Destination deleted successfully'
    });
  } catch (error) {
    logger.error('Delete destination error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Record destination view
 * @route  POST /api/destinations/:id/view
 * @access Public
 */
export const recordDestinationView = async (req, res) => {
  try {
    const { id } = req.params;

    const destination = await Destination.findByIdAndUpdate(
      id,
      { $inc: { 'engagement.views': 1 } },
      { new: true }
    ).lean();

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    res.json({
      success: true,
      views: destination.engagement.views
    });
  } catch (error) {
    logger.error('Record view error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Save destination (user only)
 * @route  POST /api/destinations/:id/save
 * @access User
 */
export const saveDestination = async (req, res) => {
  try {
    const { id } = req.params;

    const destination = await Destination.findByIdAndUpdate(
      id,
      { $inc: { 'engagement.saves': 1 } },
      { new: true }
    ).lean();

    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    res.json({
      success: true,
      saves: destination.engagement.saves
    });
  } catch (error) {
    logger.error('Save destination error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getDestinations,
  getFeaturedDestinations,
  getCategories,
  getDestinationBySlug,
  createDestination,
  updateDestination,
  deleteDestination,
  recordDestinationView,
  saveDestination
};
