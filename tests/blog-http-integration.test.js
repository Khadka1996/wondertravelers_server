import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { performance } from 'node:perf_hooks';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
// Ensure required env vars to avoid app.js exit
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/testdb';
process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'abcdefghijklmnopqrstuvwxzy123456';
process.env.BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY || 'a'.repeat(32);
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'b'.repeat(32);
process.env.NODE_ENV = 'test';

// Create fake blog dataset
const TOTAL_ITEMS = 23;
const makeObjectId = (n) => n.toString(16).padStart(24, '0');
const fakeBlogs = Array.from({ length: TOTAL_ITEMS }).map((_, i) => ({
  _id: makeObjectId(i + 1),
  title: `Blog post #${i + 1}`,
  slug: `post-${i + 1}`,
  publishedAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
  type: 'blog',
  status: 'published',
  views: Math.floor(Math.random() * 1000),
  likesCount: Math.floor(Math.random() * 100),
}));

// Helper to create a chainable query builder for .find()
function makeQueryBuilder(filter) {
  const state = { filter, _skip: 0, _limit: 10 };
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    hint() { return this; },
    skip(n) { state._skip = n; return this; },
    limit(n) { state._limit = n; return this; },
    lean() { // return sliced data according to skip/limit
      const slice = fakeBlogs.filter(b => {
        if (state.filter.type && b.type !== state.filter.type) return false;
        if (state.filter.status && b.status !== state.filter.status) return false;
        return true;
      }).slice(state._skip, state._skip + state._limit);
      return Promise.resolve(slice);
    }
  };
}

// Patch model and auth middleware before importing app
const blogModelMod = await import('../src/features/blog/blog.model.js');
const Blog = blogModelMod.default;
Blog.find = (filter = {}) => makeQueryBuilder(filter);
Blog.countDocuments = async (filter = {}) => {
  const count = fakeBlogs.filter(b => {
    if (filter.type && b.type !== filter.type) return false;
    if (filter.status && b.status !== filter.status) return false;
    if (filter.category && b.category !== filter.category) return false;
    return true;
  }).length;
  // mimic chainable API for .hint()
  const chain = {
    hint() { return chain; },
    exec: async () => count,
    then: (cb) => Promise.resolve(count).then(cb),
  };
  return chain;
};
Blog.findByIdAndDelete = async (id) => {
  const idx = fakeBlogs.findIndex(b => b._id === id);
  if (idx === -1) return null;
  const removed = fakeBlogs.splice(idx, 1)[0];
  return removed;
};

// Patch auth middleware to allow easy role injection
const authMod = await import('../src/features/auth/auth.middleware.js');
const authMiddleware = authMod.authMiddleware || authMod.default || authMod;
// protect normally reads headers/cookies; override to set req.user from header for tests
authMiddleware.protect = (req, res, next) => {
  // allow passing role via header X-Test-Role
  const role = req.headers['x-test-role'] || 'user';
  req.user = { role };
  return next();
};

// Now import app
const appMod = await import('../src/app.js');
const app = appMod.default;

let server;
let baseUrl;

test('HTTP integration: pagination, cache, moderator-delete', async (t) => {
  // start server on ephemeral port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Helper fetch
  const doFetch = async (path, opts = {}) => {
    const url = baseUrl + path;
    const started = performance.now();
    const res = await fetch(url, opts);
    const duration = performance.now() - started;
    const json = await res.json().catch(() => null);
    return { status: res.status, json, duration };
  };

  // 1) Request page 1 limit 5
  const r1 = await doFetch('/api/blogs?page=1&limit=5&type=blog');
  assert.equal(r1.status, 200);
  assert.equal(r1.json.pagination.page, 1);
  assert.equal(r1.json.pagination.limit, 5);
  assert.equal(r1.json.pagination.total, TOTAL_ITEMS);
  assert.equal(r1.json.data.length, 5);
  t.diagnostic(`First request duration ${r1.duration.toFixed(2)}ms`);

  // 2) Repeat same request to check cache behaviour (expect cached true)
  const r2 = await doFetch('/api/blogs?page=1&limit=5&type=blog');
  assert.equal(r2.status, 200);
  // Controller sets `cached` flag on response body
  assert.equal(r2.json.cached, true);
  t.diagnostic(`Second request (cached) duration ${r2.duration.toFixed(2)}ms`);

  // 3) Fetch page 2
  const r3 = await doFetch('/api/blogs?page=2&limit=5&type=blog');
  assert.equal(r3.status, 200);
  assert.equal(r3.json.pagination.page, 2);
  assert.equal(r3.json.data.length, 5);

  // 4) Attempt delete as moderator (send header to let protect set role)
  const targetId = makeObjectId(1);
  const del = await doFetch(`/api/blogs/${targetId}`, { method: 'DELETE', headers: { 'X-Test-Role': 'moderator' } });
  assert.equal(del.status, 200);
  assert.equal(del.json.success, true);

  // 5) Attempt delete as normal user
  const del2 = await doFetch(`/api/blogs/${makeObjectId(2)}`, { method: 'DELETE', headers: { 'X-Test-Role': 'user' } });
  assert.equal(del2.status, 403);

  server.close();
});
