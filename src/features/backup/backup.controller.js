// src/features/backup/backup.controller.js
import path from 'path';
import fs from 'fs-extra';
import mongoose from 'mongoose';
import { Backup, BackupSchedule } from './backup.model.js';
import {
  exportDatabaseCollections,
  createBackupArchive,
  restoreBackupData,
  calculateDatabaseStatistics,
  validateBackupIntegrity,
  generateBackupFileName,
  getBackupSize,
  enforceRetention,
} from './backup.service.js';
import {
  ensureBackupDir,
  cleanupExpiredBackups,
  formatFileSize,
  getBackupStorageStats,
  BACKUP_DIR,
} from './backup.utils.js';
import { saveGDriveCredentials, loadGDriveCredentials, uploadFileToDrive } from './drive.service.js';
import { calculateChecksum } from './backup.utils.js';
import * as tar from 'tar';
import { createMongoDumpJob } from './backup.service.js';
import { initScheduler, getAutoSyncConfig, setAutoSyncConfig, triggerAutoSyncNow as schedulerTriggerAutoSyncNow } from './scheduler.service.js';
import { logger } from '../../utils/logger.util.js';
import { incBackupCreated, incBackupFailed, observeBackupDuration, getPrometheusMetrics } from './metrics.service.js';
import { sendBackupWebhook } from './webhook.service.js';
import { listDriveFiles, downloadDriveFile, deleteDriveFile, generateDriveAuthUrl, exchangeCodeForTokens } from './drive.service.js';

export const backupController = {
  /**
   * Create a new backup
   */
  async createBackup(req, res, next) {
    try {
      logger.info('Creating backup', { userId: req.user._id });

      // Ensure backup directory exists
      await ensureBackupDir();

      // Start backup
      const backupStatus = new Backup({
        name: `Manual Backup - ${new Date().toLocaleString()}`,
        fileName: generateBackupFileName('manual'),
        type: 'manual',
        status: 'in-progress',
        createdBy: req.user._id,
        startedAt: new Date(),
      });

      const startTime = Date.now();
      const backupFilePath = path.join(BACKUP_DIR, backupStatus.fileName);

      // Send immediate response
      res.json({
        success: true,
        message: 'Backup creation started',
        backup: backupStatus,
      });

      // Process backup in the background (non-blocking)
      setImmediate(async () => {
        try {
          // Export database
          const { exportData, statistics } = await exportDatabaseCollections(req.user._id);

          // Create backup archive
          const archiveInfo = await createBackupArchive(exportData, backupFilePath, {
            compress: true,
            encrypt: true,
          });

          // Update backup record
          backupStatus.size = {
            original: archiveInfo.originalSize,
            compressed: archiveInfo.compressedSize,
          };
          backupStatus.storagePath = archiveInfo.filePath;
          backupStatus.checksum = archiveInfo.checksum;
          backupStatus.compressed = true;
          backupStatus.encrypted = true;
          backupStatus.status = 'success';
          backupStatus.completedAt = new Date();
          backupStatus.duration = Date.now() - startTime;
          backupStatus.statistics = statistics;
          backupStatus.integrity.status = 'verified';
          backupStatus.integrity.verifiedAt = new Date();

          await backupStatus.save();

          logger.info('Backup created successfully', {
            backupId: backupStatus._id,
            size: archiveInfo.compressedSize,
            duration: backupStatus.duration,
          });
          try { await sendBackupWebhook('backup.db.created', { backupId: backupStatus._id.toString(), fileName: backupStatus.fileName, size: backupStatus.size }); } catch (e) { }
          try { incBackupCreated('db'); } catch (e) { }
        } catch (err) {
          logger.error('Background backup creation error:', {
            error: err.message,
            userId: req.user._id,
          });

          backupStatus.status = 'failed';
          backupStatus.error = {
            message: err.message,
            code: err.code,
          };
          backupStatus.completedAt = new Date();
          await backupStatus.save();

          // Cleanup failed backup file
          try {
            await fs.remove(backupFilePath);
          } catch (cleanupErr) {
            logger.warn('Failed to cleanup backup file:', cleanupErr.message);
          }
          try { incBackupFailed('db'); } catch (e) { }
          try { await sendBackupWebhook('backup.db.failed', { backupId: backupStatus._id.toString(), error: err.message }); } catch (e) { }
        }
      });
    } catch (err) {
      logger.error('Backup controller error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Backup operation failed',
        error: err.message,
      });
    }
  },

  /**
   * Get backup list
   */
  async getBackupList(req, res, next) {
    try {
      logger.info('Fetching backup list', { userId: req.user._id });

      const { page = 1, limit = 10, status, type } = req.query;
      const skip = (page - 1) * limit;

      const filter = {};
      if (status) filter.status = status;
      if (type) filter.type = type;

      const [backups, total] = await Promise.all([
        Backup.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('createdBy', 'username email'),
        Backup.countDocuments(filter),
      ]);

      const storageStats = await getBackupStorageStats();

      res.json({
        success: true,
        data: {
          backups,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          storage: storageStats,
        },
      });
    } catch (err) {
      logger.error('Failed to fetch backup list:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch backup list',
        error: err.message,
      });
    }
  },

  /**
   * Get backup details
   */
  async getBackupDetails(req, res, next) {
    try {
      const { backupId } = req.params;

      const backup = await Backup.findById(backupId).populate('createdBy', 'username email');

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
        });
      }

      res.json({
        success: true,
        backup,
      });
    } catch (err) {
      logger.error('Failed to fetch backup details:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch backup details',
      });
    }
  },

  /**
   * Restore backup
   */
  async restoreBackup(req, res, next) {
    try {
      logger.info('Restoring backup', {
        backupId: req.params.backupId,
        userId: req.user._id,
      });

      const { backupId } = req.params;
      const backup = await Backup.findById(backupId);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
        });
      }

      if (backup.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Cannot restore a failed or incomplete backup',
        });
      }

      // Verify integrity before restore
      const integrity = await validateBackupIntegrity(backup.storagePath, backup.checksum);

      if (integrity.status === 'corrupted') {
        return res.status(400).json({
          success: false,
          message: 'Backup is corrupted and cannot be restored',
          integrity,
        });
      }

      try {
        const mode = req.query.mode || req.body.mode || 'upsert';
        const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;

        let restoreResult;

        // If this is a files backup, restore filesystem entries with conflict handling
        if (backup.type === 'files' || (backup.fileName && backup.fileName.includes('files'))) {
          // Extract archive to temp dir and perform file-level restore
          const tempDir = path.join(BACKUP_DIR, `.temp-files-restore-${Date.now()}`);
          await fs.ensureDir(tempDir);

          // Decompress/extract depending on compressed flag
          await tar.x({ file: backup.storagePath, cwd: tempDir });

          // Walk extracted files
          const extractedFiles = await fs.readdir(tempDir);
          const actions = [];

          // Helper to walk recursively
          async function walk(dir) {
            const items = await fs.readdir(dir);
            for (const it of items) {
              const full = path.join(dir, it);
              const stat = await fs.stat(full);
              if (stat.isDirectory()) {
                await walk(full);
              } else {
                actions.push(full);
              }
            }
          }

          await walk(tempDir);

          const uploadsRoot = path.join(process.cwd(), 'uploads');
          let processed = 0;
          const nowStamp = Date.now();

          for (const src of actions) {
            const rel = path.relative(tempDir, src);
            const dest = path.join(uploadsRoot, rel);
            const exists = await fs.pathExists(dest);

            if (dryRun) {
              // just record what would happen
              // skip actual fs operations
              continue;
            }

            if (mode === 'overwrite') {
              await fs.ensureDir(path.dirname(dest));
              await fs.copy(src, dest, { overwrite: true });
              processed++;
            } else if (mode === 'skip-existing') {
              if (!exists) {
                await fs.ensureDir(path.dirname(dest));
                await fs.copy(src, dest, { overwrite: false, errorOnExist: false });
                processed++;
              }
            } else {
              // upsert -> if exists, write with .restore.TIMESTAMP suffix
              if (exists) {
                const ext = path.extname(dest);
                const base = dest.slice(0, -ext.length);
                const newDest = `${base}.restore.${nowStamp}${ext}`;
                await fs.ensureDir(path.dirname(newDest));
                await fs.copy(src, newDest, { overwrite: false });
                processed++;
              } else {
                await fs.ensureDir(path.dirname(dest));
                await fs.copy(src, dest, { overwrite: false });
                processed++;
              }
            }
          }

          // cleanup temp dir
          try { await fs.remove(tempDir); } catch (e) { }

          restoreResult = { success: true, filesProcessed: processed, mode, dryRun };
        } else {
          // Restore DB backup with conflict-aware modes
          restoreResult = await restoreBackupData(backup.storagePath, {
            encrypted: backup.encrypted,
            compressed: backup.compressed,
            mode,
            dryRun,
          });
        }

        // Log restore event
        backup.restoreHistory.push({
          restoredBy: req.user._id,
          restoredAt: new Date(),
          status: 'success',
          notes: req.body.notes,
        });
        await backup.save();

        logger.info('Backup restored successfully', {
          backupId,
          userId: req.user._id,
          documentsRestored: restoreResult.documentsRestored,
        });

        res.json({
          success: true,
          message: 'Backup restored successfully',
          result: restoreResult,
        });
      } catch (restoreErr) {
        logger.error('Restore operation failed:', restoreErr.message);

        backup.restoreHistory.push({
          restoredBy: req.user._id,
          restoredAt: new Date(),
          status: 'failed',
          notes: restoreErr.message,
        });
        await backup.save();

        res.status(500).json({
          success: false,
          message: 'Failed to restore backup',
          error: restoreErr.message,
        });
      }
    } catch (err) {
      logger.error('Restore backup error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Restore operation failed',
      });
    }
  },

  /**
   * Delete backup
   */
  async deleteBackup(req, res, next) {
    try {
      const { backupId } = req.params;
      const backup = await Backup.findById(backupId);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
        });
      }

      if (backup.isLocked) {
        return res.status(403).json({
          success: false,
          message: 'This backup is locked and cannot be deleted',
        });
      }

      // Delete backup file
      try {
        await fs.remove(backup.storagePath);
        logger.info(`Backup file deleted: ${backup.fileName}`);
      } catch (err) {
        logger.warn(`Failed to delete backup file: ${err.message}`);
      }

      // Delete backup record
      await Backup.findByIdAndDelete(backupId);

      logger.info('Backup deleted', { backupId, userId: req.user._id });

      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (err) {
      logger.error('Failed to delete backup:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to delete backup',
      });
    }
  },

  /**
   * Download backup
   */
  async downloadBackup(req, res, next) {
    try {
      const { backupId } = req.params;
      const backup = await Backup.findById(backupId);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
        });
      }

      const filePath = backup.storagePath;

      // Check if file exists
      try {
        await fs.access(filePath, fs.constants.F_OK);
      } catch (err) {
        return res.status(404).json({
          success: false,
          message: 'Backup file not found on disk',
        });
      }

      // Check if file is readable
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (err) {
        return res.status(403).json({
          success: false,
          message: 'Backup file is not accessible',
        });
      }

      res.download(filePath, backup.fileName, (err) => {
        if (err && err.code !== 'ERR_HTTP_HEADERS_SENT') {
          logger.error('Download error:', err.message);
        } else if (!err) {
          logger.info('Backup downloaded successfully', {
            backupId,
            userId: req.user._id,
          });
        }
      });
    } catch (err) {
      logger.error('Download backup error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to download backup',
      });
    }
  },

  /**
   * Verify backup integrity
   */
  async verifyBackup(req, res, next) {
    try {
      const { backupId } = req.params;
      const backup = await Backup.findById(backupId);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
        });
      }

      const integrity = await validateBackupIntegrity(backup.storagePath, backup.checksum);

      backup.integrity.status = integrity.status;
      backup.integrity.verifiedAt = new Date();
      backup.integrity.verificationResult = integrity;
      await backup.save();

      res.json({
        success: true,
        integrity,
      });
    } catch (err) {
      logger.error('Backup verification error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to verify backup',
      });
    }
  },

  /**
   * Get backup statistics
   */
  async getBackupStats(req, res, next) {
    try {
      const stats = {
        total: await Backup.countDocuments(),
        successful: await Backup.countDocuments({ status: 'success' }),
        failed: await Backup.countDocuments({ status: 'failed' }),
        pending: await Backup.countDocuments({ status: 'pending' }),
      };

      const recentBackups = await Backup.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'username email');

      const storageStats = await getBackupStorageStats();

      res.json({
        success: true,
        data: {
          stats,
          recentBackups,
          storage: storageStats,
        },
      });
    } catch (err) {
      logger.error('Failed to get backup stats:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup statistics',
      });
    }
  },

  /**
   * Upload Google Drive credentials
   */
  async uploadGDriveCredentials(req, res) {
    try {
      const creds = req.body;
      if (!creds || (!creds.clientId && !creds.serviceAccount) ) {
        return res.status(400).json({ success: false, message: 'Invalid credentials payload' });
      }

      await saveGDriveCredentials(creds);

      res.json({ success: true, message: 'Google Drive credentials saved' });
    } catch (err) {
      logger.error('Failed to save Google Drive credentials:', err.message);
      res.status(500).json({ success: false, message: 'Failed to save credentials', error: err.message });
    }
  },

  /**
   * Get Google Drive config (non-sensitive)
   */
  async getGDriveConfig(req, res) {
    try {
      const creds = await loadGDriveCredentials();
      if (!creds) {
        return res.json({ success: true, configured: false });
      }

      const safe = {
        clientId: creds.clientId || null,
        configured: true,
        hasRefreshToken: !!creds.refreshToken,
      };

      res.json({ success: true, data: safe });
    } catch (err) {
      logger.error('Failed to read Google Drive config:', err.message);
      res.status(500).json({ success: false, message: 'Failed to read config' });
    }
  },

  /**
   * Start OAuth flow: return consent URL for Google Drive
   */
  async startGDriveOAuth(req, res) {
    try {
      // Allow clientId/redirect override via body or env
      const creds = await loadGDriveCredentials();
      const clientId = req.body?.clientId || process.env.GDRIVE_CLIENT_ID || creds?.clientId;
      const redirectUri = process.env.GDRIVE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/api/backup/gdrive/callback`;

      if (!clientId || !redirectUri) {
        return res.status(400).json({ success: false, message: 'clientId and redirectUri required (set GDRIVE_CLIENT_ID and GDRIVE_OAUTH_REDIRECT)' });
      }

      const url = generateDriveAuthUrl({ clientId, redirectUri });
      // Return URL so frontend can open consent page
      res.json({ success: true, url });
    } catch (err) {
      logger.error('Failed to generate Drive OAuth URL:', err.message);
      res.status(500).json({ success: false, message: 'Failed to generate OAuth URL' });
    }
  },

  /**
   * OAuth callback: exchange code for tokens and persist refresh token
   */
  async handleGDriveOAuthCallback(req, res) {
    try {
      const { code } = req.query;
      if (!code) return res.status(400).send('Missing code');

      const clientId = process.env.GDRIVE_CLIENT_ID;
      const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
      const redirectUri = process.env.GDRIVE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/api/backup/gdrive/callback`;

      if (!clientId || !clientSecret) {
        return res.status(500).send('Server not configured with GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET');
      }

      const tokens = await exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri, persist: true });

      // Simple response; frontend may redirect to admin UI
      res.json({ success: true, tokens: { hasRefreshToken: !!tokens.refreshToken } });
    } catch (err) {
      logger.error('Drive OAuth callback error:', err.message);
      res.status(500).json({ success: false, message: 'OAuth callback failed', error: err.message });
    }
  },

  /**
   * Create a files-only backup (uploads directory)
   */
  async createFilesBackup(req, res) {
    try {
      logger.info('Creating files-only backup', { userId: req.user._id });

      await ensureBackupDir();

      const backupStatus = new Backup({
        name: `Files Backup - ${new Date().toLocaleString()}`,
        fileName: generateBackupFileName('files'),
        type: 'files',
        status: 'in-progress',
        createdBy: req.user._id,
        startedAt: new Date(),
      });

      const startTime = Date.now();
      const archivePath = path.join(BACKUP_DIR, backupStatus.fileName);

      res.json({ success: true, message: 'Files backup started', backup: backupStatus });

      setImmediate(async () => {
        try {
          const uploadsRoot = path.join(process.cwd(), 'uploads');

          // If uploads dir doesn't exist, create empty archive
          const exists = await fs.pathExists(uploadsRoot);
          if (!exists) {
            await fs.ensureDir(uploadsRoot);
          }

          // Create tar.gz of uploads, excluding logs and system files
          await tar.c({
            gzip: true,
            file: archivePath,
            cwd: uploadsRoot,
            filter: (path) => {
              // Exclude log and audit directories
              const pathLower = path.toLowerCase();
              return !pathLower.includes('logs') && !pathLower.includes('audit') && !pathLower.includes('.log');
            }
          }, ['.']);

          const stat = await fs.stat(archivePath);
          const checksum = await calculateChecksum(archivePath);

          backupStatus.size = { compressed: stat.size, original: stat.size };
          backupStatus.storagePath = archivePath;
          backupStatus.checksum = checksum;
          backupStatus.compressed = true;
          backupStatus.encrypted = false;

          // Try uploading to Google Drive if configured
          try {
            const driveRes = await uploadFileToDrive(archivePath, backupStatus.fileName, 'application/gzip');
            backupStatus.remote = { provider: 'gdrive', id: driveRes.id, link: driveRes.webViewLink };
          } catch (uploadErr) {
            logger.warn('Google Drive upload failed for files backup:', uploadErr.message);
          }

          backupStatus.status = 'success';
          backupStatus.completedAt = new Date();
          backupStatus.duration = Date.now() - startTime;
          await backupStatus.save();

          logger.info('Files backup created', { backupId: backupStatus._id, size: stat.size });
        } catch (err) {
          logger.error('Files backup background error:', err.message);
          backupStatus.status = 'failed';
          backupStatus.error = { message: err.message };
          backupStatus.completedAt = new Date();
          await backupStatus.save();
          try { await fs.remove(archivePath); } catch (e) { }
        }
      });
    } catch (err) {
      logger.error('Files backup error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to start files backup' });
    }
  },

  /**
   * Get auto-sync config
   */
  async getAutoSyncConfig(req, res) {
    try {
      const cfg = await getAutoSyncConfig();
      res.json({ success: true, data: cfg });
    } catch (err) {
      logger.error('Failed to get auto-sync config:', err.message);
      res.status(500).json({ success: false, message: 'Failed to read auto-sync config' });
    }
  },

  /**
   * Set auto-sync config
   */
  async setAutoSyncConfig(req, res) {
    try {
      const { enabled, cron } = req.body;
      const updated = await setAutoSyncConfig({ enabled: !!enabled, cron: cron || '0 2 * * *' });
      res.json({ success: true, data: updated });
    } catch (err) {
      logger.error('Failed to set auto-sync config:', err.message);
      res.status(500).json({ success: false, message: 'Failed to set auto-sync config' });
    }
  },

  /**
   * Trigger auto-sync now
   */
  async triggerAutoSyncNow(req, res) {
    try {
      const result = await schedulerTriggerAutoSyncNow();
      res.json({ success: true, message: 'Auto-sync triggered', backup: result });
    } catch (err) {
      logger.error('Failed to trigger auto-sync now:', err.message);
      res.status(500).json({ success: false, message: 'Failed to trigger auto-sync' });
    }
  },

  /**
   * Trigger a DB dump backup now
   */
  async createDbBackup(req, res) {
    try {
      const result = await createMongoDumpJob();
      res.json({ success: true, message: 'DB dump created', backup: result });
    } catch (err) {
      logger.error('Failed to create DB dump backup:', err.message);
      res.status(500).json({ success: false, message: 'Failed to create DB dump', error: err.message });
    }
  },

  /**
   * Expose Prometheus metrics for backups
   */
  async getMetrics(req, res) {
    try {
      const metricsText = await getPrometheusMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metricsText);
    } catch (err) {
      logger.error('Failed to get metrics:', err.message);
      res.status(500).send('Failed to get metrics');
    }
  },

  /**
   * List files in configured Google Drive
   */
  async listGDriveFiles(req, res) {
    try {
      const q = req.query.q || "mimeType='application/gzip' or mimeType='application/octet-stream'";
      const data = await listDriveFiles(q, parseInt(req.query.pageSize) || 50);
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Failed to list Google Drive files:', err.message);
      res.status(500).json({ success: false, message: 'Failed to list drive files', error: err.message });
    }
  },

  /**
   * Download a file from Google Drive to local backup dir
   */
  async downloadGDriveFile(req, res) {
    try {
      const { fileId } = req.params;
      if (!fileId) return res.status(400).json({ success: false, message: 'fileId required' });

      const destPath = path.join(BACKUP_DIR, `gdrive-${fileId}-${Date.now()}.download`);
      await downloadDriveFile(fileId, destPath);

      res.json({ success: true, path: destPath });
    } catch (err) {
      logger.error('Failed to download drive file:', err.message);
      res.status(500).json({ success: false, message: 'Failed to download file', error: err.message });
    }
  },

  /**
   * Delete a file from Google Drive
   */
  async deleteGDriveFile(req, res) {
    try {
      const { fileId } = req.params;
      if (!fileId) return res.status(400).json({ success: false, message: 'fileId required' });

      const result = await deleteDriveFile(fileId);
      if (result) {
        // Remove any Backup records referencing this remote id
        await Backup.updateMany({ 'remote.id': fileId }, { $set: { status: 'deleted', backupLocation: 'external' } });
        res.json({ success: true, message: 'File deleted from Drive' });
      } else {
        res.status(500).json({ success: false, message: 'Delete returned false' });
      }
    } catch (err) {
      logger.error('Failed to delete drive file:', err.message);
      res.status(500).json({ success: false, message: 'Failed to delete file', error: err.message });
    }
  },

  /**
   * Sync Drive files metadata into local Backup collection
   */
  async syncGDriveToDb(req, res) {
    try {
      const q = req.query.q || "mimeType='application/gzip' or mimeType='application/octet-stream'";
      const data = await listDriveFiles(q, parseInt(req.query.pageSize) || 100);
      const files = data.files || [];
      let created = 0;
      let updated = 0;

      for (const f of files) {
        const existing = await Backup.findOne({ 'remote.id': f.id });
        const fileName = f.name || `drive-${f.id}`;
        const storagePath = `gdrive://${f.id}`;
        const size = { compressed: parseInt(f.size || 0, 10), original: parseInt(f.size || 0, 10) };

        if (existing) {
          existing.fileName = fileName;
          existing.storagePath = storagePath;
          existing.remote = { provider: 'gdrive', id: f.id, link: f.webViewLink };
          existing.size = size;
          existing.status = 'success';
          await existing.save();
          updated++;
        } else {
          const b = new Backup({
            name: fileName,
            fileName: fileName,
            type: fileName.includes('mongodump') ? 'mongodump' : 'files',
            status: 'success',
            size,
            storagePath,
            backupLocation: 'cloud',
            remote: { provider: 'gdrive', id: f.id, link: f.webViewLink },
            startedAt: new Date(f.modifiedTime),
            completedAt: new Date(f.modifiedTime),
            createdBy: req.user?._id || null,
          });
          await b.save();
          created++;
        }
      }

      res.json({ success: true, created, updated, total: files.length });
    } catch (err) {
      logger.error('Failed to sync Drive files:', err.message);
      res.status(500).json({ success: false, message: 'Failed to sync drive files', error: err.message });
    }
  },

  /**
   * Cleanup expired backups
   */
  async cleanupExpiredBackups(req, res, next) {
    try {
      logger.info('Cleaning up expired backups', { userId: req.user._id });

      const expiredBackups = await Backup.find({
        expiresAt: { $lt: new Date() },
        isLocked: false,
      });

      let deletedCount = 0;

      for (const backup of expiredBackups) {
        try {
          await fs.remove(backup.storagePath);
          await Backup.findByIdAndDelete(backup._id);
          deletedCount++;
        } catch (err) {
          logger.warn(`Failed to cleanup backup ${backup._id}: ${err.message}`);
        }
      }

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} expired backups`,
        deletedCount,
      });
    } catch (err) {
      logger.error('Cleanup error:', err.message);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup expired backups',
      });
    }
  },

  /**
   * Enforce retention policy now (delete/mark expired backups)
   */
  async enforceRetentionNow(req, res, next) {
    try {
      logger.info('Enforcing backup retention', { userId: req.user._id });
      const result = await enforceRetention();
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('Failed to enforce retention:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Sync backups from filesystem to database
   */
  async syncBackupsFromFilesystem(req, res) {
    try {
      // Validate authentication
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      logger.info('Syncing backups from filesystem', { userId: req.user._id });

      // Ensure backup directory exists
      await ensureBackupDir();

      // Read the backup directory
      let files;
      try {
        files = await fs.readdir(BACKUP_DIR);
      } catch (err) {
        if (err.code === 'ENOENT') {
          logger.info('Backup directory does not exist, creating empty list');
          files = [];
        } else {
          throw err;
        }
      }
      
      // Look for backup files with correct extensions
      const backupFiles = files.filter(f => 
        f.endsWith('.backup') || f.endsWith('.backup.gz')
      );
      
      logger.info('Found backup files', { 
        count: backupFiles.length,
        files: backupFiles 
      });
      
      let synced = 0;
      let skipped = 0;
      const errors = [];

      for (const fileName of backupFiles) {
        try {
          const filePath = path.join(BACKUP_DIR, fileName);
          
          // Check if backup exists in DB
          const existing = await Backup.findOne({ fileName });
          
          if (existing) {
            logger.info('Backup already synced, skipping', { fileName });
            skipped++;
            continue;
          }

          logger.info('Processing backup file', { fileName });
          
          const stat = await fs.stat(filePath);
          
          // Extract backup info from filename
          const fileNameMatch = fileName.match(/backup-(\w+)-(.+)\.backup/);
          const backupType = fileNameMatch ? fileNameMatch[1] : 'manual';
          
          // Parse timestamp from filename
          let backupDate = new Date(stat.birthtime);
          if (fileNameMatch && fileNameMatch[2]) {
            try {
              const timestampStr = fileNameMatch[2];
              const parsedDate = new Date(timestampStr);
              if (!isNaN(parsedDate.getTime())) {
                backupDate = parsedDate;
              }
            } catch (e) {
              logger.warn('Could not parse backup date from filename', { fileName });
            }
          }

          // Statistics default to zeros for synced backups
          const statistics = {
            users: 0,
            products: 0,
            orders: 0,
            categories: 0,
            reviews: 0,
            auditLogs: 0,
            sessions: 0,
            settings: 0,
            transactions: 0,
            totalCollections: 0,
            totalDocuments: 0,
          };

          const backup = new Backup({
            name: `${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup - ${backupDate.toLocaleDateString()}`,
            fileName,
            type: backupType,
            status: 'success',
            createdBy: req.user._id,
            size: {
              compressed: stat.size,
              original: stat.size,
            },
            storagePath: filePath,
            encrypted: fileName.endsWith('.backup'),
            compressed: fileName.endsWith('.gz'),
            startedAt: backupDate,
            completedAt: stat.mtime,
            duration: 0,
            integrity: {
              status: 'not-verified',
            },
            statistics,
          });

          await backup.save();
          logger.info('Backup saved successfully', { 
            fileName,
            backupId: backup._id 
          });
          synced++;
        } catch (itemErr) {
          logger.error('Error processing backup file', { 
            fileName, 
            error: itemErr.message,
            stack: itemErr.stack 
          });
          errors.push({
            fileName,
            error: itemErr.message,
          });
        }
      }

      logger.info('Sync operation completed', { 
        synced, 
        skipped, 
        errors: errors.length 
      });
      
      res.json({
        success: true,
        message: `Synced ${synced} backups from filesystem${skipped > 0 ? ` (${skipped} already existed)` : ''}`,
        synced,
        skipped,
        filesFound: backupFiles.length,
        errors: errors.length > 0 ? errors : undefined,
      });
      
    } catch (err) {
      logger.error('Sync operation failed', { 
        error: err.message,
        stack: err.stack 
      });
      res.status(500).json({
        success: false,
        message: 'Failed to sync backups',
        error: err.message,
      });
    }
  },
};

export default backupController;