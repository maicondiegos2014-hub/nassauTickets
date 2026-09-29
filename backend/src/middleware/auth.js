import { config } from '../config.js';
import { forbidden, unauthorized } from '../errors.js';
import { resolveSession } from '../services/authService.js';

/** Carrega a sessão do cookie (se houver) em req.auth. */
export async function loadSession(req, _res, next) {
  try {
    req.auth = await resolveSession(req.cookies?.[config.auth.cookieName]);
    next();
  } catch (error) {
    next(error);
  }
}

/** RNF-01: toda regra de acesso é aplicada no servidor, nunca apenas na tela. */
export function requireAuth(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (roles.length && !roles.includes(req.auth.user.role)) return next(forbidden());
    next();
  };
}

/** Enquanto a senha provisória não for trocada, só a troca de senha é permitida. */
export function requirePasswordChanged(req, _res, next) {
  if (req.auth?.user.mustChangePassword) {
    return next(forbidden('Troque sua senha provisória antes de continuar.'));
  }
  next();
}

export const requireGestor = [requireAuth('GESTOR'), requirePasswordChanged];
export const requireAttendant = [requireAuth('ATENDENTE', 'GESTOR'), requirePasswordChanged];
