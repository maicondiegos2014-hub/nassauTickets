export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'DADOS_INVALIDOS', message, details);
export const unauthorized = (message = 'Faça login para continuar.') => new AppError(401, 'NAO_AUTENTICADO', message);
export const forbidden = (message = 'Acesso negado.') => new AppError(403, 'ACESSO_NEGADO', message);
export const notFound = (message = 'Registro não encontrado.') => new AppError(404, 'NAO_ENCONTRADO', message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
