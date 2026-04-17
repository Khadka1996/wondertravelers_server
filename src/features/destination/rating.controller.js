import mongoose from 'mongoose';
import Rating from './rating.model.js';
import Destination from './destination.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';

/**
 * @desc   Get all ratings for a destination
 * @route  GET /api/destinations/:id/ratings
 * @access Public
 * @query  skip, limit, sort
 */
export const getDestinationRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const { skip = 0, limit = 10, sort = '-createdAt' } = req.query;

    // Verify destination exists
    const destination = await Destination.findById(id).lean();
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    const ratings = await Rating.find({
      destination: id
    })
      .populate('user', 'name avatar')
      .select('-__v')
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort(sort)
      .lean();

    const total = await Rating.countDocuments({
      destination: id
    });

    // Calculate rating distribution
    const distribution = await Rating.aggregate([
      { $match: { destination: id } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      success: true,
      total,
      count: ratings.length,
      hasMore: parseInt(skip) + parseInt(limit) < total,
      distribution: distribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      ratings
    });
  } catch (error) {
    logger.error('Get ratings error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Submit/Create a rating for destination
 * @route  POST /api/destinations/:id/ratings
 * @access User (authenticated)
 */
export const rateDestination = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Verify destination exists
    const destination = await Destination.findById(id);
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }

    // Check if user already rated this destination
    let existingRating = await Rating.findOne({
      destination: id,
      user: req.user._id
    });

    if (existingRating) {
      // Update existing rating
      console.log('🔄 Updating existing rating...', { ratingId: existingRating._id, newRating: rating });
      existingRating.rating = rating;
      existingRating.review = review || existingRating.review;
      await existingRating.save();
      console.log('✅ Existing rating updated');

      // Recalculate destination stats
      console.log('🔄 Aggregating all ratings for destination:', id);
      const stats = await Rating.aggregate([
        { $match: { destination: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: '$destination',
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ]);

      console.log('📊 Aggregation stats:', stats);

      if (stats.length > 0) {
        console.log('🔄 Updating destination with:', {
          rating: parseFloat(stats[0].avgRating.toFixed(1)),
          reviewCount: stats[0].count
        });
        const updateResult = await Destination.findByIdAndUpdate(id, {
          rating: parseFloat(stats[0].avgRating.toFixed(1)),
          reviewCount: stats[0].count
        }, { new: true });
        console.log('✅ Destination updated:', {
          rating: updateResult.rating,
          reviewCount: updateResult.reviewCount
        });
      }

      // Invalidate cache
      await cache.del(`destination:${destination.slug}`);
      await cache.del('destinations:*');

      return res.json({
        success: true,
        message: 'Rating updated successfully',
        rating: existingRating
      });
    }

    // Create new rating
    const newRating = new Rating({
      destination: id,
      user: req.user._id,
      rating,
      review: review || null
    });

    console.log('💾 Saving new rating...', { destId: id, rating, userId: req.user._id });
    await newRating.save();

    // Populate user details
    await newRating.populate('user', 'name avatar');
    console.log('✅ Rating saved with ID:', newRating._id);

    // Recalculate destination stats after new rating
    console.log('🔄 Aggregating all ratings for destination:', id);
    const stats = await Rating.aggregate([
      { $match: { destination: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: '$destination',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📊 Aggregation stats:', stats);

    if (stats.length > 0) {
      console.log('🔄 Updating destination with:', {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        reviewCount: stats[0].count
      });
      const updateResult = await Destination.findByIdAndUpdate(id, {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        reviewCount: stats[0].count
      }, { new: true });
      console.log('✅ Destination updated:', {
        rating: updateResult.rating,
        reviewCount: updateResult.reviewCount
      });
    } else {
      console.warn('⚠️ No stats found after aggregation');
    }

    // Invalidate cache
    await cache.del(`destination:${destination.slug}`);
    await cache.del('destinations:*');
    console.log('🧹 Cache invalidated');

    logger.info('Destination rated', {
      destId: id,
      userId: req.user._id,
      rating
    });

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      rating: newRating
    });
  } catch (error) {
    logger.error('Rate destination error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Get user's rating for a destination
 * @route  GET /api/destinations/:id/my-rating
 * @access User (authenticated)
 */
export const getUserRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await Rating.findOne({
      destination: id,
      user: req.user._id
    }).lean();

    if (!rating) {
      return res.json({
        success: true,
        rating: null,
        message: 'User has not rated this destination'
      });
    }

    res.json({
      success: true,
      rating
    });
  } catch (error) {
    logger.error('Get user rating error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Delete user's rating
 * @route  DELETE /api/destinations/:id/ratings/:ratingId
 * @access User (owner only)
 */
export const deleteRating = async (req, res) => {
  try {
    const { id, ratingId } = req.params;

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Check if user is the owner
    if (rating.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own ratings'
      });
    }

    // Store destination info before deletion
    const destinationId = rating.destination;

    await Rating.findByIdAndDelete(ratingId);

    // Recalculate destination rating
    const stats = await Rating.aggregate([
      { $match: { destination: destinationId } },
      {
        $group: {
          _id: '$destination',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Destination.findByIdAndUpdate(destinationId, {
        rating: parseFloat(stats[0].avgRating.toFixed(1)),
        reviewCount: stats[0].count
      });
    } else {
      // No more ratings, reset
      await Destination.findByIdAndUpdate(destinationId, {
        rating: 0,
        reviewCount: 0
      });
    }

    // Invalidate cache
    const destination = await Destination.findById(destinationId).lean();
    if (destination) {
      await cache.del(`destination:${destination.slug}`);
      await cache.del('destinations:*');
    }

    logger.info('Rating deleted', { ratingId, userId: req.user._id });

    res.json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    logger.error('Delete rating error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Mark rating as helpful
 * @route  POST /api/destinations/:id/ratings/:ratingId/helpful
 * @access Public
 */
export const markHelpful = async (req, res) => {
  try {
    const { ratingId } = req.params;

    const rating = await Rating.findByIdAndUpdate(
      ratingId,
      { $inc: { helpful: 1 } },
      { new: true }
    ).lean();

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    res.json({
      success: true,
      helpful: rating.helpful
    });
  } catch (error) {
    logger.error('Mark helpful error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc   Mark rating as unhelpful
 * @route  POST /api/destinations/:id/ratings/:ratingId/unhelpful
 * @access Public
 */
export const markUnhelpful = async (req, res) => {
  try {
    const { ratingId } = req.params;

    const rating = await Rating.findByIdAndUpdate(
      ratingId,
      { $inc: { unhelpful: 1 } },
      { new: true }
    ).lean();

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    res.json({
      success: true,
      unhelpful: rating.unhelpful
    });
  } catch (error) {
    logger.error('Mark unhelpful error:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getDestinationRatings,
  rateDestination,
  getUserRating,
  deleteRating,
  markHelpful,
  markUnhelpful
};
