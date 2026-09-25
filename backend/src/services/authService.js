import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { query, withTransaction } from '../db/pool.js';
import { now } from '../domain/clock.js';
import { AppError, badRequest, conflict, unauthorized } from '../errors.js';
import { audit } from './auditService.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);

// Hash usado para gastar o mesmo tempo quando o usuário não existe (evita enumeração de logins).
const DUMMY_HASH = bcrypt.hashSync('nassauTickets-dummy', 10);

export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return 'A senha deve ter entre 8 e 72 caracteres.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'A senha deve conter letras e números.';
  }
  return null;
}

export function hashPassword(password) {
  return bcrypt.hash(password, config.auth.bcryptCost);
}

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

/**
 * RF-01: login do atendente, vinculando a sessão ao guichê.
 * RNF-02: bloqueio temporário após N tentativas falhas.
 */
export async function login({ username, password, counterId, ip }) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    throw badRequest('Informe usuário e senha.');
  }
  const at = now();
  const [user] = await query('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    await audit({ action: 'LOGIN_FALHA', details: { username: username.slice(0, 40), motivo: 'usuario' }, ip });
    throw unauthorized('Usuário ou senha inválidos.');
  }

  if (user.locked_until && user.locked_until > at) {
    await audit({ userId: user.id, action: 'LOGIN_BLOQUEADO', ip });
    const minutes = Math.ceil((user.locked_until - at) / 60_000);
    throw new AppError(429, 'LOGIN_BLOQUEADO', `Muitas tentativas. Tente novamente em ${minutes} min.`);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_attempts + 1;
    const locked = attempts >= config.auth.maxFailedAttempts;
    await query('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?', [
      locked ? 0 : attempts,
      locked ? addMinutes(at, config.auth.lockMinutes) : null,
      at,
      user.id,
    ]);
    await audit({ userId: user.id, action: locked ? 'LOGIN_BLOQUEIO_TEMPORARIO' : 'LOGIN_FALHA', details: { tentativas: attempts }, ip });
    if (locked) {
      throw new AppError(429, 'LOGIN_BLOQUEADO', `Muitas tentativas. Acesso bloqueado por ${config.auth.lockMinutes} min.`);
    }
    throw unauthorized('Usuário ou senha inválidos.');
  }

  // RF-05: atendente bloqueado ou desativado não entra.
  if (user.status !== 'ATIVO') {
    await audit({ userId: user.id, action: 'LOGIN_NEGADO', details: { status: user.status }, ip });
    throw new AppError(403, 'USUARIO_INATIVO', 'Seu acesso está bloqueado. Procure o gestor.');
  }

  const chosenCounter = counterId === undefined || counterId === null || counterId === '' ? null : Number(counterId);
  if (chosenCounter === null && user.role === 'ATENDENTE') {
    throw badRequest('Selecione o guichê em que você vai atender.');
  }

  const token = randomBytes(32).toString('base64url');
  await withTransaction(async (conn) => {
    if (chosenCounter !== null) {
      // RF-06: guichê desativado não pode ser escolhido no login.
      const [[counter]] = await conn.query('SELECT id, active FROM counters WHERE id = ? FOR UPDATE', [chosenCounter]);
      if (!counter || !counter.active) throw badRequest('Guichê inválido ou desativado.');
      const [[occupied]] = await conn.query(
        `SELECT s.user_id FROM sessions s
          WHERE s.counter_id = ? AND s.user_id <> ? AND s.revoked_at IS NULL AND s.expires_at > ? AND s.last_seen_at > ?
          LIMIT 1`,
        [chosenCounter, user.id, at, addMinutes(at, -config.auth.idleMinutes)],
      );
      if (occupied) throw conflict('GUICHE_OCUPADO', 'Este guichê já está em uso por outro atendente.');
    }
    // Um atendente opera em um único guichê por vez: sessões anteriores são encerradas.
    await conn.query('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [at, user.id]);
    await conn.query(
      `INSERT INTO sessions (token_hash, user_id, counter_id, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hashToken(token), user.id, chosenCounter, at, at, addMinutes(at, config.auth.absoluteHours * 60)],
    );
    await conn.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [at, user.id]);
    await audit({ userId: user.id, counterId: chosenCounter, action: 'LOGIN', ip }, conn);
  });

  return { token, user: publicUser(user), counterId: chosenCounter };
}

/** Valida o token do cookie. Retorna null se a sessão não existir, expirou ou o usuário não está ativo. */
export async function resolveSession(token) {
  if (!token) return null;
  const at = now();
  const [row] = await query(
    `SELECT s.token_hash, s.counter_id, s.last_seen_at, s.expires_at, s.revoked_at,
            u.id, u.username, u.full_name, u.role, u.status, u.must_change_password,
            c.number AS counter_number, c.name AS counter_name, c.active AS counter_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN counters c ON c.id = s.counter_id
      WHERE s.token_hash = ?`,
    [hashToken(token)],
  );
  if (!row || row.revoked_at || row.expires_at <= at) return null;
  if (row.last_seen_at <= addMinutes(at, -config.auth.idleMinutes)) return null;
  if (row.status !== 'ATIVO') return null;

  // Renova a expiração por inatividade no máximo uma vez por minuto.
  if (at - row.last_seen_at > 60_000) {
    await query('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', [at, row.token_hash]);
  }
  return {
    tokenHash: row.token_hash,
    user: publicUser(row),
    counterId: row.counter_id,
    counter: row.counter_id ? { id: row.counter_id, number: row.counter_number, name: row.counter_name, active: Boolean(row.counter_active) } : null,
  };
}

export async function logout(auth, ip) {
  await query('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?', [now(), auth.tokenHash]);
  await audit({ userId: auth.user.id, counterId: auth.counterId, action: 'LOGOUT', ip });
}

/** RF-02: o próprio atendente troca a senha. */
export async function changePassword(auth, { currentPassword, newPassword }, ip) {
  const [user] = await query('SELECT id, password_hash FROM users WHERE id = ?', [auth.user.id]);
  if (!(await bcrypt.compare(String(currentPassword ?? ''), user.password_hash))) {
    throw badRequest('A senha atual está incorreta.');
  }
  const problem = validatePasswordStrength(newPassword);
  if (problem) throw badRequest(problem);
  if (currentPassword === newPassword) throw badRequest('A nova senha deve ser diferente da atual.');
  const at = now();
  await query('UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE id = ?', [
    await hashPassword(newPassword),
    at,
    at,
    user.id,
  ]);
  // Encerra as demais sessões do usuário.
  await query('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND token_hash <> ? AND revoked_at IS NULL', [
    at,
    user.id,
    auth.tokenHash,
  ]);
  await audit({ userId: user.id, counterId: auth.counterId, action: 'SENHA_ALTERADA', entity: 'usuario', entityId: user.id, ip });
}

export async function purgeExpiredSessions() {
  const at = now();
  await query('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)', [
    addMinutes(at, -24 * 60),
    addMinutes(at, -24 * 60),
  ]);
}
