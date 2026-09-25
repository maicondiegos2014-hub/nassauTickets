import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { issueTicket } from '../services/ticketService.js';

// RNF-03: o totem não tem login e só acessa este endpoint de emissão.
export const totemRouter = Router();

totemRouter.post(
  '/tickets',
  rateLimit({ windowMs: 60_000, limit: config.totem.ratePerMinute, standardHeaders: 'draft-8', legacyHeaders: false }),
  async (req, res) => {
    const { ticket, replayed } = await issueTicket({
      type: req.body?.type,
      issueKey: req.get('Idempotency-Key'),
    });
    res.status(replayed ? 200 : 201).json(ticket);
  },
);
