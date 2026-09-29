// Cliente REST único do frontend. Toda regra de acesso é validada no servidor;
// aqui só tratamos respostas e erros de forma amigável.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Backend ou banco fora do ar (RNF-13). */
  get offline() {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

/** Chave única para tornar a requisição idempotente (RNF-06). Funciona também fora de HTTPS. */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // contexto não seguro: cai no método abaixo
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function request(path, { method = 'GET', body, headers = {}, signal, idempotencyKey } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Tentando reconectar…');
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error;
    const fallback =
      response.status >= 502 ? 'Serviço indisponível no momento. Tentando reconectar…' : `Erro ${response.status}`;
    throw new ApiError(response.status, err?.code ?? 'ERRO', err?.message ?? fallback, err?.details);
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
};

export const API_BASE = BASE;

export function toQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
