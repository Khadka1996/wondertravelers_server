import Activity from './activity.model.js';

/**
 * Get user activity history
 * GET /api/activities/user
 */
export const getUserActivity = async (req, res) => {
  try {
    const { skip = 0, limit = 50 } = req.query;
    const userId = req.user._id;

    const { activities, total } = await Activity.getUserActivity(
      userId,
      parseInt(skip),
      parseInt(limit)
    );

    res.json({
      success: true,
      total,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get system-wide activity (admin only)
 * GET /api/activities
 */
export const getSystemActivity = async (req, res) => {
  try {
    const { skip = 0, limit = 100, action, resourceType, status } = req.query;

    const filters = {};
    if (action) filters.action = action;
    if (resourceType) filters.resourceType = resourceType;
    if (status) filters.status = status;

    const { activities, total } = await Activity.getSystemActivity(
      parseInt(skip),
      parseInt(limit),
      filters
    );

    res.json({
      success: true,
      total,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get activity by resource (admin)
 * GET /api/activities/resource/:resourceType/:resourceId
 */
export const getResourceActivity = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    const activities = await Activity.find({
      resourceType,
      resourceId
    })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get activity statistics (admin)
 * GET /api/activities/stats
 */
export const getActivityStats = async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stats24h = await Activity.countDocuments({ createdAt: { $gte: last24h } });
    const stats7d = await Activity.countDocuments({ createdAt: { $gte: last7d } });
    const statsTotal = await Activity.countDocuments();

    // Most active users
    const topUsers = await Activity.aggregate([
      { $match: { createdAt: { $gte: last7d } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }
    ]);

    // Most common actions
    const topActions = await Activity.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: {
        last24h: stats24h,
        last7d: stats7d,
        total: statsTotal,
        topUsers: topUsers,
        topActions: topActions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getUserActivity,
  getSystemActivity,
  getResourceActivity,
  getActivityStats
};
