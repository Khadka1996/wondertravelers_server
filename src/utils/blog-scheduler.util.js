// src/utils/blog-scheduler.util.js
/**
 * Blog Scheduler Utility
 * Automatically publishes scheduled blogs when their scheduled time arrives
 */

import cron from 'node-cron';
import { logger } from './logger.util.js';
import Blog from '../features/blog/blog.model.js';

let schedulerJob = null;

/**
 * Initialize blog scheduler
 * Runs every minute to check for blogs that should be published
 */
export const initializeBlogScheduler = () => {
  try {
    // Run every minute: '* * * * *'
    // Or every 5 minutes: '*/5 * * * *'
    schedulerJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await Blog.publishScheduledBlogs();
        if (result.modifiedCount > 0) {
          logger.info(`📅 Blog Scheduler: Published ${result.modifiedCount} scheduled blog(s)`);
        }
      } catch (error) {
        logger.error('Blog Scheduler Error:', error.message);
      }
    });

    logger.info('✅ Blog Scheduler initialized - runs every 5 minutes');
    return schedulerJob;
  } catch (error) {
    logger.error('Failed to initialize blog scheduler:', error.message);
    return null;
  }
};

/**
 * Stop the scheduler (useful for testing or graceful shutdown)
 */
export const stopBlogScheduler = () => {
  if (schedulerJob) {
    schedulerJob.stop();
    logger.info('⏹️ Blog Scheduler stopped');
    return true;
  }
  return false;
};

/**
 * Manually trigger blog publishing (for testing or manual sync)
 */
export const triggerBlogPublishing = async () => {
  try {
    const result = await Blog.publishScheduledBlogs();
    logger.info(`Manual trigger: ${result.message}`);
    return result;
  } catch (error) {
    logger.error('Manual trigger error:', error.message);
    throw error;
  }
};

export default {
  initializeBlogScheduler,
  stopBlogScheduler,
  triggerBlogPublishing
};
