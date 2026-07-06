# User Management System - Complete Implementation Guide

## Overview
The user management system provides comprehensive backend functionality for managing users, their roles, and their statuses. This system is integrated into the admin dashboard and provides the following features:

### Key Features
✅ **User Statistics** - Total users, admins, moderators, active users  
✅ **User Listing** - Get all users with pagination, search, and filtering  
✅ **User Search** - Advanced search by username, email, or name  
✅ **Role Management** - Update user roles (user, moderator, admin)  
✅ **Status Management** - Activate/deactivate users  
✅ **Session Tracking** - Monitor active sessions  
✅ **Activity Summary** - User activity analytics  
✅ **Bulk Operations** - Bulk update roles and status  
✅ **Audit Logging** - All actions are logged for security  

---

## File Structure

```
/server/src/features/user/
├── user.service.js      # Business logic and database operations
├── user.controller.js   # Request handlers
└── user.routes.js       # Route definitions and validations
```

---

## API Endpoints

### 1. GET `/api/users/stats`
**Description**: Get user statistics and summary  
**Authentication**: Required (any authenticated user)  
**Rate Limit**: Standard

**Response**:
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
    "activeIn30Days": 98,
    "lastLoginStats": {
      "lastLogin": "2026-03-10T10:30:00Z",
      "avgLastLogin": 0.65
    }
  }
}
```

---

### 2. GET `/api/users`
**Description**: Get all users with pagination, search, and filters  
**Authentication**: Required (any authenticated user)  
**Rate Limit**: Standard

**Query Parameters**:
- `page` (integer, default: 1) - Page number for pagination
- `limit` (integer, default: 20, max: 100) - Items per page
- `search` (string) - Search by username, email, or name
- `role` (string) - Filter by role: 'user', 'moderator', 'admin'
- `status` (string) - Filter by status: 'active', 'inactive'
- `sortBy` (string, default: 'createdAt') - Sort field
- `sortOrder` (integer, default: -1) - 1 for ascending, -1 for descending
- `dateFrom` (string) - Filter from date (ISO format)
- `dateTo` (string) - Filter to date (ISO format)

**Example Request**:
```bash
GET /api/users?page=1&limit=20&search=john&role=admin&status=active&sortBy=createdAt&sortOrder=-1
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "sno": 1,
      "id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "wondertravelsnepal@gmail.com",
      "fullName": "Subash Thapa",
      "firstName": "Subash",
      "lastName": "Thapa",
      "role": "admin",
      "avatar": "https://example.com/avatar.jpg",
      "status": "active",
      "joined": "2026-01-15T10:00:00Z",
      "lastLogin": "2026-03-10T09:30:00Z",
      "emailVerified": true
    }
  ],
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

### 3. GET `/api/users/:userId`
**Description**: Get single user details by ID  
**Authentication**: Required  
**Rate Limit**: Standard

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "wondertravelsnepal@gmail.com",
    "firstName": "Subash",
    "lastName": "Thapa",
    "fullName": "Subash Thapa",
    "avatar": "https://example.com/avatar.jpg",
    "role": "admin",
    "active": true,
    "lastLogin": "2026-03-10T09:30:00Z",
    "createdAt": "2026-01-15T10:00:00Z",
    "emailVerified": true
  }
}
```

---

### 4. GET `/api/users/search?q=query`
**Description**: Search users (public endpoint)  
**Authentication**: Not required  
**Rate Limit**: Standard

**Query Parameters**:
- `q` (string, required) - Search query
- `role` (string, optional) - Filter by role
- `status` (string, optional) - Filter by status
- `sortBy` (string, optional) - Sort field
- `sortOrder` (integer, optional) - Sort order

**Response**:
```json
{
  "success": true,
  "query": "john",
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "johndoe",
      "email": "wondertravelsnepal@gmail.com",
      "fullName": "Subash Thapa",
      "role": "admin",
      "active": true,
      "lastLogin": "2026-03-10T09:30:00Z"
    }
  ]
}
```

---

### 5. GET `/api/users/sessions/active`
**Description**: Get active sessions count (last 24 hours)  
**Authentication**: Required  
**Rate Limit**: Standard

**Response**:
```json
{
  "success": true,
  "data": {
    "activeSessionsCount": 45,
    "timestamp": "2026-03-10T10:30:00Z"
  }
}
```

---

### 6. GET `/api/users/activity-summary?days=30`
**Description**: Get user activity summary  
**Authentication**: Required  
**Rate Limit**: Standard

**Query Parameters**:
- `days` (integer, default: 30) - Number of days to analyze

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "newUsers": 12,
    "activeUsers": 98,
    "inactiveUsers": 22,
    "totalActive": 120
  }
}
```

---

### 7. GET `/api/users/role/:role`
**Description**: Get users by role (admin, moderator, user)  
**Authentication**: Required  
**Rate Limit**: Standard

**Query Parameters**:
- `page` (integer, default: 1)
- `limit` (integer, default: 20)
- `search` (string, optional)

**Response**: Same as GET `/api/users`

---

### 8. PUT `/api/users/:userId/role`
**Description**: Update user role (Admin only)  
**Authentication**: Required (Admin only)  
**Rate Limit**: Strict (sensitive operation)

**Request Body**:
```json
{
  "role": "moderator"
}
```

**Response**:
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

**Possible Errors**:
- Admins cannot downgrade their own role
- Invalid role provided
- User not found

---

### 9. PUT `/api/users/:userId/status`
**Description**: Update user status (activate/deactivate) - Admin only  
**Authentication**: Required (Admin only)  
**Rate Limit**: Strict (sensitive operation)

**Request Body**:
```json
{
  "active": false,
  "reason": "Account suspended due to policy violation"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "wondertravelsnepal@gmail.com",
    "previousStatus": true,
    "currentStatus": false,
    "reason": "Account suspended due to policy violation",
    "updatedAt": "2026-03-10T10:30:00Z"
  }
}
```

**Possible Errors**:
- Cannot deactivate own account
- User not found

---

### 10. DELETE `/api/users/:userId`
**Description**: Delete user (soft or hard delete) - Admin only  
**Authentication**: Required (Admin only)  
**Rate Limit**: Strict (sensitive operation)

**Request Body**:
```json
{
  "softDelete": true,
  "reason": "Account deletion requested by user"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "deleted": true,
    "type": "soft_delete",
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

**Notes**:
- `softDelete: true` (default) - Marks user as inactive
- `softDelete: false` - Permanently deletes from database
- Cannot delete own account

---

### 11. POST `/api/users/bulk-role-update`
**Description**: Bulk update user roles - Admin only  
**Authentication**: Required (Admin only)  
**Rate Limit**: Strict (sensitive operation)

**Request Body**:
```json
{
  "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "role": "moderator"
}
```

**Response**:
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

### 12. POST `/api/users/bulk-status-update`
**Description**: Bulk update user status - Admin only  
**Authentication**: Required (Admin only)  
**Rate Limit**: Strict (sensitive operation)

**Request Body**:
```json
{
  "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "active": true
}
```

**Response**:
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

## Usage Examples

### Example 1: Get User Statistics
```bash
curl -X GET http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 2: Search Users by Email
```bash
curl -X GET 'http://localhost:5000/api/users?search=wondertravelsnepal@gmail.com' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 3: List All Admin Users
```bash
curl -X GET 'http://localhost:5000/api/users?role=admin&status=active' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 4: Update User Role (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/users/507f1f77bcf86cd799439011/role \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "moderator"
  }'
```

### Example 5: Deactivate User (Admin Only)
```bash
curl -X PUT http://localhost:5000/api/users/507f1f77bcf86cd799439011/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false,
    "reason": "Violation of terms"
  }'
```

### Example 6: Bulk Update Roles
```bash
curl -X POST http://localhost:5000/api/users/bulk-role-update \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "role": "moderator"
  }'
```

---

## Security Features

### 1. Authentication & Authorization
- All endpoints require JWT authentication (except public search)
- Admin-only endpoints enforce admin role
- Users can only view their own details (unless admin)

### 2. Rate Limiting
- Standard endpoints: 250 requests/15 minutes
- Sensitive operations: Stricter rate limiting

### 3. Audit Logging
- All admin actions are logged in SecurityAudit collection
- Logs include:
  - Admin who performed action
  - Action type and category
  - IP address and user agent
  - Timestamp
  - Metadata about changes

### 4. Data Validation
- Input validation using Zod schemas
- MongoDB injection protection
- XSS prevention through sanitization

### 5. Safeguards
- Cannot downgrade own admin role
- Cannot deactivate own account
- Cannot delete own account

---

## Database Queries Used

### Total Users Count
```javascript
User.countDocuments()
```

### Users by Role
```javascript
User.countDocuments({ role: 'admin' })
User.countDocuments({ role: 'moderator' })
User.countDocuments({ role: 'user' })
```

### Active Users
```javascript
User.countDocuments({ active: true })
User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 24*60*60*1000) } })
```

### Search & Filter
```javascript
User.find({
  $or: [
    { username: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
    { fullName: { $regex: search, $options: 'i' } }
  ],
  role: { $in: roles },
  active: true,
  createdAt: { $gte: from, $lte: to }
})
```

---

## Integration with Admin Dashboard

The user management system is designed to support the admin dashboard with:

1. **User Summary Card** - Shows total users, admins, moderators, active users
2. **User List Table** - Displays all users with:
   - Search functionality
   - Role and status filters
   - Pagination
   - Sorting
3. **User Actions** - Inline actions for each user:
   - View details
   - Change role
   - Activate/deactivate
   - Delete
4. **Bulk Operations** - Perform actions on multiple users at once

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- 200: Success
- 400: Bad Request (validation error)
- 401: Unauthorized (invalid/missing token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 429: Too Many Requests (rate limit exceeded)
- 500: Server Error

---

## Performance Considerations

### Indexing
- `username` - Indexed for search
- `email` - Indexed for search
- `role` - Indexed for filtering
- `active` - Indexed for filtering
- `createdAt` - Indexed for sorting

### Query Optimization
- Uses `.lean()` for read-only queries (faster)
- Limits results to prevent memory issues
- Pagination implemented for large datasets
- Field selection to exclude sensitive data

### Caching
- Search results can be cached (optional)
- Statistics can be cached for 5 minutes
- Redis integration available

---

## Future Enhancements

- [ ] Advanced permission system (granular permissions per role)
- [ ] User groups for bulk management
- [ ] Activity history per user
- [ ] Email notifications for actions
- [ ] Two-factor authentication
- [ ] User analytics dashboard
- [ ] Export user data (CSV/Excel)
- [ ] User import/batch operations
- [ ] Compliance reporting

---

## Troubleshooting

### Issue: "User not found"
- Verify the user ID is correct and in ObjectId format
- Check if user was deleted

### Issue: "Cannot downgrade your own role"
- Cannot use this endpoint to demote yourself
- Ask another admin to change your role

### Issue: "Rate limit exceeded"
- Wait 15 minutes before making another request
- Reduce frequency of API calls

### Issue: "Unknown error"
- Check server logs for detailed error information
- Ensure JWT token is valid
- Verify admin permissions for sensitive operations

---

## Support & Documentation

For additional support:
- Check audit logs for action history
- Review security configuration
- Contact system administrator
- Check API documentation at `/api-docs`
