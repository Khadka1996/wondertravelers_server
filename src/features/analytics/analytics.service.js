import Analytics from './analytics.model.js';
import geoip from 'geoip-lite';
import crypto from 'crypto';
import redisClient from '../../utils/redis.util.js';

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    '127.0.0.1'
  );
};

/**
 * Anonymize IP address for privacy (GDPR/CCPA compliance)
 * Removes last octet for IPv4, last 80 bits for IPv6
 * @param {string} ipAddress - IP address to anonymize
 * @returns {string} Anonymized IP address
 */
const anonymizeIp = (ipAddress) => {
  if (!ipAddress) return 'unknown';
  
  // IPv4: replace last octet with 0
  if (ipAddress.includes('.')) {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }
  
  // IPv6: replace last 80 bits with 0s
  if (ipAddress.includes(':')) {
    const parts = ipAddress.split(':');
    if (parts.length > 0) {
      parts[parts.length - 1] = '0';
      return parts.join(':');
    }
  }
  
  return ipAddress;
};

const getRegionFromAnalytics = (countryCode, timezone) => {
  if (timezone && typeof timezone === 'string' && timezone.includes('/')) {
    const [region] = timezone.split('/');
    if (region) return region;
  }

  const regionByCountryCode = {
    NA: ['US', 'CA', 'MX'],
    SA: ['BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO', 'EC', 'VE', 'GY', 'SR'],
    EU: ['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'PT', 'CZ', 'GR', 'HU', 'RO', 'UA'],
    AS: ['NP', 'IN', 'CN', 'JP', 'KR', 'TH', 'VN', 'ID', 'MY', 'SG', 'PH', 'PK', 'BD', 'LK', 'AE', 'SA', 'QA', 'KW', 'OM'],
    AF: ['ZA', 'EG', 'NG', 'KE', 'ET', 'GH', 'TZ', 'UG', 'DZ', 'MA', 'TN', 'CM'],
    OC: ['AU', 'NZ', 'FJ', 'PG'],
  };

  const code = (countryCode || '').toUpperCase();
  if (regionByCountryCode.NA.includes(code)) return 'North America';
  if (regionByCountryCode.SA.includes(code)) return 'South America';
  if (regionByCountryCode.EU.includes(code)) return 'Europe';
  if (regionByCountryCode.AS.includes(code)) return 'Asia';
  if (regionByCountryCode.AF.includes(code)) return 'Africa';
  if (regionByCountryCode.OC.includes(code)) return 'Oceania';

  return 'Local/Private';
};

/**
 * Track analytics event with geolocation
 */
export const trackAnalyticsEvent = async (req, eventType, additionalData = {}) => {
  try {
    const ipAddress = getClientIp(req);
    const anonymizedIp = anonymizeIp(ipAddress);
    
    // Lookup geolocation
    const geoData = geoip.lookup(ipAddress);
    
    if (!geoData) {
      console.warn(`⚠️ Geolocation lookup failed for IP: ${ipAddress}. This is normal for private IPs (127.0.0.1, 192.168.x.x, etc.)`);
    }

    // geoip-lite returns: { country: 'US', city: 'New York', ll: [lat, lng], ... }
    // So geoData.country IS the country code (2-letter ISO)
    const countryCode = geoData?.country || 'XX';
    
    // Get country name using Intl API
    let countryName = 'Unknown';
    
    if (countryCode && countryCode !== 'XX') {
      try {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
        const resolvedName = displayNames.of(countryCode);
        if (resolvedName && resolvedName !== countryCode) {
          countryName = resolvedName;
        } else {
          countryName = countryCode; // Fallback to code if Intl doesn't recognize it
        }
      } catch (e) {
        // Intl.DisplayNames might not support this locale or there's an error
        console.warn(`⚠️ Failed to resolve country name for code: ${countryCode}`, e.message);
        countryName = countryCode;
      }
    } else {
      // IP is either local/private or unknown
      countryName = geoData?.country ? countryCode : 'Unknown';
    }

    const analyticsData = {
      type: eventType,
      ipAddress: anonymizedIp, // Store anonymized IP for privacy
      userAgent: req.get('user-agent'),
      userId: req.user?._id || null,
      path: req.path,
      referrer: req.get('referer') || null,
      country: countryName,
      countryCode: countryCode,
      region: getRegionFromAnalytics(countryCode, geoData?.timezone),
      city: geoData?.city || 'Unknown',
      latitude: geoData?.ll?.[0] || null,
      longitude: geoData?.ll?.[1] || null,
      timezone: geoData?.timezone || null,
      ...additionalData,
    };

    await Analytics.create(analyticsData);
    
    // Log successful tracking with geolocation info
    if (geoData) {
      console.log(`✅ Analytics tracked: ${countryName} (${countryCode}) - ${geoData.city || 'Unknown city'}`);
    } else {
      console.log(`✅ Analytics tracked: Private/Local IP (${ipAddress})`);
    }
    
    return analyticsData;
  } catch (error) {
    console.error('Error tracking analytics:', error);
    // Don't throw, just log - don't break main request
  }
};

/**
 * Validate days parameter
 * @param {number} days - Number of days to validate
 * @returns {number} Valid number of days (1-365)
 */
const validateDays = (days) => {
  const parsed = parseInt(days);
  if (isNaN(parsed) || parsed < 1) return 30;
  if (parsed > 365) return 365;
  return parsed;
};

/**
 * Get global reach statistics
 * @param {number} days - Number of days to fetch (1-365)
 * @returns {Object} Global reach statistics with caching
 */
export const getGlobalReachStats = async (days = 30) => {
  try {
    const validDays = validateDays(days);
    const cacheKey = `analytics:global-reach:${validDays}`;
    
    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    // Get view counts by country
    const countryStats = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: 'page_view',
        },
      },
      {
        $group: {
          _id: '$countryCode',
          country: { $first: '$country' },
          views: { $sum: 1 },
          cities: { $addToSet: '$city' },
          latitude: { $first: '$latitude' },
          longitude: { $first: '$longitude' },
        },
      },
      {
        $sort: { views: -1 },
      },
      {
        $project: {
          _id: 0,
          countryCode: '$_id',
          country: 1,
          views: 1,
          citiesCount: { $size: '$cities' },
          latitude: 1,
          longitude: 1,
        },
      },
    ]);

    // Get total statistics
    const totalStats = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: 'page_view',
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          uniqueCountries: { $addToSet: '$countryCode' },
          uniqueIPs: { $addToSet: '$ipAddress' },
        },
      },
      {
        $project: {
          _id: 0,
          totalViews: 1,
          uniqueCountries: { $size: '$uniqueCountries' },
          uniqueVisitors: { $size: '$uniqueIPs' },
        },
      },
    ]);

    // Get top cities
    const topCities = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: 'page_view',
          city: { $ne: null },
        },
      },
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          views: { $sum: 1 },
        },
      },
      {
        $sort: { views: -1 },
      },
      {
        $limit: 20,
      },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          country: '$_id.country',
          views: 1,
        },
      },
    ]);

    // Get trend data (daily)
    const trendData = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: 'page_view',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          views: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          views: 1,
        },
      },
    ]);

    const result = {
      countryStats,
      totalStats: totalStats[0] || { totalViews: 0, uniqueCountries: 0, uniqueVisitors: 0 },
      topCities,
      trendData,
      period: `Last ${validDays} days`,
    };

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(result));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return result;
  } catch (error) {
    console.error('Error getting global reach stats:', error);
    throw error;
  }
};

/**
 * Get heatmap data for visualization
 * @param {number} days - Number of days to fetch (1-365)
 * @returns {Array} Heatmap data with caching
 */
export const getHeatmapData = async (days = 30) => {
  try {
    const validDays = validateDays(days);
    const cacheKey = `analytics:heatmap:${validDays}`;
    
    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    const data = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          type: 'page_view',
          latitude: { $ne: null },
          longitude: { $ne: null },
        },
      },
      {
        $group: {
          _id: { lat: '$latitude', lng: '$longitude' },
          intensity: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          lat: '$_id.lat',
          lng: '$_id.lng',
          intensity: 1,
        },
      },
    ]);

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(data));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return data;
  } catch (error) {
    console.error('Error getting heatmap data:', error);
    throw error;
  }
};

/**
 * Get analytics by type with validation and caching
 */
export const getAnalyticsByType = async (type, days = 30) => {
  try {
    const validDays = validateDays(days);
    
    // Validate type parameter
    const validTypes = ['page_view', 'product_view', 'order', 'user_signup'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid analytics type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const cacheKey = `analytics:by-type:${type}:${validDays}`;
    
    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    const stats = await Analytics.aggregate([
      {
        $match: {
          type,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$countryCode',
          country: { $first: '$country' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(stats));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return stats;
  } catch (error) {
    console.error(`Error getting ${type} analytics:`, error);
    throw error;
  }
};

/**
 * Get regional analytics statistics
 * Aggregates analytics data by region
 */
export const getRegionalStats = async (days = 30) => {
  try {
    const cacheKey = `analytics:regional:${days}`;
    
    // Check cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get global reach stats (which includes all countries with regions from countries.json)
    const countryStats = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$countryCode',
          country: { $first: '$country' },
          views: { $sum: 1 },
          visitors: { $addToSet: '$ipAddress' },
        },
      },
      {
        $project: {
          _id: 0,
          countryCode: '$_id',
          country: 1,
          views: 1,
          visitors: { $size: '$visitors' },
        },
      },
      {
        $sort: { views: -1 },
      },
    ]);

    // Calculate total stats
    const totalViews = countryStats.reduce((sum, c) => sum + c.views, 0);
    const totalVisitors = countryStats.reduce((sum, c) => sum + c.visitors, 0);
    const uniqueCountries = countryStats.length;

    const stats = {
      totalStats: {
        totalViews,
        uniqueCountries,
        uniqueVisitors: totalVisitors,
      },
      countryStats,
    };

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(stats));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return stats;
  } catch (error) {
    console.error('Error getting regional stats:', error);
    throw error;
  }
};

/**
 * Get market analytics statistics (sales by country)
 * Requires Order model to be imported where this is used
 */
export const getMarketStats = async (days = 30, OrderModel) => {
  try {
    const cacheKey = `analytics:market-stats:${days}`;
    
    // Check cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get sales and order data by country from Order collection
    const marketStats = await OrderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'delivered', 'processing'] }, // Only count completed orders
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'analytics',
          let: { userId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$userId', '$$userId'] },
                timestamp: { $gte: startDate },
              },
            },
          ],
          as: 'analyticsData',
        },
      },
      {
        $group: {
          _id: '$userDetails.address.country', // Country from user profile
          country: { $first: '$userDetails.address.country' },
          countryCode: { $first: '$userDetails.address.countryCode' },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          paymentMethods: {
            $push: '$paymentMethod', // cash or qr
          },
          currencies: {
            $push: '$currency',
          },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          country: { $ifNull: ['$country', 'Unknown'] },
          countryCode: { $ifNull: ['$countryCode', 'XX'] },
          totalSales: { $round: ['$totalRevenue', 2] },
          orderCount: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          avgOrderValue: { $round: ['$avgOrderValue', 2] },
          uniqueCustomers: { $size: '$uniqueCustomers' },
          paymentMethods: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: ['$paymentMethods'] },
                as: 'method',
                in: {
                  k: '$$method',
                  v: {
                    $size: {
                      $filter: {
                        input: '$paymentMethods',
                        as: 'pm',
                        cond: { $eq: ['$$pm', '$$method'] },
                      },
                    },
                  },
                },
              },
            },
          },
          topCurrency: { $arrayElemAt: ['$currencies', 0] },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);

    // Calculate totals
    const totalRevenue = marketStats.reduce((sum, m) => sum + (m.totalRevenue || 0), 0);
    const totalOrders = marketStats.reduce((sum, m) => sum + (m.orderCount || 0), 0);
    const totalCustomers = marketStats.reduce((sum, m) => sum + (m.uniqueCustomers || 0), 0);

    const stats = {
      period: `${days}d`,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      totalCustomers,
      totalMarkets: marketStats.length,
      avgRevenuePerMarket: parseFloat((totalRevenue / marketStats.length || 0).toFixed(2)),
      marketStats,
    };

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(stats));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return stats;
  } catch (error) {
    console.error('Error getting market stats:', error);
    throw error;
  }
};

/**
 * Get product performance by market (country)
 */
export const getProductByMarket = async (days = 30, OrderModel) => {
  try {
    const cacheKey = `analytics:product-by-market:${days}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const productByMarket = await OrderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'delivered', 'processing'] },
        },
      },
      {
        $unwind: '$items', // Unwind order items
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: {
            country: { $ifNull: ['$userDetails.address.country', 'Unknown'] },
            productId: '$items.productId',
            productName: { $ifNull: ['$productDetails.name', 'Unknown'] },
          },
          unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.country',
          country: { $first: '$_id.country' },
          products: {
            $push: {
              productId: '$_id.productId',
              productName: '$_id.productName',
              unitsSold: '$unitsSold',
              totalRevenue: { $round: ['$totalRevenue', 2] },
              orderCount: '$orderCount',
            },
          },
          totalCountryRevenue: { $sum: '$totalRevenue' },
        },
      },
      {
        $project: {
          country: 1,
          totalCountryRevenue: { $round: ['$totalCountryRevenue', 2] },
          products: {
            $slice: [{ $sortArray: { input: '$products', sortBy: { totalRevenue: -1 } } }, 10],
          },
        },
      },
      {
        $sort: { totalCountryRevenue: -1 },
      },
    ]);

    const stats = {
      period: `${days}d`,
      productByMarket,
    };

    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(stats));
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return stats;
  } catch (error) {
    console.error('Error getting product by market:', error);
    throw error;
  }
};

/**
 * Get user engagement metrics by market
 */
export const getUserEngagementByMarket = async (days = 30, OrderModel, AnalyticsModel) => {
  try {
    const cacheKey = `analytics:user-engagement-market:${days}`;
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get signups by country from analytics
    const signupsByCountry = await AnalyticsModel.aggregate([
      {
        $match: {
          type: 'user_signup',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$countryCode',
          country: { $first: '$country' },
          signups: { $sum: 1 },
          uniqueSignups: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          countryCode: '$_id',
          country: 1,
          signups: { $size: '$uniqueSignups' },
        },
      },
    ]);

    // Get purchase data by country
    const purchasesByCountry = await OrderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'delivered'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: '$userDetails.address.countryCode',
          country: { $first: '$userDetails.address.country' },
          purchases: { $sum: 1 },
          uniquePurchasers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          countryCode: '$_id',
          country: 1,
          purchases: 1,
          purchasers: { $size: '$uniquePurchasers' },
        },
      },
    ]);

    // Merge signups and purchases data
    const mergedData = signupsByCountry.map(signup => {
      const purchase = purchasesByCountry.find(p => p.countryCode === signup.countryCode);
      const conversionRate = purchase
        ? parseFloat(((purchase.purchasers / signup.signups) * 100).toFixed(2))
        : 0;

      return {
        countryCode: signup.countryCode,
        country: signup.country,
        signups: signup.signups,
        purchases: purchase?.purchases || 0,
        purchasers: purchase?.purchasers || 0,
        conversionRate,
      };
    });

    const stats = {
      period: `${days}d`,
      totalSignups: mergedData.reduce((sum, m) => sum + m.signups, 0),
      totalPurchases: mergedData.reduce((sum, m) => sum + m.purchases, 0),
      avgConversionRate: parseFloat(
        (mergedData.reduce((sum, m) => sum + m.conversionRate, 0) / mergedData.length || 0).toFixed(2)
      ),
      engagementByMarket: mergedData.sort((a, b) => b.purchasers - a.purchasers),
    };

    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(stats));
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return stats;
  } catch (error) {
    console.error('Error getting user engagement by market:', error);
    throw error;
  }
};

/**
 * Clear old analytics data (retention policy)
 */
export const cleanupOldAnalytics = async (retentionDays = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await Analytics.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    console.log(`Cleaned up ${result.deletedCount} old analytics records`);
    return result;
  } catch (error) {
    console.error('Error cleaning up old analytics:', error);
    throw error;
  }
};

/**
 * Get page visit analytics
 * @param {number} days - Number of days to analyze
 * @returns {Object} Page visit statistics and trends
 */
export const getPageVisitAnalytics = async (days = 30) => {
  try {
    const validDays = validateDays(days);
    const cacheKey = `analytics:page-visits:${validDays}`;

    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    // Get page visits grouped by path
    const pageVisits = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$path',
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastVisit: { $max: '$timestamp' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
        },
      },
      {
        $sort: { visits: -1 },
      },
      {
        $limit: 20, // Top 20 pages
      },
      {
        $project: {
          path: '$_id',
          visits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          lastVisit: 1,
          _id: 0,
        },
      },
    ]);

    // Get total page views count
    const totalVisits = await Analytics.countDocuments({
      type: 'page_view',
      timestamp: { $gte: startDate },
    });

    // Get visits trend over days
    const visitsTrend = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
        },
      },
      {
        $addFields: {
          uniqueCount: { $size: '$uniqueVisitors' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: '$_id',
          visits: 1,
          uniqueVisitors: '$uniqueCount',
          _id: 0,
        },
      },
    ]);

    // Get country distribution
    const countryDistribution = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$country',
          visits: { $sum: 1 },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { visits: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          country: '$_id',
          visits: 1,
          _id: 0,
        },
      },
    ]);

    const result = {
      totalVisits,
      topPages: pageVisits,
      visitsTrend,
      countryDistribution,
      period: `Last ${validDays} days`,
      timestamp: new Date(),
    };

    // Cache for 5 minutes
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(result));
      console.log(`✅ Cached ${cacheKey} for 5 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return result;
  } catch (error) {
    console.error('Error getting page visit analytics:', error);
    throw error;
  }
};

/**
 * Get detailed web analytics with time-based breakdown
 * @param {number} days - Number of days to analyze
 * @returns {Object} Detailed web analytics data
 */
export const getDetailedWebAnalytics = async (days = 30) => {
  try {
    const validDays = validateDays(days);
    const cacheKey = `analytics:detailed-web:${validDays}`;

    // Try to get from cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    // Daily statistics
    const dailyStats = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          pages: { $addToSet: '$path' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          pagesVisited: { $size: '$pages' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: '$_id',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          pagesVisited: 1,
          _id: 0,
        },
      },
    ]);

    // Weekly statistics
    const weeklyStats = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            week: { $isoWeek: '$timestamp' },
            year: { $year: '$timestamp' },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          pages: { $addToSet: '$path' },
          startDate: { $min: '$timestamp' },
          endDate: { $max: '$timestamp' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          pagesVisited: { $size: '$pages' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.week': 1 },
      },
      {
        $limit: 53, // Max 53 weeks in a year
      },
      {
        $project: {
          week: {
            $concat: ['Week ', { $toString: '$_id.week' }, ' - ', { $toString: '$_id.year' }]
          },
          year: '$_id.year',
          weekNumber: '$_id.week',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          pagesVisited: 1,
          startDate: 1,
          endDate: 1,
          _id: 0,
        },
      },
    ]);

    // Monthly statistics
    const monthlyStats = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$timestamp' },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          pages: { $addToSet: '$path' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          pagesVisited: { $size: '$pages' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $limit: 12,
      },
      {
        $project: {
          month: '$_id',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          pagesVisited: 1,
          _id: 0,
        },
      },
    ]);

    // Yearly statistics
    const yearlyStats = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $year: '$timestamp',
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          pages: { $addToSet: '$path' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          pagesVisited: { $size: '$pages' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          year: '$_id',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          pagesVisited: 1,
          _id: 0,
        },
      },
    ]);

    // Page performance metrics
    const pageMetrics = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$path',
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          countries: { $addToSet: '$country' },
          lastVisit: { $max: '$timestamp' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
          countriesCount: { $size: '$countries' },
          bounceRateEstimate: {
            $multiply: [
              {
                $divide: [
                  { $size: '$uniqueVisitors' },
                  '$visits',
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $sort: { visits: -1 },
      },
      {
        $limit: 50,
      },
      {
        $project: {
          path: '$_id',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          countriesServed: '$countriesCount',
          bounceRateEstimate: 1,
          lastVisit: 1,
          _id: 0,
        },
      },
    ]);

    // Country-wise visit metrics
    const countryVisits = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            country: { $ifNull: ['$country', 'Local/Private'] },
            countryCode: { $ifNull: ['$countryCode', 'XX'] },
            region: { $ifNull: ['$region', 'Local/Private'] },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastVisit: { $max: '$timestamp' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
        },
      },
      {
        $sort: { visits: -1 },
      },
      {
        $limit: 50,
      },
      {
        $project: {
          _id: 0,
          country: '$_id.country',
          countryCode: '$_id.countryCode',
          region: '$_id.region',
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          lastVisit: 1,
        },
      },
    ]);

    // Hour-based heatmap (traffic by hour of day) - with all 24 hours
    const hourlyHeatmapRaw = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $hour: '$timestamp',
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          hour: {
            $concat: [
              { $toString: '$_id' },
              ':00',
            ],
          },
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          _id: 0,
        },
      },
    ]);

    // Fill missing hours with 0 visits
    const hourlyHeatmap = [];
    const hourlyMap = new Map(hourlyHeatmapRaw.map(h => [h.hour, h]));
    for (let i = 0; i < 24; i++) {
      const hour = `${i}:00`;
      hourlyHeatmap.push(hourlyMap.get(hour) || { hour, visits: 0, uniqueVisitors: 0 });
    }

    // Day-of-week heatmap - ensure all 7 days
    const dayOfWeekHeatmapRaw = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dayOfWeek: '$timestamp',
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
        },
      },
      {
        $addFields: {
          uniqueVisitorCount: { $size: '$uniqueVisitors' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          day: {
            $arrayElemAt: [
              ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
              { $subtract: ['$_id', 1] },
            ],
          },
          visits: 1,
          uniqueVisitors: '$uniqueVisitorCount',
          _id: 0,
        },
      },
    ]);

    // Fill missing days with 0 visits
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeekMap = new Map(dayOfWeekHeatmapRaw.map(d => [d.day, d]));
    const dayOfWeekHeatmap = daysOfWeek.map(day => dayOfWeekMap.get(day) || { day, visits: 0, uniqueVisitors: 0 });

    // Calculate averages
    const totalVisits = dailyStats.reduce((sum, d) => sum + d.visits, 0);
    const totalUniqueVisitors = new Set();
    const avgVisitsPerDay = dailyStats.length > 0 ? Math.round(totalVisits / dailyStats.length) : 0;
    const avgPagesPerDay = dailyStats.length > 0 
      ? Math.round(dailyStats.reduce((sum, d) => sum + d.pagesVisited, 0) / dailyStats.length) 
      : 0;
    const avgVisitsPerPage = pageMetrics.length > 0
      ? Math.round(totalVisits / pageMetrics.length)
      : 0;

    const result = {
      summary: {
        totalVisits,
        totalPages: pageMetrics.length,
        avgVisitsPerDay,
        avgPagesPerDay,
        avgVisitsPerPage,
        period: `Last ${validDays} days`,
      },
      daily: dailyStats,
      weekly: weeklyStats,
      monthly: monthlyStats,
      yearly: yearlyStats,
      pageMetrics,
      countryVisits,
      hourlyHeatmap,
      dayOfWeekHeatmap,
      timestamp: new Date(),
    };

    // Cache for 10 minutes
    try {
      await redisClient.setex(cacheKey, 600, JSON.stringify(result));
      console.log(`✅ Cached ${cacheKey} for 10 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return result;
  } catch (error) {
    console.error('Error getting detailed web analytics:', error);
    throw error;
  }
};

/**
 * Get visits grouped by country
 * @param {number} days - Number of days to analyze
 * @returns {Object} Country-wise visit analytics
 */
export const getVisitsByCountry = async (days = 30) => {
  try {
    const validDays = validateDays(days);
    const cacheKey = `analytics:visits-by-country:${validDays}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.warn('Cache read failed, continuing with DB query:', cacheErr.message);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    const countryVisits = await Analytics.aggregate([
      {
        $match: {
          type: 'page_view',
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            country: { $ifNull: ['$country', 'Local/Private'] },
            countryCode: { $ifNull: ['$countryCode', 'XX'] },
            region: { $ifNull: ['$region', 'Local/Private'] },
          },
          visits: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$ipAddress' },
          lastVisit: { $max: '$timestamp' },
        },
      },
      {
        $project: {
          _id: 0,
          country: '$_id.country',
          countryCode: '$_id.countryCode',
          region: '$_id.region',
          visits: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          lastVisit: 1,
        },
      },
      {
        $sort: { visits: -1 },
      },
      {
        $limit: 100,
      },
    ]);

    const totalVisits = countryVisits.reduce((sum, row) => sum + (row.visits || 0), 0);

    const result = {
      period: `Last ${validDays} days`,
      totalVisits,
      uniqueCountries: countryVisits.length,
      countryVisits,
      timestamp: new Date(),
    };

    try {
      await redisClient.setex(cacheKey, 600, JSON.stringify(result));
      console.log(`✅ Cached ${cacheKey} for 10 minutes`);
    } catch (cacheErr) {
      console.warn('Cache write failed:', cacheErr.message);
    }

    return result;
  } catch (error) {
    console.error('Error getting visits by country:', error);
    throw error;
  }
};

/**
 * Debug: Get analytics collection statistics
 * Returns info about tracked data in the database
 */
export const getAnalyticsDebugStats = async () => {
  try {
    const totalRecords = await Analytics.countDocuments();
    
    const typeDistribution = await Analytics.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const pathDistribution = await Analytics.aggregate([
      {
        $group: {
          _id: '$path',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const latestRecords = await Analytics.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .select('type path timestamp country ipAddress');

    const oldestRecord = await Analytics.findOne().sort({ timestamp: 1 });
    const newestRecord = await Analytics.findOne().sort({ timestamp: -1 });

    return {
      totalRecords,
      typeDistribution: Object.fromEntries(typeDistribution.map(d => [d._id, d.count])),
      topPaths: pathDistribution.map(p => ({ path: p._id, count: p.count })),
      latestRecords: latestRecords.map(r => ({
        type: r.type,
        path: r.path,
        country: r.country,
        timestamp: r.timestamp,
      })),
      dateRange: {
        oldest: oldestRecord?.timestamp || null,
        newest: newestRecord?.timestamp || null,
      },
      status: totalRecords > 0 ? 'Active' : 'No data tracked yet',
    };
  } catch (error) {
    console.error('Error getting analytics debug stats:', error);
    throw error;
  }
};
