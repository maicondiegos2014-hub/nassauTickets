import { config } from '../config.js';

// RNF-04: a única fonte de horário do sistema é o relógio do servidor
// (sincronizado por NTP no sistema operacional). O cliente nunca envia horários.
let frozen = null;

export function now() {
  return frozen ? new Date(frozen.getTime()) : new Date();
}

/** Somente para testes automatizados: congela o relógio. */
export function setNowForTests(date) {
  if (config.env !== 'test') throw new Error('setNowForTests só pode ser usado em testes');
  frozen = date ? new Date(date) : null;
}

const formatters = new Map();
function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
    );
  }
  return formatters.get(timeZone);
}

/** Componentes da data/hora no fuso do laboratório. */
export function labParts(date = now(), timeZone = config.timezone) {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Data de serviço (YYYY-MM-DD) no fuso do laboratório. */
export function serviceDate(date = now()) {
  const p = labParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isWithinCallHours(date = now()) {
  const { hour } = labParts(date);
  return hour >= config.hours.callStart && hour < config.hours.callEnd;
}

export function isWithinIssueHours(date = now()) {
  const { hour } = labParts(date);
  return hour >= config.hours.issueStart && hour < config.hours.callEnd;
}

export function isAfterClosing(date = now()) {
  return labParts(date).hour >= config.hours.callEnd;
}

/** Hora local do laboratório (0–23) de um instante. */
export function labHour(date) {
  return labParts(date).hour;
}
