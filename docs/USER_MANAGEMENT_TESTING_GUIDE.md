# User Management System - Testing Guide

## Setup Requirements

Before testing, ensure:
- Node.js server is running
- JWT tokens are available for testing
- At least one admin user exists
- MongoDB is connected

---

## Test Cases

### 1. Get User Statistics
**Endpoint**: `GET /api/users/stats`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "totalUsers": <number>,
    "totalAdmins": <number>,
    "totalModerators": <number>,
    "totalRegularUsers": <number>,
    "activeUsers": <number>,
    "inactiveUsers": <number>,
    "verifiedEmails": <number>,
    "activeIn30Days": <number>
  }
}
```

---

### 2. Get All Users with Pagination
**Endpoint**: `GET /api/users`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users?page=1&limit=10' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Validation**:
- Response has `data` array
- Response has `pagination` object
- `pagination.total` > 0
- `data` array length <= 10

---

### 3. Search Users by Role
**Endpoint**: `GET /api/users`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users?role=admin' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation**:
- All returned users have `role: "admin"`
- Response has pagination info

---

### 4. Search Users by Status
**Endpoint**: `GET /api/users`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users?status=active' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation**:
- All returned users have `status: "active"`

---

### 5. Search Users by Username/Email
**Endpoint**: `GET /api/users`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users?search=admin' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation**:
- Results contain users matching "admin" in username, email, or fullName

---

### 6. Get User by ID
**Endpoint**: `GET /api/users/:userId`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users/VALID_USER_ID' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation**:
- Returns user object with all fields
- No sensitive fields exposed (password, tokens, etc.)

---

### 7. Search Users (Public)
**Endpoint**: `GET /api/users/search`  
**Auth**: Not required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users/search?q=admin'
```

**Validation**:
- Works without Authorization header
- Returns limited results (max 50)

---

### 8. Get Users by Role
**Endpoint**: `GET /api/users/role/admin`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users/role/admin' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation**:
- All results have role "admin"

---

### 9. Get Active Sessions
**Endpoint**: `GET /api/users/sessions/active`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users/sessions/active' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "activeSessionsCount": <number>,
    "timestamp": "2026-03-10T10:30:00Z"
  }
}
```

---

### 10. Get Activity Summary
**Endpoint**: `GET /api/users/activity-summary`  
**Auth**: Required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X GET 'http://localhost:5000/api/users/activity-summary?days=30' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "newUsers": <number>,
    "activeUsers": <number>,
    "inactiveUsers": <number>,
    "totalActive": <number>
  }
}
```

---

### 11. Update User Role (Admin Only)
**Endpoint**: `PUT /api/users/:userId/role`  
**Auth**: Admin required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X PUT 'http://localhost:5000/api/users/TEST_USER_ID/role' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "moderator"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "userId": "TEST_USER_ID",
    "username": "<username>",
    "email": "<email>",
    "oldRole": "<old_role>",
    "newRole": "moderator",
    "updatedAt": "<timestamp>"
  }
}
```

**Negative Test - Try to downgrade own role**:
```bash
curl -X PUT 'http://localhost:5000/api/users/YOUR_ADMIN_ID/role' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user"}'
```

**Expected**: 400 error with message about cannot downgrade own role

---

### 12. Update User Status (Admin Only)
**Endpoint**: `PUT /api/users/:userId/status`  
**Auth**: Admin required  
**Expected Status**: 200

**Test Command - Deactivate**:
```bash
curl -X PUT 'http://localhost:5000/api/users/TEST_USER_ID/status' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false,
    "reason": "Test deactivation"
  }'
```

**Test Command - Activate**:
```bash
curl -X PUT 'http://localhost:5000/api/users/TEST_USER_ID/status' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

**Validation**:
- User status changes in database
- Audit log is created

---

### 13. Delete User (Admin Only)
**Endpoint**: `DELETE /api/users/:userId`  
**Auth**: Admin required  
**Expected Status**: 200

**Test Command - Soft Delete**:
```bash
curl -X DELETE 'http://localhost:5000/api/users/TEST_USER_ID' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "softDelete": true,
    "reason": "Account deleted by user"
  }'
```

**Test Command - Hard Delete**:
```bash
curl -X DELETE 'http://localhost:5000/api/users/TEST_USER_ID' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "softDelete": false,
    "reason": "Permanent deletion"
  }'
```

---

### 14. Bulk Update Roles (Admin Only)
**Endpoint**: `POST /api/users/bulk-role-update`  
**Auth**: Admin required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X POST 'http://localhost:5000/api/users/bulk-role-update' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["USER_ID_1", "USER_ID_2"],
    "role": "moderator"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Successfully updated 2 user(s)",
  "data": {
    "updated": 2,
    "total": 2
  }
}
```

---

### 15. Bulk Update Status (Admin Only)
**Endpoint**: `POST /api/users/bulk-status-update`  
**Auth**: Admin required  
**Expected Status**: 200

**Test Command**:
```bash
curl -X POST 'http://localhost:5000/api/users/bulk-status-update' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["USER_ID_1", "USER_ID_2"],
    "active": true
  }'
```

---

## Error Test Cases

### Missing Required Fields
```bash
curl -X PUT 'http://localhost:5000/api/users/TEST_USER_ID/role' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' # Missing role field
```

**Expected**: 400 Bad Request

---

### Invalid User ID
```bash
curl -X GET 'http://localhost:5000/api/users/invalid-id' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: 400 Bad Request or 404 Not Found

---

### Unauthorized Access
```bash
curl -X PUT 'http://localhost:5000/api/users/TEST_USER_ID/role' \
  -H "Authorization: Bearer REGULAR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

**Expected**: 403 Forbidden

---

### Missing Authentication
```bash
curl -X GET 'http://localhost:5000/api/users' \
  -H "Content-Type: application/json"
```

**Expected**: 401 Unauthorized

---

### Rate Limit Exceeded
Make multiple requests rapidly (more than rate limit allows)

**Expected**: 429 Too Many Requests

---

## Automated Test Script

Save as `test-user-management.js`:

```javascript
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  const adminToken = 'YOUR_ADMIN_TOKEN';
  const userId = 'TEST_USER_ID';

  console.log('🧪 Testing User Management System\n');

  try {
    // Test 1: Get stats
    console.log('1️⃣  Testing GET /users/stats');
    let res = await fetch(`${BASE_URL}/users/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(res.status === 200 ? '✅ PASS' : '❌ FAIL');

    // Test 2: Get all users
    console.log('2️⃣  Testing GET /users');
    res = await fetch(`${BASE_URL}/users?page=1&limit=10`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(res.status === 200 ? '✅ PASS' : '❌ FAIL');

    // Test 3: Get user by ID
    console.log('3️⃣  Testing GET /users/:userId');
    res = await fetch(`${BASE_URL}/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(res.status === 200 ? '✅ PASS' : '❌ FAIL');

    // Test 4: Search users
    console.log('4️⃣  Testing GET /users/search');
    res = await fetch(`${BASE_URL}/users/search?q=admin`);
    console.log(res.status === 200 ? '✅ PASS' : '❌ FAIL');

    console.log('\n✨ Test suite completed!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runTests();
```

Run with:
```bash
node test-user-management.js
```

---

## Postman Collection

Import this into Postman as a collection:

```json
{
  "info": {
    "name": "User Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Stats",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/users/stats",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ]
      }
    },
    {
      "name": "Get All Users",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/users?page=1&limit=20"
      }
    }
  ]
}
```

---

## Verification Checklist

- [ ] All endpoints return 200 status on success
- [ ] All admin-only endpoints return 403 for non-admin users
- [ ] All protected endpoints return 401 without token
- [ ] Search works with partial matches
- [ ] Pagination works correctly
- [ ] Filters (role, status) work correctly
- [ ] Sorting works in both directions
- [ ] Audit logs are created for admin actions
- [ ] Cannot downgrade own admin role
- [ ] Cannot deactivate own account
- [ ] Bulk operations update multiple users
- [ ] Error messages are descriptive
- [ ] Rate limiting works on sensitive operations

---

## Performance Testing

### Load Test
```bash
# Using Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/users?page=1&limit=20
```

### Results to Monitor
- Response time < 500ms
- No memory leaks
- Database query times < 100ms
- No timeout errors

---

## Debugging Tips

1. Check server logs for errors:
```bash
tail -f logs/app.log
```

2. Monitor database queries:
```bash
db.users.find().explain("executionStats")
```

3. Check audit logs:
```javascript
db.securityaudits.find({ action: 'update_user_role' }).pretty()
```

4. Test with verbose curl:
```bash
curl -v -X GET http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer TOKEN"
```

---

## Success Criteria

✅ All 15 test cases pass  
✅ No security vulnerabilities  
✅ Error handling works correctly  
✅ Performance metrics acceptable  
✅ Audit logging functional  
✅ Authorization checks working  
✅ Pagination functional  
✅ Search/filter working  
✅ Bulk operations successful  
✅ Database transactions reliable  

---

## Next Steps After Testing

1. Deploy to staging environment
2. Run load tests with production data volume
3. Test integration with admin dashboard
4. Conduct security audit
5. Deploy to production with monitoring
