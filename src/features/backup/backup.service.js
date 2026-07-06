// src/features/backup/backup.service.js
import fs from 'fs-extra';
import path from 'path';
import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../utils/logger.util.js';
import { spawn } from 'child_process';
import {
  compressFile,
  decompressFile,
  encryptFile,
  decryptFile,
  calculateChecksum,
  verifyBackupIntegrity,
  getBackupFileStats,
  formatFileSize,
  ensureBackupDir,
  BACKUP_DIR,
} from './backup.utils.js';
import * as tar from 'tar';
import { Backup } from './backup.model.js';
import { loadGDriveCredentials, uploadFileToDrive, deleteDriveFile } from './drive.service.js';
import { sendBackupWebhook } from './webhook.service.js';
import { incBackupCreated, incBackupFailed, observeBackupDuration } from './metrics.service.js';

const execAsync = promisify(exec);

/**
 * Export database collections to JSON
 */
export const exportDatabaseCollections = async (userId) => {
  try {
    logger.info('Starting database export');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const exportData = {};
    let totalDocuments = 0;

    // Collections to exclude (logs, audit trails - too large and not needed for recovery)
    const excludeCollections = ['auditlogs', 'securityaudits', 'logs', 'activitylogs', 'errorlogs', 'accesslogs', 'systemlogs'];

    for (const collection of collections) {
      const collectionName = collection.name;

      // Skip system collections and log collections
      if (collectionName.startsWith('system.')) continue;
      if (excludeCollections.includes(collectionName.toLowerCase())) {
        logger.info(`Skipped log collection: ${collectionName}`);
        continue;
      }

      try {
        const docs = await db.collection(collectionName).find({}).toArray();
        exportData[collectionName] = docs;
        totalDocuments += docs.length;

        logger.info(`Exported ${collectionName}: ${docs.length} documents`);
      } catch (err) {
        logger.warn(`Failed to export ${collectionName}: ${err.message}`);
      }
    }

    logger.info(`Database export completed: ${totalDocuments} total documents`);

    return {
      exportData,
      statistics: {
        users: exportData.users?.length || 0,
        products: exportData.products?.length || 0,
        orders: exportData.orders?.length || 0,
        categories: exportData.categories?.length || 0,
        reviews: exportData.reviews?.length || 0,
        auditLogs: exportData.auditlogs?.length || exportData.securityaudits?.length || 0,
        sessions: exportData.sessions?.length || 0,
        settings: exportData.settings?.length || 0,
        transactions: exportData.transactions?.length || 0,
        totalCollections: Object.keys(exportData).length,
        totalDocuments,
      },
    };
  } catch (err) {
    logger.error('Database export failed:', err.message);
    throw new Error(`Failed to export database: ${err.message}`);
  }
};

/**
 * Create backup archive
 */
export const createBackupArchive = async (exportData, backupFilePath, options = {}) => {
  try {
    logger.info('Creating backup archive');

    // Write JSON data to temp file
    const tempJsonPath = backupFilePath.replace('.backup', '.json');
    const jsonString = JSON.stringify(exportData, null, 2);
    await fs.writeFile(tempJsonPath, jsonString);

    logger.info(`Backup data written: ${formatFileSize((await fs.stat(tempJsonPath)).size)}`);

    let currentFile = tempJsonPath;
    const originalSize = (await fs.stat(tempJsonPath)).size;

    // Compress if enabled
    if (options.compress !== false) {
      const compressedPath = backupFilePath.replace('.backup', '.backup.gz');
      const compressionStats = await compressFile(currentFile, compressedPath);
      logger.info(`Compression: ${formatFileSize(compressionStats.original)} → ${formatFileSize(compressionStats.compressed)}`);
      
      // Clean up original JSON
      await fs.remove(currentFile);
      currentFile = compressedPath;
    }

    // Encrypt if enabled
    if (options.encrypt !== false) {
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('BACKUP_ENCRYPTION_KEY environment variable must be set for backup encryption');
      }
      const encryptedPath = backupFilePath;
      await encryptFile(currentFile, encryptedPath, encryptionKey);
      logger.info(`Backup encrypted with AES-256`);
      
      // Clean up compressed file
      if (options.compress !== false) {
        await fs.remove(currentFile);
      }
      currentFile = encryptedPath;
    }

    // Calculate checksum
    const checksum = await calculateChecksum(currentFile);
    const finalStats = await fs.stat(currentFile);

    logger.info(`Backup archive created successfully`);

    return {
      filePath: currentFile,
      fileName: path.basename(currentFile),
      originalSize,
      compressedSize: finalStats.size,
      checksum,
    };
  } catch (err) {
    logger.error('Archive creation failed:', err.message);
    throw err;
  }
};

/**
 * Restore backup
 */
export const restoreBackupData = async (backupFilePath, options = {}) => {
  try {
    logger.info('Starting backup restoration');

    let currentFile = backupFilePath;
    const tempDir = path.join(BACKUP_DIR, `.temp-restore-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // Decrypt if needed
    if (options.encrypted !== false) {
      const decryptedPath = path.join(tempDir, 'backup.json.gz');
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('BACKUP_ENCRYPTION_KEY environment variable must be set for backup decryption');
      }
      await decryptFile(backupFilePath, decryptedPath, encryptionKey);
      currentFile = decryptedPath;
      logger.info('Backup decrypted successfully');
    }

    // Decompress if needed
    if (options.compressed !== false) {
      const decompressedPath = path.join(tempDir, 'backup.json');
      await decompressFile(currentFile, decompressedPath);
      currentFile = decompressedPath;
      logger.info('Backup decompressed successfully');
    }

    // Read and parse JSON
    const jsonData = await fs.readFile(currentFile, 'utf8');
    const restoreData = JSON.parse(jsonData);

    logger.info('Backup data parsed successfully');

    // Restore to database with conflict-aware modes
    const db = mongoose.connection.db;
    let restoredDocuments = 0;
    const mode = options.mode || 'upsert'; // overwrite | skip-existing | upsert
    const dryRun = !!options.dryRun;

    for (const [collectionName, documents] of Object.entries(restoreData)) {
      if (!Array.isArray(documents) || documents.length === 0) continue;

      try {
        const collection = db.collection(collectionName);
        const ids = documents.map(d => d._id).filter(Boolean);

        if (dryRun) {
          // Determine actions without applying
          const existing = ids.length ? await collection.find({ _id: { $in: ids } }).project({ _id: 1 }).toArray() : [];
          const existingSet = new Set(existing.map(e => e._id.toString()));
          let willInsert = 0, willSkip = 0, willReplace = 0, willUpsert = 0;

          for (const doc of documents) {
            const exists = existingSet.has(String(doc._id));
            if (mode === 'overwrite') {
              exists ? willReplace++ : willInsert++;
            } else if (mode === 'skip-existing') {
              exists ? willSkip++ : willInsert++;
            } else {
              // upsert
              exists ? willUpsert++ : willInsert++;
            }
          }

          logger.info(`Dry-run for ${collectionName}: insert=${willInsert}, skip=${willSkip}, replace=${willReplace}, upsert=${willUpsert}`);
          restoredDocuments += willInsert; // report potential inserts
          continue;
        }

        // Build bulk operations
        const ops = [];
        for (const doc of documents) {
          const filter = { _id: doc._id };
          if (mode === 'overwrite') {
            ops.push({ replaceOne: { filter, replacement: doc, upsert: true } });
          } else if (mode === 'skip-existing') {
            ops.push({ updateOne: { filter, update: { $setOnInsert: doc }, upsert: true } });
          } else {
            // upsert (merge)
            ops.push({ updateOne: { filter, update: { $set: doc }, upsert: true } });
          }
        }

        if (ops.length > 0) {
          const result = await collection.bulkWrite(ops, { ordered: false });
          const inserted = (result.upsertedCount || 0) + (result.insertedCount || 0);
          const modified = result.modifiedCount || 0;
          restoredDocuments += inserted + modified;
          logger.info(`Restored ${collectionName}: upserted=${result.upsertedCount || 0}, modified=${modified}`);
        }
      } catch (err) {
        logger.warn(`Failed to restore ${collectionName}: ${err.message}`);
      }
    }

    // Cleanup temp directory
    await fs.remove(tempDir);

    logger.info(`Restoration completed: ${restoredDocuments} documents processed`);

    return {
      success: true,
      documentsProcessed: restoredDocuments,
      collectionsRestored: Object.keys(restoreData).length,
    };
  } catch (err) {
    logger.error('Restoration failed:', err.message);
    throw new Error(`Failed to restore backup: ${err.message}`);
  }
};

/**
 * Calculate database statistics before backup
 */
export const calculateDatabaseStatistics = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
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

    for (const collection of collections) {
      const name = collection.name;
      if (name.startsWith('system.')) continue;

      const count = await db.collection(name).countDocuments();
      statistics.totalDocuments += count;
      statistics.totalCollections += 1;

      // Map collection names to statistics
      if (name.includes('user')) statistics.users = count;
      if (name.includes('product')) statistics.products = count;
      if (name.includes('order')) statistics.orders = count;
      if (name.includes('categor')) statistics.categories = count;
      if (name.includes('review') || name.includes('rating')) statistics.reviews = count;
      if (name.includes('audit') || name.includes('security')) statistics.auditLogs = count;
      if (name.includes('session')) statistics.sessions = count;
      if (name.includes('setting')) statistics.settings = count;
      if (name.includes('transaction')) statistics.transactions = count;
    }

    return statistics;
  } catch (err) {
    logger.error('Statistics calculation failed:', err.message);
    return {};
  }
};

/**
 * Validate backup integrity
 */
export const validateBackupIntegrity = async (backupFilePath, expectedChecksum) => {
  try {
    logger.info('Validating backup integrity');

    const fileStats = await fs.stat(backupFilePath);
    if (!fileStats.isFile()) {
      throw new Error('Backup file not found or is not a file');
    }

    const verification = await verifyBackupIntegrity(backupFilePath, expectedChecksum);

    if (verification.isValid) {
      logger.info('Backup integrity verified successfully');
      return {
        status: 'verified',
        ...verification,
      };
    } else {
      logger.error('Backup integrity verification failed');
      return {
        status: 'corrupted',
        ...verification,
      };
    }
  } catch (err) {
    logger.error('Integrity validation failed:', err.message);
    return {
      status: 'error',
      error: err.message,
    };
  }
};

/**
 * Generate backup filename
 */
export const generateBackupFileName = (type = 'manual') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `backup-${type}-${timestamp}.backup`;
};

/**
 * Get backup file size
 */
export const getBackupSize = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (err) {
    logger.error('Failed to get backup size:', err.message);
    return 0;
  }
};

/**
 * Create a files-only backup (used by controller and scheduler)
 */
export const createFilesBackupJob = async (options = {}) => {
  try {
    await ensureBackupDir();
    const backupFileName = generateBackupFileName('files');
    const archivePath = path.join(BACKUP_DIR, backupFileName);

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const exists = await fs.pathExists(uploadsRoot);
    if (!exists) await fs.ensureDir(uploadsRoot);

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

    // Persist backup record
    const backupStatus = new Backup({
      name: `Files Backup - ${new Date().toLocaleString()}`,
      fileName: backupFileName,
      type: 'files',
      status: 'in-progress',
      startedAt: new Date(),
      size: { compressed: stat.size, original: stat.size },
      storagePath: archivePath,
      checksum,
      compressed: true,
      encrypted: false,
    });

    await backupStatus.save();

    // Attempt upload if Drive creds configured
    try {
      const creds = await loadGDriveCredentials();
      if (creds) {
        const driveRes = await uploadFileToDrive(archivePath, backupFileName, 'application/gzip');
        backupStatus.remote = { provider: 'gdrive', id: driveRes.id, link: driveRes.webViewLink };
      }
    } catch (uploadErr) {
      logger.warn('Files backup upload failed:', uploadErr.message);
    }

    backupStatus.status = 'success';
    backupStatus.completedAt = new Date();
    backupStatus.duration = 0;
    await backupStatus.save();

    // Metrics & webhook
    try { incBackupCreated('files'); } catch (e) { }
    try { await sendBackupWebhook('backup.files.created', { backupId: backupStatus._id.toString(), fileName: backupStatus.fileName, size: backupStatus.size }); } catch (e) { }

    return backupStatus;
  } catch (err) {
    logger.error('createFilesBackupJob failed:', err.message);
    throw err;
  }
};

/**
 * Create a full mongodump archive and optionally upload to Google Drive
 */
export const createMongoDumpJob = async (options = {}) => {
  try {
    await ensureBackupDir();
    const backupFileName = generateBackupFileName('mongodump');
    const archivePath = path.join(BACKUP_DIR, backupFileName);

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI not set');

    // Run mongodump --archive --gzip --uri="..."
    await new Promise((resolve, reject) => {
      const args = [`--uri=${mongoUri}`, '--archive', '--gzip'];
      const child = spawn('mongodump', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      const outStream = fs.createWriteStream(archivePath);
      child.stdout.pipe(outStream);

      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        outStream.close();
        if (code === 0) resolve();
        else reject(new Error(`mongodump exited ${code}: ${stderr}`));
      });
    });

    const stat = await fs.stat(archivePath);
    const checksum = await calculateChecksum(archivePath);

    const backupStatus = new Backup({
      name: `DB Dump - ${new Date().toLocaleString()}`,
      fileName: backupFileName,
      type: 'mongodump',
      status: 'in-progress',
      startedAt: new Date(),
      size: { compressed: stat.size, original: stat.size },
      storagePath: archivePath,
      checksum,
      compressed: true,
      encrypted: false,
    });

    await backupStatus.save();

    // Attempt upload to Google Drive
    try {
      const driveRes = await uploadFileToDrive(archivePath, backupFileName, 'application/gzip');
      backupStatus.remote = { provider: 'gdrive', id: driveRes.id, link: driveRes.webViewLink };
    } catch (uploadErr) {
      logger.warn('mongodump upload failed:', uploadErr.message);
    }

    backupStatus.status = 'success';
    backupStatus.completedAt = new Date();
    await backupStatus.save();

    // Metrics & webhook
    try { incBackupCreated('mongodump'); } catch (e) { }
    try { await sendBackupWebhook('backup.mongodump.created', { backupId: backupStatus._id.toString(), fileName: backupStatus.fileName, size: backupStatus.size }); } catch (e) { }

    return backupStatus;
  } catch (err) {
    logger.error('createMongoDumpJob failed:', err.message);
    throw err;
  }
};

/**
 * Enforce retention: delete or mark expired backups
 */
export const enforceRetention = async (options = {}) => {
  try {
    const now = new Date();
    const expired = await Backup.find({ expiresAt: { $lt: now }, isLocked: false });
    let removed = 0;
    for (const b of expired) {
      try {
        // Remove local file if exists
        if (b.storagePath && b.storagePath.startsWith('/') ) {
          try { await fs.remove(b.storagePath); } catch (e) { logger.warn('Failed to remove local backup file during retention', { path: b.storagePath, err: e.message }); }
        }

        // Remove remote if present
        if (b.remote && b.remote.provider === 'gdrive' && b.remote.id) {
          try { await deleteDriveFile(b.remote.id); } catch (e) { logger.warn('Failed to delete remote drive file during retention', { id: b.remote.id, err: e.message }); }
        }

        // Mark as deleted
        b.status = 'deleted';
        b.backupLocation = b.remote ? 'external' : 'local';
        b.deletedAt = new Date();
        await b.save();
        removed++;

        try { await sendBackupWebhook('backup.retention.deleted', { backupId: b._id.toString(), fileName: b.fileName }); } catch (e) { }
      } catch (err) {
        logger.warn('Error enforcing retention for backup', { id: b._id.toString(), err: err.message });
      }
    }

    return { removed };
  } catch (err) {
    logger.error('Retention enforcement failed:', err.message);
    throw err;
  }
};
