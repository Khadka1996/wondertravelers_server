import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'abcdefghijklmnopqrstuvwxzy123456';
process.env.NODE_ENV = 'test';

const makeObjectId = (n) => n.toString(16).padStart(24, '0');

// ---- In-memory Blog dataset (mutable, so updateBlog can mutate it) -----------
let blogs = [];
const reseed = () => {
  blogs = Array.from({ length: 5 }).map((_, i) => ({
    _id: makeObjectId(i + 1),
    title: `Existing news #${i + 1}`,
    subHeading: `sub ${i + 1}`,
    content: 'x'.repeat(200),
    slug: `existing-news-${i + 1}`,
    tags: [],
    // newest is #1 (0h ago), oldest is #5 (4h ago)
    publishedAt: new Date(Date.now() - i * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - i * 60 * 60 * 1000),
    type: 'news',
    status: 'published',
    isFeatured: false,
    isBreaking: false,
    breakingExpiresAt: null,
    views: 0,
    likesCount: 0,
  }));
  // The post under test: a BLOG, published 10 hours ago (older than all news),
  // with NO publishedAt for the "sinks to the bottom" half of the repro.
  blogs.push({
    _id: makeObjectId(99),
    title: 'The post that gets recategorised',
    subHeading: 'sub',
    content: 'y'.repeat(200),
    slug: 'the-post-that-gets-recategorised',
    tags: [],
    publishedAt: null,
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    type: 'blog',
    status: 'published',
    isFeatured: false,
    isBreaking: false,
    breakingExpiresAt: null,
    views: 0,
    likesCount: 0,
  });
};

const matches = (b, f) => {
  if (f.type && b.type !== f.type) return false;
  if (f.status && b.status !== f.status) return false;
  if (f.isFeatured !== undefined && b.isFeatured !== f.isFeatured) return false;
  if (f.category && String(b.category) !== String(f.category)) return false;
  if (f.$or) {
    const ok = f.$or.some((cond) => {
      if (cond.isBreaking === false) return b.isBreaking === false;
      if (cond.isBreaking === true) {
        return b.isBreaking === true && b.breakingExpiresAt && new Date(b.breakingExpiresAt) > new Date(cond['isBreaking'] ? cond.breakingExpiresAt?.$gt ?? 0 : 0);
      }
      return false;
    });
    if (!ok) return false;
  }
  if (f.publishedAt && f.publishedAt.$gte) {
    if (!b.publishedAt || new Date(b.publishedAt) < f.publishedAt.$gte) return false;
  }
  return true;
};

const applySort = (arr, sort) => {
  const keys = Object.keys(sort || {});
  return [...arr].sort((a, b) => {
    for (const k of keys) {
      const dir = sort[k];
      const av = a[k] == null ? -Infinity : (a[k] instanceof Date ? a[k].getTime() : a[k]);
      const bv = b[k] == null ? -Infinity : (b[k] instanceof Date ? b[k].getTime() : b[k]);
      if (av < bv) return dir === 1 ? -1 : 1;
      if (av > bv) return dir === 1 ? 1 : -1;
    }
    return 0;
  });
};

const makeQuery = (filter) => {
  const state = { skip: 0, limit: 1000, sort: null };
  const q = {
    select() { return q; },
    populate() { return q; },
    hint() { return q; },
    sort(s) { state.sort = s; return q; },
    skip(n) { state.skip = n; return q; },
    limit(n) { state.limit = n; return q; },
    lean() {
      let rows = blogs.filter((b) => matches(b, filter));
      if (state.sort) rows = applySort(rows, state.sort);
      return Promise.resolve(rows.slice(state.skip, state.skip + state.limit).map((r) => ({ ...r })));
    },
    then(res, rej) { return q.lean().then(res, rej); },
  };
  return q;
};

const blogModelMod = await import('../src/features/blog/blog.model.js');
const Blog = blogModelMod.default;

Blog.find = (filter = {}) => makeQuery(filter);
Blog.countDocuments = (filter = {}) => {
  const count = blogs.filter((b) => matches(b, filter)).length;
  const chain = { hint: () => chain, exec: async () => count, then: (cb) => Promise.resolve(count).then(cb) };
  return chain;
};
Blog.findById = (id) => {
  const found = blogs.find((b) => b._id === id) || null;
  return Promise.resolve(found ? { ...found } : null);
};
Blog.findByIdAndUpdate = (id, updates) => {
  const idx = blogs.findIndex((b) => b._id === id);
  if (idx !== -1) blogs[idx] = { ...blogs[idx], ...updates };
  const result = idx !== -1 ? { ...blogs[idx] } : null;
  const p = { populate() { return p; }, then(res, rej) { return Promise.resolve(result).then(res, rej); } };
  return p;
};

const { getBlogs, updateBlog } = await import('../src/features/blog/blog.controller.js');
const cache = (await import('../src/utils/cache.util.js')).default;

const makeRes = () => {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.body = p; return res; };
  res.set = (k, v) => { if (typeof k === 'object') Object.assign(res.headers, k); else res.headers[k] = v; return res; };
  return res;
};

const listBlog = async () => {
  const res = makeRes();
  await getBlogs({ query: { page: '1', limit: '12', type: 'blog' } }, res);
  return res.body.data.map((b) => b.title);
};
const listNews = async () => {
  const res = makeRes();
  await getBlogs({ query: { page: '1', limit: '12', type: 'news' } }, res);
  return res.body.data;
};

test('type change blog -> news: leaves blog list, tops news list, publishedAt stamped', async () => {
  reseed();
  await cache.flush();

  const RECAT = 'The post that gets recategorised';

  // 1) It shows on the blog list, and this response is now cached.
  let blogTitles = await listBlog();
  assert.ok(blogTitles.includes(RECAT), 'precondition: post is in the blog list');

  // sanity: the blog-list response really was cached
  const cachedBlog = await cache.get('blogs:public:page:1:limit:12:sort:latest:type:blog:cat:all');
  assert.ok(cachedBlog, 'blog list response was cached');

  // 2) Recategorise it: blog -> news
  const req = {
    params: { id: makeObjectId(99) },
    body: { type: 'news' },
    file: undefined,
  };
  const res = makeRes();
  await updateBlog(req, res);
  assert.equal(res.statusCode, 200, res.body && res.body.error);
  assert.equal(res.body.data.type, 'news');

  // publishedAt must have been stamped (was null) so it can sort to the top
  assert.ok(res.body.data.publishedAt, 'publishedAt was stamped on the still-published post');

  // 3) Blog list must no longer contain it (source-type cache was flushed)
  blogTitles = await listBlog();
  assert.ok(!blogTitles.includes(RECAT), 'post left the blog list immediately');

  // 4) News list contains it AND it is first (freshest publishedAt)
  const news = await listNews();
  const newsTitles = news.map((n) => n.title);
  assert.ok(newsTitles.includes(RECAT), 'post joined the news list');
  assert.equal(news[0].title, RECAT, 'recategorised post is at the top of the news list');
});

test('regression: same-type edit still only clears its own list cache key shape', async () => {
  reseed();
  await cache.flush();

  await listNews(); // populate news cache
  const beforeKey = await cache.get('blogs:public:page:1:limit:12:sort:latest:type:news:cat:all');
  assert.ok(beforeKey, 'news list cached');

  const res = makeRes();
  await updateBlog({ params: { id: makeObjectId(2) }, body: { subHeading: 'edited sub' }, file: undefined }, res);
  assert.equal(res.statusCode, 200, res.body && res.body.error);

  const afterKey = await cache.get('blogs:public:page:1:limit:12:sort:latest:type:news:cat:all');
  assert.equal(afterKey, null, 'news list cache invalidated after a news edit');
});
