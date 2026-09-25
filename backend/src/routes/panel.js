import { Router } from 'express';
import { bus, PANEL_CALL } from '../services/events.js';
import { lastCalls } from '../services/ticketService.js';

// RNF-03: o painel não tem login e só lê as últimas chamadas.
export const panelRouter = Router();

panelRouter.get('/calls', async (_req, res) => {
  res.json(await lastCalls());
});

/** RF-23 / RNF-11: atualização em tempo real por Server-Sent Events. */
panelRouter.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const send = (payload) => res.write(`event: call\ndata: ${JSON.stringify(payload)}\n\n`);
  bus.on(PANEL_CALL, send);
  const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off(PANEL_CALL, send);
  });
});
