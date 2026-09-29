import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { logger } from './logger.js';
import { loadSession } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { adminRouter } from './routes/admin.js';
import { attendanceRouter } from './routes/attendance.js';
import { authRouter } from './routes/auth.js';
import { panelRouter } from './routes/panel.js';
import { publicRouter } from './routes/public.js';
import { reportsRouter } from './routes/reports.js';
import { totemRouter } from './routes/totem.js';

const frontendDist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          // Só força HTTPS nos recursos quando o sistema de fato é servido em HTTPS.
          'upgrade-insecure-requests': config.https.certFile || config.trustProxy ? [] : null,
        },
      },
      // HSTS só faz sentido quando o servidor responde em HTTPS (RNF-02).
      strictTransportSecurity: Boolean(config.https.certFile),
    }),
  );

  if (config.corsOrigin) {
    app.use((req, res, next) => {
      res.set({
        'Access-Control-Allow-Origin': config.corsOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        Vary: 'Origin',
      });
      if (req.method === 'OPTIONS') return res.status(204).end();
      next();
    });
  }

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path.endsWith('/stream')) return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms: Math.round(ms) }, 'http');
    });
    next();
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(publicRouter);
  api.use('/totem', totemRouter);
  api.use('/panel', panelRouter);
  api.use(loadSession);
  api.use('/auth', authRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/admin', adminRouter);
  api.use('/reports', reportsRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  // Em produção o próprio backend pode servir o frontend compilado (npm run build).
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile('index.html', { root: frontendDist }));
  }

  app.use(errorHandler);
  return app;
}
