// src/middleware/sanitize.middleware.js
import sanitizeHtml from 'sanitize-html';

const sanitizeObjectRecursive = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectRecursive(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = key.replace(/[<>"']/g, ''); // Prevent key injection
    sanitized[sanitizedKey] = typeof value === 'string'
      ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) // Remove HTML tags
      : sanitizeObjectRecursive(value);
  }
  return sanitized;
};

export const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObjectRecursive(req.body);
  }
  next();
};

export const sanitizeQuery = (req, res, next) => {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObjectRecursive(req.query);
  }
  next();
};

export const sanitizeParams = (req, res, next) => {
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObjectRecursive(req.params);
  }
  next();
};

export default {
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
};
