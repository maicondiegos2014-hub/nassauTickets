import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { reportFailure } from '../services/alerts.js';

const DB_DOWN = new Set(['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ER_CON_COUNT_ERROR', 'ENOTFOUND']);

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: 'Rota não encontrada.' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'Corpo da requisição inválido.' } });
  }
  // RNF-13: banco indisponível — o frontend mostra aviso claro e tenta de novo sozinho.
  if (DB_DOWN.has(error?.code)) {
    reportFailure('database', error);
    return res
      .status(503)
      .json({ error: { code: 'SERVICO_INDISPONIVEL', message: 'Banco de dados indisponível. Tente novamente em instantes.' } });
  }
  logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Erro não tratado');
  res.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Erro interno. A equipe de suporte foi notificada.' } });
}
