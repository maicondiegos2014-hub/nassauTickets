import { isTicketType } from './priority.js';

export const MAX_DAILY_SEQUENCE = 999;

/**
 * RF-08: número no formato YYMMDD-PPSQ (ex.: 260923-SP001).
 * @param {string} serviceDate data do laboratório no formato YYYY-MM-DD
 */
export function formatTicketNumber(serviceDate, type, seq) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error(`Data inválida: ${serviceDate}`);
  if (!isTicketType(type)) throw new Error(`Tipo de senha inválido: ${type}`);
  if (!Number.isInteger(seq) || seq < 1 || seq > MAX_DAILY_SEQUENCE) throw new Error(`Sequência inválida: ${seq}`);
  const [year, month, day] = serviceDate.split('-');
  return `${year.slice(2)}${month}${day}-${type}${String(seq).padStart(3, '0')}`;
}

export function parseTicketNumber(number) {
  const match = /^(\d{2})(\d{2})(\d{2})-(SP|SG|SE)(\d{3})$/.exec(number);
  if (!match) return null;
  const [, yy, mm, dd, type, seq] = match;
  return { yy, mm, dd, type, seq: Number(seq) };
}
