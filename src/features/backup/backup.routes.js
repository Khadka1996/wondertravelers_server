// src/features/backup/backup.routes.js
import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { checkPermission } from '../../middleware/check-permission.middleware.js';
import { apiRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { backupController } from './backup.controller.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware.protect);

// Check admin role for all backup operations
router.use((req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super-admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
});

// Apply rate limiting to backup operations
router.use(apiRateLimiter);

/**
 * @route POST /api/backup/gdrive/credentials
 * @desc Upload Google Drive OAuth credentials (clientId, clientSecret, refreshToken)
 * @access Private (Admin only)
 */
router.post('/gdrive/credentials', backupController.uploadGDriveCredentials);

/**
 * @route GET /api/backup/gdrive/config
 * @desc Get stored Google Drive config (non-sensitive fields)
 * @access Private (Admin only)
 */
router.get('/gdrive/config', backupController.getGDriveConfig);

/**
 * @route GET /api/backup/gdrive/oauth/start
 * @desc Return Google Drive OAuth consent URL
 * @access Private (Admin only)
 */
router.get('/gdrive/oauth/start', backupController.startGDriveOAuth);

/**
 * @route GET /api/backup/gdrive/callback
 * @desc OAuth callback for Google Drive (exchanges code for tokens)
 * @access Private (Admin only)
 */
router.get('/gdrive/callback', backupController.handleGDriveOAuthCallback);

/**
 * @route POST /api/backup/files/create
 * @desc Create a files-only backup (uploads in /uploads)
 * @access Private (Admin only)
 */
router.post('/files/create', backupController.createFilesBackup);

/**
 * @route POST /api/backup/db/create
 * @desc Trigger a mongodump backup and upload to Google Drive
 * @access Private (Admin only)
 */
router.post('/db/create', backupController.createDbBackup);

/**
 * @route GET /api/backup/files/autosync
 * @desc Get auto-sync configuration
 * @access Private (Admin only)
 */
router.get('/files/autosync', backupController.getAutoSyncConfig);

/**
 * @route POST /api/backup/files/autosync
 * @desc Set auto-sync configuration { enabled: boolean, cron: string }
 * @access Private (Admin only)
 */
router.post('/files/autosync', backupController.setAutoSyncConfig);

/**
 * @route POST /api/backup/files/autosync/trigger
 * @desc Trigger auto-sync immediately
 * @access Private (Admin only)
 */
router.post('/files/autosync/trigger', backupController.triggerAutoSyncNow);

/**
 * @route GET /api/backup/metrics
 * @desc Prometheus metrics for backups
 * @access Private (Admin only)
 */
router.get('/metrics', backupController.getMetrics);

/**
 * @route GET /api/backup/gdrive/list
 * @desc List files in configured Google Drive
 * @access Private (Admin only)
 */
router.get('/gdrive/list', backupController.listGDriveFiles);

/**
 * @route GET /api/backup/gdrive/download/:fileId
 * @desc Download a file from Google Drive to local backup dir
 * @access Private (Admin only)
 */
router.get('/gdrive/download/:fileId', backupController.downloadGDriveFile);

/**
 * @route DELETE /api/backup/gdrive/delete/:fileId
 * @desc Delete a file from Google Drive
 * @access Private (Admin only)
 */
router.delete('/gdrive/delete/:fileId', backupController.deleteGDriveFile);

/**
 * @route POST /api/backup/gdrive/sync
 * @desc Sync Google Drive files into local Backups DB
 * @access Private (Admin only)
 */
router.post('/gdrive/sync', backupController.syncGDriveToDb);

/**
 * @route POST /api/backup/create
 * @desc Create a new backup
 * @access Private (Admin only)
 */
router.post('/create', backupController.createBackup);

/**
 * @route GET /api/backup/list
 * @desc Get list of all backups with pagination
 * @access Private (Admin only)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @query {string} status - Filter by status (pending/in-progress/success/failed)
 * @query {string} type - Filter by type (manual/scheduled/auto)
 */
router.get('/list', backupController.getBackupList);

/**
 * @route GET /api/backup/stats
 * @desc Get backup statistics and storage info
 * @access Private (Admin only)
 */
router.get('/stats', backupController.getBackupStats);

/** * @route GET /api/backup/sync
 * @desc Sync backups from filesystem to database
 * @access Private (Admin only)
 */
router.get('/sync', backupController.syncBackupsFromFilesystem);

/** * @route GET /api/backup/cleanup
 * @desc Cleanup expired backups
 * @access Private (Admin only)
 */
router.get('/cleanup', backupController.cleanupExpiredBackups);

/**
 * @route POST /api/backup/retention/enforce
 * @desc Trigger retention enforcement now (delete expired backups)
 * @access Private (Admin only)
 */
router.post('/retention/enforce', backupController.enforceRetentionNow);

/**
 * @route GET /api/backup/:backupId
 * @desc Get specific backup details
 * @access Private (Admin only)
 * @param {string} backupId - Backup ID
 */
router.get('/:backupId', backupController.getBackupDetails);

/**
 * @route POST /api/backup/restore/:backupId
 * @desc Restore a backup
 * @access Private (Admin only)
 * @param {string} backupId - Backup ID
 * @body {string} notes - Optional restoration notes
 */
router.post('/restore/:backupId', backupController.restoreBackup);

/**
 * @route POST /api/backup/verify/:backupId
 * @desc Verify backup integrity
 * @access Private (Admin only)
 * @param {string} backupId - Backup ID
 */
router.post('/verify/:backupId', backupController.verifyBackup);

/**
 * @route GET /api/backup/download/:backupId
 * @desc Download backup file
 * @access Private (Admin only)
 * @param {string} backupId - Backup ID
 */
router.get('/download/:backupId', backupController.downloadBackup);

/**
 * @route DELETE /api/backup/:backupId
 * @desc Delete a backup
 * @access Private (Admin only)
 * @param {string} backupId - Backup ID
 */
router.delete('/:backupId', backupController.deleteBackup);

export default router;
