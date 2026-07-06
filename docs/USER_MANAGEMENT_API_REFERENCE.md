# User Management API - Visual Reference

## Complete Endpoint Reference

### 📊 Statistics & Analytics

#### Get User Statistics
```
GET /api/users/stats

✅ Returns: Dashboard statistics (total users, admins, moderators, active users, etc.)
🔒 Auth: Required
⏱️ Rate: Standard
📦 Query Params: None
```

**Example:**
```bash
curl http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer TOKEN"
```

**Response Status**: 200 OK
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalAdmins": 3,
    "totalModerators": 5,
    "totalRegularUsers": 142,
    "activeUsers": 120,
    "inactiveUsers": 30,
    "verifiedEmails": 145,
    "activeIn30Days": 98
  }
}
```

---

#### Get Active Sessions
```
GET /api/users/sessions/active

✅ Returns: Count of active sessions (last 24 hours)
🔒 Auth: Required
⏱️ Rate: Standard
📦 Query Params: None
```

---

#### Get Activity Summary
```
GET /api/users/activity-summary

✅ Returns: User activity stats for specified period
🔒 Auth: Required
⏱️ Rate: Standard
📦 Query Params:
  - days (integer, default: 30)
```

**Example:**
```bash
curl 'http://localhost:5000/api/users/activity-summary?days=30' \
  -H "Authorization: Bearer TOKEN"
```

---

### 👥 User Listing & Search

#### Get All Users (with Pagination & Filtering)
```
GET /api/users

✅ Returns: Paginated list of users
🔒 Auth: Required (any authenticated user)
⏱️ Rate: Standard
📦 Query Params:
  - page (integer, default: 1)
  - limit (integer, default: 20, max: 100)
  - search (string)
  - role (enum: user, moderator, admin)
  - status (enum: active, inactive)
  - sortBy (string, default: createdAt)
  - sortOrder (integer, 1 or -1)
  - dateFrom (ISO date string)
  - dateTo (ISO date string)
```

**Examples:**

Get first page with 20 users:
```bash
curl 'http://localhost:5000/api/users?page=1&limit=20' \
  -H "Authorization: Bearer TOKEN"
```

Get admin users only:
```bash
curl 'http://localhost:5000/api/users?role=admin' \
  -H "Authorization: Bearer TOKEN"
```

Search by username:
```bash
curl 'http://localhost:5000/api/users?search=john' \
  -H "Authorization: Bearer TOKEN"
```

Combine filters:
```bash
curl 'http://localhost:5000/api/users?role=moderator&status=active&sortBy=lastLogin&sortOrder=-1' \
  -H "Authorization: Bearer TOKEN"
```

---

#### Get Single User
```
GET /api/users/:userId

✅ Returns: Full user object
🔒 Auth: Required (own or admin)
⏱️ Rate: Standard
📦 URL Params:
  - userId (string, required)
```

**Example:**
```bash
curl 'http://localhost:5000/api/users/507f1f77bcf86cd799439011' \
  -H "Authorization: Bearer TOKEN"
```

---

#### Get Users by Role
```
GET /api/users/role/:role

✅ Returns: Paginated users with specified role
🔒 Auth: Required
⏱️ Rate: Standard
📦 URL Params:
  - role (enum: user, moderator, admin, required)
📦 Query Params:
  - page (integer)
  - limit (integer)
  - search (string)
```

**Examples:**

Get all admins:
```bash
curl 'http://localhost:5000/api/users/role/admin' \
  -H "Authorization: Bearer TOKEN"
```

Get moderators on page 2:
```bash
curl 'http://localhost:5000/api/users/role/moderator?page=2&limit=25' \
  -H "Authorization: Bearer TOKEN"
```

---

#### Search Users (Public)
```
GET /api/users/search

✅ Returns: Matched users (max 50 results)
🔒 Auth: NOT required
⏱️ Rate: Standard
📦 Query Params:
  - q (string, required)
  - role (string, optional)
  - status (string, optional)
  - sortBy (string, optional)
  - sortOrder (integer, optional)
```

**Examples:**

Search by name:
```bash
curl 'http://localhost:5000/api/users/search?q=john'
```

Search admin named john:
```bash
curl 'http://localhost:5000/api/users/search?q=john&role=admin'
```

---

### 🔧 Admin Operations

#### Update User Role
```
PUT /api/users/:userId/role

✅ Returns: Updated user info
🔒 Auth: ADMIN ONLY
⏱️ Rate: Strict (sensitive)
📦 URL Params:
  - userId (string, required)
📦 Body:
  - role (enum: user, moderator, admin, required)

❌ Restrictions:
  - Cannot downgrade own role
```

**Example:**
```bash
curl -X PUT 'http://localhost:5000/api/users/507f1f77bcf86cd799439011/role' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "moderator"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "wondertravelsnepal@gmail.com",
    "oldRole": "user",
    "newRole": "moderator",
    "updatedAt": "2026-03-10T10:30:00Z"
  }
}
```

---

#### Update User Status
```
PUT /api/users/:userId/status

✅ Returns: Updated user status info
🔒 Auth: ADMIN ONLY
⏱️ Rate: Strict (sensitive)
📦 URL Params:
  - userId (string, required)
📦 Body:
  - active (boolean, required)
  - reason (string, optional)

❌ Restrictions:
  - Cannot deactivate own account
```

**Example - Deactivate:**
```bash
curl -X PUT 'http://localhost:5000/api/users/507f1f77bcf86cd799439011/status' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false,
    "reason": "Violation of terms of service"
  }'
```

**Example - Activate:**
```bash
curl -X PUT 'http://localhost:5000/api/users/507f1f77bcf86cd799439011/status' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": true
  }'
```

---

#### Delete User
```
DELETE /api/users/:userId

✅ Returns: Deletion confirmation
🔒 Auth: ADMIN ONLY
⏱️ Rate: Strict (sensitive)
📦 URL Params:
  - userId (string, required)
📦 Body:
  - softDelete (boolean, default: true)
  - reason (string, optional)

Options:
  - softDelete: true → Marks as inactive (reversible)
  - softDelete: false → Permanently removes from database

❌ Restrictions:
  - Cannot delete own account
```

**Example - Soft Delete:**
```bash
curl -X DELETE 'http://localhost:5000/api/users/507f1f77bcf86cd799439011' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "softDelete": true,
    "reason": "Account deletion requested by user"
  }'
```

**Example - Hard Delete:**
```bash
curl -X DELETE 'http://localhost:5000/api/users/507f1f77bcf86cd799439011' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "softDelete": false,
    "reason": "Permanent deletion for compliance"
  }'
```

---

### 🔀 Bulk Operations

#### Bulk Update User Roles
```
POST /api/users/bulk-role-update

✅ Returns: Update summary
🔒 Auth: ADMIN ONLY
⏱️ Rate: Strict (sensitive)
📦 Body:
  - userIds (array of strings, required, min: 1)
  - role (enum: user, moderator, admin, required)
```

**Example:**
```bash
curl -X POST 'http://localhost:5000/api/users/bulk-role-update' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "role": "moderator"
  }'
```

**Response:**
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

#### Bulk Update User Status
```
POST /api/users/bulk-status-update

✅ Returns: Update summary
🔒 Auth: ADMIN ONLY
⏱️ Rate: Strict (sensitive)
📦 Body:
  - userIds (array of strings, required, min: 1)
  - active (boolean, required)
```

**Example - Activate Multiple Users:**
```bash
curl -X POST 'http://localhost:5000/api/users/bulk-status-update' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "active": true
  }'
```

**Example - Deactivate Multiple Users:**
```bash
curl -X POST 'http://localhost:5000/api/users/bulk-status-update' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "active": false
  }'
```

---

## Quick Lookup Table

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/users/stats` | GET | ✅ | Get statistics |
| `/api/users` | GET | ✅ | List users |
| `/api/users/:id` | GET | ✅ | Get single user |
| `/api/users/search` | GET | ❌ | Search users |
| `/api/users/sessions/active` | GET | ✅ | Active sessions |
| `/api/users/activity-summary` | GET | ✅ | Activity stats |
| `/api/users/role/:role` | GET | ✅ | Filter by role |
| `/api/users/:id/role` | PUT | 🔐 | Update role |
| `/api/users/:id/status` | PUT | 🔐 | Update status |
| `/api/users/:id` | DELETE | 🔐 | Delete user |
| `/api/users/bulk-role-update` | POST | 🔐 | Bulk role update |
| `/api/users/bulk-status-update` | POST | 🔐 | Bulk status update |

Legend: ✅ = Auth Required | ❌ = No Auth | 🔐 = Admin Only

---

## Common Use Cases

### 1. Display Dashboard Statistics
```bash
# Get all stats
GET /api/users/stats
```
Display: Total Users, Admins, Moderators, Active Users

---

### 2. Display User Management Table
```bash
# Get paginated users
GET /api/users?page=1&limit=20

# Apply filters
GET /api/users?page=1&limit=20&role=admin&status=active
```

---

### 3. Search Users
```bash
# Quick search (public)
GET /api/users/search?q=john

# Admin search (authenticated)
GET /api/users?search=john&role=admin
```

---

### 4. Promote User to Admin
```bash
# Change role
PUT /api/users/{userId}/role
Body: { "role": "admin" }
```

---

### 5. Manage User Status
```bash
# Deactivate suspicious user
PUT /api/users/{userId}/status
Body: { "active": false, "reason": "Suspicious activity" }

# Reactivate user
PUT /api/users/{userId}/status
Body: { "active": true }
```

---

### 6. Bulk Promote Moderators
```bash
# Promote multiple users to moderators
POST /api/users/bulk-role-update
Body: {
  "userIds": ["id1", "id2", "id3"],
  "role": "moderator"
}
```

---

## HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid input/validation error |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions (admin only) |
| 404 | Not Found | User doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

---

## Error Examples

### Missing Required Field
```bash
curl -X PUT 'http://localhost:5000/api/users/id/role' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'  # Missing 'role' field
```

**Response (400):**
```json
{
  "success": false,
  "message": "Role is required"
}
```

---

### Unauthorized (No Token)
```bash
curl 'http://localhost:5000/api/users/stats'
```

**Response (401):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

### Forbidden (Not Admin)
```bash
curl -X PUT 'http://localhost:5000/api/users/id/role' \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

**Response (403):**
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

### User Not Found
```bash
curl 'http://localhost:5000/api/users/invalid-id' \
  -H "Authorization: Bearer TOKEN"
```

**Response (404/400):**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## Headers Reference

### Required Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json (for POST/PUT/DELETE)
```

### Optional Headers
```
X-Request-ID: <unique-id>
X-Device-Fingerprint: <fingerprint>
X-Audit-Source: <source>
```

---

## Parameter Validation

### Role Values
- `user` - Regular user
- `moderator` - Moderator
- `admin` - Administrator

### Status Values
- `active` - Active user
- `inactive` - Inactive user

### Sort Fields
- `createdAt` - Join date (default)
- `lastLogin` - Last login date
- `username` - Username
- `email` - Email address
- `role` - Role
- `active` - Activity status

### Sort Order
- `1` - Ascending (A→Z, old→new)
- `-1` - Descending (Z→A, new→old) (default)

---

## Response Pagination Format

```json
{
  "data": [ /* user objects */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## User Object Format

```json
{
  "sno": 1,
  "_id": "507f1f77bcf86cd799439011",
  "username": "johndoe",
  "email": "wondertravelsnepal@gmail.com",
  "firstName": "Subash",
  "lastName": "Thapa",
  "fullName": "Subash Thapa",
  "role": "admin",
  "avatar": "https://...",
  "status": "active",
  "joined": "2026-01-15T10:00:00Z",
  "lastLogin": "2026-03-10T09:30:00Z",
  "emailVerified": true
}
```

**Note**: Sensitive fields (password, tokens) are never included in responses.

---

## Integration Checklist

- [ ] Import user routes in app.js
- [ ] Register routes at /api/users
- [ ] Test all endpoints with valid token
- [ ] Test admin-only endpoints fail without admin role
- [ ] Verify pagination works
- [ ] Verify search/filters work
- [ ] Check audit logs are created
- [ ] Verify rate limiting works
- [ ] Test error scenarios
- [ ] Deploy to staging/production

---

**Last Updated**: March 10, 2026  
**API Version**: 1.0.0  
**Status**: ✅ Production Ready
