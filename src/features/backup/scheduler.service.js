// src/features/backup/scheduler.service.js
import fs from 'fs-extra';
import path from 'path';
import cron from 'node-cron';
import { BACKUP_DIR, ensureBackupDir } from './backup.utils.js';
import { createFilesBackupJob, enforceRetention } from './backup.service.js';
import { logger } from '../../utils/logger.util.js';

const CONFIG_FILE = path.join(BACKUP_DIR, 'auto-sync.json');
let currentTask = null;
let currentConfig = { enabled: false, cron: '0 2 * * *' }; // default daily at 02:00
let retentionTask = null;
const RETENTION_CRON = process.env.BACKUP_RETENTION_CRON || '0 3 * * *';
let dbDumpTask = null;
const DB_DUMP_CRON = process.env.BACKUP_DB_CRON || '30 2 * * *';

async function loadConfig() {
  await ensureBackupDir();
  try {
    if (await fs.pathExists(CONFIG_FILE)) {
      const raw = await fs.readFile(CONFIG_FILE, 'utf8');
      currentConfig = JSON.parse(raw);
    }
  } catch (err) {
    logger.warn('Failed to load auto-sync config, using defaults');
  }
}

async function saveConfig(cfg) {
  await ensureBackupDir();
  currentConfig = { ...currentConfig, ...cfg };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
}

function startTask() {
  if (!currentConfig.enabled) return;
  if (currentTask) currentTask.stop();

  try {
    currentTask = cron.schedule(currentConfig.cron, async () => {
      logger.info('Auto-sync job triggered by scheduler');
      try {
        await createFilesBackupJob();
        logger.info('Auto-sync files backup completed');
      } catch (err) {
        logger.error('Auto-sync files backup failed:', err.message);
      }
    });
    logger.info('Auto-sync scheduler started', { cron: currentConfig.cron });
  } catch (err) {
    logger.error('Failed to start cron task:', err.message);
  }
}

function startRetentionTask() {
  try {
    if (retentionTask) retentionTask.stop();
    retentionTask = cron.schedule(RETENTION_CRON, async () => {
      logger.info('Retention enforcement job triggered by scheduler');
      try {
        await enforceRetention();
        logger.info('Retention enforcement completed');
      } catch (err) {
        logger.error('Retention enforcement failed:', err.message);
      }
    });
    logger.info('Retention scheduler started', { cron: RETENTION_CRON });
  } catch (err) {
    logger.error('Failed to start retention cron task:', err.message);
  }
}

function stopRetentionTask() {
  if (retentionTask) {
    try { retentionTask.stop(); } catch (e) { }
    retentionTask = null;
    logger.info('Retention scheduler stopped');
  }
}

function stopTask() {
  if (currentTask) {
    try { currentTask.stop(); } catch (e) { }
    currentTask = null;
    logger.info('Auto-sync scheduler stopped');
  }
}

export async function initScheduler() {
  await loadConfig();
  if (currentConfig.enabled) startTask();
  // start retention scheduler by default
  startRetentionTask();
  // start DB dump scheduler by default
  startDbDumpTask();
}

export async function getAutoSyncConfig() {
  await loadConfig();
  return currentConfig;
}

export async function setAutoSyncConfig(cfg) {
  await saveConfig(cfg);
  stopTask();
  if (currentConfig.enabled) startTask();
  return currentConfig;
}

export async function triggerAutoSyncNow() {
  return createFilesBackupJob();
}

export async function triggerRetentionNow() {
  return enforceRetention();
}

function startDbDumpTask() {
  try {
    if (dbDumpTask) dbDumpTask.stop();
    dbDumpTask = cron.schedule(DB_DUMP_CRON, async () => {
      logger.info('DB dump job triggered by scheduler');
      try {
        await createMongoDumpJob();
        logger.info('DB dump completed');
      } catch (err) {
        logger.error('DB dump failed:', err.message);
      }
    });
    logger.info('DB dump scheduler started', { cron: DB_DUMP_CRON });
  } catch (err) {
    logger.error('Failed to start DB dump cron task:', err.message);
  }
}

function stopDbDumpTask() {
  if (dbDumpTask) {
    try { dbDumpTask.stop(); } catch (e) { }
    dbDumpTask = null;
    logger.info('DB dump scheduler stopped');
  }
}

export async function triggerDbDumpNow() {
  return createMongoDumpJob();
}
