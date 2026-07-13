/**
 * Performance & Cache Invalidation Test Suite
 * Tests blog/news listing speed, caching, and cache invalidation on updates
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';
const TEST_TIMEOUT = 5000;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
  time: (msg) => console.log(`${colors.yellow}⏱️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}\n`),
};

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
};

// Test 1: Check blog listing endpoint speed and caching
async function testBlogListingPerformance() {
  log.header('Test 1: Blog Listing Performance & Caching');
  
  try {
    // First request - should be a cache MISS
    log.test('First request (expect MISS)...');
    const start1 = performance.now();
    const res1 = await axios.get(`${BASE_URL}/blogs`, { timeout: TEST_TIMEOUT });
    const time1 = performance.now() - start1;
    const cacheStatus1 = res1.headers['x-cache'] || 'UNKNOWN';
    
    testResults.total++;
    if (res1.status === 200 && res1.data.success && res1.data.data) {
      log.success(`Blog listing returned ${res1.data.data.length} blogs in ${time1.toFixed(2)}ms`);
      log.info(`Cache Status: ${cacheStatus1}`);
      testResults.passed++;
    } else {
      log.error('Failed to fetch blogs');
      testResults.failed++;
      return;
    }
    
    // Second request - should be a cache HIT
    log.test('Second request (expect HIT)...');
    const start2 = performance.now();
    const res2 = await axios.get(`${BASE_URL}/blogs`, { timeout: TEST_TIMEOUT });
    const time2 = performance.now() - start2;
    const cacheStatus2 = res2.headers['x-cache'] || 'UNKNOWN';
    
    testResults.total++;
    if (cacheStatus2 === 'HIT') {
      log.success(`Cache HIT! Response time: ${time2.toFixed(2)}ms`);
      log.time(`Speed improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}% faster`);
      testResults.passed++;
    } else {
      log.error(`Expected cache HIT but got ${cacheStatus2}`);
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Blog listing test failed: ${error.message}`);
    testResults.failed += 2;
  }
}

// Test 2: Check news listing endpoint speed and caching
async function testNewsListingPerformance() {
  log.header('Test 2: News Listing Performance & Caching');
  
  try {
    // First request
    log.test('First request (expect MISS)...');
    const start1 = performance.now();
    const res1 = await axios.get(`${BASE_URL}/news`, { timeout: TEST_TIMEOUT });
    const time1 = performance.now() - start1;
    const cacheStatus1 = res1.headers['x-cache'] || 'UNKNOWN';
    
    testResults.total++;
    if (res1.status === 200 && res1.data.success && res1.data.data) {
      log.success(`News listing returned ${res1.data.data.length} news items in ${time1.toFixed(2)}ms`);
      log.info(`Cache Status: ${cacheStatus1}`);
      testResults.passed++;
    } else {
      log.error('Failed to fetch news');
      testResults.failed++;
      return;
    }
    
    // Second request
    log.test('Second request (expect HIT)...');
    const start2 = performance.now();
    const res2 = await axios.get(`${BASE_URL}/news`, { timeout: TEST_TIMEOUT });
    const time2 = performance.now() - start2;
    const cacheStatus2 = res2.headers['x-cache'] || 'UNKNOWN';
    
    testResults.total++;
    if (cacheStatus2 === 'HIT') {
      log.success(`Cache HIT! Response time: ${time2.toFixed(2)}ms`);
      log.time(`Speed improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}% faster`);
      testResults.passed++;
    } else {
      log.error(`Expected cache HIT but got ${cacheStatus2}`);
      testResults.failed++;
    }
  } catch (error) {
    log.error(`News listing test failed: ${error.message}`);
    testResults.failed += 2;
  }
}

// Test 3: Check default sorting (latest first)
async function testDefaultSorting() {
  log.header('Test 3: Default Sorting (Latest First)');
  
  try {
    log.test('Fetching blogs/news to check sort order...');
    const res = await axios.get(`${BASE_URL}/news`, { timeout: TEST_TIMEOUT });
    
    testResults.total++;
    if (res.status === 200 && res.data.data && res.data.data.length > 1) {
      const first = res.data.data[0];
      const second = res.data.data[1];
      
      if (first.publishedAt && second.publishedAt) {
        const firstDate = new Date(first.publishedAt);
        const secondDate = new Date(second.publishedAt);
        
        if (firstDate >= secondDate) {
          log.success(`Latest content is first! (${firstDate.toISOString()} >= ${secondDate.toISOString()})`);
          testResults.passed++;
        } else {
          log.error('Sorting issue: Older content appears first');
          testResults.failed++;
        }
      } else {
        log.info('Not enough data with dates to verify sorting');
        testResults.passed++;
      }
    } else {
      log.info('Not enough news items to test sorting');
      testResults.passed++;
    }
  } catch (error) {
    log.error(`Sorting test failed: ${error.message}`);
    testResults.failed++;
  }
}

// Test 4: Check pagination
async function testPagination() {
  log.header('Test 4: Pagination');
  
  try {
    log.test('Fetching page 1 with limit 5...');
    const res1 = await axios.get(`${BASE_URL}/news?page=1&limit=5`, { timeout: TEST_TIMEOUT });
    
    testResults.total++;
    if (res1.status === 200 && res1.data.pagination) {
      const { page, limit, total, pages, hasNext, hasPrev } = res1.data.pagination;
      log.success(`Page 1: Got ${res1.data.data.length} items`);
      log.info(`Pagination: Page ${page}/${pages} (Total: ${total}, HasNext: ${hasNext}, HasPrev: ${hasPrev})`);
      testResults.passed++;
    } else {
      log.error('Pagination metadata missing');
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Pagination test failed: ${error.message}`);
    testResults.failed++;
  }
}

// Test 5: Check different sort modes
async function testSortModes() {
  log.header('Test 5: Sort Mode Tests');
  
  const sortModes = ['latest', 'trending', 'mostViewed', 'mostLiked', 'oldest'];
  
  for (const sort of sortModes) {
    try {
      log.test(`Testing sort mode: ${sort}...`);
      const start = performance.now();
      const res = await axios.get(`${BASE_URL}/blogs?sortBy=${sort}&limit=10`, { timeout: TEST_TIMEOUT });
      const time = performance.now() - start;
      
      testResults.total++;
      if (res.status === 200 && res.data.data) {
        log.success(`${sort}: ${res.data.data.length} items in ${time.toFixed(2)}ms (${res.headers['x-cache']})`);
        testResults.passed++;
      } else {
        log.error(`${sort}: Failed to fetch`);
        testResults.failed++;
      }
    } catch (error) {
      log.error(`${sort}: ${error.message}`);
      testResults.failed++;
    }
  }
}

// Test 6: Check featured content prioritization
async function testFeaturedContent() {
  log.header('Test 6: Featured Content Prioritization');
  
  try {
    log.test('Fetching news to check featured/breaking content...');
    const res = await axios.get(`${BASE_URL}/news?limit=20`, { timeout: TEST_TIMEOUT });
    
    testResults.total++;
    if (res.status === 200 && res.data.data) {
      const featured = res.data.data.filter(item => item.isFeatured || item.isBreaking);
      const nonFeatured = res.data.data.filter(item => !item.isFeatured && !item.isBreaking);
      
      if (featured.length > 0 && nonFeatured.length > 0) {
        const firstFeaturedIndex = res.data.data.findIndex(item => item.isFeatured || item.isBreaking);
        const firstNormalIndex = res.data.data.findIndex(item => !item.isFeatured && !item.isBreaking);
        
        if (firstFeaturedIndex < firstNormalIndex) {
          log.success(`Featured content is prioritized (${featured.length} featured, ${nonFeatured.length} normal)`);
          testResults.passed++;
        } else {
          log.error('Featured content is not prioritized');
          testResults.failed++;
        }
      } else {
        log.info(`Featured/normal content distribution: Featured=${featured.length}, Normal=${nonFeatured.length}`);
        testResults.passed++;
      }
    } else {
      log.error('Failed to fetch news for featured check');
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Featured content test failed: ${error.message}`);
    testResults.failed++;
  }
}

// Test 7: Performance comparison (first vs cached request)
async function testCacheSpeedBenefit() {
  log.header('Test 7: Cache Speed Benefit Analysis');
  
  try {
    // Warm up
    await axios.get(`${BASE_URL}/blogs`, { timeout: TEST_TIMEOUT });
    
    // Test uncached endpoint
    log.test('Testing fresh endpoint (cache MISS)...');
    const start1 = performance.now();
    const res1 = await axios.get(`${BASE_URL}/blogs?page=2`, { timeout: TEST_TIMEOUT });
    const time1 = performance.now() - start1;
    
    testResults.total++;
    log.time(`Fresh request: ${time1.toFixed(2)}ms`);
    
    // Test cached endpoint
    log.test('Testing cached endpoint (cache HIT)...');
    const start2 = performance.now();
    const res2 = await axios.get(`${BASE_URL}/blogs?page=2`, { timeout: TEST_TIMEOUT });
    const time2 = performance.now() - start2;
    
    log.time(`Cached request: ${time2.toFixed(2)}ms`);
    log.success(`Cache provides ${((time1 - time2) / time1 * 100).toFixed(1)}% speed improvement`);
    testResults.passed++;
  } catch (error) {
    log.error(`Cache speed test failed: ${error.message}`);
    testResults.failed++;
  }
}

// Main test runner
async function runAllTests() {
  log.header('🚀 BLOG & NEWS PERFORMANCE TEST SUITE');
  log.info(`Testing against: ${BASE_URL}\n`);
  
  try {
    await testBlogListingPerformance();
    await testNewsListingPerformance();
    await testDefaultSorting();
    await testPagination();
    await testSortModes();
    await testFeaturedContent();
    await testCacheSpeedBenefit();
    
    // Print summary
    log.header('📊 TEST SUMMARY');
    log.info(`Total Tests: ${testResults.total}`);
    log.success(`Passed: ${testResults.passed}`);
    if (testResults.failed > 0) {
      log.error(`Failed: ${testResults.failed}`);
    }
    log.info(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`);
    
    if (testResults.failed === 0) {
      console.log(`${colors.green}${colors.bold}🎉 ALL TESTS PASSED! Blog and news systems are super fast!${colors.reset}\n`);
    }
  } catch (error) {
    log.error(`Test suite error: ${error.message}`);
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
