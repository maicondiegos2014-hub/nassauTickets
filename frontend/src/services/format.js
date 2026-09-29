// Formatação no fuso do laboratório (informado pelo servidor em /api/config — RNF-04).
let labTimeZone = 'America/Recife';

export function setLabTimeZone(timeZone) {
  if (timeZone) labTimeZone = timeZone;
}

const cache = new Map();
function formatter(key, options) {
  const id = `${labTimeZone}|${key}`;
  if (!cache.has(id)) cache.set(id, new Intl.DateTimeFormat('pt-BR', { timeZone: labTimeZone, ...options }));
  return cache.get(id);
}

export function formatDateTime(value) {
  if (!value) return '';
  return formatter('dt', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '';
  return formatter('t', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) return '';
  return formatter('d', { dateStyle: 'full' }).format(new Date(value));
}

/** Segundos -> "12 min 05 s". */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.round(seconds);
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return min ? `${min} min ${sec} s` : `${total} s`;
}

export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${String(value).replace('.', ',')}%`;
}

export const TYPE_LABELS = {
  SP: 'Prioritária',
  SE: 'Retirada de exames',
  SG: 'Geral',
};

export const STATUS_LABELS = {
  EMITIDA: 'Emitida',
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamada',
  CHAMADA_NOVAMENTE: 'Chamada novamente',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  NAO_COMPARECEU: 'Não compareceu',
  DESCARTADA: 'Descartada',
};

/** Data de hoje (YYYY-MM-DD) no fuso do laboratório. */
export function todayInLab() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: labTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
