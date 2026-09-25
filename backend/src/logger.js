import pino from 'pino';
import { config } from './config.js';

// RNF-17: logs estruturados em JSON (um evento por linha).
export const logger = pino({
  level: config.logLevel,
  base: { service: 'nassautickets-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.cookie', 'password', 'currentPassword', 'newPassword'],
});
