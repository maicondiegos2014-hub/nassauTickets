import { Router } from 'express';
import { simulateDay } from '../domain/simulation.js';
import { badRequest } from '../errors.js';
import { requireGestor } from '../middleware/auth.js';
import {
  createCounter,
  createUser,
  listCounters,
  listUsers,
  resetPassword,
  updateCounter,
  updateUser,
} from '../services/adminService.js';
import { audit, auditContext } from '../services/auditService.js';
import { registerContingency } from '../services/ticketService.js';

// Cadastros: exclusivos do gestor (RF-03, RNF-01).
export const adminRouter = Router();
adminRouter.use(requireGestor);

adminRouter.get('/users', async (_req, res) => res.json(await listUsers()));
adminRouter.post('/users', async (req, res) => res.status(201).json(await createUser(auditContext(req), req.body ?? {})));
adminRouter.patch('/users/:id', async (req, res) => res.json(await updateUser(auditContext(req), req.params.id, req.body ?? {})));
adminRouter.post('/users/:id/password', async (req, res) => {
  await resetPassword(auditContext(req), req.params.id, req.body ?? {});
  res.status(204).end();
});

adminRouter.get('/counters', async (_req, res) => res.json(await listCounters()));
adminRouter.post('/counters', async (req, res) => res.status(201).json(await createCounter(auditContext(req), req.body ?? {})));
adminRouter.patch('/counters/:id', async (req, res) =>
  res.json(await updateCounter(auditContext(req), req.params.id, req.body ?? {})),
);

/** RNF-14: registro de senhas manuais emitidas durante falha do totem. */
adminRouter.post('/contingency', async (req, res) => {
  res.status(201).json(await registerContingency(req.auth, req.body ?? {}, req.ip));
});

/** RF-34: simulação de um dia de atendimento. */
adminRouter.post('/simulation', async (req, res) => {
  const body = req.body ?? {};
  const toInt = (v) => (v === undefined ? undefined : Number(v));
  const result = simulateDay({
    counters: toInt(body.counters),
    tickets: toInt(body.tickets),
    mix: body.mix,
    abandonRate: toInt(body.abandonRate),
    seed: toInt(body.seed),
  });
  if (result.errors) throw badRequest(result.errors.join(' '));
  await audit({ ...auditContext(req), action: 'SIMULACAO', details: result.params });
  res.json(result);
});
