import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { changePassword, login, logout } from '../services/authService.js';

export const authRouter = Router();

function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: '/',
    maxAge: config.auth.absoluteHours * 3_600_000,
  };
}

authRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60_000, limit: config.auth.ipLoginLimitPer15Min, standardHeaders: 'draft-8', legacyHeaders: false }),
  async (req, res) => {
    const { username, password, counterId } = req.body ?? {};
    const session = await login({ username, password, counterId, ip: req.ip });
    res.cookie(config.auth.cookieName, session.token, cookieOptions(req));
    res.json({ user: session.user, counterId: session.counterId });
  },
);

authRouter.post('/logout', requireAuth(), async (req, res) => {
  await logout(req.auth, req.ip);
  res.clearCookie(config.auth.cookieName, { ...cookieOptions(req), maxAge: undefined });
  res.status(204).end();
});

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json({ user: req.auth.user, counter: req.auth.counter });
});

/** RF-02: troca de senha pelo próprio usuário. */
authRouter.post('/password', requireAuth(), async (req, res) => {
  await changePassword(req.auth, req.body ?? {}, req.ip);
  res.status(204).end();
});
