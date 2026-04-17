# Project Folder Structure

This document outlines the folder structure of the project for better understanding and navigation.

## Root Directory
- **alertmanager-config.yml**: Configuration file for Alertmanager.
- **grafana-dashboard.json**: Dashboard configuration for Grafana.
- **package.json**: Node.js project metadata and dependencies.
- **README.md**: Project overview and instructions.

## Directories

### `docs/`
- Contains documentation files.
  - `auth.md`: Documentation for authentication-related features.

### `src/`
- Main source code directory.

#### `app.js`
- Entry point for the application.

#### `server.js`
- Server setup and initialization.

#### `config/`
- Configuration files for various services.
  - `swagger.js`: Swagger API documentation setup.

#### `features/`
- Contains feature-specific modules.

##### `admin/`
- Admin-related features.
  - `admin-settings.controller.js`: Controller for admin settings.
  - `admin-settings.model.js`: Model for admin settings.
  - `admin-settings.schema.js`: Schema for admin settings.
  - `admin-settings.service.js`: Service logic for admin settings.
  - `admin.controller.js`: General admin controller.
  - `admin.routes.js`: Routes for admin features.
  - `permission.controller.js`: Controller for permissions.
  - `permission.model.js`: Model for permissions.
  - `user-list.controller.js`: Controller for user list.

##### `analytics/`
- Analytics-related features.
  - `analytics.controller.js`: Controller for analytics.
  - `analytics.model.js`: Model for analytics.
  - `analytics.routes.js`: Routes for analytics.
  - `analytics.service.js`: Service logic for analytics.
  - `customer-behavior.model.js`: Model for customer behavior.
  - `customer-behavior.routes.js`: Routes for customer behavior.

##### `auth/`
- Authentication-related features.
  - `audit.controller.js`: Controller for audit logs.
  - `audit.model.js`: Model for audit logs.
  - `audit.routes.js`: Routes for audit logs.
  - `auth.controller.js`: Controller for authentication.
  - `auth.enhanced.js`: Enhanced authentication logic.
  - `auth.middleware.js`: Middleware for authentication.
  - `auth.model.js`: Model for authentication.
  - `auth.routes.js`: Routes for authentication.
  - `auth.service.js`: Service logic for authentication.
  - `oauth.controller.js`: Controller for OAuth.
  - `oauth.routes.js`: Routes for OAuth.
  - `oauth.service.js`: Service logic for OAuth.

##### `backup/`
- Backup-related features.
  - `backup.controller.js`: Controller for backups.
  - `backup.model.js`: Model for backups.
  - `backup.routes.js`: Routes for backups.
  - `backup.service.js`: Service logic for backups.
  - `backup.utils.js`: Utility functions for backups.
  - `drive.service.js`: Service for drive integration.
  - `metrics.service.js`: Service for metrics.
  - `scheduler.service.js`: Service for scheduling tasks.
  - `webhook.service.js`: Service for webhooks.

#### `middleware/`
- Middleware functions for various purposes.
  - `admin-privilege.middleware.js`: Middleware for admin privileges.
  - `admin-rate-limit.middleware.js`: Middleware for admin rate limiting.
  - `analytics-rate-limit.middleware.js`: Middleware for analytics rate limiting.
  - `analytics-tracking.middleware.js`: Middleware for analytics tracking.
  - `analytics-validation.middleware.js`: Middleware for analytics validation.
  - `audit.middleware.js`: Middleware for audit logs.
  - `check-permission.middleware.js`: Middleware for permission checks.
  - `error.middleware.js`: Middleware for error handling.
  - `rate-limit.middleware.js`: Middleware for rate limiting.
  - `request-id.middleware.js`: Middleware for request ID generation.
  - `sanitize.middleware.js`: Middleware for sanitization.
  - `upload.middleware.js`: Middleware for file uploads.
  - `validate.middleware.js`: Middleware for validation.

#### `utils/`
- Utility functions and helpers.
  - `audit-cleanup.util.js`: Utility for audit cleanup.
  - `email.util.js`: Utility for email handling.
  - `emailCron.js`: Cron jobs for email.
  - `errors.util.js`: Utility for error handling.
  - `imageProcessor.util.js`: Utility for image processing.
  - `logger.util.js`: Utility for logging.
  - `memory-leak.util.js`: Utility for memory leak detection.
  - `mnz.js`: Miscellaneous utilities.
  - `notification.util.js`: Utility for notifications.
  - `redis.util.js`: Utility for Redis operations.
  - `response.js`: Utility for standardized responses.
  - `watermark.util.js`: Utility for watermarking.

#### `uploads/`
- Directory for uploaded files.
  - `avatars/`: Avatar uploads.
    - `original/`: Original avatar files.
    - `thumbnails/`: Thumbnail versions of avatars.

#### `temp/`
- Temporary files.

---

This structure is designed to ensure modularity, scalability, and maintainability of the project.