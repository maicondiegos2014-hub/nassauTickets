// Regras de priorização (RF-12, RF-13) — isoladas para teste (RNF-16).
//
// Ciclo definido na especificação: [SP] -> [SE|SG] -> [SP] -> [SE|SG]
//  - SP tem a maior prioridade, mas nunca é chamada duas vezes seguidas
//    enquanto houver outra senha esperando;
//  - logo após uma SP vem a SE (atendimento rápido) e, na falta dela, a SG;
//  - a cada chamada o tipo muda em relação ao anterior, sempre que possível;
//  - se uma fila estiver vazia, a próxima existente é escolhida mantendo
//    a ordem de prioridade — nenhum guichê fica ocioso com senha na fila.
//
// Implementação: a ordem base é SP, SE, SG; o tipo chamado por último vai
// para o fim da lista. Assim:
//   depois de SP  -> SE, SG, SP
//   depois de SE  -> SP, SG, SE
//   depois de SG  -> SP, SE, SG
//   início do dia -> SP, SE, SG

export const TICKET_TYPES = ['SP', 'SE', 'SG'];

export const TYPE_LABELS = {
  SP: 'Prioritária',
  SE: 'Retirada de exames',
  SG: 'Geral',
};

export function isTicketType(value) {
  return TICKET_TYPES.includes(value);
}

/** Ordem em que as filas devem ser consultadas na próxima chamada. */
export function priorityOrder(lastCalledType) {
  if (!isTicketType(lastCalledType)) return [...TICKET_TYPES];
  return [...TICKET_TYPES.filter((t) => t !== lastCalledType), lastCalledType];
}

/**
 * Escolhe o tipo da próxima senha.
 * @param {string|null} lastCalledType tipo da última senha chamada no dia
 * @param {{SP?: number, SE?: number, SG?: number}} waiting quantidade aguardando por tipo
 * @returns {string|null} tipo escolhido ou null se todas as filas estão vazias
 */
export function pickNextType(lastCalledType, waiting) {
  return priorityOrder(lastCalledType).find((type) => (waiting[type] ?? 0) > 0) ?? null;
}
