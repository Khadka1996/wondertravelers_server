import { Router } from 'express';
import { CustomerBehaviorScore } from '../analytics/customer-behavior.model.js';
import { scoreCustomer, rescoreAllCustomers } from '../../services/customer-behavior.service.js';
import { logger } from '../../utils/logger.util.js';
import { authMiddleware } from '../auth/auth.middleware.js';
const { restrictTo: authorize } = authMiddleware;

const router = Router();

/**
 * Get customer behavior score and recommendations
 * GET /api/customer-behavior/:userId
 */
router.get('/:userId', (req, res, next) => authMiddleware.protect(req, res, next), async (req, res) => {
  try {
    const { userId } = req.params;

    // Check authorization (own profile or admin)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let score = await CustomerBehaviorScore.findOne({ user: userId })
      .populate('user', 'email name')
      .populate('purchaseBehavior.favoriteCategories');

    // If no score exists or it's stale, create new one
    if (!score || (score.nextScoringAt && score.nextScoringAt < new Date())) {
      score = await scoreCustomer(userId);
      score = await score.populate('user', 'email name');
    }

    res.json({
      success: true,
      data: score
    });
  } catch (err) {
    logger.error('Failed to get customer score', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve customer score' });
  }
});

/**
 * Get recommendations for customer
 * GET /api/customer-behavior/:userId/recommendations
 */
router.get('/:userId/recommendations', (req, res, next) => authMiddleware.protect(req, res, next), async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const score = await CustomerBehaviorScore.findOne({ user: userId });

    if (!score) {
      return res.status(404).json({ error: 'No behavior score found' });
    }

    // Filter pending recommendations
    const pendingRecommendations = score.recommendedActions.filter(
      a => !a.actionTaken && !a.result
    ).sort((a, b) => {
      const priorityMap = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });

    res.json({
      success: true,
      segment: score.segment,
      riskLevel: score.churnRisk.riskLevel,
      riskScore: score.churnRisk.riskScore,
      ltv: score.ltv.projectedLTV,
      recommendations: pendingRecommendations
    });
  } catch (err) {
    logger.error('Failed to get recommendations', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

/**
 * Mark recommendation as actioned
 * PATCH /api/customer-behavior/:userId/recommendations/:actionId
 */
router.patch('/:userId/recommendations/:actionId', (req, res, next) => authMiddleware.protect(req, res, next), authorize('admin'), async (req, res) => {
  try {
    const { userId, actionId } = req.params;
    const { actionTaken, result } = req.body;

    const score = await CustomerBehaviorScore.findOne({ user: userId });
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }

    const action = score.recommendedActions.id(actionId);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    action.actionTaken = actionTaken !== undefined ? actionTaken : true;
    action.actionTakenAt = new Date();
    action.result = result || 'pending';

    await score.save();

    res.json({
      success: true,
      message: 'Recommendation updated',
      action
    });
  } catch (err) {
    logger.error('Failed to update recommendation', { error: err.message });
    res.status(500).json({ error: 'Failed to update recommendation' });
  }
});

/**
 * List at-risk customers
 * GET /api/customer-behavior/segments/at-risk
 */
router.get('/segments/at-risk', (req, res, next) => authMiddleware.protect(req, res, next), authorize('admin'), async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const atRiskCustomers = await CustomerBehaviorScore.find({
      segment: 'at_risk'
    })
      .populate('user', 'email name')
      .sort({ 'churnRisk.riskScore': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await CustomerBehaviorScore.countDocuments({ segment: 'at_risk' });

    res.json({
      success: true,
      data: atRiskCustomers,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip),
        total
      }
    });
  } catch (err) {
    logger.error('Failed to get at-risk customers', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve at-risk customers' });
  }
});

/**
 * List high-value customers
 * GET /api/customer-behavior/segments/high-value
 */
router.get('/segments/high-value', (req, res, next) => authMiddleware.protect(req, res, next), authorize('admin'), async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const highValueCustomers = await CustomerBehaviorScore.find({
      segment: 'high_value'
    })
      .populate('user', 'email name')
      .sort({ 'ltv.projectedLTV': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await CustomerBehaviorScore.countDocuments({ segment: 'high_value' });

    res.json({
      success: true,
      data: highValueCustomers,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip),
        total
      }
    });
  } catch (err) {
    logger.error('Failed to get high-value customers', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve high-value customers' });
  }
});

/**
 * Admin: Manually trigger customer re-scoring
 * POST /api/customer-behavior/admin/rescore
 */
router.post('/admin/rescore', (req, res, next) => authMiddleware.protect(req, res, next), authorize('admin'), async (req, res) => {
  try {
    logger.info('Admin triggered customer re-scoring');
    
    // Run async, don't wait
    rescoreAllCustomers().catch(err => logger.error('Async rescore failed', { error: err.message }));

    res.json({
      success: true,
      message: 'Customer re-scoring initiated. This may take several minutes.'
    });
  } catch (err) {
    logger.error('Failed to initiate re-scoring', { error: err.message });
    res.status(500).json({ error: 'Failed to initiate re-scoring' });
  }
});

/**
 * Get customer alerts
 * GET /api/customer-behavior/:userId/alerts
 */
router.get('/:userId/alerts', (req, res, next) => authMiddleware.protect(req, res, next), async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const score = await CustomerBehaviorScore.findOne({ user: userId });

    if (!score) {
      return res.status(404).json({ error: 'No behavior score found' });
    }

    const unresolvedAlerts = score.alerts.filter(a => !a.resolved);

    res.json({
      success: true,
      alerts: unresolvedAlerts
    });
  } catch (err) {
    logger.error('Failed to get alerts', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

export default router;
