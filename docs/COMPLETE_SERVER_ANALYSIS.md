# Wondertravelers API - Complete Server Analysis & Documentation

**Version:** 1.0.0  
**Last Updated:** February 27, 2026  
**Framework:** Express.js + MongoDB + Node.js

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Features Completed](#features-completed)
5. [Project Structure](#project-structure)
6. [Detailed Feature Documentation](#detailed-feature-documentation)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Database Models](#database-models)
9. [Security Features](#security-features)
10. [Middleware & Utilities](#middleware--utilities)
11. [Configuration & Environment Variables](#configuration--environment-variables)
12. [Performance & Monitoring](#performance--monitoring)
13. [Backup & Recovery](#backup--recovery)
14. [Future Improvement Areas](#future-improvement-areas)

---

## Project Overview

**Wondertravelers API** is a comprehensive backend system designed for travel/e-commerce platforms with advanced features including:

- Complete authentication and authorization system
- Multi-role user management (User, Moderator, Admin)
- Blog and content management system
- Analytics and behavior tracking
- Secure backup and restore functionality
- Performance monitoring and health checks
- User verification system with 2FA and OTP
- Notification system
- Audit logging for security compliance
- GeoIP tracking and location-based analytics

The API is built on industry best practices with security, scalability, and maintainability as core principles.

---

## Technology Stack

### Core Technologies
- **Runtime:** Node.js
- **Framework:** Express.js v5.2.1
- **Database:** MongoDB (via Mongoose v9.2.1)
- **Cache:** Redis v5.10.0
- **Authentication:** JWT (JSON Web Tokens)
- **Validation:** Zod v4.3.6
- **ORM:** Mongoose

### Security & Protection
- **Helmet:** v8.1.0 (HTTP headers security)
- **bcryptjs:** v3.0.3 (password hashing)
- **express-rate-limit:** v8.2.1 (rate limiting)
- **express-mongo-sanitize:** v2.2.0 (data sanitization)
- **CORS:** v2.8.6 (cross-origin requests)

### Additional Libraries
- **Morgan:** v1.10.1 (HTTP request logging)
- **Multer:** v2.0.2 (file uploads)
- **Sharp:** v0.34.5 (image processing)
- **Nodemailer:** v8.0.1 (email sending)
- **Twilio:** v5.12.1 (SMS/WhatsApp)
- **GeoIP Lite:** v1.4.10 (geolocation)
- **Prom-client:** v15.1.3 (Prometheus metrics)
- **Swagger:** v6.2.8 & v5.0.1 (API documentation)
- **Speakeasy:** v2.0.0 (2FA generation)
- **QR Code:** v1.5.4 (QR code generation)
- **fs-extra & tar:** File system operations
- **Pino:** v10.3.1 (structured logging)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client Applications                    │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│            Express.js Application Server                │
├─────────────────────────────────────────────────────────┤
│ • Helmet (Security)                                     │
│ • CORS + Rate Limiting                                  │
│ • Request Validation & Sanitization                    │
│ • Authentication & Authorization                       │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│  MongoDB     │ │   Redis    │ │  File System │
│  (Primary    │ │  (Cache &  │ │   (Uploads)  │
│  Database)   │ │ Sessions)  │ └──────────────┘
└──────────────┘ └────────────┘
        │
        └─── Features Modules ───
            ├── Auth (JWT, OAuth)
            ├── User Management
            ├── Blog & Comments
            ├── Analytics
            ├── Backup System
            ├── Notifications
            ├── Verification (2FA, OTP, Address)
            ├── Admin Management
            ├── Moderator Tools
            └── Performance Monitoring
```

### Design Patterns Used

1. **MVC Pattern (Modified):** Controllers → Services → Models
2. **Middleware Pipeline:** Layered request processing
3. **Modular Feature Structure:** Self-contained feature modules
4. **Service Layer Pattern:** Business logic separation
5. **Error Handling:** Centralized error middleware
6. **Authentication Guards:** Protected routes with role-based access

---

## Features Completed

### ✅ 1. Authentication System (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `auth/auth.service.js` - Core authentication logic
- `auth/auth.controller.js` - Request handlers
- `auth/auth.routes.js` - Route definitions
- `auth/auth.model.js` - User schema and model
- `auth/auth.middleware.js` - Authentication Guards
- `auth/auth.enhanced.js` - Advanced features (brute force, session management)
- `auth/oauth.service.js` - OAuth integration
- `auth/oauth.controller.js` - OAuth handlers

**Features Implemented:**
- User registration with email validation
- Secure login with JWT token generation
- Refresh token mechanism (15m access + 7d refresh)
- Password hashing with bcryptjs
- Login attempt tracking and brute force protection
- Session management with logout
- Avatar upload and processing
- Password reset functionality
- Device trust management
- OAuth integration capability
- Profile updates

**Endpoints:**
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT tokens
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/reset-password` - Reset forgotten password
- `POST /api/auth/avatar` - Upload avatar
- `GET /api/auth/trusted-devices` - List trusted devices
- `POST /api/auth/verify-device` - Verify new device
- `DELETE /api/auth/delete-me` - Delete account

**Security Features:**
- JWT with separate access and refresh secrets
- Password history tracking (last 5 passwords)
- Rate limiting on login attempts
- Brute force protection
- Device fingerprinting
- Secure session invalidation

---

### ✅ 2. User Management (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `user/user.service.js` - User operations
- `user/user.controller.js` - User handlers
- `user/user.routes.js` - User routes

**Features Implemented:**
- User profile management
- Role-based access control (user, moderator, admin)
- User listing with pagination
- User status management (active/inactive)
- User search and filtering
- Account deactivation/reactivation
- User data export
- Preferences management

**Supported Roles:**
- `user` - Regular user
- `moderator` - Content moderation, user management
- `admin` - Full system access
- `super-admin` - System administrator (reserved)

---

### ✅ 3. Audit & Security Logging (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `auth/audit.model.js` - Audit log schema
- `auth/audit.controller.js` - Audit handlers
- `auth/audit.routes.js` - Audit routes
- `middleware/audit.middleware.js` - Audit tracking
- `utils/audit-cleanup.util.js` - Cleanup service

**Features Implemented:**
- Real-time audit logging of sensitive operations
- Automatic geolocation tracking
- IP address logging with anonymization (GDPR compliant)
- Action categorization (ACCOUNT, LOGIN, ADMIN, DATA)
- Severity levels (INFO, WARNING, CRITICAL)
- User agent and device information
- Automatic old audit log cleanup (90 days retention)
- Audit sampling in production (configurable)
- Request/response logging
- Error tracking and logging

**Audit Tracking Includes:**
- Authentication events (login, logout, password change)
- Admin actions (user deletion, role changes)
- Data modifications
- Permission changes
- Security events

---

### ✅ 4. Blog & Content Management (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `blog/blog.model.js` - Blog schema
- `blog/blog.controller.js` - Blog handlers
- `blog/blog.routes.js` - Blog routes
- `category/category.model.js` - Category schema
- `author/author.model.js` - Author schema
- `comment/comment.model.js` - Comment schema

**Features Implemented:**
- Blog post creation, reading, updating, deleting
- Rich content support with markdown/HTML
- Blog categorization and tagging
- Author management
- Comment system with nested replies
- Comment likes and engagement
- Content status (draft, published, archived)
- Blog views tracking
- Reading time calculation
- SEO-friendly slug generation
- Blog search and filtering
- Pagination support
- Content moderation status

**Blog Fields:**
- Title, slug, excerpt, content
- Featured image with thumbnail
- Category and tags
- Author information
- Publication date
- View count
- Estimated reading time
- Status (draft/published/archived)
- Search metadata

**Comment Features:**
- Nested comment replies
- Like functionality
- Edit tracking
- Status management (active/hidden/deleted)
- Author attribution
- Timestamp tracking

---

### ✅ 5. Analytics System (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `analytics/analytics.service.js` - Analytics logic
- `analytics/analytics.controller.js` - Handlers
- `analytics/analytics.routes.js` - Routes
- `analytics/analytics.model.js` - Analytics schema
- `analytics/customer-behavior.model.js` - Behavior tracking
- `analytics/customer-behavior.routes.js` - Behavior routes
- `middleware/analytics-tracking.middleware.js` - Event tracking
- `middleware/analytics-validation.middleware.js` - Input validation
- `middleware/analytics-rate-limit.middleware.js` - Rate limits

**Features Implemented:**
- Event tracking and logging
- GeoIP-based analytics
- User behavior analysis
- Regional statistics and heatmaps
- Market/country-specific insights
- Product performance by region
- User engagement metrics
- Customer behavior patterns
- Session tracking
- Page view analytics
- IP anonymization (GDPR compliant)
- Data cleanup and archival
- Time-based analytics aggregation
- Custom event tracking

**Tracked Metrics:**
- Page views
- User sessions
- Geographic location
- Device information
- Browser type and version
- Referrer tracking
- Click events
- Conversion events
- User engagement duration
- Custom events

**Reports Available:**
- Global reach statistics
- Regional performance
- Market-specific metrics
- Heatmap data
- User engagement by location
- Product performance by market

---

### ✅ 6. Backup & Disaster Recovery (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `backup/backup.service.js` - Core backup logic
- `backup/backup.controller.js` - Handlers
- `backup/backup.routes.js` - Routes
- `backup/backup.model.js` - Backup schema
- `backup/backup.utils.js` - Utility functions
- `backup/drive.service.js` - Google Drive integration
- `backup/scheduler.service.js` - Automated scheduling
- `backup/metrics.service.js` - Backup metrics
- `backup/webhook.service.js` - Webhook notifications

**Features Implemented:**
- Full database backup (mongodump)
- File-only backup (uploads directory)
- Incremental backups
- Automatic compression (tar.gz)
- AES-256 encryption of backups
- Backup integrity verification (checksums)
- Google Drive integration
- Scheduled automated backups (cron-based)
- Multi-location backup storage
- Backup restoration capability
- Backup metadata tracking
- Prometheus metrics for backups
- Webhook notifications on backup completion
- Bandwidth monitoring
- Backup file validation

**Backup Types:**
1. **Database Backups:** Complete MongoDB export (excludes logs)
2. **File Backups:** User uploads and media files
3. **Combined Backups:** Database + Files

**Storage Backends:**
- Local file system
- Google Drive (with OAuth)
- Archive with compression and encryption

**Restoration Features:**
- Point-in-time recovery
- Selective collection restoration
- Database integrity validation
- Automated post-restore verification

---

### ✅ 7. Notifications System (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `notification/notification.model.js` - Notification schema
- `notification/notification.controller.js` - Handlers
- `notification/notification.routes.js` - Routes
- `utils/notification.util.js` - Notification utils
- `utils/email.util.js` - Email sending
- `utils/emailCron.js` - Email scheduling
- `middleware/analytics-tracking.middleware.js` - Event tracking

**Features Implemented:**
- Push notifications
- Email notifications
- In-app notifications
- Notification preferences management
- Read/unread tracking
- Notification categories
- Template-based notifications
- Scheduled email sending
- Bulk notification sending
- Notification archival
- User notification history
- Notification delivery tracking
- Customizable notification templates
- Multi-channel support

**Notification Types:**
- Security alerts
- Account updates
- System announcements
- Marketing campaigns
- Order updates
- Comment replies
- Custom events

**Features:**
- User preference management
- Notification frequency control
- Channel selection (email, push, in-app)
- Batch sending
- Retry mechanism
- Delivery confirmation

---

### ✅ 8. Admin Management (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `admin/admin.controller.js` - Admin handlers
- `admin/admin.routes.js` - Admin routes
- `admin/admin-settings.controller.js` - Settings handlers
- `admin/admin-settings.service.js` - Settings logic
- `admin/admin-settings.model.js` - Settings schema
- `admin/permission.controller.js` - Permission handlers
- `admin/permission.model.js` - Permission schema
- `admin/user-list.controller.js` - User list handlers
- `middleware/admin-privilege.middleware.js` - Admin guard
- `middleware/admin-rate-limit.middleware.js` - Rate limiting

**Features Implemented:**
- System settings management
- Permission management for moderators
- User role assignment
- User suspension/deactivation
- Admin audit trail
- System configuration
- Feature flags
- Rate limit configuration
- Security policies management
- Admin activity monitoring
- Bulk user operations
- Dashboard statistics

**Admin Capabilities:**
- View all users
- Manage user roles and permissions
- Suspend/activate users
- Manage system settings
- View audit logs
- Manage admin accounts
- Configure system-wide settings
- View analytics dashboards
- Manage backup schedules
- Configure notification templates

---

### ✅ 9. Moderator Tools (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `moderator/moderator.controller.js` - Handlers
- `moderator/moderator.routes.js` - Routes
- `middleware/check-permission.middleware.js` - Permission checking

**Features Implemented:**
- User management (list, search, filter)
- User status management
- Report management
- Content moderation
- User verification status checking
- Activity monitoring
- Warning system
- User deactivation/reactivation
- Bulk operations
- Moderation dashboard
- Action logging

**Moderator Capabilities:**
- List and search users
- View user details and activity
- Deactivate suspicious accounts
- Reactivate users
- Manage user warnings
- View and respond to reports
- Moderate comments and content
- Check verification status
- View activity logs

---

### ✅ 10. User Verification System (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `verification/phone.controller.js` - Phone verification
- `verification/2fa.controller.js` - 2FA implementation
- `verification/address.controller.js` - Address verification
- `verification/login-alerts.controller.js` - Login security
- `verification/whatsapp.controller.js` - WhatsApp integration
- `verification/purchase-verification.middleware.js` - Purchase eligibility
- `verification/verification.routes.js` - Routes

**Features Implemented:**

#### Phone Verification
- OTP generation and sending
- SMS verification via Twilio
- Phone number validation
- Resend OTP functionality
- Expiry management
- Rate limiting

#### Two-Factor Authentication (2FA)
- TOTP (Time-based One-Time Password)
- Backup codes generation
- QR code generation for authenticator apps
- Enable/disable 2FA
- Session validation with 2FA
- Backup code regeneration

#### Address Verification
- Multiple address support
- Address validation
- Primary address management
- Address type categorization
- Geolocation verification
- Delivery address management

#### Login Security
- New device detection
- Login alerts
- Trusted device management
- Location-based alerts
- Suspicious activity detection
- Login attempt history
- Security settings management

#### WhatsApp Integration
- WhatsApp number management
- WhatsApp message delivery
- WhatsApp alerts
- WhatsApp verification codes

#### Purchase Verification
- Phone verification requirement
- Address verification requirement
- Eligibility checking
- Verification status tracking
- Compliance verification

---

### ✅ 11. Performance Monitoring (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `perf/perf.service.js` - Performance queries
- `perf/perf.controller.js` - Handlers
- `perf/perf.routes.js` - Routes
- `perf/perf.model.js` - Metric schemas
- `perf/perf.collector.js` - Metric collection
- `perf/perf.scheduler.js` - Scheduled collection
- `utils/memory-leak.util.js` - Memory monitoring
- `utils/mnz.js` - Server monitoring

**Features Implemented:**
- CPU usage monitoring
- Memory usage tracking
- Event loop lag measurement
- Network latency measurement
- Server uptime tracking
- HTTP request latency
- Database query performance
- Cache hit rates
- Prometheus metrics export
- Grafana dashboard compatible
- Historical data collection
- Performance aggregation
- Alert thresholds
- Bottleneck detection
- Load monitoring

**Metrics Collected:**
- CPU percentage
- Memory usage (heap, resident)
- Node.js process memory
- Event loop latency
- Network latency to endpoints
- HTTP request duration
- Database operations timing
- Cache operations
- Garbage collection stats
- Worker thread stats

**Monitoring Features:**
- Real-time metric collection
- Historical aggregation
- Trend analysis
- Performance baseline
- Alert generation
- Metric exportation for Prometheus

---

### ✅ 12. Security Features (COMPLETE)

**Status:** Fully Implemented

**Middleware Components:**
- `middleware/sanitize.middleware.js` - Input sanitization
- `middleware/rate-limit.middleware.js` - Rate limiting
- `middleware/error.middleware.js` - Error handling
- `middleware/validate.middleware.js` - Input validation
- `middleware/upload.middleware.js` - File upload handling
- `middleware/request-id.middleware.js` - Request tracking
- `app.js` - Helmet, CORS, security headers

**Features Implemented:**
- Helmet security headers
- CORS configuration
- Rate limiting (global, per-endpoint, per-user)
- Input validation with Zod schemas
- Data sanitization (XSS prevention)
- SQL injection prevention
- CSRF protection
- HTTP parameter pollution prevention
- Secure password storage (bcryptjs)
- Session management
- JWT token security
- HTTPS enforcement (production)
- HSTS headers
- Content Security Policy
- Referrer Policy
- Permissions Policy
- Request size limiting
- Request timeout handling
- Sensitive data masking in logs

**Implemented Protections:**
- XSS prevention via sanitization
- NoSQL injection prevention
- Brute force attack prevention
- Rate limit abuse prevention
- CORS misconfiguration prevention
- Clickjacking prevention
- Data exposure prevention
- Cryptographic key management

---

### ✅ 13. Configuration System (COMPLETE)

**Status:** Fully Implemented

**Components:**
- `config/swagger.js` - API documentation

**Features Implemented:**
- Environment-based configuration
- Swagger/OpenAPI documentation
- Secret management
- Feature toggles
- Rate limit configuration
- Session configuration
- Database configuration
- Cache configuration
- Email configuration
- Backup configuration
- Analytics configuration

---

## Project Structure

```
server/
├── src/
│   ├── app.js                          # Express app setup
│   ├── server.js                       # Server entry point
│   │
│   ├── features/                       # Feature modules
│   │   ├── auth/                       # Authentication
│   │   │   ├── auth.service.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.model.js
│   │   │   ├── auth.middleware.js
│   │   │   ├── auth.enhanced.js
│   │   │   ├── oauth.service.js
│   │   │   ├── oauth.controller.js
│   │   │   ├── oauth.routes.js
│   │   │   ├── audit.model.js
│   │   │   ├── audit.controller.js
│   │   │   └── audit.routes.js
│   │   │
│   │   ├── user/                       # User management
│   │   │   ├── user.service.js
│   │   │   ├── user.controller.js
│   │   │   └── user.routes.js
│   │   │
│   │   ├── admin/                      # Admin features
│   │   │   ├── admin.controller.js
│   │   │   ├── admin.routes.js
│   │   │   ├── admin-settings.controller.js
│   │   │   ├── admin-settings.service.js
│   │   │   ├── admin-settings.model.js
│   │   │   ├── admin-settings.schema.js
│   │   │   ├── permission.controller.js
│   │   │   ├── permission.model.js
│   │   │   └── user-list.controller.js
│   │   │
│   │   ├── blog/                       # Blog system
│   │   │   ├── blog.model.js
│   │   │   ├── blog.controller.js
│   │   │   └── blog.routes.js
│   │   │
│   │   ├── category/                   # Blog categories
│   │   │   └── category.model.js
│   │   │
│   │   ├── author/                     # Blog authors
│   │   │   └── author.model.js
│   │   │
│   │   ├── comment/                    # Blog comments
│   │   │   ├── comment.model.js
│   │   │   └── comment.controller.js
│   │   │
│   │   ├── analytics/                  # Analytics system
│   │   │   ├── analytics.service.js
│   │   │   ├── analytics.controller.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── analytics.model.js
│   │   │   ├── customer-behavior.model.js
│   │   │   └── customer-behavior.routes.js
│   │   │
│   │   ├── backup/                     # Backup system
│   │   │   ├── backup.service.js
│   │   │   ├── backup.controller.js
│   │   │   ├── backup.routes.js
│   │   │   ├── backup.model.js
│   │   │   ├── backup.utils.js
│   │   │   ├── drive.service.js
│   │   │   ├── scheduler.service.js
│   │   │   ├── metrics.service.js
│   │   │   └── webhook.service.js
│   │   │
│   │   ├── notification/               # Notifications
│   │   │   ├── notification.model.js
│   │   │   ├── notification.controller.js
│   │   │   └── notification.routes.js
│   │   │
│   │   ├── verification/               # Verification system
│   │   │   ├── phone.controller.js
│   │   │   ├── 2fa.controller.js
│   │   │   ├── address.controller.js
│   │   │   ├── login-alerts.controller.js
│   │   │   ├── whatsapp.controller.js
│   │   │   ├── purchase-verification.middleware.js
│   │   │   └── verification.routes.js
│   │   │
│   │   ├── moderator/                  # Moderator tools
│   │   │   ├── moderator.controller.js
│   │   │   └── moderator.routes.js
│   │   │
│   │   ├── perf/                       # Performance monitoring
│   │   │   ├── perf.service.js
│   │   │   ├── perf.controller.js
│   │   │   ├── perf.routes.js
│   │   │   ├── perf.model.js
│   │   │   ├── perf.collector.js
│   │   │   └── perf.scheduler.js
│   │   │
│   │   └── config/                     # Configuration
│   │       ├── swagger.js
│   │       └── schemas/
│   │           ├── auth.schema.js
│   │           ├── admin.schema.js
│   │           └── other schemas
│   │
│   ├── middleware/                     # Express middleware
│   │   ├── auth.middleware.js          # Auth guards
│   │   ├── audit.middleware.js         # Audit logging
│   │   ├── admin-privilege.middleware.js
│   │   ├── admin-rate-limit.middleware.js
│   │   ├── analytics-rate-limit.middleware.js
│   │   ├── analytics-tracking.middleware.js
│   │   ├── analytics-validation.middleware.js
│   │   ├── check-permission.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rate-limit.middleware.js
│   │   ├── request-id.middleware.js
│   │   ├── sanitize.middleware.js
│   │   ├── upload.middleware.js
│   │   └── validate.middleware.js
│   │
│   ├── utils/                          # Utility functions
│   │   ├── audit-cleanup.util.js       # Audit log cleanup
│   │   ├── cache.util.js               # Cache utilities
│   │   ├── email.util.js               # Email sending
│   │   ├── emailCron.js                # Email scheduling
│   │   ├── errors.util.js              # Error handling
│   │   ├── imageProcessor.util.js      # Image processing
│   │   ├── logger.util.js              # Structured logging
│   │   ├── memory-leak.util.js         # Memory monitoring
│   │   ├── mnz.js                      # Server monitoring
│   │   ├── notification.util.js        # Notifications
│   │   ├── redis.util.js               # Redis client
│   │   ├── response.js                 # Response formatting
│   │   └── watermark.util.js           # Image watermarking
│   │
│   └── services/                       # Core services
│       └── audit.service.js
│
├── docs/                               # Documentation
│   ├── auth.md
│   ├── blogs.md
│   ├── folder-structure.md
│   └── COMPLETE_SERVER_ANALYSIS.md    # THIS FILE
│
├── config/                             # Configuration files
│   ├── alertmanager-config.yml
│   └── grafana-dashboard.json
│
├── uploads/                            # User uploads
│   └── avatars/
│       ├── original/
│       └── thumbnails/
│
├── .env                                # Environment variables
├── .env.example                        # Example environment file
├── package.json                        # Dependencies
└── README.md                           # Project README
```

---

## Detailed Feature Documentation

### Authentication Module (`/src/features/auth`)

**Purpose:** Handles user registration, login, token management, and security

**Key Files:**
- **auth.service.js** (634 lines)
  - `registerUser()` - User registration
  - `loginUser()` - Authentication
  - `refreshToken()` - Token refresh
  - `logout()` - Session termination
  - `changePassword()` - Password updates
  - `resetPassword()` - Password recovery

- **auth.model.js**
  - User schema with password hashing
  - Device trust tracking
  - Session management fields
  - Password history
  - Login attempt tracking

- **auth.enhanced.js**
  - Brute force detection
  - Device fingerprinting
  - Session validation
  - Security checks

**Database Collections:**
- `users` - User accounts
- `securityaudits` - Audit logs
- `sessions` - Active sessions (optional)

**Request/Response Examples:**

```javascript
// Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "username"
}

Response: {
  "success": true,
  "data": {
    "user": { ... user data ... },
    "accessToken": "jwt.token.here",
    "refreshToken": "refresh.token"
  }
}

// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: {
  "success": true,
  "data": {
    "user": { ... user data ... },
    "accessToken": "jwt.token.here",
    "refreshToken": "refresh.token"
  }
}
```

---

### Blog Module (`/src/features/blog`)

**Purpose:** Complete content management system for blogs

**Database Schema:**

```javascript
Blog Collection:
{
  _id: ObjectId,
  title: String (required),
  slug: String (unique),
  excerpt: String,
  content: String (rich HTML/markdown),
  featuredImage: String,
  thumbnail: String,
  category: ObjectId (ref: Category),
  tags: [String],
  author: ObjectId (ref: Author),
  status: 'draft' | 'published' | 'archived',
  views: Number,
  readingTime: Number,
  createdAt: Date,
  updatedAt: Date,
  publishedAt: Date,
  isFeatured: Boolean,
  seoMetadata: {
    metaDescription: String,
    keywords: [String]
  }
}

Category Collection:
{
  _id: ObjectId,
  name: String,
  slug: String,
  description: String,
  color: String,
  postCount: Number,
  parent: ObjectId (ref: Category),
  isActive: Boolean
}

Author Collection:
{
  _id: ObjectId,
  name: String,
  bio: String,
  profileImage: String,
  socialLinks: {
    twitter: String,
    linkedin: String,
    website: String
  }
}

Comment Collection:
{
  _id: ObjectId,
  blog: ObjectId (ref: Blog),
  author: ObjectId (ref: Author),
  content: String,
  parentComment: ObjectId (ref: Comment),
  likes: [ObjectId],
  likesCount: Number,
  repliesCount: Number,
  status: 'active' | 'hidden' | 'deleted'
}
```

---

### Analytics Module (`/src/features/analytics`)

**Purpose:** Track user behavior, geographic data, and engagement metrics

**Key Features:**
1. **Event Tracking**
   - Page views
   - User actions
   - Conversions
   - Custom events

2. **Geographic Analytics**
   - Country-level data
   - City-level data
   - Heatmaps
   - Regional performance

3. **User Behavior**
   - Session duration
   - Bounce rate
   - Page flow
   - Engagement metrics

4. **Data Retention**
   - Automatic cleanup of old data
   - Configurable retention policy
   - Archive capabilities

**Analytics Data Includes:**
```javascript
{
  eventType: String,
  userId: ObjectId,
  ipAddress: String (anonymized),
  userAgent: String,
  country: String,
  city: String,
  latitude: Number,
  longitude: Number,
  deviceType: String,
  browser: String,
  timestamp: Date,
  metadata: Object
}
```

---

### Backup Module (`/src/features/backup`)

**Purpose:** Safe data backups with encryption and multi-location storage

**Backup Flow:**

```
1. Trigger Backup (Admin)
   ↓
2. Export Data (Database + Files)
   ↓
3. Compress (tar.gz)
   ↓
4. Encrypt (AES-256)
   ↓
5. Calculate Checksum
   ↓
6. Verify Integrity
   ↓
7. Upload (Google Drive / Local Storage)
   ↓
8. Log Metadata
   ↓
9. Send Webhook Notification
```

**Backup Metadata:**
```javascript
{
  _id: ObjectId,
  type: 'database' | 'files' | 'full',
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  fileName: String,
  fileSize: Number,
  compressed: Boolean,
  encrypted: Boolean,
  checksum: String,
  storageLocation: String,
  startTime: Date,
  endTime: Date,
  duration: Number,
  collections: [String],
  documentCount: Number,
  error: String (if failed)
}
```

**Available Endpoints:**
- `POST /api/backup/db/create` - Full DB backup
- `POST /api/backup/files/create` - Files backup
- `POST /api/backup/gdrive/credentials` - Configure Google Drive
- `GET /api/backup/gdrive/list` - List backups
- `POST /api/backup/restore/{id}` - Restore backup
- `GET /api/backup/metrics` - Prometheus metrics

---

### Verification Module (`/src/features/verification`)

**1. Phone Verification**
- OTP generation and sending
- SMS delivery via Twilio
- Verification status tracking
- Rate limiting (prevent spam)

**2. Two-Factor Authentication (2FA)**
- TOTP generation
- Backup codes
- QR code for authenticator apps
- Recovery mechanisms

**3. Address Verification**
- Address validation
- Multiple addresses support
- Address type categorization
- Default address management

**4. Login Security**
- New device detection
- Trusted device list
- Login alerts
- Suspicious activity detection

**5. WhatsApp Integration**
- WhatsApp number management
- Message delivery
- Alerts and notifications

---

### Notification Module (`/src/features/notification`)

**Notification Types:**
1. Email notifications
2. Push notifications
3. In-app notifications
4. SMS notifications (via Twilio)
5. WhatsApp messages

**Features:**
- User preferences management
- Notification categories
- Template-based sending
- Batch operations
- Delivery tracking
- Retry mechanisms
- Read/unread tracking

**Notification Channels:**
- Email (via Nodemailer)
- Push (via service)
- In-app (database stored)
- SMS (via Twilio)
- WhatsApp (via Twilio)

---

### Performance Monitoring (`/src/features/perf`)

**Metrics Collected:**
1. CPU usage
2. Memory usage
3. Event loop lag
4. Network latency
5. Request duration
6. Database performance
7. Cache statistics
8. Garbage collection

**Collection Interval:** Every 10 seconds (configurable)

**Data Retention:** 30 days (configurable)

**Export Format:** Prometheus-compatible metrics

**Grafana Integration:**
- Pre-built dashboards available
- Automatic metric export
- Real-time monitoring

---

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | User login |
| POST | `/api/auth/logout` | JWT | User logout |
| POST | `/api/auth/refresh` | Refresh Token | Refresh JWT |
| GET | `/api/auth/me` | JWT | Get profile |
| PATCH | `/api/auth/profile` | JWT | Update profile |
| POST | `/api/auth/change-password` | JWT | Change password |
| POST | `/api/auth/reset-password` | None | Reset password |
| POST | `/api/auth/avatar` | JWT | Upload avatar |
| GET | `/api/auth/trusted-devices` | JWT | List devices |
| POST | `/api/auth/verify-device` | JWT | Verify device |
| DELETE | `/api/auth/delete-me` | JWT | Delete account |

### Blog Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| GET | `/api/blogs` | None | List blogs |
| GET | `/api/blogs/:id` | None | Get blog details |
| POST | `/api/blogs` | JWT (Admin) | Create blog |
| PATCH | `/api/blogs/:id` | JWT (Admin) | Update blog |
| DELETE | `/api/blogs/:id` | JWT (Admin) | Delete blog |
| GET | `/api/blogs/category/:categoryId` | None | Blogs by category |
| GET | `/api/blogs/:blogId/comments` | None | Get comments |
| POST | `/api/blogs/:blogId/comments` | None | Post comment |

### Admin Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| GET | `/api/admin/users/summary` | JWT (Admin) | User statistics |
| GET | `/api/admin/users/all` | JWT (Admin) | List all users |
| GET | `/api/admin/users/list-admins` | JWT (Admin) | List admins |
| PATCH | `/api/admin/users/:id` | JWT (Admin) | Update user |
| DELETE | `/api/admin/users/:id` | JWT (Admin) | Delete user |
| GET | `/api/admin/settings` | JWT (Admin) | Get settings |
| PATCH | `/api/admin/settings` | JWT (Admin) | Update settings |

### Backup Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| POST | `/api/backup/db/create` | JWT (Admin) | Create DB backup |
| POST | `/api/backup/files/create` | JWT (Admin) | Create files backup |
| GET | `/api/backup/gdrive/list` | JWT (Admin) | List backups |
| POST | `/api/backup/restore/:id` | JWT (Admin) | Restore backup |
| POST | `/api/backup/gdrive/credentials` | JWT (Admin) | Set Google Drive |
| GET | `/api/backup/metrics` | JWT (Admin) | Prometheus metrics |

### Analytics Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| GET | `/api/analytics/global-reach` | JWT (Admin) | Global stats |
| GET | `/api/analytics/heatmap` | JWT (Admin) | Heatmap data |
| GET | `/api/analytics/regional-stats` | JWT (Admin) | Regional data |
| GET | `/api/analytics/by-type/:type` | JWT (Admin) | By event type |
| POST | `/api/analytics/cleanup` | JWT (Admin) | Cleanup old data |

### Verification Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| POST | `/api/verification/phone/send-otp` | JWT | Send phone OTP |
| POST | `/api/verification/phone/verify-otp` | JWT | Verify phone |
| POST | `/api/verification/2fa/generate` | JWT | Enable 2FA |
| POST | `/api/verification/2fa/verify` | JWT | Verify 2FA code |
| POST | `/api/verification/address/add` | JWT | Add address |
| GET | `/api/verification/address/all` | JWT | Get addresses |
| POST | `/api/verification/whatsapp/set` | JWT | Set WhatsApp |

### Notification Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| GET | `/api/notifications` | JWT | Get notifications |
| GET | `/api/notifications/unread-count` | JWT | Unread count |
| PATCH | `/api/notifications/:id/read` | JWT | Mark as read |
| GET | `/api/notifications/preferences` | JWT | Get preferences |
| PATCH | `/api/notifications/preferences` | JWT | Update preferences |
| DELETE | `/api/notifications/:id` | JWT | Delete notification |

### Moderator Endpoints

| Method | Endpoint | Authentication | Purpose |
|--------|----------|-----------------|---------|
| GET | `/api/moderator/users` | JWT (Mod) | List users |
| GET | `/api/moderator/users/:id` | JWT (Mod) | User details |
| POST | `/api/moderator/users/:id/deactivate` | JWT (Mod) | Deactivate user |
| POST | `/api/moderator/users/:id/reactivate` | JWT (Mod) | Reactivate user |
| GET | `/api/moderator/reports` | JWT (Mod) | View reports |

---

## Database Models

### Core Collections

#### 1. Users Collection
```javascript
{
  _id: ObjectId,
  email: String (unique),
  username: String (unique),
  password: String (hashed),
  firstName: String,
  lastName: String,
  phone: String,
  avatar: String,
  bio: String,
  role: 'user' | 'moderator' | 'admin' | 'super-admin',
  isActive: Boolean,
  isEmailVerified: Boolean,
  isPhoneVerified: Boolean,
  addresses: [ObjectId],
  notificationPreferences: Object,
  loginAttempts: Number,
  lastFailedLogin: Date,
  lastLogoutAt: Date,
  refreshToken: String,
  refreshTokenExpires: Date,
  sessionVersion: Number,
  twoFactorEnabled: Boolean,
  trustedDevices: [{
    deviceId: String,
    userAgent: String,
    ipAddress: String,
    addedAt: Date,
    lastUsed: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. Security Audit Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  action: String,
  category: 'ACCOUNT' | 'LOGIN' | 'ADMIN' | 'DATA',
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  details: Object,
  ipAddress: String (anonymized),
  userAgent: String,
  geolocation: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  statusCode: Number,
  requestBody: Object (sanitized),
  responseSize: Number,
  duration: Number,
  success: Boolean,
  error: String,
  createdAt: Date
}
```

#### 3. Analytics Collection
```javascript
{
  _id: ObjectId,
  eventType: String,
  userId: ObjectId,
  sessionId: String,
  ipAddress: String (anonymized),
  userAgent: String,
  country: String,
  city: String,
  latitude: Number,
  longitude: Number,
  deviceType: String,
  browser: String,
  osName: String,
  referrer: String,
  pageUrl: String,
  metadata: Object,
  timestamp: Date
}
```

#### 4. Blog Collection
```javascript
{
  _id: ObjectId,
  title: String,
  slug: String (unique),
  excerpt: String,
  content: String,
  featuredImage: String,
  category: ObjectId,
  tags: [String],
  author: ObjectId,
  status: 'draft' | 'published' | 'archived',
  views: Number,
  readingTime: Number,
  isFeatured: Boolean,
  seoMetadata: {
    metaDescription: String,
    keywords: [String]
  },
  createdAt: Date,
  updatedAt: Date,
  publishedAt: Date
}
```

#### 5. Notification Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: String,
  title: String,
  message: String,
  data: Object,
  read: Boolean,
  readAt: Date,
  channel: 'email' | 'push' | 'in-app' | 'sms',
  templateId: String,
  createdAt: Date,
  expiresAt: Date
}
```

#### 6. Backup Collection
```javascript
{
  _id: ObjectId,
  type: 'database' | 'files' | 'full',
  status: 'pending' | 'in-progress' | 'completed' | 'failed',
  fileName: String,
  fileSize: Number,
  compressed: Boolean,
  encrypted: Boolean,
  checksum: String,
  storageLocation: String,
  startTime: Date,
  endTime: Date,
  duration: Number,
  collections: [String],
  documentCount: Number,
  createdBy: ObjectId,
  error: String,
  metadata: Object,
  createdAt: Date
}
```

---

## Security Features

### 1. Authentication Security
- ✅ bcryptjs password hashing (salted)
- ✅ JWT with separate access/refresh secrets
- ✅ 15-minute access token expiry
- ✅ 7-day refresh token expiry
- ✅ Brute force protection
- ✅ Login attempt tracking
- ✅ Device fingerprinting
- ✅ Session invalidation on logout

### 2. Data Protection
- ✅ Input validation with Zod schemas
- ✅ XSS prevention via sanitization
- ✅ NoSQL injection prevention
- ✅ Data encryption at rest (optional)
- ✅ Backup encryption (AES-256)
- ✅ Secure file uploads
- ✅ Image processing and watermarking

### 3. Network Security
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Rate limiting (global, per-user, per-endpoint)
- ✅ HTTPS enforcement (production)
- ✅ HSTS headers
- ✅ Content Security Policy
- ✅ Referrer Policy
- ✅ X-Frame-Options (clickjacking prevention)
- ✅ X-Content-Type-Options (MIME sniffing prevention)

### 4. Access Control
- ✅ Role-based access control (RBAC)
- ✅ Permission-based middleware
- ✅ Admin privilege verification
- ✅ Moderator action logging
- ✅ Endpoint-level authorization

### 5. Audit & Compliance
- ✅ Complete audit logging
- ✅ Geolocation tracking
- ✅ IP anonymization (GDPR compliant)
- ✅ 90-day default audit retention
- ✅ Automatic log cleanup
- ✅ Security event categorization
- ✅ Sensitive data masking in logs

### 6. Two-Factor Authentication
- ✅ TOTP support
- ✅ Backup codes
- ✅ Device trust
- ✅ Login alerts
- ✅ OTP via SMS/WhatsApp

---

## Middleware & Utilities

### Middleware Stack

1. **Error Handler**
   - Centralized error catching
   - Consistent error responses
   - Stack trace in development
   - CORS error handling

2. **Authentication Middleware**
   - JWT verification
   - Token refresh
   - User context injection
   - Device verification

3. **Authorization Middleware**
   - Role checking
   - Permission verification
   - Resource ownership validation

4. **Rate Limiting**
   - Global rate limit (100 requests/15 min)
   - Login rate limit (5 attempts/15 min)
   - Admin rate limit (100 requests/minute)
   - Sensitive action rate limit (10 requests/minute)
   - Analytics rate limit
   - Per-user rate limiting

5. **Validation Middleware**
   - Zod schema validation
   - Custom validators
   - Type coercion
   - Sanitization

6. **Audit Middleware**
   - Request logging
   - Sensitive endpoint detection
   - Geolocation tracking
   - Response timing
   - Error logging

7. **Upload Middleware**
   - File type validation
   - File size limiting
   - Image processing
   - Thumbnail generation
   - Avatar optimization

8. **Sanitization Middleware**
   - MongoDB query operator prevention
   - XSS prevention
   - HTML sanitization
   - Parameter cleaning

### Utility Functions

1. **logger.util.js** - Structured logging with Pino
2. **cache.util.js** - Redis caching layer
3. **redis.util.js** - Redis client management
4. **email.util.js** - Email sending
5. **errors.util.js** - Error handling utilities
6. **response.js** - Response formatting
7. **imageProcessor.util.js** - Image operations
8. **watermark.util.js** - Image watermarking
9. **audit-cleanup.util.js** - Audit log cleanup
10. **memory-leak.util.js** - Memory monitoring
11. **notification.util.js** - Notification utilities
12. **mnz.js** - Server monitoring

---

## Configuration & Environment Variables

### Essential Variables
```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/wondertravelers

# Authentication
JWT_SECRET=your-access-secret-change-me-at-least-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-change-me-at-least-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Encryption
BACKUP_ENCRYPTION_KEY=your-backup-encryption-key-32-chars-min
COOKIE_SECRET=your-cookie-secret-32-chars-min

# Redis
REDIS_URL=redis://localhost:6379

# Email
EMAIL_FROM=noreply@wondertravelers.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS/WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890

# Google Drive (Backup)
GDRIVE_CLIENT_ID=your-client-id
GDRIVE_CLIENT_SECRET=your-secret
GDRIVE_REFRESH_TOKEN=your-refresh-token

# Frontend URLs
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# Security
AUDIT_RETENTION_DAYS=90
AUDIT_SAMPLING_RATE_PROD=0.1

# Features
FEATURES_ENABLED=auth,blog,analytics,backup,notifications
```

### Optional Variables
```env
# Logging
LOG_LEVEL=info
LOG_MASK_SENSITIVE=true

# Performance
PERF_COLLECTION_INTERVAL=10000
PERF_DATA_RETENTION_DAYS=30

# Cache
CACHE_TTL=3600
CACHE_ENABLED=true

# Upload
MAX_FILE_SIZE=52428800
MAX_AVATAR_SIZE=5242880
UPLOAD_DIR=./uploads

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database
MONGO_MAX_POOL_SIZE=60
MONGO_MIN_POOL_SIZE=8
```

---

## Performance & Monitoring

### Metrics Collection
- **Interval:** Every 10 seconds
- **Retention:** 30 days in MongoDB
- **Export:** Prometheus format
- **Grafana:** Pre-built dashboards

### Monitored Metrics
1. CPU usage %
2. Memory (heap, resident, external)
3. Event loop lag
4. Network latency
5. Request duration
6. Database operations
7. Cache hit rate
8. Garbage collection frequency
9. Worker thread count
10. File descriptor usage

### Health Check Endpoint
```
GET /health

Response:
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

### Threshold Alerts
- CPU > 80%
- Memory > 85%
- Event loop lag > 100ms
- Failed backups
- Audit log growth
- Database connection issues

---

## Backup & Recovery

### Backup Process
1. **Trigger:** Manual or scheduled (cron)
2. **Export:** Complete database export (excludes logs)
3. **Compress:** tar.gz compression
4. **Encrypt:** AES-256 encryption
5. **Verify:** Checksum validation
6. **Upload:** To Google Drive or local storage
7. **Log:** Metadata stored in database
8. **Notify:** Webhook notification
9. **Monitor:** Prometheus metrics

### Recovery Process
1. **Locate:** Find backup by ID
2. **Download:** From Google Drive or local storage
3. **Decrypt:** AES-256 decryption
4. **Decompress:** Extraction from tar.gz
5. **Validate:** Integrity verification
6. **Restore:** MongoDB import
7. **Verify:** Data consistency checks
8. **Finalize:** Complete recovery process

### Backup Storage Options
- Local file system (`./uploads/backups`)
- Google Drive (with OAuth)
- Configurable retention policy

### Recovery Time Objectives (RTO)
- Database recovery: < 5 minutes
- Files recovery: < 10 minutes
- Full recovery: < 15 minutes

---

## Future Improvement Areas

### High Priority
1. **API Versioning**
   - Implement v2 endpoints
   - Handle backward compatibility
   - Deprecation strategy

2. **Enhanced Testing**
   - Unit tests for services
   - Integration tests for APIs
   - End-to-end tests
   - Performance testing
   - Security testing

3. **Database Optimization**
   - Index optimization review
   - Query performance tuning
   - Connection pooling optimization
   - Database sharding strategy

4. **Search Functionality**
   - Full-text search implementation
   - Elasticsearch integration
   - Search analytics
   - Autocomplete suggestions

5. **Documentation Generation**
   - Auto-generated API docs
   - Postman collection export
   - OpenAPI spec updates
   - SDK generation

### Medium Priority
1. **Webhooks System**
   - Event-driven architecture
   - Webhook retries
   - Signature verification
   - Webhook dashboard

2. **Caching Strategy**
   - Cache invalidation policy
   - Cache warming
   - CDN integration
   - ETag support

3. **Job Queue System**
   - Background job processing (Bull/BullMQ)
   - Email queue
   - Notification queue
   - Export/import queue
   - Cleanup jobs

4. **Message Queue**
   - RabbitMQ/Kafka integration
   - Event streaming
   - Multi-node scaling
   - Message routing

5. **API Rate Limiting Enhancement**
   - Dynamic rate limiting
   - Tiered pricing integration
   - Custom limits per user
   - Rate limit headers

### Lower Priority
1. **GraphQL API**
   - GraphQL schema design
   - Query optimization
   - Subscription support
   - GraphQL federation

2. **Microservices Migration**
   - Service decomposition
   - Inter-service communication
   - Service discovery
   - Circuit breakers

3. **Advanced Analytics**
   - Custom dashboards
   - Predictive analytics
   - Machine learning integration
   - Real-time analytics

4. **Mobile App Support**
   - Push notification improvement
   - Mobile-specific endpoints
   - Offline support
   - Sync mechanisms

5. **Multi-tenancy**
   - Tenant isolation
   - Custom branding
   - Separate databases
   - Resource quotas

---

## Dependencies Summary

### Production Dependencies (42 total)
- **Express.js Ecosystem** (5): express, cors, helmet, compression, cookie-parser
- **Database** (1): mongoose
- **Caching** (2): redis, connect-redis
- **Authentication** (2): jsonwebtoken, bcryptjs
- **Validation** (1): zod, express-validator
- **Security** (3): express-rate-limit, express-mongo-sanitize, sanitize-html
- **File Operations** (4): multer, fs-extra, sharp, tar
- **Logging** (3): morgan, pino, pino-pretty
- **Email** (1): nodemailer
- **SMS/Chat** (1): twilio
- **Geolocation** (1): geoip-lite
- **Metrics** (1): prom-client
- **Code Generation** (1): uuid
- **Data Utilities** (1): node-cache, node-cron
- **API Documentation** (2): swagger-jsdoc, swagger-ui-express
- **2FA/QR Codes** (2): speakeasy, qrcode
- **Configuration** (1): dotenv
- **Passport** (1): passport

---

## Deployment Checklist

- [ ] Set environment variables
- [ ] Create MongoDB database
- [ ] Set up Redis instance
- [ ] Configure email service
- [ ] Set up Google Drive OAuth (if using)
- [ ] Configure Twilio (for SMS/WhatsApp)
- [ ] Set up Grafana dashboards
- [ ] Configure alerting rules
- [ ] Set up backup schedule
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy
- [ ] Set up monitoring
- [ ] Configure log aggregation
- [ ] Set up CI/CD pipeline
- [ ] Run security audit
- [ ] Performance testing
- [ ] Load testing
- [ ] User acceptance testing

---

## Support & Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGO_URI syntax
   - Verify database is running
   - Check network connectivity
   - Review MongoDB logs

2. **Redis Connection Failed**
   - Verify Redis is running
   - Check REDIS_URL
   - Review Redis logs
   - Check firewall rules

3. **Email Not Sending**
   - Verify SMTP credentials
   - Check Gmail app-specific password
   - Review Nodemailer configuration
   - Check email logs

4. **High Memory Usage**
   - Check for memory leaks
   - Review event loop lag
   - Check cache size
   - Review database query performance

5. **Slow API Response**
   - Check database indexes
   - Review query performance
   - Check Redis cache
   - Monitor CPU/memory
   - Check network latency

---

## Conclusion

The Wondertravelers API is a comprehensive, production-ready backend system with enterprise-grade features including:

- Complete user authentication and authorization
- Secure data backup and recovery
- Advanced analytics and monitoring
- Multi-tier security architecture
- Scalable design patterns
- Comprehensive audit logging
- Performance monitoring and optimization

The system is designed for reliability, security, and scalability, with room for growth and enhancement based on future requirements.

**Next Steps for Improvement:**
1. Implement comprehensive test suite
2. Add API versioning support
3. Integrate webhook system
4. Enable message queue for background jobs
5. Implement advanced caching strategy
6. Add GraphQL API layer
7. Set up microservices architecture
8. Implement multi-tenancy support

---

**Document Version:** 1.0.0  
**Last Updated:** February 27, 2026  
**Maintained By:** Development Team
