import { config } from '../config.js';
import { logger } from '../logger.js';

// RNF-17: alerta de falha (log "fatal" + webhook opcional), no máximo um por componente a cada 5 min.
const lastAlert = new Map();
const INTERVAL_MS = 5 * 60_000;

export function reportFailure(component, error) {
  const at = Date.now();
  if (at - (lastAlert.get(component) ?? 0) < INTERVAL_MS) return;
  lastAlert.set(component, at);
  logger.fatal({ alert: true, component, err: error }, `ALERTA: falha em ${component}`);
  if (config.alertWebhookUrl) {
    fetch(config.alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[nassauTickets] Falha em ${component}: ${error?.message ?? error}` }),
    }).catch((err) => logger.error({ err }, 'Falha ao enviar alerta'));
  }
}

export function reportRecovery(component) {
  if (lastAlert.delete(component)) logger.warn({ alert: true, component }, `Recuperado: ${component}`);
}
