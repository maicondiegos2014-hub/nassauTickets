import 'dotenv/config';

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Variável de ambiente ${name} inválida: ${raw}`);
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim'].includes(raw.toLowerCase());
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: int('PORT', 3000),

  // RNF-02: HTTPS. Com certificado configurado, o servidor sobe em HTTPS.
  https: {
    keyFile: process.env.HTTPS_KEY_FILE || null,
    certFile: process.env.HTTPS_CERT_FILE || null,
  },
  // Origem do frontend quando servido em outro host (CORS com credenciais).
  corsOrigin: process.env.CORS_ORIGIN || null,
  trustProxy: bool('TRUST_PROXY', false),

  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: int('DB_PORT', 3306),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'nassau_tickets',
    connectionLimit: int('DB_POOL_SIZE', 20),
  },

  // RNF-04: todos os horários vêm do servidor, no fuso do laboratório.
  timezone: process.env.LAB_TIMEZONE ?? 'America/Recife',

  // RF-19 / RF-20: expediente de chamadas (horas cheias, no fuso do laboratório).
  hours: {
    callStart: int('CALL_START_HOUR', 7),
    callEnd: int('CALL_END_HOUR', 17),
    // RF-11 (Could): emissão antes da abertura. Padrão = mesmo horário das chamadas.
    issueStart: int('ISSUE_START_HOUR', int('CALL_START_HOUR', 7)),
  },

  auth: {
    cookieName: 'nt_session',
    // Expiração por inatividade e expiração absoluta (RNF-02).
    idleMinutes: int('SESSION_IDLE_MINUTES', 60),
    absoluteHours: int('SESSION_ABSOLUTE_HOURS', 12),
    maxFailedAttempts: int('LOGIN_MAX_ATTEMPTS', 5),
    lockMinutes: int('LOGIN_LOCK_MINUTES', 15),
    bcryptCost: int('BCRYPT_COST', 12),
    // Limite adicional por IP (protege contra varredura de vários logins).
    ipLoginLimitPer15Min: int('LOGIN_IP_LIMIT', 50),
  },

  totem: {
    // Emissões por minuto por totem (IP), contra toques repetidos ou abuso.
    ratePerMinute: int('TOTEM_RATE_LIMIT', 60),
  },

  // Primeiro acesso: o único gestor é criado a partir destas variáveis.
  seed: {
    gestorUsername: process.env.GESTOR_USERNAME ?? '',
    gestorPassword: process.env.GESTOR_PASSWORD ?? '',
    gestorName: process.env.GESTOR_NAME ?? 'Gestor do Laboratório',
    counters: int('SEED_COUNTERS', 3),
  },

  // RNF-07: prazo de retenção do log de auditoria (logins, cadastros, relatórios).
  auditRetentionDays: int('AUDIT_RETENTION_DAYS', 1825),

  // RNF-17: webhook opcional para alertas (ex.: canal do suporte).
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || null,

  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
};
