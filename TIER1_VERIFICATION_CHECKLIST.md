# 🔍 TIER 1 VERIFICATION CHECKLIST

Use this checklist to confirm Tier 1 optimization is working correctly.

---

## Phase 1: Pre-Launch Verification (5 mins)

### Environment Configuration Check
- [ ] NODE_ENV is set to 'production'
  ```bash
  echo $NODE_ENV
  # Should output: production
  ```

- [ ] ENABLE_CLUSTER variable exists (or defaults to true in prod)
  ```bash
  echo $ENABLE_CLUSTER
  # Should be empty (uses default) or 'true'
  ```

- [ ] MongoDB URI is set
  ```bash
  echo $MONGO_URI | head -c 30
  # Should show connection string, not empty
  ```

### Code Verification
- [ ] Cluster util file exists
  ```bash
  ls -l server/src/utils/cluster.util.js
  # Should exist, > 100 bytes
  ```

- [ ] Dedup middleware file exists
  ```bash
  ls -l server/src/middleware/request-deduplication.middleware.js
  # Should exist, > 50 bytes
  ```

- [ ] Server.js has cluster imports
  ```bash
  grep -n "initializeCluster" server/src/server.js
  # Should find matches
  ```

- [ ] App.js has dedup middleware
  ```bash
  grep -n "requestDeduplication" server/src/app.js
  # Should find import and usage
  ```

---

## Phase 2: Server Startup (2 mins)

### Start Server
```bash
cd server
npm run start:prod
```

### Verify Startup Messages
Watch the console output for these messages in order:

- [ ] "✅ Cluster mode active"
  ```
  ✅ Cluster mode active - Primary process managing workers
  ```

- [ ] "🎯 Primary process" message
  ```
  🎯 Primary process XXXXX starting cluster mode
  ```

- [ ] CPU core count
  ```
  📊 Available CPUs: X, spawning X workers
  ```

- [ ] Worker online messages
  ```
  [!] Worker X (PID XXXX) online
  [!] Worker Y (PID YYYY) online
  ... (one per CPU core)
  ```

- [ ] "🗄️ MongoDB pool size" message
  ```
  🗄️ MongoDB pool size - Min: 75, Max: 250
  ```

- [ ] "Server running" message
  ```
  Server is running on http://localhost:5000
  ```

**⚠️ If any message is missing:** Check logs for errors. Common issues:
- `NODE_ENV` not set to production
- MongoDB connection failed
- Port 5000 already in use

---

## Phase 3: Endpoint Verification (3 mins)

Open another terminal. Test these endpoints:

### Cluster Status Endpoint
```bash
curl http://localhost:5000/api/cluster/info | jq .
```
**Expected Response:**
```json
{
  "mode": "cluster",
  "totalWorkers": 4,  // or # of your CPU cores
  "workers": [
    { "pid": XXXXX, "id": 1, "alive": true },
    { "pid": XXXXX, "id": 2, "alive": true },
    { "pid": XXXXX, "id": 3, "alive": true },
    { "pid": XXXXX, "id": 4, "alive": true }
  ]
}
```

**Checklist:**
- [ ] Endpoint returns 200 status
- [ ] "mode" is "cluster"
- [ ] "totalWorkers" equals your CPU core count
- [ ] All workers show "alive": true
- [ ] Worker count matches CPU count

### Blog Recent Endpoint
```bash
curl http://localhost:5000/api/blogs/recent
```
**Expected Response:**
- [ ] Status code 200
- [ ] Response contains array of blogs
- [ ] Each blog has: title, slug, excerpt, featuredImage, views, etc.
- [ ] Response time < 500ms (measured with `time curl`)

Test with timing:
```bash
time curl http://localhost:5000/api/blogs/recent > /dev/null
```

### Blog Trending Endpoint
```bash
curl http://localhost:5000/api/blogs/trending
```
**Expected Response:**
- [ ] Status code 200
- [ ] Response contains blogs sorted by views/engagement
- [ ] Response time < 500ms
- [ ] Repeated calls show cache hits faster

### Health Check Endpoint
```bash
curl http://localhost:5000/health | jq .
```
**Expected Response:**
```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2024-...",
  "uptime": XXX,
  "database": "connected",
  "redis": "connected" // if Redis configured
}
```

**Checklist:**
- [ ] Status is "ok"
- [ ] Database is "connected"
- [ ] Timestamp is recent
- [ ] Uptime is > 0

---

## Phase 4: Load Testing (10 mins)

Install autocannon if needed:
```bash
npm install -g autocannon
```

### Baseline Test (100 concurrent users)
```bash
autocannon -c 100 -d 30 http://localhost:5000/api/blogs
```

**Expected Results:**
- [ ] Requests/sec: > 500
- [ ] Errors: 0
- [ ] Timeout errors: 0
- [ ] Latency p95: < 300ms
- [ ] Latency p99: < 500ms

### Moderate Test (500 concurrent users)
```bash
autocannon -c 500 -d 30 http://localhost:5000/api/blogs
```

**Expected Results:**
- [ ] Requests/sec: > 1000
- [ ] Errors: 0 or < 1%
- [ ] Timeout errors: 0
- [ ] Latency p95: < 200ms
- [ ] CPU usage: 80-100%

### Heavy Test (1000 concurrent users - Tier 1 target)
```bash
autocannon -c 1000 -d 30 http://localhost:5000/api/blogs
```

**Expected Results:**
- [ ] Requests/sec: > 1000 (stable)
- [ ] Errors: < 1%
- [ ] Timeout errors: very few
- [ ] Latency p95: < 200ms
- [ ] Latency p99: < 300ms
- [ ] No crashed workers in original terminal

---

## Phase 5: Optimization Verification (5 mins)

### Verify .lean() Optimization
```bash
# Enable debug logging for Mongoose
DEBUG=mongoose:query npm run start:prod 2>&1 | grep "lean"
```

**Expected:** Queries should show `.lean()` being applied

### Verify Request Deduplication
```bash
# Send same request twice, very quickly
curl http://localhost:5000/api/blogs/trending & curl http://localhost:5000/api/blogs/trending
```

**Expected:**
- [ ] Both requests complete
- [ ] Both return same results
- [ ] Response headers show X-Dedup status
- [ ] First shows FRESH, second shows QUEUED or cached

### Verify Compression
```bash
curl -i http://localhost:5000/api/blogs | grep -i "content-encoding"
```

**Expected Output:**
```
content-encoding: gzip
```

**Checklist:**
- [ ] Content-Encoding header present
- [ ] Value is gzip (or deflate)
- [ ] Response body is smaller (compressed)

### Verify Multiple Processes
```bash
ps aux | grep "node src/server"
```

**Expected Output:** Multiple node processes (one per CPU core)
```
user    XXXXX  0.0  0.5 ... node server/src/server.js
user    XXXXX  0.0  0.5 ... node server/src/server.js
user    XXXXX  0.0  0.5 ... node server/src/server.js
user    XXXXX  0.0  0.5 ... node server/src/server.js
```

**Checklist:**
- [ ] Number of processes = CPU core count
- [ ] All processes show reasonable CPU/memory usage
- [ ] No processes in zombie state (<defunct>)

### Verify MongoDB Pool Size
```bash
grep -A2 "maxPoolSize" server/src/server.js
```

**Expected:**
```javascript
maxPoolSize: isProd ? 250 : 25
minPoolSize: isProd ? 75 : 4
```

**Checklist:**
- [ ] maxPoolSize is 250 (not 60)
- [ ] minPoolSize is 75 (not 8)

---

## Phase 6: Performance Baseline (15 mins)

Record these metrics for comparison later:

### Response Times
```bash
# Time 5 requests to blog endpoints
for i in {1..5}; do
  echo "Request $i:"
  time curl -s http://localhost:5000/api/blogs/recent > /dev/null
done
```

**Record:** Average response time: _____ ms

### Database Query Time
```bash
# Monitor slow queries
time curl -s http://localhost:5000/api/blogs/recent?limit=50
```

**Record:** Time for 50 blogs: _____ ms

### Memory Usage
```bash
# Check initial memory
ps aux | grep "node src/server" | grep -v grep
```

**Record:** Initial memory usage: _____ MB

### Active Connections
```bash
# Monitor for 30 seconds during load test
watch -n 1 'lsof -i :5000 | wc -l'
```

**Record:** Peak connections during load: _____ connections

---

## Phase 7: Monitoring Setup (5 mins)

### Terminal 1: Server Monitoring
```bash
# Watch cluster status continuously
watch -n 1 'curl -s http://localhost:5000/api/cluster/info | jq .'
```

**Checklist:**
- [ ] All workers remain "alive": true
- [ ] No worker restarts occur
- [ ] Cluster info updates every second

### Terminal 2: CPU/Memory Monitoring
```bash
top
```

**Look for:**
- [ ] 4 node processes (or # cores)
- [ ] CPU combined usage 80-95%
- [ ] Memory stable (not growing)

**Checklist:**
- [ ] CPU usage increases under load
- [ ] Memory doesn't continuously grow
- [ ] No single core maxes out (shows clustering works)

### Terminal 3: Log Monitoring
```bash
npm run start:prod 2>&1 | tee server.log
```

**Monitor for:**
- [ ] No error messages
- [ ] Worker crashes or respawns logged
- [ ] Database connection issues

**Checklist:**
- [ ] Log shows cluster startup messages
- [ ] No ERROR level messages
- [ ] Occasional warnings are OK

---

## Phase 8: Stress Testing (20 mins)

### Progressive Load Increase
```bash
# Run this sequence and check results

# 1. Light load
autocannon -c 100 -d 10 http://localhost:5000/api/blogs > test1.txt

# 2. Medium load
autocannon -c 500 -d 10 http://localhost:5000/api/blogs > test2.txt

# 3. Heavy load
autocannon -c 1000 -d 10 http://localhost:5000/api/blogs > test3.txt

# 4. Extreme load (optional, may hit OS limits)
autocannon -c 2000 -d 10 http://localhost:5000/api/blogs > test4.txt
```

**After Each Test - Check:**
- [ ] Error messages in server logs
- [ ] Worker processes still alive (curl cluster info)
- [ ] Response times didn't increase drastically

**Record Results:**
| Load | Req/sec | Errors | Latency p95 | Status |
|------|---------|--------|-------------|--------|
| 100  |         |        |             |        |
| 500  |         |        |             |        |
| 1000 |         |        |             |        |
| 2000 |         |        |             |        |

---

## Phase 9: Failure Recovery Test (5 mins)

### Test Worker Auto-Respawn
```bash
# While server is running, identify a worker PID
curl http://localhost:5000/api/cluster/info | jq '.workers[0].pid'

# Kill that worker process
kill -9 XXXXX  # Replace XXXXX with PID

# Check cluster recovers
curl http://localhost:5000/api/cluster/info

# Monitor logs - should show worker respawn
```

**Expected:**
- [ ] Server logs show worker crash
- [ ] Server logs show new worker spawning
- [ ] New worker gets new PID
- [ ] Cluster info shows all workers alive again
- [ ] No requests should have failed during recovery

---

## Phase 10: Success Criteria (Final Check)

### All Should Be True:
- [ ] Server starts with cluster mode message
- [ ] Cluster info shows N workers (= CPU cores)
- [ ] All workers show "alive": true
- [ ] Blog endpoints respond < 200ms
- [ ] Load test shows > 1000 req/sec at 1000 concurrent
- [ ] No errors during heavy load
- [ ] Multiple node processes visible
- [ ] Compression active (gzip in headers)
- [ ] Workers auto-respawn on crash
- [ ] Memory doesn't continuously grow

### If ALL are checked:
✅ **TIER 1 OPTIMIZATION IS WORKING CORRECTLY**

---

## Troubleshooting During Verification

### Cluster Mode Not Starting
**Symptom:** Only 1 worker or no cluster message
**Fix:**
```bash
export NODE_ENV=production
export ENABLE_CLUSTER=true
npm run start:prod
```

### High Error Rate in Load Test
**Symptom:** Errors: 50+ in autocannon
**Causes:**
- Database connection pool exhausted
- Workers crashing
- Memory pressure

**Fix:**
```bash
# Increase memory
export NODE_OPTIONS="--max-old-space-size=2048"
npm run start:prod

# Check logs for errors
npm run start:prod 2>&1 | grep -i error
```

### Workers Not Spawning
**Symptom:** Only 1 process in `ps aux`
**Fix:**
```bash
# Force production mode
NODE_ENV=production npm run start:prod

# Check if cluster import exists
grep -n "import.*cluster" server/src/utils/cluster.util.js
```

### Requests Timing Out
**Symptom:** "timeout" errors in autocannon
**Causes:**
- Server overloaded
- Database pool exhausted
- Long GC pauses

**Fix:**
```bash
# Lower concurrent load
autocannon -c 500 -d 30 # instead of 1000

# Check database pool
grep "maxPoolSize" server/src/server.js
# Should be 250
```

---

## Documentation References

After verification, review these for deeper understanding:

1. **TIER1_OPTIMIZATION_COMPLETE.md** - Complete details of each optimization
2. **TIER1_QUICK_START.md** - Quick reference guide
3. **OPTIMIZATION_ROADMAP.md** - Path to Tier 2 when ready
4. **BACKEND_PERFORMANCE_ANALYSIS.md** - Original analysis and bottlenecks

---

## Sign-Off

**Tier 1 Verification Complete:** ✅ **YES** / ❌ **NO**

**Date Verified:** ___________

**Baseline Performance:**
- Throughput: __________ req/sec
- Latency p95: __________ ms
- Concurrent Users: __________ 
- Error Rate: __________ %

**Notes:**
_________________________________________________________________

---

**Next Step:** Once verification is complete, monitor production for 24-48 hours, then decide if Tier 2 (load balancing) is needed.
