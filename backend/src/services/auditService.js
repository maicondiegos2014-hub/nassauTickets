import { getPool } from '../db/pool.js';
import { now } from '../domain/clock.js';
import { logger } from '../logger.js';

// RNF-08: registro de logins, cadastros e emissão de relatórios.
export async function audit(entry, conn = getPool()) {
  const { userId = null, counterId = null, action, entity = null, entityId = null, details = null, ip = null } = entry;
  await conn.query(
    `INSERT INTO audit_log (at, user_id, counter_id, action, entity, entity_id, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [now(), userId, counterId, action, entity, entityId === null ? null : String(entityId), details && JSON.stringify(details), ip],
  );
  logger.info({ audit: { action, userId, counterId, entity, entityId } }, 'auditoria');
}

/** Contexto de auditoria a partir da requisição autenticada. */
export function auditContext(req) {
  return { userId: req.auth?.user.id ?? null, counterId: req.auth?.counterId ?? null, ip: req.ip ?? null };
}
