import crypto from 'crypto';
import config from '../config/index.js';
import { auditLog } from './security.js';

export function requireApiKey(req, res, next) {
  if (config.nodeEnv === 'development') return next();

  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!apiKey || !config.dashboardApiKey) {
    auditLog('AUTH_FAILURE', { ip: req.ip, path: req.path, reason: 'missing_key' });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const expected = Buffer.from(config.dashboardApiKey, 'utf8');
  const provided = Buffer.from(apiKey, 'utf8');

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    auditLog('AUTH_FAILURE', { ip: req.ip, path: req.path, reason: 'invalid_key' });
    return res.status(403).json({ error: 'Invalid API key' });
  }

  return next();
}
