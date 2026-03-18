// src/features/backup/backup.utils.js
import fs from 'fs-extra';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { logger } from '../../utils/logger.util.js';

const BACKUP_DIR = path.resolve('./backups');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Ensure backup directory exists
export const ensureBackupDir = async () => {
  try {
    await fs.ensureDir(BACKUP_DIR);
    logger.info('Backup directory ready:', BACKUP_DIR);
  } catch (err) {
    logger.error('Failed to create backup directory:', err.message);
    throw err;
  }
};

// Generate encryption key from password
export const deriveEncryptionKey = (password) => {
  return createHash('sha256').update(password).digest();
};

// Compress file with gzip
export const compressFile = async (inputPath, outputPath) => {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const inputStream = fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 });
    const outputStream = fs.createWriteStream(outputPath, { highWaterMark: 64 * 1024 });
    const gzip = createGzip({ level: 6 }); // Reduced compression level for stability

    return new Promise((resolve, reject) => {
      let completed = false;

      const handleComplete = async () => {
        if (completed) return;
        completed = true;

        try {
          const originalStats = await fs.stat(inputPath);
          const compressedStats = await fs.stat(outputPath);
          const compressionRatio = ((1 - compressedStats.size / originalStats.size) * 100).toFixed(2);

          logger.info(`File compressed: ${originalStats.size} → ${compressedStats.size} bytes (${compressionRatio}% reduction)`);

          resolve({
            original: originalStats.size,
            compressed: compressedStats.size,
            ratio: parseFloat(compressionRatio),
          });
        } catch (err) {
          logger.error('Error getting file stats after compression:', err.message);
          reject(err);
        }
      };

      const handleError = async (err) => {
        if (completed) return;
        completed = true;
        logger.error('Compression error:', err.message);
        try {
          await fs.remove(outputPath);
        } catch (e) {
          // ignore cleanup errors
        }
        reject(new Error(`Failed to compress backup: ${err.message}`));
      };

      inputStream.on('error', handleError);
      outputStream.on('error', handleError);
      gzip.on('error', handleError);

      outputStream.on('finish', handleComplete);

      inputStream.pipe(gzip).pipe(outputStream);
    });
  } catch (err) {
    logger.error('Compression setup failed:', err.message);
    throw new Error(`Failed to compress backup: ${err.message}`);
  }
};

// Decompress file
export const decompressFile = async (inputPath, outputPath) => {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }

    const inputStream = fs.createReadStream(inputPath, { highWaterMark: 64 * 1024 });
    const outputStream = fs.createWriteStream(outputPath, { highWaterMark: 64 * 1024 });
    const gunzip = createGunzip();

    return new Promise((resolve, reject) => {
      let completed = false;

      const handleComplete = () => {
        if (completed) return;
        completed = true;
        logger.info(`File decompressed successfully`);
        resolve();
      };

      const handleError = async (err) => {
        if (completed) return;
        completed = true;
        logger.error('Decompression error:', err.message);
        try {
          await fs.remove(outputPath);
        } catch (e) {
          // ignore cleanup errors
        }
        reject(new Error(`Failed to decompress backup: ${err.message}`));
      };

      inputStream.on('error', handleError);
      outputStream.on('error', handleError);
      gunzip.on('error', handleError);

      outputStream.on('finish', handleComplete);

      inputStream.pipe(gunzip).pipe(outputStream);
    });
  } catch (err) {
    logger.error('Decompression setup failed:', err.message);
    throw new Error(`Failed to decompress backup: ${err.message}`);
  }
};

// Encrypt file
export const encryptFile = async (inputPath, outputPath, encryptionKey) => {
  try {
    const key = typeof encryptionKey === 'string' 
      ? deriveEncryptionKey(encryptionKey)
      : encryptionKey;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    const inputStream = fs.createReadStream(inputPath);
    const outputStream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      inputStream.on('error', reject);
      outputStream.on('error', reject);
      cipher.on('error', reject);

      outputStream.on('finish', async () => {
        try {
          // Write IV and auth tag to the beginning of encrypted file
          const encryptedBuffer = await fs.readFile(outputPath);
          const authTag = cipher.getAuthTag();
          
          const finalBuffer = Buffer.concat([
            Buffer.from('ENCRYPTED_BACKUP_V1'), // Magic header
            iv,
            authTag,
            encryptedBuffer,
          ]);

          await fs.writeFile(outputPath, finalBuffer);

          logger.info(`File encrypted with ${ENCRYPTION_ALGORITHM}`);

          resolve({
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
          });
        } catch (err) {
          logger.error('Encryption finalization failed:', err.message);
          reject(err);
        }
      });

      inputStream.pipe(cipher).pipe(outputStream);
    });
  } catch (err) {
    logger.error('Encryption failed:', err.message);
    throw new Error(`Failed to encrypt backup: ${err.message}`);
  }
};

// Decrypt file
export const decryptFile = async (inputPath, outputPath, encryptionKey) => {
  try {
    const key = typeof encryptionKey === 'string' 
      ? deriveEncryptionKey(encryptionKey)
      : encryptionKey;

    const fileBuffer = await fs.readFile(inputPath);

    // Extract components
    const header = fileBuffer.slice(0, 19).toString();
    if (header !== 'ENCRYPTED_BACKUP_V1') {
      throw new Error('Invalid backup file format');
    }

    const iv = fileBuffer.slice(19, 19 + IV_LENGTH);
    const authTag = fileBuffer.slice(19 + IV_LENGTH, 19 + IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = fileBuffer.slice(19 + IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    await fs.writeFile(outputPath, decryptedData);

    logger.info(`File decrypted successfully`);
  } catch (err) {
    logger.error('Decryption failed:', err.message);
    throw new Error(`Failed to decrypt backup: ${err.message}`);
  }
};

// Calculate file checksum (SHA-256)
export const calculateChecksum = async (filePath) => {
  try {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    const checksum = hash.digest('hex');
    logger.info(`Checksum calculated: ${checksum}`);

    return checksum;
  } catch (err) {
    logger.error('Checksum calculation failed:', err.message);
    throw err;
  }
};

// Verify backup integrity
export const verifyBackupIntegrity = async (filePath, expectedChecksum) => {
  try {
    const actualChecksum = await calculateChecksum(filePath);
    const isValid = actualChecksum === expectedChecksum;

    logger.info(`Backup integrity verification: ${isValid ? 'PASSED' : 'FAILED'}`);

    return {
      isValid,
      expected: expectedChecksum,
      actual: actualChecksum,
    };
  } catch (err) {
    logger.error('Integrity verification failed:', err.message);
    throw err;
  }
};

// Get backup file size information
export const getBackupFileStats = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
    };
  } catch (err) {
    logger.error('Failed to get file stats:', err.message);
    throw err;
  }
};

// Cleanup old/expired backups
export const cleanupExpiredBackups = async (backups) => {
  try {
    const now = new Date();
    const expiredBackups = backups.filter(backup => {
      return backup.expiresAt && new Date(backup.expiresAt) < now && !backup.isLocked;
    });

    for (const backup of expiredBackups) {
      try {
        await fs.remove(backup.storagePath);
        logger.info(`Deleted expired backup: ${backup.fileName}`);
      } catch (err) {
        logger.warn(`Failed to delete expired backup ${backup.fileName}: ${err.message}`);
      }
    }

    return expiredBackups.length;
  } catch (err) {
    logger.error('Cleanup failed:', err.message);
    throw err;
  }
};

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Get backup directory stats
export const getBackupStorageStats = async () => {
  try {
    const backups = await fs.readdir(BACKUP_DIR);
    let totalSize = 0;

    for (const backup of backups) {
      const filepath = path.join(BACKUP_DIR, backup);
      const stats = await fs.stat(filepath);
      totalSize += stats.size;
    }

    return {
      backupCount: backups.length,
      totalSize,
      totalSizeFormatted: formatFileSize(totalSize),
    };
  } catch (err) {
    logger.error('Failed to get storage stats:', err.message);
    return {
      backupCount: 0,
      totalSize: 0,
      totalSizeFormatted: '0 Bytes',
    };
  }
};

export { BACKUP_DIR };
