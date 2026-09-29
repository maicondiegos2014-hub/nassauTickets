import { config } from '../config.js';
import { query } from '../db/pool.js';
import { now } from '../domain/clock.js';
import { logger } from '../logger.js';
import { reportFailure, reportRecovery } from './alerts.js';
import { purgeExpiredSessions } from './authService.js';
import { discardLeftovers } from './ticketService.js';

const timers = [];

async function endOfDayJob() {
  try {
    const discarded = await discardLeftovers();
    if (discarded) logger.info({ discarded }, 'Fim do expediente: senhas da fila descartadas');
    reportRecovery('database');
  } catch (error) {
    reportFailure('database', error);
  }
}

/** RNF-07: retenção dos dados de atendentes no log de auditoria. */
async function retentionJob() {
  try {
    await purgeExpiredSessions();
    const limit = new Date(now().getTime() - config.auditRetentionDays * 86_400_000);
    await query('DELETE FROM audit_log WHERE at < ?', [limit]);
  } catch (error) {
    logger.error({ err: error }, 'Falha na rotina de retenção');
  }
}

export function startJobs() {
  endOfDayJob();
  timers.push(setInterval(endOfDayJob, 30_000));
  timers.push(setInterval(retentionJob, 6 * 3_600_000));
}

export function stopJobs() {
  for (const t of timers.splice(0)) clearInterval(t);
}
