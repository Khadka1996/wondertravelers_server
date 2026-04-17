# Wondertravelers API - Quick Reference Guide

**Quick Links:** [Complete Analysis](./COMPLETE_SERVER_ANALYSIS.md) | [Auth Docs](./auth.md) | [Blog Docs](./blogs.md)

---

## Base URL
```
Development: http://localhost:5000
Production: https://api.wondertravelers.com
```

---

## 1. Authentication Endpoints

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "SecurePass123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-id",
      "email": "user@example.com",
      "username": "username",
      "role": "user"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Get Current User Profile
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <accessToken>"
```

### Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'
```

### Change Password
```bash
curl -X POST http://localhost:5000/api/auth/change-password \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "CurrentPass123!",
    "newPassword": "NewPass456!"
  }'
```

### Upload Avatar
```bash
curl -X POST http://localhost:5000/api/auth/avatar \
  -H "Authorization: Bearer <accessToken>" \
  -F "avatar=@/path/to/avatar.jpg"
```

---

## 2. Blog Endpoints

### Get All Blogs
```bash
curl -X GET "http://localhost:5000/api/blogs?page=1&limit=10&category=slug" \
  -H "Content-Type: application/json"
```

### Get Single Blog
```bash
curl -X GET http://localhost:5000/api/blogs/:id \
  -H "Content-Type: application/json"
```

### Create Blog (Admin Only)
```bash
curl -X POST http://localhost:5000/api/blogs \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Blog Title",
    "slug": "blog-title",
    "excerpt": "Short description",
    "content": "<h1>Content</h1>",
    "category": "category-id",
    "author": "author-id",
    "status": "published"
  }'
```

### Update Blog (Admin Only)
```bash
curl -X PATCH http://localhost:5000/api/blogs/:id \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "content": "<h1>Updated Content</h1>"
  }'
```

### Delete Blog (Admin Only)
```bash
curl -X DELETE http://localhost:5000/api/blogs/:id \
  -H "Authorization: Bearer <adminToken>"
```

### Get Blogs by Category
```bash
curl -X GET "http://localhost:5000/api/blogs/category/:categoryId?page=1&limit=10"
```

### Get Blog Comments
```bash
curl -X GET http://localhost:5000/api/blogs/:blogId/comments
```

### Post Comment
```bash
curl -X POST http://localhost:5000/api/blogs/:blogId/comments \
  -H "Content-Type: application/json" \
  -d '{
    "authorName": "Subash Thapa",
    "content": "Great article!",
    "parentComment": null
  }'
```

### Like Comment
```bash
curl -X POST http://localhost:5000/api/blogs/:blogId/comments/:commentId/like \
  -H "Authorization: Bearer <accessToken>"
```

---

## 3. Admin Endpoints (Admin Only)

### Get User Summary
```bash
curl -X GET http://localhost:5000/api/admin/users/summary \
  -H "Authorization: Bearer <adminToken>"
```

### List All Users
```bash
curl -X GET "http://localhost:5000/api/admin/users/all?page=1&limit=10&search=term" \
  -H "Authorization: Bearer <adminToken>"
```

### Get User Details
```bash
curl -X GET http://localhost:5000/api/admin/users/:userId \
  -H "Authorization: Bearer <adminToken>"
```

### Update User
```bash
curl -X PATCH http://localhost:5000/api/admin/users/:userId \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "moderator",
    "isActive": true
  }'
```

### Delete User
```bash
curl -X DELETE http://localhost:5000/api/admin/users/:userId \
  -H "Authorization: Bearer <adminToken>"
```

### Get System Settings
```bash
curl -X GET http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer <adminToken>"
```

### Update System Settings
```bash
curl -X PATCH http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenanceMode": false,
    "maxFileSize": 52428800
  }'
```

---

## 4. Backup Endpoints (Admin Only)

### Create Database Backup
```bash
curl -X POST http://localhost:5000/api/backup/db/create \
  -H "Authorization: Bearer <adminToken>"
```

### Create Files Backup
```bash
curl -X POST http://localhost:5000/api/backup/files/create \
  -H "Authorization: Bearer <adminToken>"
```

### List Backups
```bash
curl -X GET "http://localhost:5000/api/backup/gdrive/list?limit=20" \
  -H "Authorization: Bearer <adminToken>"
```

### Restore Backup
```bash
curl -X POST http://localhost:5000/api/backup/restore/:backupId \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "verifyIntegrity": true
  }'
```

### Upload Google Drive Credentials
```bash
curl -X POST http://localhost:5000/api/backup/gdrive/credentials \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "clientSecret": "your-secret",
    "refreshToken": "your-refresh-token"
  }'
```

### Get Backup Metrics
```bash
curl -X GET http://localhost:5000/api/backup/metrics \
  -H "Authorization: Bearer <adminToken>"
```

---

## 5. Analytics Endpoints (Admin Only)

### Get Global Reach Statistics
```bash
curl -X GET "http://localhost:5000/api/analytics/global-reach?startDate=2026-02-01&endDate=2026-02-27" \
  -H "Authorization: Bearer <adminToken>"
```

### Get Heatmap Data
```bash
curl -X GET "http://localhost:5000/api/analytics/heatmap?startDate=2026-02-01&endDate=2026-02-27" \
  -H "Authorization: Bearer <adminToken>"
```

### Get Regional Statistics
```bash
curl -X GET "http://localhost:5000/api/analytics/regional-stats?startDate=2026-02-01&endDate=2026-02-27" \
  -H "Authorization: Bearer <adminToken>"
```

### Get Analytics by Type
```bash
curl -X GET "http://localhost:5000/api/analytics/by-type/page_view?startDate=2026-02-01&endDate=2026-02-27" \
  -H "Authorization: Bearer <adminToken>"
```

### Cleanup Old Analytics
```bash
curl -X POST http://localhost:5000/api/analytics/cleanup \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "olderThanDays": 30,
    "eventType": "page_view"
  }'
```

---

## 6. Notification Endpoints

### Get Notifications
```bash
curl -X GET "http://localhost:5000/api/notifications?page=1&limit=20&unreadOnly=false" \
  -H "Authorization: Bearer <accessToken>"
```

### Get Unread Count
```bash
curl -X GET http://localhost:5000/api/notifications/unread-count \
  -H "Authorization: Bearer <accessToken>"
```

### Mark Notification as Read
```bash
curl -X PATCH http://localhost:5000/api/notifications/:notificationId/read \
  -H "Authorization: Bearer <accessToken>"
```

### Get Notification Preferences
```bash
curl -X GET http://localhost:5000/api/notifications/preferences \
  -H "Authorization: Bearer <accessToken>"
```

### Update Notification Preferences
```bash
curl -X PATCH http://localhost:5000/api/notifications/preferences \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": true,
    "pushNotifications": false,
    "inAppNotifications": true
  }'
```

### Delete Notification
```bash
curl -X DELETE http://localhost:5000/api/notifications/:notificationId \
  -H "Authorization: Bearer <accessToken>"
```

---

## 7. Verification Endpoints

### Send Phone OTP
```bash
curl -X POST http://localhost:5000/api/verification/phone/send-otp \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890"
  }'
```

### Verify Phone OTP
```bash
curl -X POST http://localhost:5000/api/verification/phone/verify-otp \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456"
  }'
```

### Generate 2FA Secret
```bash
curl -X POST http://localhost:5000/api/verification/2fa/generate \
  -H "Authorization: Bearer <accessToken>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### Verify and Enable 2FA
```bash
curl -X POST http://localhost:5000/api/verification/2fa/verify \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "secret": "JBSWY3DPEBLW64TMMQ======"
  }'
```

### Get 2FA Status
```bash
curl -X GET http://localhost:5000/api/verification/2fa/status \
  -H "Authorization: Bearer <accessToken>"
```

### Get Backup Codes
```bash
curl -X GET http://localhost:5000/api/verification/2fa/backup-codes \
  -H "Authorization: Bearer <accessToken>"
```

### Add Address
```bash
curl -X POST http://localhost:5000/api/verification/address/add \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "shipping",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "US",
    "zipCode": "10001"
  }'
```

### Get All Addresses
```bash
curl -X GET http://localhost:5000/api/verification/address/all \
  -H "Authorization: Bearer <accessToken>"
```

### Set Default Address
```bash
curl -X POST http://localhost:5000/api/verification/address/:addressId/set-default \
  -H "Authorization: Bearer <accessToken>"
```

### Set WhatsApp Number
```bash
curl -X POST http://localhost:5000/api/verification/whatsapp/set \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890"
  }'
```

---

## 8. Moderator Endpoints (Moderator+ Only)

### List Users
```bash
curl -X GET "http://localhost:5000/api/moderator/users?page=1&limit=10&search=term&role=user&active=true" \
  -H "Authorization: Bearer <moderatorToken>"
```

### Get User Details
```bash
curl -X GET http://localhost:5000/api/moderator/users/:userId \
  -H "Authorization: Bearer <moderatorToken>"
```

### Deactivate User
```bash
curl -X POST http://localhost:5000/api/moderator/users/:userId/deactivate \
  -H "Authorization: Bearer <moderatorToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Violating terms of service"
  }'
```

### Reactivate User
```bash
curl -X POST http://localhost:5000/api/moderator/users/:userId/reactivate \
  -H "Authorization: Bearer <moderatorToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Appeal granted"
  }'
```

---

## 9. Performance & Health Endpoints

### Health Check
```bash
curl -X GET http://localhost:5000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-27T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": "connected",
    "redis": "connected",
    "memory": "ok",
    "cpu": "ok"
  }
}
```

### Get Performance Metrics
```bash
curl -X GET "http://localhost:5000/api/perf/metrics?period=1d" \
  -H "Authorization: Bearer <adminToken>"
```

### Prometheus Metrics
```bash
curl -X GET http://localhost:5000/metrics
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 204 | No Content - Deletion successful |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate resource |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Server Error - Internal error |
| 503 | Service Unavailable - Server down |

---

## Common Request Headers

All authenticated requests should include:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Optional headers:
```
X-Request-ID: <unique-request-id>  # For tracking
Accept-Language: en-US              # For localization
```

---

## Response Format

All responses follow this standard format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error code",
  "message": "Human-readable error message",
  "details": { ... }
}
```

---

## Authentication

### Token Types

1. **Access Token** (JWT)
   - Validity: 15 minutes
   - Used for API requests
   - Header: `Authorization: Bearer <accessToken>`

2. **Refresh Token** (JWT)
   - Validity: 7 days
   - Used to get new access token
   - Stored securely (httpOnly cookie recommended)

### Getting Tokens

1. Register or login to get initial tokens
2. Use refresh token to get new access token before expiry
3. Logout to invalidate tokens

### Token Refresh Example
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'
```

---

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public APIs | 100 req | 15 min |
| Login | 5 attempts | 15 min |
| Admin APIs | 100 req | 1 min |
| Sensitive Actions | 10 req | 1 min |
| Analytics | 50 req | 1 min |
| Backup | 5 req | 1 hour |

**Rate Limit Headers:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1614067200
```

---

## Error Handling

**Example Error Response:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Email already in use",
  "details": {
    "field": "email",
    "value": "existing@email.com"
  }
}
```

### Common Error Codes

| Code | Message |
|------|---------|
| VALIDATION_ERROR | Input validation failed |
| UNAUTHORIZED | Missing or invalid token |
| FORBIDDEN | Insufficient permissions |
| NOT_FOUND | Resource not found |
| CONFLICT | Resource already exists |
| RATE_LIMIT_EXCEEDED | Too many requests |
| SERVER_ERROR | Internal server error |
| DATABASE_ERROR | Database operation failed |
| INVALID_TOKEN | Token expired or invalid |
| BRUTE_FORCE_DETECTED | Too many failed attempts |

---

## Quick Tips

1. **Always use HTTPS in production**
2. **Store refresh tokens securely** (httpOnly cookies)
3. **Handle token expiry gracefully** with auto-refresh
4. **Implement exponential backoff** for retries
5. **Log errors for debugging** but never log sensitive data
6. **Cache responses** when appropriate
7. **Set reasonable timeouts** (30 seconds recommended)
8. **Monitor rate limits** to avoid hitting limits
9. **Use pagination** for large datasets
10. **Validate input** on the client side too

---

## Useful Links

- [Complete API Documentation](./COMPLETE_SERVER_ANALYSIS.md)
- [Authentication Guide](./auth.md)
- [Blog System Guide](./blogs.md)
- Swagger UI: `http://localhost:5000/api-docs`
- Health Check: `http://localhost:5000/health`
- Metrics: `http://localhost:5000/metrics`

---

**Last Updated:** February 27, 2026  
**Version:** 1.0.0
