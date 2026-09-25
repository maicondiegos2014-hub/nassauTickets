import { Router } from 'express';
import { badRequest } from '../errors.js';
import { requireGestor } from '../middleware/auth.js';
import { audit, auditContext } from '../services/auditService.js';
import {
  attendanceAuditReport,
  averageTimeReport,
  dashboard,
  detailedReport,
  resolvePeriod,
  summaryReport,
  systemLogReport,
} from '../services/reportService.js';

// RF-31 / RNF-01: relatórios visíveis apenas para o gestor, inclusive pela API.
export const reportsRouter = Router();
reportsRouter.use(requireGestor);

const REPORTS = {
  summary: (range) => summaryReport(range),
  detailed: (range) => detailedReport(range),
  'average-time': (range) => averageTimeReport(range),
  audit: (range, q) => attendanceAuditReport(range, q),
  'system-log': (range, q) => systemLogReport(range, q),
  dashboard: (range) => dashboard(range),
};

reportsRouter.get('/:name', async (req, res) => {
  const build = REPORTS[req.params.name];
  if (!build) throw badRequest('Relatório inexistente.');
  const range = resolvePeriod(req.query);
  const data = await build(range, req.query);
  // RNF-08: a emissão de relatórios também é auditada.
  await audit({ ...auditContext(req), action: 'RELATORIO_EMITIDO', entity: 'relatorio', entityId: req.params.name, details: req.query });
  res.json(data);
});

/** RF-32: registra a exportação (o arquivo é gerado no navegador a partir dos mesmos dados da tela). */
reportsRouter.post('/:name/exports', async (req, res) => {
  if (!REPORTS[req.params.name]) throw badRequest('Relatório inexistente.');
  const format = req.body?.format;
  if (!['pdf', 'csv'].includes(format)) throw badRequest('Formato inválido.');
  await audit({
    ...auditContext(req),
    action: 'RELATORIO_EXPORTADO',
    entity: 'relatorio',
    entityId: req.params.name,
    details: { format, filtros: req.body?.filters ?? null },
  });
  res.status(204).end();
});
