import { Router } from 'express';
import { config } from '../config.js';
import { isWithinCallHours, isWithinIssueHours, now, serviceDate } from '../domain/clock.js';
import { listCounters } from '../services/adminService.js';
import { reportFailure, reportRecovery } from '../services/alerts.js';
import { isDatabaseUp } from '../services/ticketService.js';

export const publicRouter = Router();

/** Saúde do serviço — usada pelo painel/terminal para reconexão e pelo monitor (RNF-13, RNF-17). */
publicRouter.get('/health', async (_req, res) => {
  const database = await isDatabaseUp();
  if (database) reportRecovery('database');
  else reportFailure('database', new Error('SELECT 1 falhou'));
  res.status(database ? 200 : 503).json({ status: database ? 'ok' : 'degradado', database, serverTime: now() });
});

/** Parâmetros públicos de funcionamento (sem dados de atendentes ou relatórios). */
publicRouter.get('/config', (_req, res) => {
  const at = now();
  res.json({
    timezone: config.timezone,
    serverTime: at,
    serviceDate: serviceDate(at),
    hours: config.hours,
    callsOpen: isWithinCallHours(at),
    issueOpen: isWithinIssueHours(at),
  });
});

/** Guichês ativos, para a escolha no login (RF-06). */
publicRouter.get('/counters', async (_req, res) => {
  const counters = await listCounters({ onlyActive: true });
  res.json(counters.map(({ id, number, name }) => ({ id, number, name })));
});
