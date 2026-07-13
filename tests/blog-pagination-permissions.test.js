import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

// Provide safe defaults for JWT secrets used during test imports
process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'abcdefghijklmnopqrstuvwxzy123456';

const { sanitizePagination, normalizeSortValue } = await import('../src/features/blog/blog.controller.js');
const { authMiddleware } = await import('../src/features/auth/auth.middleware.js');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

test('sanitizePagination clamps page and limit values for blog/news listing', (t) => {
  const started = performance.now();

  const result = sanitizePagination('0', '200', 20);

  assert.deepEqual(result, { page: 1, limit: 20, skip: 0 });

  const duration = performance.now() - started;
  assert.ok(duration < 100, `pagination sanitization should be fast, took ${duration.toFixed(2)}ms`);
  t.diagnostic(`sanitizePagination completed in ${duration.toFixed(2)}ms`);
});

test('normalizeSortValue keeps blog/news sort modes in the allowed set', (t) => {
  const started = performance.now();

  assert.equal(normalizeSortValue('latest'), 'latest');
  assert.equal(normalizeSortValue('oldest'), 'oldest');
  assert.equal(normalizeSortValue('unknown'), 'latest');

  const duration = performance.now() - started;
  assert.ok(duration < 100, `sort normalization should be fast, took ${duration.toFixed(2)}ms`);
  t.diagnostic(`normalizeSortValue completed in ${duration.toFixed(2)}ms`);
});

test('moderator role is allowed to delete content while standard users are denied', async (t) => {
  const started = performance.now();

  const moderatorReq = { user: { role: 'moderator' }, headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' };
  const moderatorRes = createMockRes();
  let moderatorNextCalled = false;

  await authMiddleware.restrictTo('admin', 'moderator')(moderatorReq, moderatorRes, () => {
    moderatorNextCalled = true;
  });

  assert.equal(moderatorNextCalled, true);

  const userReq = { user: { role: 'user' }, headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' };
  const userRes = createMockRes();
  let userNextCalled = false;

  await authMiddleware.restrictTo('admin', 'moderator')(userReq, userRes, () => {
    userNextCalled = true;
  });

  assert.equal(userNextCalled, false);
  assert.equal(userRes.statusCode, 403);
  assert.equal(userRes.body.message, 'Insufficient permissions');

  const duration = performance.now() - started;
  assert.ok(duration < 100, `permission check should be fast, took ${duration.toFixed(2)}ms`);
  t.diagnostic(`permission checks completed in ${duration.toFixed(2)}ms`);
});
