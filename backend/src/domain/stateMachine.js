import { conflict } from '../errors.js';

// RF-25 / RF-26: ciclo de vida da senha.
export const STATUS = Object.freeze({
  EMITIDA: 'EMITIDA',
  AGUARDANDO: 'AGUARDANDO',
  CHAMADA: 'CHAMADA',
  CHAMADA_NOVAMENTE: 'CHAMADA_NOVAMENTE',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  ATENDIDA: 'ATENDIDA',
  NAO_COMPARECEU: 'NAO_COMPARECEU',
  // RF-26: senhas que sobraram na fila ao fim do expediente.
  DESCARTADA: 'DESCARTADA',
});

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

const TRANSITIONS = {
  EMITIDA: ['AGUARDANDO'],
  AGUARDANDO: ['CHAMADA', 'DESCARTADA'],
  CHAMADA: ['CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'],
  // RF-18: só após a segunda chamada a senha pode ser dada como não comparecida.
  CHAMADA_NOVAMENTE: ['EM_ATENDIMENTO', 'NAO_COMPARECEU'],
  EM_ATENDIMENTO: ['ATENDIDA'],
  ATENDIDA: [],
  NAO_COMPARECEU: [],
  DESCARTADA: [],
};

/** Estados em que a senha está vinculada a um guichê. */
export const ACTIVE_STATUSES = ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'];

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw conflict(
      'TRANSICAO_INVALIDA',
      `A senha está "${STATUS_LABELS[from] ?? from}" e não pode passar para "${STATUS_LABELS[to] ?? to}".`,
      { from, to },
    );
  }
}

export function allowedTransitions(from) {
  return [...(TRANSITIONS[from] ?? [])];
}
