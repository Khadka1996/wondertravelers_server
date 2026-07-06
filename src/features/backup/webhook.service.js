// src/features/backup/webhook.service.js
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger.util.js';

const WEBHOOK_URLS = (process.env.BACKUP_WEBHOOK_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
const WEBHOOK_SECRET = process.env.BACKUP_WEBHOOK_SECRET || process.env.APP_MASTER_KEY || '';

export async function sendBackupWebhook(event, payload) {
  if (!WEBHOOK_URLS.length) return;

  const body = { event, timestamp: new Date().toISOString(), payload };
  const raw = JSON.stringify(body);
  const signature = WEBHOOK_SECRET ? crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex') : '';

  await Promise.all(WEBHOOK_URLS.map(async (url) => {
    try {
      await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Signature': signature } : {}),
        },
        timeout: 15000,
      });
      logger.info('Sent backup webhook', { url, event });
    } catch (err) {
      logger.warn('Failed sending backup webhook', { url, error: err.message });
    }
  }));
}

export default { sendBackupWebhook };
