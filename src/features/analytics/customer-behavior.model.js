import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Customer Behavior Scoring Schema
 * Tracks comprehensive customer metrics for:
 * - Lifetime Value (LTV) calculation
 * - Churn risk assessment
 * - Purchase patterns
 * - Engagement metrics
 */
const customerBehaviorScoreSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // 📊 LIFETIME VALUE (LTV)
    ltv: {
      totalSpent: { type: Number, default: 0, index: true },
      totalOrders: { type: Number, default: 0 },
      averageOrderValue: { type: Number, default: 0 },
      projectedLTV: { type: Number, default: 0 }, // AI-predicted 12-month LTV
      ltaScore: { type: Number, default: 0, min: 0, max: 100 }, // Lifetime Account Score
      lastCalculatedAt: Date
    },

    // ⚠️ CHURN RISK
    churnRisk: {
      riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
      riskScore: { type: Number, default: 0, min: 0, max: 100 }, // 0=safe, 100=will churn
      daysAtRisk: { type: Number, default: 0 }, // Days showing risk patterns
      lastPurchaseGap: { type: Number, default: 0 }, // Days since last purchase
      predictedChurnDate: Date, // Estimated when customer will churn
      churnIndicators: [
        {
          indicator: String, // 'no_recent_activity', 'decreased_spending', 'support_complaints'
          severity: { type: String, enum: ['low', 'medium', 'high'] },
          detectedAt: { type: Date, default: Date.now }
        }
      ],
      lastAssessedAt: Date
    },

    // 📈 PURCHASE BEHAVIOR
    purchaseBehavior: {
      frequency: { type: String, enum: ['rare', 'occasional', 'regular', 'frequent'], default: 'occasional' },
      seasonality: [
        {
          month: Number,
          avgSpend: Number,
          orderCount: Number
        }
      ],
      favoriteCategories: [
        {
          category: Schema.Types.ObjectId,
          ref: 'Category',
          purchaseCount: Number,
          avgSpendPerCategory: Number
        }
      ],
      avgDaysBetweenOrders: { type: Number, default: 0 },
      repeatPurchaseRate: { type: Number, default: 0, min: 0, max: 100 }, // % of items repurchased
      lastAssessedAt: Date
    },

    // 💬 ENGAGEMENT METRICS
    engagement: {
      reviewCount: { type: Number, default: 0 },
      avgReviewRating: { type: Number, default: 0, min: 0, max: 5 },
      wishlistItems: { type: Number, default: 0 },
      cartAbandonment: { type: Number, default: 0 }, // Times customer left cart without purchasing
      cartAbandonmentRate: { type: Number, default: 0, min: 0, max: 100 },
      pageViews: { type: Number, default: 0 },
      lastActiveAt: Date,
      daysSinceLastActivity: { type: Number, default: 0 },
      supportTickets: { type: Number, default: 0 },
      avgResponseRating: { type: Number, default: 0, min: 0, max: 5 },
      npsScore: { type: Number, min: 0, max: 10 }, // Net Promoter Score
      lastAssessedAt: Date
    },

    // 🎁 SEGMENT & RECOMMENDATIONS
    segment: {
      type: String,
      enum: ['high_value', 'growth_potential', 'at_risk', 'loyal', 'new', 'dormant'],
      default: 'new',
      index: true
    },
    recommendedActions: [
      {
        action: String, // 'send_offer', 'personalized_campaign', 'retention_email', 'vip_upgrade'
        priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] },
        reason: String,
        suggestedDate: Date,
        actionTaken: Boolean,
        actionTakenAt: Date,
        result: String // 'successful', 'failed', 'pending'
      }
    ],

    // 🔔 ALERTS & NOTES
    alerts: [
      {
        type: String, // 'inactivity', 'high_churn_risk', 'ltv_increase', 'segment_change'
        severity: { type: String, enum: ['info', 'warning', 'critical'] },
        message: String,
        createdAt: { type: Date, default: Date.now },
        resolved: { type: Boolean, default: false },
        resolvedAt: Date
      }
    ],
    notes: String,

    // 📅 METADATA
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    lastScoringAt: { type: Date, index: true },
    nextScoringAt: { type: Date, index: true }
  },
  { collection: 'customer_behavior_scores', timestamps: true }
);

// Indexes for queries
customerBehaviorScoreSchema.index({ user: 1 });
customerBehaviorScoreSchema.index({ 'churnRisk.riskLevel': 1, lastScoringAt: -1 });
customerBehaviorScoreSchema.index({ segment: 1, 'ltv.totalSpent': -1 });
customerBehaviorScoreSchema.index({ 'ltv.projectedLTV': -1 });
customerBehaviorScoreSchema.index({ 'churnRisk.predictedChurnDate': 1 });
customerBehaviorScoreSchema.index({ 'engagement.lastActiveAt': -1 });

// TTL index: remove scoring older than 1 year (optional archival)
customerBehaviorScoreSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000, sparse: true });

const CustomerBehaviorScore = mongoose.model('CustomerBehaviorScore', customerBehaviorScoreSchema);

export { CustomerBehaviorScore };
export default CustomerBehaviorScore;
