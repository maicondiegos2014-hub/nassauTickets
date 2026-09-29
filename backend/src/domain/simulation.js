import { pickNextType, TICKET_TYPES } from './priority.js';

// RF-34 (Could): simulação de um dia de atendimento com os tempos do documento.
//  - SG: TM de 5 min, variando 3 min para cima ou para baixo (distribuição uniforme)
//  - SP: TM de 15 min, variando 5 min para cima ou para baixo (distribuição uniforme)
//  - SE: 1 min em 95% dos atendimentos e 5 min em 5%
//  - 5% das senhas emitidas não são atendidas (cliente não comparece)
// A simulação é pura (não toca no banco) e usa a mesma regra de priorização
// do atendimento real (priority.js).

export const DEFAULT_SIMULATION = {
  counters: 3,
  tickets: 150,
  mix: { SP: 20, SE: 30, SG: 50 },
  openHour: 7,
  closeHour: 17,
  abandonRate: 5,
  // Tempo perdido com as duas chamadas de uma senha que não comparece.
  noShowMinutes: 2,
  seed: 42,
};

/** Gerador pseudoaleatório determinístico (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function serviceMinutes(type, random) {
  switch (type) {
    case 'SP':
      return 15 + (random() * 10 - 5);
    case 'SG':
      return 5 + (random() * 6 - 3);
    case 'SE':
      return random() < 0.95 ? 1 : 5;
    default:
      throw new Error(`Tipo inválido: ${type}`);
  }
}

function validate(params) {
  const p = { ...DEFAULT_SIMULATION, ...params, mix: { ...DEFAULT_SIMULATION.mix, ...(params.mix ?? {}) } };
  const errors = [];
  if (!Number.isInteger(p.counters) || p.counters < 1 || p.counters > 50) errors.push('Guichês deve ser entre 1 e 50.');
  if (!Number.isInteger(p.tickets) || p.tickets < 1 || p.tickets > 2997) errors.push('Senhas deve ser entre 1 e 2997.');
  const mixTotal = TICKET_TYPES.reduce((sum, t) => sum + Number(p.mix[t] ?? 0), 0);
  if (TICKET_TYPES.some((t) => !(Number(p.mix[t]) >= 0)) || mixTotal <= 0) errors.push('Distribuição por tipo inválida.');
  if (!(p.openHour >= 0 && p.closeHour <= 24 && p.openHour < p.closeHour)) errors.push('Horário de expediente inválido.');
  if (!(p.abandonRate >= 0 && p.abandonRate <= 100)) errors.push('Taxa de abandono deve ser entre 0 e 100.');
  if (!Number.isInteger(p.seed)) errors.push('Semente deve ser um número inteiro.');
  return { p, errors, mixTotal };
}

const round = (value, digits = 1) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function simulateDay(params = {}) {
  const { p, errors, mixTotal } = validate(params);
  if (errors.length) return { errors };

  const random = rng(p.seed);
  const open = p.openHour * 60;
  const close = p.closeHour * 60;

  // Chegadas uniformes ao longo do expediente, tipo sorteado pela distribuição.
  const arrivals = Array.from({ length: p.tickets }, (_, id) => {
    const pick = random() * mixTotal;
    let acc = 0;
    let type = 'SG';
    for (const t of TICKET_TYPES) {
      acc += Number(p.mix[t]);
      if (pick < acc) {
        type = t;
        break;
      }
    }
    return { id, type, arrival: open + random() * (close - open) };
  }).sort((a, b) => a.arrival - b.arrival);

  const queues = { SP: [], SE: [], SG: [] };
  let nextArrival = 0;
  const admit = (t) => {
    while (nextArrival < arrivals.length && arrivals[nextArrival].arrival <= t) {
      const ticket = arrivals[nextArrival++];
      queues[ticket.type].push(ticket);
    }
  };

  const counters = Array.from({ length: p.counters }, (_, i) => ({ id: i + 1, freeAt: open, served: 0, busy: 0 }));
  const results = [];
  const sequence = [];
  let lastType = null;

  for (;;) {
    const counter = counters.filter((c) => c.freeAt < close).sort((a, b) => a.freeAt - b.freeAt || a.id - b.id)[0];
    if (!counter) break;
    const t = counter.freeAt;
    admit(t);
    const waiting = Object.fromEntries(TICKET_TYPES.map((type) => [type, queues[type].length]));
    const type = pickNextType(lastType, waiting);
    if (!type) {
      // Fila vazia: o guichê espera a próxima chegada.
      counter.freeAt = nextArrival < arrivals.length ? Math.max(t, arrivals[nextArrival].arrival) : close;
      continue;
    }
    const ticket = queues[type].shift();
    lastType = type;
    if (sequence.length < 30) sequence.push(type);
    const wait = t - ticket.arrival;
    if (random() * 100 < p.abandonRate) {
      results.push({ ...ticket, status: 'NAO_COMPARECEU', wait, counter: counter.id });
      counter.freeAt = t + p.noShowMinutes;
      counter.busy += p.noShowMinutes;
      continue;
    }
    const duration = serviceMinutes(type, random);
    results.push({ ...ticket, status: 'ATENDIDA', wait, duration, counter: counter.id, start: t });
    counter.freeAt = t + duration;
    counter.busy += duration;
    counter.served += 1;
  }

  // RF-20: às 17h as senhas que sobraram são descartadas.
  admit(close);
  for (const type of TICKET_TYPES) {
    for (const ticket of queues[type]) results.push({ ...ticket, status: 'DESCARTADA' });
  }

  const byType = Object.fromEntries(
    TICKET_TYPES.map((type) => {
      const rows = results.filter((r) => r.type === type);
      const served = rows.filter((r) => r.status === 'ATENDIDA');
      return [
        type,
        {
          emitidas: rows.length,
          atendidas: served.length,
          naoCompareceu: rows.filter((r) => r.status === 'NAO_COMPARECEU').length,
          descartadas: rows.filter((r) => r.status === 'DESCARTADA').length,
          esperaMediaMin: round(mean(rows.filter((r) => r.wait !== undefined).map((r) => r.wait))),
          tmMin: round(mean(served.map((r) => r.duration))),
        },
      ];
    }),
  );

  const served = results.filter((r) => r.status === 'ATENDIDA');
  const perHour = {};
  for (const r of served) {
    const hour = Math.floor(r.start / 60);
    perHour[hour] = (perHour[hour] ?? 0) + 1;
  }

  return {
    params: p,
    total: {
      emitidas: results.length,
      atendidas: served.length,
      naoCompareceu: results.filter((r) => r.status === 'NAO_COMPARECEU').length,
      descartadas: results.filter((r) => r.status === 'DESCARTADA').length,
      esperaMediaMin: round(mean(results.filter((r) => r.wait !== undefined).map((r) => r.wait))),
      tmMin: round(mean(served.map((r) => r.duration))),
    },
    byType,
    counters: counters.map((c) => ({
      guiche: c.id,
      atendimentos: c.served,
      ocupacaoPct: round((c.busy / (close - open)) * 100),
    })),
    perHour: Object.entries(perHour).map(([hour, count]) => ({ hora: Number(hour), atendimentos: count })),
    sequence,
  };
}
