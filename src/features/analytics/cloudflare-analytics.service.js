// src/features/analytics/cloudflare-analytics.service.js
// Cloudflare zone analytics for the admin page, shaped like Cloudflare's own
// Traffic dashboard. Free-plan limits: daily/hourly totals cover the zone's
// history; per-request breakdowns (paths, devices, ...) at most ~30 days.

import cache from '../../utils/cache.util.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ADAPTIVE_MAX_MS = 30 * DAY_MS - 60 * 1000; // "cannot request a time range wider than 4w2d"

export const RANGES = {
  '24h': { ms: DAY_MS, hourly: true, label: 'Previous 24 hours' },
  '7d': { ms: 7 * DAY_MS, label: 'Previous 7 days' },
  '30d': { ms: 30 * DAY_MS, label: 'Previous 30 days' },
  '90d': { ms: 90 * DAY_MS, label: 'Previous 90 days' },
  '1y': { ms: 365 * DAY_MS, label: 'Previous year' },
};

const SUM_FIELDS = 'requests cachedRequests bytes cachedBytes pageViews threats';

async function gql(query, variables) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { zone: process.env.CLOUDFLARE_ZONE_ID, ...variables } }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message || `Cloudflare API ${response.status}`);
  return body.data.viewer.zones[0];
}

const isoDate = (d) => d.toISOString().slice(0, 10);
const isoTime = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const isoHour = (d) => `${d.toISOString().slice(0, 13)}:00:00Z`;

/** Totals, time series and per-country/content/status/browser maps for a window. */
async function series(range, end) {
  const { ms, hourly } = RANGES[range];
  const start = new Date(end.getTime() - ms);
  const maps = `countryMap { clientCountryName requests threats bytes }
    contentTypeMap { edgeResponseContentTypeName requests bytes }
    responseStatusMap { edgeResponseStatus requests }
    browserMap { uaBrowserFamily pageViews }`;

  const zone = hourly
    ? await gql(
        `query ($zone: String!, $since: Time!, $until: Time!) { viewer { zones(filter: { zoneTag: $zone }) {
          groups: httpRequests1hGroups(limit: 100, filter: { datetime_geq: $since, datetime_lt: $until }, orderBy: [datetime_ASC]) {
            dimensions { time: datetime } sum { ${SUM_FIELDS} ${maps} } uniq { uniques } } } } }`,
        { since: isoHour(start), until: isoHour(new Date(end.getTime() + 3600 * 1000)) },
      )
    : await gql(
        `query ($zone: String!, $since: Date!, $until: Date!) { viewer { zones(filter: { zoneTag: $zone }) {
          groups: httpRequests1dGroups(limit: 400, filter: { date_geq: $since, date_leq: $until }, orderBy: [date_ASC]) {
            dimensions { time: date } sum { ${SUM_FIELDS} ${maps} } uniq { uniques } } } } }`,
        { since: isoDate(new Date(start.getTime() + DAY_MS)), until: isoDate(end) },
      );

  const totals = { requests: 0, cachedRequests: 0, bytes: 0, cachedBytes: 0, pageViews: 0, threats: 0, uniques: 0 };
  const add = (map, key, values) => {
    const entry = map.get(key) || { key };
    for (const [k, v] of Object.entries(values)) entry[k] = (entry[k] || 0) + (v || 0);
    map.set(key, entry);
  };
  const countries = new Map();
  const contentTypes = new Map();
  const statuses = new Map();
  const browsers = new Map();

  const points = zone.groups.map((g) => {
    const s = g.sum;
    for (const k of Object.keys(totals)) if (k !== 'uniques') totals[k] += s[k] || 0;
    totals.uniques += g.uniq?.uniques || 0;
    for (const c of s.countryMap || []) add(countries, c.clientCountryName, { requests: c.requests, threats: c.threats, bytes: c.bytes });
    for (const c of s.contentTypeMap || []) add(contentTypes, c.edgeResponseContentTypeName || 'other', { requests: c.requests, bytes: c.bytes });
    for (const c of s.responseStatusMap || []) add(statuses, String(c.edgeResponseStatus), { requests: c.requests });
    for (const c of s.browserMap || []) add(browsers, c.uaBrowserFamily || 'Unknown', { pageViews: c.pageViews });
    return {
      time: g.dimensions.time,
      requests: s.requests,
      cachedRequests: s.cachedRequests,
      uncachedRequests: s.requests - s.cachedRequests,
      bytes: s.bytes,
      cachedBytes: s.cachedBytes,
      pageViews: s.pageViews,
      threats: s.threats,
      uniques: g.uniq?.uniques || 0,
    };
  });

  const sorted = (map, field) => [...map.values()].sort((a, b) => b[field] - a[field]);
  return {
    totals,
    points,
    countries: sorted(countries, 'requests'),
    contentTypes: sorted(contentTypes, 'requests').slice(0, 10),
    statuses: sorted(statuses, 'requests').slice(0, 10),
    browsers: sorted(browsers, 'pageViews').slice(0, 10),
  };
}

/** Per-request breakdowns (free plan: at most ~30 days back). */
async function breakdowns(range, end) {
  const ms = Math.min(RANGES[range].ms, ADAPTIVE_MAX_MS);
  const since = isoTime(new Date(end.getTime() - ms));
  const until = isoTime(end);
  const base = `datetime_geq: $since, datetime_lt: $until, requestSource: "eyeball"`;
  const group = (alias, dimension, extra = '', limit = 10) =>
    `${alias}: httpRequestsAdaptiveGroups(limit: ${limit}, orderBy: [count_DESC], filter: { ${base} ${extra} }) { count dimensions { value: ${dimension} } }`;

  const zone = await gql(
    `query ($zone: String!, $since: Time!, $until: Time!) { viewer { zones(filter: { zoneTag: $zone }) {
      ${group('pages', 'clientRequestPath', ', clientRequestHTTPHost_like: "%wondertravelers.com", edgeResponseContentTypeName: "html", edgeResponseStatus: 200', 60)}
      ${group('hosts', 'clientRequestHTTPHost')}
      ${group('devices', 'clientDeviceType')}
      ${group('browsers', 'userAgentBrowser')}
      ${group('os', 'userAgentOS')}
      ${group('statuses', 'edgeResponseStatus')}
      ${group('paths', 'clientRequestPath', ', edgeResponseStatus_geq: 400', 10)}
    } } }`,
    { since, until },
  );
  const rows = (list) => (list || []).map((r) => ({ key: String(r.dimensions.value ?? 'Unknown'), requests: r.count }));

  // One page = /en/x, /ne/x and the old /x together.
  const pages = new Map();
  for (const r of rows(zone.pages)) {
    if (/^\/(_next|cdn-cgi|api|admin|auth|moderator|uploads)(\/|$)/.test(r.key)) continue;
    const path = r.key.replace(/^\/(en|ne)(?=\/|$)/, '') || '/';
    const entry = pages.get(path) || { key: path, requests: 0, en: 0, ne: 0 };
    entry.requests += r.requests;
    if (r.key.startsWith('/ne')) entry.ne += r.requests;
    else entry.en += r.requests;
    pages.set(path, entry);
  }

  return {
    days: Math.round(ms / DAY_MS),
    topPages: [...pages.values()].sort((a, b) => b.requests - a.requests).slice(0, 10),
    hosts: rows(zone.hosts),
    devices: rows(zone.devices),
    browsers: rows(zone.browsers),
    os: rows(zone.os),
    statuses: rows(zone.statuses),
    errorPaths: rows(zone.paths),
  };
}

export async function getCloudflareAnalytics(range = '7d', { refresh = false } = {}) {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID) return { connected: false };
  const key = RANGES[range] ? range : '7d';
  const cacheKey = `analytics:cloudflare:${key}`;
  if (!refresh) {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;
  }

  const end = new Date();
  const previousEnd = new Date(end.getTime() - RANGES[key].ms);
  const [current, previous, detail] = await Promise.all([
    series(key, end),
    key === '1y' ? Promise.resolve(null) : series(key, previousEnd).catch(() => null),
    breakdowns(key, end),
  ]);

  const result = {
    connected: true,
    range: key,
    label: RANGES[key].label,
    hourly: Boolean(RANGES[key].hourly),
    generatedAt: end.toISOString(),
    ...current,
    previous: previous?.totals || null,
    breakdowns: detail,
  };
  await cache.set(cacheKey, result, 300);
  return result;
}
