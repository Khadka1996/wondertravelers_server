// src/features/analytics/analytics-overview.service.js
// Everything the admin analytics page shows, in one request:
//   - our own page views (one $facet aggregation, cached 5 min)
//   - Cloudflare zone traffic (GraphQL Analytics API, cached 10 min)
//   - Google Search Console and GA4 (service account, cached 30 min)
// External sources are optional and fail independently.

import jwt from 'jsonwebtoken';
import Analytics from './analytics.model.js';
import cache from '../../utils/cache.util.js';
import { logger } from '../../utils/logger.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Only pages visitors actually saw (reported by the website), served by the
// { type, timestamp } index; old API-call rows have another type.
const SITE_VIEW = 'site_view';

const clampDays = (days) => Math.min(365, Math.max(1, Number.parseInt(days, 10) || 30));
const isoDate = (date) => date.toISOString().slice(0, 10);

/** Our own page views for [since, until). */
async function siteStats(since, until) {
  const match = { type: SITE_VIEW, timestamp: { $gte: since, $lt: until } };
  // Visitor = anonymised IP + browser; good enough without cookies.
  const visitor = { $concat: [{ $ifNull: ['$ipAddress', ''] }, '|', { $ifNull: ['$userAgent', ''] }] };
  const pagePath = {
    $let: {
      vars: { rest: { $substrCP: ['$path', 3, { $strLenCP: '$path' }] } },
      in: { $cond: [{ $eq: ['$$rest', ''] }, '/', '$$rest'] },
    },
  };

  const [result] = await Analytics.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [
          { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: visitor } } },
          { $project: { _id: 0, views: 1, visitors: { $size: '$visitors' } } },
        ],
        daily: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, views: { $sum: 1 }, visitors: { $addToSet: visitor } } },
          { $project: { _id: 0, date: '$_id', views: 1, visitors: { $size: '$visitors' } } },
          { $sort: { date: 1 } },
        ],
        topPages: [
          {
            $group: {
              _id: pagePath,
              views: { $sum: 1 },
              visitors: { $addToSet: visitor },
              en: { $sum: { $cond: [{ $eq: [{ $substrCP: ['$path', 0, 3] }, '/en'] }, 1, 0] } },
              ne: { $sum: { $cond: [{ $eq: [{ $substrCP: ['$path', 0, 3] }, '/ne'] }, 1, 0] } },
            },
          },
          { $sort: { views: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, path: '$_id', views: 1, visitors: { $size: '$visitors' }, en: 1, ne: 1 } },
        ],
        countries: [
          { $group: { _id: { code: { $ifNull: ['$countryCode', 'XX'] }, name: { $ifNull: ['$country', 'Unknown'] } }, views: { $sum: 1 }, visitors: { $addToSet: visitor } } },
          { $project: { _id: 0, code: '$_id.code', name: '$_id.name', views: 1, visitors: { $size: '$visitors' } } },
          { $sort: { views: -1 } },
        ],
        referrers: [
          { $match: { referrer: { $type: 'string', $ne: '' } } },
          { $group: { _id: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ['$referrer', '://'] }, -1] }, '/'] }, 0] }, views: { $sum: 1 } } },
          { $match: { _id: { $not: /wondertravelers\.com$/ } } },
          { $sort: { views: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, source: '$_id', views: 1 } },
        ],
        devices: [
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $regexMatch: { input: { $ifNull: ['$userAgent', ''] }, regex: /iPad|Tablet/i } }, then: 'Tablet' },
                    { case: { $regexMatch: { input: { $ifNull: ['$userAgent', ''] }, regex: /Mobi|Android|iPhone/i } }, then: 'Mobile' },
                  ],
                  default: 'Desktop',
                },
              },
              views: { $sum: 1 },
            },
          },
          { $project: { _id: 0, device: '$_id', views: 1 } },
        ],
      },
    },
  ]).allowDiskUse(true);

  return {
    totals: result.totals[0] || { views: 0, visitors: 0 },
    daily: result.daily,
    topPages: result.topPages,
    countries: result.countries,
    referrers: result.referrers,
    devices: result.devices,
  };
}

/** Fill days with no views so the chart has one point per day. */
function fillDays(daily, since, days) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  return Array.from({ length: days }, (_, i) => {
    const date = isoDate(new Date(since.getTime() + i * DAY_MS));
    return byDate.get(date) || { date, views: 0, visitors: 0 };
  });
}

// ---------------------------------------------------------------- Cloudflare

async function cloudflareStats(days) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return { connected: false };

  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * DAY_MS);
  const query = `query ($zone: String!, $since: Date!, $until: Date!) {
    viewer { zones(filter: { zoneTag: $zone }) {
      httpRequests1dGroups(limit: 400, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests cachedRequests bytes cachedBytes pageViews threats countryMap { clientCountryName requests threats } }
        uniq { uniques }
      }
    } }
  }`;

  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { zone, since: isoDate(since), until: isoDate(until) } }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.[0]?.message || `Cloudflare API ${response.status}`);
  }

  const groups = body.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  const totals = { requests: 0, cachedRequests: 0, bytes: 0, cachedBytes: 0, pageViews: 0, threats: 0, uniques: 0 };
  const countries = new Map();
  const daily = groups.map((g) => {
    for (const key of ['requests', 'cachedRequests', 'bytes', 'cachedBytes', 'pageViews', 'threats']) totals[key] += g.sum[key] || 0;
    totals.uniques += g.uniq?.uniques || 0;
    for (const c of g.sum.countryMap || []) {
      const entry = countries.get(c.clientCountryName) || { code: c.clientCountryName, requests: 0, threats: 0 };
      entry.requests += c.requests;
      entry.threats += c.threats;
      countries.set(c.clientCountryName, entry);
    }
    return { date: g.dimensions.date, requests: g.sum.requests, pageViews: g.sum.pageViews, uniques: g.uniq?.uniques || 0, threats: g.sum.threats };
  });

  return {
    connected: true,
    totals,
    daily,
    countries: [...countries.values()].sort((a, b) => b.requests - a.requests),
    topPages: await cloudflareTopPages(token, zone, Math.min(days, 7)).catch((e) => {
      logger.warn('Cloudflare top pages failed', { error: e.message });
      return [];
    }),
  };
}

/**
 * Most-requested HTML pages on www from real browsers. The free plan keeps
 * this detail for about a week. /en/x, /ne/x and the old unprefixed /x are
 * merged into one page.
 */
async function cloudflareTopPages(token, zone, days) {
  const query = `query ($zone: String!, $since: Time!) {
    viewer { zones(filter: { zoneTag: $zone }) {
      httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: {
        datetime_geq: $since, requestSource: "eyeball",
        clientRequestHTTPHost: "www.wondertravelers.com", edgeResponseContentTypeName: "html"
      }) { count dimensions { clientRequestPath } }
    } }
  }`;
  const since = new Date(Date.now() - days * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { zone, since } }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message || `Cloudflare API ${response.status}`);

  const pages = new Map();
  for (const row of body.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || []) {
    const raw = row.dimensions.clientRequestPath || '/';
    if (raw.startsWith('/cdn-cgi') || raw.startsWith('/_next') || raw.startsWith('/api') || raw.startsWith('/admin') || raw.startsWith('/auth')) continue;
    const path = raw.replace(/^\/(en|ne)(?=\/|$)/, '') || '/';
    const entry = pages.get(path) || { path, views: 0 };
    entry.views += row.count;
    pages.set(path, entry);
  }
  return [...pages.values()].sort((a, b) => b.views - a.views).slice(0, 10).map((p) => ({ ...p, days }));
}

// -------------------------------------------------------------------- Google

let googleToken = { value: null, expiresAt: 0 };

function googleCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    // Accept the JSON itself or base64 of it (easier to keep on one .env line).
    return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    return null;
  }
}

async function googleAccessToken(credentials) {
  if (googleToken.value && googleToken.expiresAt > Date.now() + 60000) return googleToken.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    credentials.private_key,
    { algorithm: 'RS256' },
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || 'Google sign-in failed');
  googleToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return googleToken.value;
}

async function searchConsoleStats(token, days) {
  const site = process.env.GSC_SITE_URL;
  if (!site) return { connected: false };
  // Search Console data lags ~2 days.
  const endDate = isoDate(new Date(Date.now() - 2 * DAY_MS));
  const startDate = isoDate(new Date(Date.now() - (days + 1) * DAY_MS));
  const call = (body) =>
    fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, ...body }),
      signal: AbortSignal.timeout(15000),
    }).then(async (r) => {
      const b = await r.json();
      if (!r.ok) throw new Error(b.error?.message || `Search Console ${r.status}`);
      return b.rows || [];
    });

  const [byDate, queries, pages] = await Promise.all([
    call({ dimensions: ['date'], rowLimit: 500 }),
    call({ dimensions: ['query'], rowLimit: 10 }),
    call({ dimensions: ['page'], rowLimit: 10 }),
  ]);
  const totals = byDate.reduce(
    (t, r) => ({ clicks: t.clicks + r.clicks, impressions: t.impressions + r.impressions }),
    { clicks: 0, impressions: 0 },
  );
  const position = byDate.length ? byDate.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(1, totals.impressions) : 0;
  const row = (r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position });
  return {
    connected: true,
    totals: { ...totals, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position },
    daily: byDate.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
    topQueries: queries.map(row),
    topPages: pages.map(row),
  };
}

async function ga4Stats(token, days) {
  const property = process.env.GA4_PROPERTY_ID;
  if (!property) return { connected: false };
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `GA4 ${response.status}`);
  const values = body.rows?.[0]?.metricValues?.map((v) => Number(v.value)) || [0, 0, 0, 0];
  return {
    connected: true,
    totals: { users: values[0], sessions: values[1], pageViews: values[2], avgSessionSeconds: values[3] },
  };
}

async function googleStats(days) {
  const credentials = googleCredentials();
  if (!credentials) return { searchConsole: { connected: false }, ga4: { connected: false } };
  const token = await googleAccessToken(credentials);
  const [searchConsole, ga4] = await Promise.all([
    searchConsoleStats(token, days).catch((e) => ({ connected: true, error: e.message })),
    ga4Stats(token, days).catch((e) => ({ connected: true, error: e.message })),
  ]);
  return { searchConsole, ga4 };
}

// ------------------------------------------------------------------ overview

const cached = async (key, ttl, load) => {
  const hit = await cache.get(key);
  if (hit) return hit;
  const value = await load();
  await cache.set(key, value, ttl);
  return value;
};

export async function getAnalyticsOverview(rawDays, { refresh = false } = {}) {
  const days = clampDays(rawDays);
  if (refresh) await cache.delPattern('analytics:overview:*');

  const until = new Date();
  const since = new Date(until.getTime() - days * DAY_MS);
  const previousSince = new Date(since.getTime() - days * DAY_MS);

  const [site, previous, cloudflare, google] = await Promise.all([
    cached(`analytics:overview:site:${days}`, 300, () => siteStats(since, until)),
    cached(`analytics:overview:prev:${days}`, 300, () => siteStats(previousSince, since).then((s) => s.totals)),
    cached(`analytics:overview:cf:${days}`, 600, () => cloudflareStats(days)).catch((e) => {
      logger.warn('Cloudflare analytics failed', { error: e.message });
      return { connected: true, error: e.message };
    }),
    cached(`analytics:overview:google:${days}`, 1800, () => googleStats(days)).catch((e) => {
      logger.warn('Google analytics failed', { error: e.message });
      return { searchConsole: { connected: true, error: e.message }, ga4: { connected: true, error: e.message } };
    }),
  ]);

  return {
    days,
    generatedAt: new Date().toISOString(),
    site: { ...site, previous, daily: fillDays(site.daily, since, days) },
    cloudflare,
    google,
  };
}
