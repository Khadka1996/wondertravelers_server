# User Management System - Quick Reference

## Core Endpoints Summary

### Statistics
- `GET /api/users/stats` - Get user statistics

### User Listing & Search
- `GET /api/users` - Get all users (paginated, filterable)
- `GET /api/users/search?q=query` - Search users (public)
- `GET /api/users/:userId` - Get single user
- `GET /api/users/role/:role` - Get users by role

### Session & Activity
- `GET /api/users/sessions/active` - Get active sessions count
- `GET /api/users/activity-summary?days=30` - Get activity summary

### Admin Operations (Admin only)
- `PUT /api/users/:userId/role` - Update user role
- `PUT /api/users/:userId/status` - Activate/deactivate user
- `DELETE /api/users/:userId` - Delete user

### Bulk Operations (Admin only)
- `POST /api/users/bulk-role-update` - Bulk update roles
- `POST /api/users/bulk-status-update` - Bulk update status

---

## Common Queries

### Get Dashboard Stats
```bash
curl -X GET http://localhost:5000/api/users/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Get All Active Users
```bash
curl -X GET 'http://localhost:5000/api/users?status=active' \
  -H "Authorization: Bearer $TOKEN"
```

### Get All Admins
```bash
curl -X GET 'http://localhost:5000/api/users?role=admin' \
  -H "Authorization: Bearer $TOKEN"
```

### Get All Moderators
```bash
curl -X GET 'http://localhost:5000/api/users?role=moderator' \
  -H "Authorization: Bearer $TOKEN"
```

### Search by Email
```bash
curl -X GET 'http://localhost:5000/api/users?search=wondertravelsnepal@gmail.com' \
  -H "Authorization: Bearer $TOKEN"
```

### Promote User to Admin
```bash
curl -X PUT http://localhost:5000/api/users/$USER_ID/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

### Deactivate User
```bash
curl -X PUT http://localhost:5000/api/users/$USER_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active":false,"reason":"Policy violation"}'
```

---

## Response Examples

### Stats Response
```json
{
  "totalUsers": 150,
  "totalAdmins": 3,
  "totalModerators": 5,
  "activeUsers": 120,
  "inactiveUsers": 30,
  "activeIn30Days": 98
}
```

### User List Response
```json
{
  "data": [
    {
      "sno": 1,
      "id": "507f...",
      "username": "johndoe",
      "email": "wondertravelsnepal@gmail.com",
      "fullName": "Subash Thapa",
      "role": "admin",
      "status": "active",
      "joined": "2026-01-15T10:00:00Z",
      "lastLogin": "2026-03-10T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Filter Parameters

### Role Filter
- `role=admin` - Only admins
- `role=moderator` - Only moderators
- `role=user` - Only regular users
- (no role param) - All users

### Status Filter
- `status=active` - Only active users
- `status=inactive` - Only inactive users
- (no status param) - All users

### Sorting
- `sortBy=createdAt` - Sort by join date (default)
- `sortBy=lastLogin` - Sort by last login
- `sortBy=username` - Sort by username
- `sortOrder=1` - Ascending order
- `sortOrder=-1` - Descending order (default)

---

## Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 400 | Bad Request | Check query/body parameters |
| 401 | Unauthorized | Provide valid JWT token |
| 403 | Forbidden | Need admin role for this action |
| 404 | Not Found | User ID doesn't exist |
| 429 | Too Many Requests | Wait before retrying |
| 500 | Server Error | Contact admin |

---

## Integration Notes

### With Admin Dashboard
1. **Dashboard Tab**: Show stats from `/api/users/stats`
2. **User Table**: Fetch from `/api/users` with filters
3. **Search**: Use `/api/users/search` for public search
4. **Actions**: Use role/status endpoints for inline actions

### Pagination Strategy
```javascript
// Get first page
page=1&limit=20

// Get next page
page=2&limit=20

// Calculate max page
totalPages = Math.ceil(response.pagination.total / response.pagination.limit)
```

### Caching Recommendations
- Cache stats for 5 minutes
- Don't cache user list (changes frequently)
- Cache role options (static)

---

## Audit Trail

Every admin action is logged with:
- Timestamp
- Admin who performed action
- What action was performed
- Target user
- IP address and user agent
- Success/failure status

Access audit logs: `/api/audit`

---

## Security Checklist

✅ Always send JWT in Authorization header
✅ Use HTTPS in production
✅ Validate inputs on frontend
✅ Don't expose user IDs unnecessarily
✅ Implement CSRF protection
✅ Rate limit sensitive operations
✅ Monitor failed login attempts

---

## Performance Tips

1. Use pagination (don't fetch all users at once)
2. Filter by role/status to reduce results
3. Use search instead of listing all users
4. Cache stats on frontend
5. Implement debouncing on search input
6. Use limit=10 for dropdowns, limit=50 for tables

---

## Testing Examples

### Test Stats Endpoint
```bash
node -e "
const fetch = require('node-fetch');
fetch('http://localhost:5000/api/users/stats', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(console.error);
"
```

### Test User Search
```bash
node -e "
const fetch = require('node-fetch');
fetch('http://localhost:5000/api/users/search?q=john&role=admin', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)))
.catch(console.error);
"
```

---

## Files Modified/Created

- ✅ `/server/src/features/user/user.service.js` - Service layer
- ✅ `/server/src/features/user/user.controller.js` - Controllers
- ✅ `/server/src/features/user/user.routes.js` - Routes
- ✅ `/server/src/app.js` - Route registration
- ✅ `/docs/USER_MANAGEMENT_SYSTEM.md` - Full documentation

---

## Next Steps

1. Test all endpoints with Postman/curl
2. Integrate with admin dashboard frontend
3. Add user management UI components
4. Set up email notifications for admin actions
5. Create user activity reports
6. Add user import/export functionality

---

## Support

For issues or questions:
1. Check `/api-docs` for API documentation
2. Review audit logs for action history
3. Check server logs for errors
4. Contact system administrator
