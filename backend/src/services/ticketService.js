import { config } from '../config.js';
import { getPool, isDuplicateKey, query, withTransaction } from '../db/pool.js';
import { isAfterClosing, isWithinCallHours, isWithinIssueHours, now, serviceDate } from '../domain/clock.js';
import { isTicketType, priorityOrder, TICKET_TYPES, TYPE_LABELS } from '../domain/priority.js';
import { ACTIVE_STATUSES, assertTransition, STATUS } from '../domain/stateMachine.js';
import { formatTicketNumber, MAX_DAILY_SEQUENCE } from '../domain/ticketNumber.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { logger } from '../logger.js';
import { audit } from './auditService.js';
import { bus, PANEL_CALL } from './events.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;

function checkKey(key) {
  if (key === undefined || key === null || key === '') return null;
  if (!IDEMPOTENCY_KEY.test(key)) throw badRequest('Chave de idempotência inválida.');
  return key;
}

async function recordEvent(conn, ticketId, from, to, at, { userId = null, counterId = null } = {}) {
  await conn.query(
    'INSERT INTO ticket_events (ticket_id, from_status, to_status, at, user_id, counter_id) VALUES (?, ?, ?, ?, ?, ?)',
    [ticketId, from, to, at, userId, counterId],
  );
}

/** Visão pública da senha (totem): apenas número, tipo e horário — RNF-03 / RNF-07. */
function totemView(row) {
  return { number: row.number, type: row.type, typeLabel: TYPE_LABELS[row.type], issuedAt: row.issued_at };
}

/** Visão da senha no terminal do atendente. */
function attendantView(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    number: row.number,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type],
    status: row.status,
    issuedAt: row.issued_at,
    firstCallAt: row.first_call_at,
    secondCallAt: row.second_call_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    counterId: row.counter_id,
  };
}

/**
 * RF-07 a RF-10: emite uma senha anônima e a coloca na fila.
 * RNF-06: o reenvio da mesma requisição (mesma chave) devolve a mesma senha.
 */
export async function issueTicket({ type, issueKey, origin = 'TOTEM', actor = null }) {
  if (!isTicketType(type)) throw badRequest('Tipo de senha inválido. Use SP, SG ou SE.');
  const key = checkKey(issueKey);

  if (key) {
    const [existing] = await query('SELECT * FROM tickets WHERE issue_key = ?', [key]);
    if (existing) return { ticket: totemView(existing), replayed: true };
  }

  const at = now();
  if (origin === 'TOTEM' && !isWithinIssueHours(at)) {
    throw conflict(
      'FORA_DO_EXPEDIENTE',
      `A emissão de senhas funciona das ${config.hours.issueStart}h às ${config.hours.callEnd}h.`,
    );
  }
  const date = serviceDate(at);

  try {
    const ticket = await withTransaction(async (conn) => {
      // Incremento atômico da sequência do dia/tipo: a linha fica travada até o commit,
      // então totens simultâneos nunca recebem o mesmo número (RF-08 / RNF-06).
      await conn.query(
        `INSERT INTO daily_sequences (service_date, type, last_seq) VALUES (?, ?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)`,
        [date, type],
      );
      const [[{ seq }]] = await conn.query('SELECT LAST_INSERT_ID() AS seq');
      if (seq > MAX_DAILY_SEQUENCE) {
        throw conflict('LIMITE_DIARIO', `Limite de ${MAX_DAILY_SEQUENCE} senhas do tipo ${type} atingido hoje.`);
      }
      const number = formatTicketNumber(date, type, Number(seq));
      const [result] = await conn.query(
        `INSERT INTO tickets (number, service_date, type, seq, status, origin, issue_key, issued_at)
         VALUES (?, ?, ?, ?, 'EMITIDA', ?, ?, ?)`,
        [number, date, type, seq, origin, key, at],
      );
      const id = result.insertId;
      const who = { userId: actor?.userId ?? null, counterId: actor?.counterId ?? null };
      await recordEvent(conn, id, null, STATUS.EMITIDA, at, who);
      // RF-10: a senha entra na fila com o horário do servidor.
      assertTransition(STATUS.EMITIDA, STATUS.AGUARDANDO);
      await conn.query("UPDATE tickets SET status = 'AGUARDANDO', queued_at = ? WHERE id = ?", [at, id]);
      await recordEvent(conn, id, STATUS.EMITIDA, STATUS.AGUARDANDO, at, who);
      return { number, type, issued_at: at };
    });
    return { ticket: totemView(ticket), replayed: false };
  } catch (error) {
    if (key && isDuplicateKey(error)) {
      const [existing] = await query('SELECT * FROM tickets WHERE issue_key = ?', [key]);
      if (existing) return { ticket: totemView(existing), replayed: true };
    }
    throw error;
  }
}

async function lockOwnTicket(conn, ticketId, auth) {
  const [[ticket]] = await conn.query('SELECT * FROM tickets WHERE id = ? FOR UPDATE', [ticketId]);
  if (!ticket) throw notFound('Senha não encontrada.');
  if (ticket.attendant_id !== auth.user.id) throw forbidden('Esta senha está com outro atendente.');
  return ticket;
}

async function panelPayload(ticketNumber, kind) {
  const calls = await lastCalls();
  return { kind, number: ticketNumber, calls };
}

function publishCall(number, kind) {
  panelPayload(number, kind)
    .then((payload) => bus.emit(PANEL_CALL, payload))
    .catch((error) => logger.error({ err: error }, 'Falha ao publicar chamada no painel'));
}

/**
 * RF-12 a RF-14: chama a próxima senha segundo as regras de priorização.
 * RNF-05: a seleção é atômica — a linha de controle serializa a decisão de prioridade
 * e a senha é travada com SELECT ... FOR UPDATE SKIP LOCKED.
 */
export async function callNext(auth, { callKey } = {}) {
  const key = checkKey(callKey);
  if (!auth.counterId) throw forbidden('Faça login em um guichê para chamar senhas.');

  if (key) {
    const [replay] = await query('SELECT * FROM tickets WHERE call_key = ? AND attendant_id = ?', [key, auth.user.id]);
    if (replay) return { ticket: attendantView(replay), replayed: true };
  }

  const at = now();
  if (!isWithinCallHours(at)) {
    throw conflict(
      'FORA_DO_EXPEDIENTE',
      `Chamadas são permitidas apenas das ${config.hours.callStart}h às ${config.hours.callEnd}h.`,
    );
  }
  const date = serviceDate(at);

  const called = await withTransaction(async (conn) => {
    const [[counter]] = await conn.query('SELECT id, active FROM counters WHERE id = ?', [auth.counterId]);
    if (!counter?.active) throw conflict('GUICHE_INATIVO', 'Este guichê foi desativado pelo gestor.');

    // Serializa a decisão entre guichês: quem chega depois enxerga o tipo chamado antes.
    const [[control]] = await conn.query('SELECT service_date, last_type FROM call_control WHERE id = 1 FOR UPDATE');

    // Guichê só fica livre para nova chamada depois de encerrar a atual (RF-17).
    // O atendente opera um único guichê por vez, então a verificação é pelo atendente.
    const [[busy]] = await conn.query(
      'SELECT number FROM tickets WHERE attendant_id = ? AND status IN (?) LIMIT 1',
      [auth.user.id, ACTIVE_STATUSES],
    );
    if (busy) throw conflict('ATENDIMENTO_EM_ANDAMENTO', `Finalize a senha ${busy.number} antes de chamar a próxima.`);

    const lastType = control?.service_date === date ? control.last_type : null;
    let ticket = null;
    for (const type of priorityOrder(lastType)) {
      const [[row]] = await conn.query(
        `SELECT * FROM tickets
          WHERE status = 'AGUARDANDO' AND service_date = ? AND type = ?
          ORDER BY seq
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [date, type],
      );
      if (row) {
        ticket = row;
        break;
      }
    }
    if (!ticket) return null;

    assertTransition(ticket.status, STATUS.CHAMADA);
    await conn.query(
      `UPDATE tickets SET status = 'CHAMADA', first_call_at = ?, counter_id = ?, attendant_id = ?, call_key = ?
        WHERE id = ? AND status = 'AGUARDANDO'`,
      [at, auth.counterId, auth.user.id, key, ticket.id],
    );
    await recordEvent(conn, ticket.id, ticket.status, STATUS.CHAMADA, at, { userId: auth.user.id, counterId: auth.counterId });
    await conn.query('UPDATE call_control SET service_date = ?, last_type = ? WHERE id = 1', [date, ticket.type]);
    return { ...ticket, status: STATUS.CHAMADA, first_call_at: at, counter_id: auth.counterId, attendant_id: auth.user.id };
  });

  if (!called) return { ticket: null, replayed: false };
  publishCall(called.number, 'CHAMADA');
  return { ticket: attendantView(called), replayed: false };
}

/** Aplica uma transição de estado a uma senha do próprio atendente. */
async function transitionOwn(auth, ticketId, to, column) {
  const at = now();
  const updated = await withTransaction(async (conn) => {
    const ticket = await lockOwnTicket(conn, ticketId, auth);
    assertTransition(ticket.status, to);
    await conn.query(`UPDATE tickets SET status = ?, ${column} = ? WHERE id = ?`, [to, at, ticket.id]);
    await recordEvent(conn, ticket.id, ticket.status, to, at, { userId: auth.user.id, counterId: ticket.counter_id });
    return { ...ticket, status: to, [column]: at };
  });
  return updated;
}

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador de senha inválido.');
  return id;
};

/** RF-15: segunda chamada, anunciada no painel como "Última chamada". */
export async function callAgain(auth, ticketId) {
  const ticket = await transitionOwn(auth, parseId(ticketId), STATUS.CHAMADA_NOVAMENTE, 'second_call_at');
  publishCall(ticket.number, 'CHAMADA_NOVAMENTE');
  return attendantView(ticket);
}

/** RF-16 */
export async function startService(auth, ticketId) {
  return attendantView(await transitionOwn(auth, parseId(ticketId), STATUS.EM_ATENDIMENTO, 'started_at'));
}

/** RF-17 */
export async function finishService(auth, ticketId) {
  return attendantView(await transitionOwn(auth, parseId(ticketId), STATUS.ATENDIDA, 'finished_at'));
}

/** RF-18: após duas chamadas sem comparecimento. */
export async function markNoShow(auth, ticketId) {
  return attendantView(await transitionOwn(auth, parseId(ticketId), STATUS.NAO_COMPARECEU, 'no_show_at'));
}

export async function currentTicket(auth) {
  const [row] = await query(
    'SELECT * FROM tickets WHERE attendant_id = ? AND status IN (?) ORDER BY first_call_at DESC LIMIT 1',
    [auth.user.id, ACTIVE_STATUSES],
  );
  return attendantView(row ?? null);
}

/** Quantidade aguardando por tipo (terminal do atendente; não revela a ordem da fila). */
export async function queueCounts() {
  const rows = await query(
    "SELECT type, COUNT(*) AS total FROM tickets WHERE status = 'AGUARDANDO' AND service_date = ? GROUP BY type",
    [serviceDate()],
  );
  const counts = Object.fromEntries(TICKET_TYPES.map((t) => [t, 0]));
  for (const row of rows) counts[row.type] = Number(row.total);
  return counts;
}

/** RF-21 / RF-22: as 5 últimas senhas chamadas (sem a próxima da fila e sem dados de atendentes). */
export async function lastCalls(limit = 5) {
  const rows = await query(
    `SELECT e.id, e.at, e.to_status, t.number, t.type, t.seq, c.number AS counter_number, c.name AS counter_name
       FROM ticket_events e
       JOIN tickets t ON t.id = e.ticket_id
       JOIN counters c ON c.id = e.counter_id
      WHERE e.to_status IN ('CHAMADA', 'CHAMADA_NOVAMENTE') AND t.service_date = ?
      ORDER BY e.id DESC
      LIMIT 40`,
    [serviceDate()],
  );
  const seen = new Set();
  const calls = [];
  for (const row of rows) {
    if (seen.has(row.number)) continue;
    seen.add(row.number);
    calls.push({
      number: row.number,
      type: row.type,
      typeLabel: TYPE_LABELS[row.type],
      seq: row.seq,
      counterNumber: row.counter_number,
      counterName: row.counter_name,
      lastCall: row.to_status === 'CHAMADA_NOVAMENTE',
      at: row.at,
    });
    if (calls.length === limit) break;
  }
  return calls;
}

/**
 * RF-20 / RF-26: às 17h (ou em dias anteriores) as senhas ainda na fila são descartadas.
 * Atendimentos já chamados continuam e são encerrados pelo atendente.
 */
export async function discardLeftovers() {
  const at = now();
  const today = serviceDate(at);
  const closing = isAfterClosing(at);
  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT id FROM tickets
        WHERE status = 'AGUARDANDO' AND (service_date < ? OR (? AND service_date = ?))
        FOR UPDATE SKIP LOCKED`,
      [today, closing, today],
    );
    if (!rows.length) return 0;
    const ids = rows.map((r) => r.id);
    await conn.query("UPDATE tickets SET status = 'DESCARTADA', discarded_at = ? WHERE id IN (?)", [at, ids]);
    await conn.query(
      'INSERT INTO ticket_events (ticket_id, from_status, to_status, at) VALUES ?',
      [ids.map((id) => [id, STATUS.AGUARDANDO, STATUS.DESCARTADA, at])],
    );
    await audit({ action: 'FIM_EXPEDIENTE_DESCARTE', details: { descartadas: ids.length, data: today } }, conn);
    return ids.length;
  });
}

/** RNF-14: registro posterior de senhas emitidas manualmente durante falha do totem. */
export async function registerContingency(auth, { type, manualRef }, ip) {
  if (typeof manualRef !== 'string' || !manualRef.trim() || manualRef.length > 40) {
    throw badRequest('Informe a identificação da senha manual (até 40 caracteres).');
  }
  if (!isWithinIssueHours()) throw conflict('FORA_DO_EXPEDIENTE', 'Fora do horário de emissão de senhas.');
  const result = await issueTicket({ type, origin: 'CONTINGENCIA', actor: { userId: auth.user.id, counterId: auth.counterId } });
  await audit({
    userId: auth.user.id,
    counterId: auth.counterId,
    action: 'SENHA_CONTINGENCIA',
    entity: 'senha',
    entityId: result.ticket.number,
    details: { senhaManual: manualRef.trim(), tipo: type },
    ip,
  });
  return result.ticket;
}

export async function isDatabaseUp() {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
