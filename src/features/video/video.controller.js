// src/features/video/video.controller.js
import Video from './video.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';

// Get all active videos (public) - FAST CACHED with pagination
export const getVideos = async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const parsedSkip = Math.max(0, parseInt(skip) || 0);

    // Try cache first - use combined key for pagination
    const cacheKey = `videos:active:limit:${parsedLimit}:skip:${parsedSkip}`;
    const cachedData = await cache.get(cacheKey);
    
    if (cachedData) {
      // Set no-cache headers for immediate updates
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Cache': 'HIT'
      });
      return res.status(200).json({
        success: true,
        ...cachedData,
        cached: true
      });
    }

    // Get total count for pagination
    const total = await Video.countDocuments({ isActive: true });

    // Get paginated videos from database
    const videos = await Video.find({ isActive: true })
      .select('videoUrl title description order')
      .sort({ order: 1, createdAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit)
      .lean()
      .then(vids => vids.map(video => ({
        ...video,
        embedUrl: `https://www.youtube.com/embed/${video.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&\n?#]+)/)?.[1]}`
      })));

    const responseData = {
      data: videos,
      total,
      page: Math.floor(parsedSkip / parsedLimit) + 1,
      limit: parsedLimit
    };

    // Cache for 2 hours
    await cache.set(cacheKey, responseData, 7200);

    // Set no-cache headers for immediate updates
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache': 'MISS'
    });

    res.status(200).json({
      success: true,
      ...responseData,
      cached: false
    });
  } catch (error) {
    logger.error('Error in getVideos:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos'
    });
  }
};

// Get single video
export const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id).select('videoUrl title description order isActive');

    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Add computed fields
    const videoData = video.toObject();
    videoData.embedUrl = video.getEmbedUrl();
    videoData.thumbnailUrl = video.getThumbnailUrl();

    res.status(200).json({
      success: true,
      data: videoData
    });
  } catch (error) {
    logger.error('Error in getVideoById:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video'
    });
  }
};

// Get all videos - Admin only
export const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.getAllVideosAdmin();

    res.status(200).json({
      success: true,
      data: videos,
      total: videos.length
    });
  } catch (error) {
    logger.error('Error in getAllVideos:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch videos'
    });
  }
};

// Create video - Admin only
export const createVideo = async (req, res) => {
  try {
    const { videoUrl, title, description } = req.body;

    // Validate required fields
    if (!videoUrl || !title) {
      return res.status(400).json({
        success: false,
        error: 'Video URL and title are required'
      });
    }

    // Get next order number
    const maxOrderVideo = await Video.findOne().sort({ order: -1 });
    const nextOrder = (maxOrderVideo?.order || 0) + 1;

    const newVideo = new Video({
      videoUrl,
      title,
      description: description || '',
      order: nextOrder,
      isActive: true
    });

    const savedVideo = await newVideo.save();

    // Add computed fields
    const videoData = savedVideo.toObject();
    videoData.embedUrl = savedVideo.getEmbedUrl();
    videoData.thumbnailUrl = savedVideo.getThumbnailUrl();

    // Invalidate cache
    await cache.delPattern('videos:*');

    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      data: videoData
    });
  } catch (error) {
    logger.error('Error in createVideo:', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create video'
    });
  }
};

// Update video - Admin only
export const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { videoUrl, title, description, order, isActive } = req.body;

    const video = await Video.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Update fields
    if (videoUrl) video.videoUrl = videoUrl;
    if (title) video.title = title;
    if (description) video.description = description;
    if (order !== undefined) video.order = order;
    if (isActive !== undefined) video.isActive = isActive;

    const updatedVideo = await video.save();

    // Add computed fields
    const videoData = updatedVideo.toObject();
    videoData.embedUrl = updatedVideo.getEmbedUrl();
    videoData.thumbnailUrl = updatedVideo.getThumbnailUrl();

    // Invalidate cache
    await cache.delPattern('videos:*');

    res.status(200).json({
      success: true,
      message: 'Video updated successfully',
      data: videoData
    });
  } catch (error) {
    logger.error('Error in updateVideo:', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update video'
    });
  }
};

// Delete video - Admin only
export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findByIdAndDelete(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Invalidate cache
    await cache.delPattern('videos:*');

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    logger.error('Error in deleteVideo:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete video'
    });
  }
};

// Reorder videos - Admin only
export const reorderVideos = async (req, res) => {
  try {
    const { videoIds } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid videoIds array'
      });
    }

    // Update order for each video
    await Promise.all(
      videoIds.map((id, index) =>
        Video.findByIdAndUpdate(id, { order: index })
      )
    );

    // Invalidate cache
    await cache.delPattern('videos:*');

    res.status(200).json({
      success: true,
      message: 'Videos reordered successfully'
    });
  } catch (error) {
    logger.error('Error in reorderVideos:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reorder videos'
    });
  }
};
