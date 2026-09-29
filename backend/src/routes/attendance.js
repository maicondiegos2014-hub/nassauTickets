import { Router } from 'express';
import { config } from '../config.js';
import { isWithinCallHours } from '../domain/clock.js';
import { requireAttendant } from '../middleware/auth.js';
import {
  callAgain,
  callNext,
  currentTicket,
  finishService,
  markNoShow,
  queueCounts,
  startService,
} from '../services/ticketService.js';

// Terminal do atendente (RF-12 a RF-19). Sem login válido, nada aqui funciona (RF-01).
export const attendanceRouter = Router();
attendanceRouter.use(requireAttendant);

attendanceRouter.get('/current', async (req, res) => {
  res.json({
    counter: req.auth.counter,
    ticket: await currentTicket(req.auth),
    waiting: await queueCounts(),
    callsOpen: isWithinCallHours(),
    hours: { start: config.hours.callStart, end: config.hours.callEnd },
  });
});

attendanceRouter.post('/call-next', async (req, res) => {
  const { ticket } = await callNext(req.auth, { callKey: req.get('Idempotency-Key') });
  if (!ticket) return res.json({ ticket: null, message: 'Não há senhas aguardando.' });
  res.json({ ticket });
});

attendanceRouter.post('/tickets/:id/recall', async (req, res) => {
  res.json({ ticket: await callAgain(req.auth, req.params.id) });
});

attendanceRouter.post('/tickets/:id/start', async (req, res) => {
  res.json({ ticket: await startService(req.auth, req.params.id) });
});

attendanceRouter.post('/tickets/:id/finish', async (req, res) => {
  res.json({ ticket: await finishService(req.auth, req.params.id) });
});

attendanceRouter.post('/tickets/:id/no-show', async (req, res) => {
  res.json({ ticket: await markNoShow(req.auth, req.params.id) });
});
