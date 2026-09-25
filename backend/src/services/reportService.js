import { query } from '../db/pool.js';
import { labHour, serviceDate } from '../domain/clock.js';
import { TICKET_TYPES, TYPE_LABELS } from '../domain/priority.js';
import { STATUS_LABELS } from '../domain/stateMachine.js';
import { badRequest } from '../errors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Resolve o período do relatório.
 *  - period=day&date=YYYY-MM-DD   (relatório diário)
 *  - period=month&month=YYYY-MM   (relatório mensal)
 *  - from=YYYY-MM-DD&to=YYYY-MM-DD (intervalo livre, usado na auditoria)
 */
export function resolvePeriod(q = {}) {
  if (q.period === 'month') {
    const month = q.month ?? serviceDate().slice(0, 7);
    if (!MONTH.test(month)) throw badRequest('Mês inválido. Use AAAA-MM.');
    const [y, m] = month.split('-').map(Number);
    if (m < 1 || m > 12) throw badRequest('Mês inválido.');
    return { period: 'month', label: month, from: `${month}-01`, to: `${month}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}` };
  }
  if (q.from || q.to) {
    const from = q.from ?? q.to;
    const to = q.to ?? q.from;
    if (!DATE.test(from) || !DATE.test(to)) throw badRequest('Datas inválidas. Use AAAA-MM-DD.');
    if (from > to) throw badRequest('A data inicial deve ser anterior à final.');
    return { period: 'range', label: `${from} a ${to}`, from, to };
  }
  const date = q.date ?? serviceDate();
  if (!DATE.test(date)) throw badRequest('Data inválida. Use AAAA-MM-DD.');
  return { period: 'day', label: date, from: date, to: date };
}

const optionalId = (value, name) => {
  if (value === undefined || value === '' || value === null) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`${name} inválido.`);
  return id;
};

const seconds = (from, to) => (from && to ? (to.getTime() - from.getTime()) / 1000 : null);
const avg = (values) => {
  const list = values.filter((v) => v !== null && Number.isFinite(v));
  return list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null;
};

/** RF-27: totais de senhas emitidas e atendidas, geral e por prioridade. */
export async function summaryReport(range) {
  const rows = await query(
    `SELECT type,
            COUNT(*) AS emitidas,
            SUM(status = 'ATENDIDA') AS atendidas,
            SUM(status = 'NAO_COMPARECEU') AS nao_compareceu,
            SUM(status = 'DESCARTADA') AS descartadas,
            SUM(status IN ('AGUARDANDO', 'CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')) AS em_aberto
       FROM tickets
      WHERE service_date BETWEEN ? AND ?
      GROUP BY type`,
    [range.from, range.to],
  );
  const empty = { emitidas: 0, atendidas: 0, naoCompareceu: 0, descartadas: 0, emAberto: 0 };
  const byType = Object.fromEntries(TICKET_TYPES.map((t) => [t, { ...empty, tipo: t, tipoDescricao: TYPE_LABELS[t] }]));
  for (const r of rows) {
    Object.assign(byType[r.type], {
      emitidas: Number(r.emitidas),
      atendidas: Number(r.atendidas),
      naoCompareceu: Number(r.nao_compareceu),
      descartadas: Number(r.descartadas),
      emAberto: Number(r.em_aberto),
    });
  }
  const total = { ...empty };
  for (const t of TICKET_TYPES) for (const k of Object.keys(empty)) total[k] += byType[t][k];
  return { range, total, byType: TICKET_TYPES.map((t) => byType[t]) };
}

/** RF-28: relatório detalhado; campos de atendimento em branco se a senha não foi atendida. */
export async function detailedReport(range) {
  const rows = await query(
    `SELECT t.number, t.type, t.status, t.origin, t.issued_at, t.started_at, t.finished_at,
            c.name AS counter_name
       FROM tickets t
       LEFT JOIN counters c ON c.id = t.counter_id
      WHERE t.service_date BETWEEN ? AND ?
      ORDER BY t.issued_at, t.id`,
    [range.from, range.to],
  );
  return {
    range,
    rows: rows.map((r) => {
      const attended = r.started_at !== null;
      return {
        numero: r.number,
        tipo: r.type,
        tipoDescricao: TYPE_LABELS[r.type],
        situacao: STATUS_LABELS[r.status],
        origem: r.origin,
        emissao: r.issued_at,
        atendimento: attended ? r.started_at : null,
        fimAtendimento: attended ? r.finished_at : null,
        guiche: attended ? r.counter_name : null,
      };
    }),
  };
}

/** RF-29: tempo médio de atendimento por tipo, a partir dos horários reais de início e fim. */
export async function averageTimeReport(range) {
  const rows = await query(
    `SELECT type, COUNT(*) AS atendimentos,
            AVG(TIMESTAMPDIFF(MICROSECOND, started_at, finished_at)) / 1000000 AS tm_segundos,
            MIN(TIMESTAMPDIFF(MICROSECOND, started_at, finished_at)) / 1000000 AS min_segundos,
            MAX(TIMESTAMPDIFF(MICROSECOND, started_at, finished_at)) / 1000000 AS max_segundos
       FROM tickets
      WHERE status = 'ATENDIDA' AND service_date BETWEEN ? AND ?
      GROUP BY type`,
    [range.from, range.to],
  );
  const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
  const round = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);
  const [overall] = await query(
    `SELECT COUNT(*) AS atendimentos, AVG(TIMESTAMPDIFF(MICROSECOND, started_at, finished_at)) / 1000000 AS tm_segundos
       FROM tickets WHERE status = 'ATENDIDA' AND service_date BETWEEN ? AND ?`,
    [range.from, range.to],
  );
  return {
    range,
    rows: TICKET_TYPES.map((t) => ({
      tipo: t,
      tipoDescricao: TYPE_LABELS[t],
      atendimentos: Number(byType[t]?.atendimentos ?? 0),
      tmSegundos: round(byType[t]?.tm_segundos),
      minSegundos: round(byType[t]?.min_segundos),
      maxSegundos: round(byType[t]?.max_segundos),
    })),
    total: { atendimentos: Number(overall.atendimentos), tmSegundos: round(overall.tm_segundos) },
  };
}

/** RF-30: auditoria das senhas chamadas — filtro por período, atendente e guichê. */
export async function attendanceAuditReport(range, filters = {}) {
  const userId = optionalId(filters.userId, 'Atendente');
  const counterId = optionalId(filters.counterId, 'Guichê');
  const where = ['t.service_date BETWEEN ? AND ?', 't.first_call_at IS NOT NULL'];
  const params = [range.from, range.to];
  if (userId) {
    where.push('t.attendant_id = ?');
    params.push(userId);
  }
  if (counterId) {
    where.push('t.counter_id = ?');
    params.push(counterId);
  }
  const rows = await query(
    `SELECT t.number, t.type, t.status, t.first_call_at, t.second_call_at, t.started_at, t.finished_at,
            u.full_name AS attendant_name, u.username, c.name AS counter_name
       FROM tickets t
       JOIN users u ON u.id = t.attendant_id
       JOIN counters c ON c.id = t.counter_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.first_call_at, t.id`,
    params,
  );
  return {
    range,
    filters: { userId, counterId },
    rows: rows.map((r) => ({
      atendente: `${r.attendant_name} (${r.username})`,
      guiche: r.counter_name,
      senha: r.number,
      tipo: r.type,
      situacao: STATUS_LABELS[r.status],
      primeiraChamada: r.first_call_at,
      segundaChamada: r.second_call_at,
      inicio: r.started_at,
      fim: r.finished_at,
    })),
  };
}

/** RNF-08: log do sistema (logins, cadastros, relatórios, descartes). */
export async function systemLogReport(range, filters = {}) {
  const userId = optionalId(filters.userId, 'Usuário');
  const counterId = optionalId(filters.counterId, 'Guichê');
  // O filtro usa a data do laboratório; convertemos com folga de 1 dia e refinamos na aplicação.
  const params = [`${range.from} 00:00:00`, `${range.to} 23:59:59`];
  let extra = '';
  if (userId) {
    extra += ' AND a.user_id = ?';
    params.push(userId);
  }
  if (counterId) {
    extra += ' AND a.counter_id = ?';
    params.push(counterId);
  }
  const rows = await query(
    `SELECT a.at, a.action, a.entity, a.entity_id, a.details, a.ip, u.username, c.name AS counter_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN counters c ON c.id = a.counter_id
      WHERE a.at BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY) ${extra}
      ORDER BY a.id
      LIMIT 20000`,
    params,
  );
  return {
    range,
    rows: rows
      .filter((r) => {
        const d = serviceDate(r.at);
        return d >= range.from && d <= range.to;
      })
      .map((r) => ({
        dataHora: r.at,
        acao: r.action,
        usuario: r.username,
        guiche: r.counter_name,
        registro: r.entity ? `${r.entity} ${r.entity_id ?? ''}`.trim() : null,
        detalhes: r.details ? JSON.stringify(r.details) : null,
        ip: r.ip,
      })),
  };
}

/**
 * RF-33: indicadores de desempenho. Calculados a partir das mesmas senhas
 * dos relatórios, para que os números batam.
 */
export async function dashboard(range) {
  const rows = await query(
    `SELECT t.type, t.status, t.issued_at, t.first_call_at, t.started_at, t.finished_at,
            t.attendant_id, t.counter_id, u.full_name AS attendant_name, c.name AS counter_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.attendant_id
       LEFT JOIN counters c ON c.id = t.counter_id
      WHERE t.service_date BETWEEN ? AND ?`,
    [range.from, range.to],
  );

  const called = rows.filter((r) => r.first_call_at);
  const attended = rows.filter((r) => r.status === 'ATENDIDA');
  const noShow = rows.filter((r) => r.status === 'NAO_COMPARECEU');

  const group = (list, keyFn, nameFn) => {
    const map = new Map();
    for (const r of list) {
      const key = keyFn(r);
      if (!map.has(key)) map.set(key, { nome: nameFn(r), atendimentos: 0, tempos: [] });
      const entry = map.get(key);
      entry.atendimentos += 1;
      entry.tempos.push(seconds(r.started_at, r.finished_at));
    }
    return [...map.values()]
      .map(({ tempos, ...rest }) => ({ ...rest, tmSegundos: avg(tempos) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  const perHour = new Map();
  for (const r of attended) {
    const hour = labHour(r.started_at);
    perHour.set(hour, (perHour.get(hour) ?? 0) + 1);
  }

  return {
    range,
    emitidas: rows.length,
    atendidas: attended.length,
    esperaMediaSegundos: avg(called.map((r) => seconds(r.issued_at, r.first_call_at))),
    esperaPorTipo: TICKET_TYPES.map((t) => ({
      tipo: t,
      tipoDescricao: TYPE_LABELS[t],
      esperaMediaSegundos: avg(called.filter((r) => r.type === t).map((r) => seconds(r.issued_at, r.first_call_at))),
    })),
    tmGeralSegundos: avg(attended.map((r) => seconds(r.started_at, r.finished_at))),
    taxaNaoComparecimento: called.length ? Math.round((noShow.length / called.length) * 1000) / 10 : null,
    naoCompareceu: noShow.length,
    chamadas: called.length,
    porAtendente: group(attended, (r) => r.attendant_id, (r) => r.attendant_name),
    porGuiche: group(attended, (r) => r.counter_id, (r) => r.counter_name),
    porHora: [...perHour.entries()].sort((a, b) => a[0] - b[0]).map(([hora, atendimentos]) => ({ hora, atendimentos })),
  };
}
