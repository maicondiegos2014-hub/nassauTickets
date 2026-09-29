import { isDuplicateKey, query } from '../db/pool.js';
import { now } from '../domain/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { audit } from './auditService.js';
import { hashPassword, publicUser, validatePasswordStrength } from './authService.js';

const USERNAME = /^[a-z0-9._-]{3,40}$/;
const USER_STATUSES = ['ATIVO', 'BLOQUEADO', 'INATIVO'];

function cleanName(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`Informe ${field}.`);
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > max) throw badRequest(`${field} deve ter no máximo ${max} caracteres.`);
  return name;
}

// ---------- Atendentes (RF-04, RF-05) ----------

export async function listUsers() {
  const rows = await query('SELECT * FROM users ORDER BY role, full_name');
  return rows.map((r) => ({ ...publicUser(r), createdAt: r.created_at }));
}

/** RF-04: só o gestor cria logins; não há autocadastro. Novos logins são sempre de atendente. */
export async function createUser(ctx, { username, fullName, password }) {
  const login = String(username ?? '').trim().toLowerCase();
  if (!USERNAME.test(login)) throw badRequest('Usuário deve ter de 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  const name = cleanName(fullName, 'o nome completo', 120);
  const problem = validatePasswordStrength(password);
  if (problem) throw badRequest(problem);
  const at = now();
  try {
    const result = await query(
      `INSERT INTO users (username, full_name, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'ATENDENTE', 'ATIVO', 1, ?, ?)`,
      [login, name, await hashPassword(password), at, at],
    );
    await audit({ ...ctx, action: 'USUARIO_CRIADO', entity: 'usuario', entityId: result.insertId, details: { username: login } });
    const [row] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return publicUser(row);
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('USUARIO_EXISTENTE', 'Já existe um usuário com esse login.');
    throw error;
  }
}

async function findUser(id) {
  const [row] = await query('SELECT * FROM users WHERE id = ?', [Number(id)]);
  if (!row) throw notFound('Usuário não encontrado.');
  return row;
}

/** RF-05: ativa, bloqueia ou desativa; o histórico é preservado (não há exclusão). */
export async function updateUser(ctx, id, { fullName, status }) {
  const user = await findUser(id);
  const changes = {};
  if (fullName !== undefined) changes.full_name = cleanName(fullName, 'o nome completo', 120);
  if (status !== undefined) {
    if (!USER_STATUSES.includes(status)) throw badRequest('Situação inválida.');
    if (user.role === 'GESTOR' && status !== 'ATIVO') throw forbidden('O gestor não pode ser bloqueado ou desativado.');
    changes.status = status;
  }
  if (!Object.keys(changes).length) throw badRequest('Nada para alterar.');
  const at = now();
  const sets = Object.keys(changes).map((k) => `${k} = ?`);
  await query(`UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, [...Object.values(changes), at, user.id]);
  if (changes.status && changes.status !== 'ATIVO') {
    await query('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [at, user.id]);
  }
  await audit({ ...ctx, action: 'USUARIO_ALTERADO', entity: 'usuario', entityId: user.id, details: changes });
  return publicUser(await findUser(user.id));
}

/** O gestor define uma senha provisória; o atendente troca no próximo acesso. */
export async function resetPassword(ctx, id, { password }) {
  const user = await findUser(id);
  const problem = validatePasswordStrength(password);
  if (problem) throw badRequest(problem);
  const at = now();
  await query(
    'UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?',
    [await hashPassword(password), at, user.id],
  );
  await query('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [at, user.id]);
  await audit({ ...ctx, action: 'SENHA_REDEFINIDA', entity: 'usuario', entityId: user.id });
}

// ---------- Guichês (RF-06) ----------

const counterView = (r) => ({ id: r.id, number: r.number, name: r.name, active: Boolean(r.active) });

export async function listCounters({ onlyActive = false } = {}) {
  const rows = await query(`SELECT * FROM counters ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY number`);
  return rows.map(counterView);
}

function parseCounterNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 999) throw badRequest('O número do guichê deve ser entre 1 e 999.');
  return number;
}

export async function createCounter(ctx, { number, name }) {
  const n = parseCounterNumber(number);
  const label = name ? cleanName(name, 'o nome do guichê', 60) : `Guichê ${n}`;
  const at = now();
  try {
    const result = await query('INSERT INTO counters (number, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)', [
      n,
      label,
      at,
      at,
    ]);
    await audit({ ...ctx, action: 'GUICHE_CRIADO', entity: 'guiche', entityId: result.insertId, details: { number: n, name: label } });
    const [row] = await query('SELECT * FROM counters WHERE id = ?', [result.insertId]);
    return counterView(row);
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('GUICHE_EXISTENTE', 'Já existe um guichê com esse número.');
    throw error;
  }
}

export async function updateCounter(ctx, id, { number, name, active }) {
  const [row] = await query('SELECT * FROM counters WHERE id = ?', [Number(id)]);
  if (!row) throw notFound('Guichê não encontrado.');
  const changes = {};
  if (number !== undefined) changes.number = parseCounterNumber(number);
  if (name !== undefined) changes.name = cleanName(name, 'o nome do guichê', 60);
  if (active !== undefined) {
    if (typeof active !== 'boolean') throw badRequest('Situação do guichê inválida.');
    changes.active = active ? 1 : 0;
  }
  if (!Object.keys(changes).length) throw badRequest('Nada para alterar.');
  try {
    await query(`UPDATE counters SET ${Object.keys(changes).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
      ...Object.values(changes),
      now(),
      row.id,
    ]);
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('GUICHE_EXISTENTE', 'Já existe um guichê com esse número.');
    throw error;
  }
  await audit({ ...ctx, action: 'GUICHE_ALTERADO', entity: 'guiche', entityId: row.id, details: changes });
  const [updated] = await query('SELECT * FROM counters WHERE id = ?', [row.id]);
  return counterView(updated);
}
