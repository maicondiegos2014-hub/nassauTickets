import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { closePool } from './db/pool.js';
import { logger } from './logger.js';
import { startJobs, stopJobs } from './services/jobs.js';

async function connectWithRetry() {
  // RNF-13: se o banco ainda não subiu, a API tenta de novo em vez de cair.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await migrate();
      return;
    } catch (error) {
      const wait = Math.min(30, attempt * 2);
      logger.error({ err: error, attempt }, `Banco indisponível, nova tentativa em ${wait}s`);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    }
  }
}

await connectWithRetry();

const app = createApp();
const useHttps = Boolean(config.https.keyFile && config.https.certFile);
const server = useHttps
  ? https.createServer({ key: readFileSync(config.https.keyFile), cert: readFileSync(config.https.certFile) }, app)
  : http.createServer(app);

server.listen(config.port, () => {
  logger.info(
    { port: config.port, https: useHttps, timezone: config.timezone, hours: config.hours },
    `nassauTickets API em ${useHttps ? 'https' : 'http'}://localhost:${config.port}`,
  );
});
startJobs();

async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando');
  stopJobs();
  server.closeAllConnections?.();
  server.close();
  await closePool();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (err) => logger.error({ err }, 'Promise rejeitada sem tratamento'));
