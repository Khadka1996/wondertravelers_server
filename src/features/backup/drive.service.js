// src/features/backup/drive.service.js
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { BACKUP_DIR, ensureBackupDir, deriveEncryptionKey } from './backup.utils.js';
import { logger } from '../../utils/logger.util.js';

const GDRIVE_CRED_FILE = path.join(BACKUP_DIR, 'gdrive_creds.enc');

export async function saveGDriveCredentials(creds) {
  await ensureBackupDir();

  const masterKey = process.env.APP_MASTER_KEY || process.env.SECRET_KEY || null;
  let data = JSON.stringify(creds);

  if (masterKey) {
    const key = deriveEncryptionKey(masterKey);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const out = Buffer.concat([iv, authTag, encrypted]);
    await fs.writeFile(GDRIVE_CRED_FILE, out);
    logger.info('Saved encrypted Google Drive credentials');
    return { encrypted: true };
  }

  await fs.writeFile(GDRIVE_CRED_FILE, data, 'utf8');
  logger.warn('Saved Google Drive credentials without encryption (no APP_MASTER_KEY set)');
  return { encrypted: false };
}

export async function loadGDriveCredentials() {
  try {
    if (!(await fs.pathExists(GDRIVE_CRED_FILE))) return null;
    const content = await fs.readFile(GDRIVE_CRED_FILE);
    const masterKey = process.env.APP_MASTER_KEY || process.env.SECRET_KEY || null;

    if (masterKey) {
      const key = deriveEncryptionKey(masterKey);
      const iv = content.slice(0, 12);
      const authTag = content.slice(12, 28);
      const encrypted = content.slice(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    }

    return JSON.parse(content.toString('utf8'));
  } catch (err) {
    logger.error('Failed to load Google Drive credentials:', err.message);
    return null;
  }
}

async function getAccessTokenFromRefresh(clientId, clientSecret, refreshToken) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  try {
    const res = await axios.post(
      tokenUrl,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    return res.data.access_token;
  } catch (err) {
    logger.error('Failed to acquire access token from refresh token:', err.message);
    throw err;
  }
}

export async function uploadFileToDrive(localPath, fileName, mimeType = 'application/octet-stream') {
  const creds = await loadGDriveCredentials();
  if (!creds || !creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error('Google Drive credentials not configured');
  }

  const accessToken = await getAccessTokenFromRefresh(creds.clientId, creds.clientSecret, creds.refreshToken);

  // Multipart upload (metadata + media)
  const metadata = {
    name: fileName,
    mimeType,
  };

  const boundary = '-------nodejsdrive' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileStream = await fs.readFile(localPath);
  const multipartRequestBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)),
    Buffer.from(delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
    fileStream,
    Buffer.from(closeDelimiter),
  ]);

  try {
    const res = await axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', multipartRequestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': multipartRequestBody.length,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 0,
    });

    logger.info('Uploaded file to Google Drive', { fileId: res.data.id, name: fileName });
    return res.data;
  } catch (err) {
    logger.error('Failed to upload to Google Drive:', err.message);
    throw err;
  }
}

export { GDRIVE_CRED_FILE };

export async function listDriveFiles(q = "mimeType='application/gzip' or mimeType='application/octet-stream'", pageSize = 50) {
  const creds = await loadGDriveCredentials();
  if (!creds) throw new Error('Google Drive credentials not configured');
  const accessToken = await getAccessTokenFromRefresh(creds.clientId, creds.clientSecret, creds.refreshToken);

  const params = new URLSearchParams({ pageSize: String(pageSize), q, fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink),nextPageToken' });
  const res = await axios.get(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  return res.data;
}

export async function downloadDriveFile(fileId, destPath) {
  const creds = await loadGDriveCredentials();
  if (!creds) throw new Error('Google Drive credentials not configured');
  const accessToken = await getAccessTokenFromRefresh(creds.clientId, creds.clientSecret, creds.refreshToken);

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'stream',
    timeout: 0,
  });

  const writer = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    let error = null;
    writer.on('error', err => { error = err; writer.close(); reject(err); });
    writer.on('close', () => { if (!error) resolve(); });
  });

  return destPath;
}

export async function deleteDriveFile(fileId) {
  const creds = await loadGDriveCredentials();
  if (!creds) throw new Error('Google Drive credentials not configured');
  const accessToken = await getAccessTokenFromRefresh(creds.clientId, creds.clientSecret, creds.refreshToken);

  try {
    await axios.delete(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    return true;
  } catch (err) {
    throw new Error(`Failed to delete file on Drive: ${err.message}`);
  }
}

/**
 * Generate Google Drive OAuth2 consent URL
 */
export function generateDriveAuthUrl({ clientId, redirectUri, scope = ['https://www.googleapis.com/auth/drive.file'] } = {}) {
  if (!clientId || !redirectUri) throw new Error('clientId and redirectUri required');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: Array.isArray(scope) ? scope.join(' ') : scope,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens and optionally persist refresh token
 */
export async function exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri, persist = true }) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  try {
    const res = await axios.post(
      tokenUrl,
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const data = res.data;

    // Build credentials structure to save
    const credsToSave = {
      clientId,
      clientSecret,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      scope: data.scope,
      tokenType: data.token_type,
      expiry: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    };

    if (persist && credsToSave.refreshToken) {
      try {
        await saveGDriveCredentials({ clientId, clientSecret, refreshToken: credsToSave.refreshToken });
        logger.info('Persisted Google Drive refresh token from OAuth exchange');
      } catch (e) {
        logger.warn('Failed to persist Google Drive credentials after OAuth exchange:', e.message);
      }
    }

    return credsToSave;
  } catch (err) {
    logger.error('Failed to exchange OAuth code for tokens:', err.message);
    throw err;
  }
}
