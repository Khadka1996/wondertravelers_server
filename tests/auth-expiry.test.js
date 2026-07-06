import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'abcdefghijklmnopqrstuvwxzy123456';

const { parseExpiryToMs } = await import('../src/features/auth/auth.service.js');

test('parses common expiry strings into milliseconds', () => {
  assert.equal(parseExpiryToMs('15m'), 15 * 60 * 1000);
  assert.equal(parseExpiryToMs('7d'), 7 * 24 * 60 * 60 * 1000);
  assert.equal(parseExpiryToMs('30d'), 30 * 24 * 60 * 60 * 1000);
});

test('falls back to a long default for missing values', () => {
  assert.equal(parseExpiryToMs(undefined), 30 * 24 * 60 * 60 * 1000);
});
