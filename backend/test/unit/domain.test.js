process.env.NODE_ENV = 'test';
process.env.LAB_TIMEZONE = 'America/Recife';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { priorityOrder, pickNextType } = await import('../../src/domain/priority.js');
const { canTransition, assertTransition, STATUS } = await import('../../src/domain/stateMachine.js');
const { formatTicketNumber, parseTicketNumber } = await import('../../src/domain/ticketNumber.js');
const { serviceDate, isWithinCallHours, isWithinIssueHours, isAfterClosing } = await import('../../src/domain/clock.js');
const { simulateDay } = await import('../../src/domain/simulation.js');

describe('Regras de priorização (RF-12, RF-13)', () => {
  it('começa o dia pela SP e segue SE, SG', () => {
    assert.deepEqual(priorityOrder(null), ['SP', 'SE', 'SG']);
  });

  it('depois de uma SP chama SE e, na falta, SG', () => {
    assert.deepEqual(priorityOrder('SP'), ['SE', 'SG', 'SP']);
    assert.equal(pickNextType('SP', { SP: 5, SE: 2, SG: 9 }), 'SE');
    assert.equal(pickNextType('SP', { SP: 5, SE: 0, SG: 9 }), 'SG');
  });

  it('depois de SE ou SG volta para SP', () => {
    assert.equal(pickNextType('SE', { SP: 1, SE: 1, SG: 1 }), 'SP');
    assert.equal(pickNextType('SG', { SP: 1, SE: 1, SG: 1 }), 'SP');
  });

  it('segue o ciclo [SP] -> [SE|SG] -> [SP] -> [SE|SG] com todas as filas cheias', () => {
    let last = null;
    const calls = [];
    const waiting = { SP: 10, SE: 10, SG: 10 };
    for (let i = 0; i < 6; i += 1) {
      last = pickNextType(last, waiting);
      waiting[last] -= 1;
      calls.push(last);
    }
    assert.deepEqual(calls, ['SP', 'SE', 'SP', 'SE', 'SP', 'SE']);
  });

  it('o tipo muda a cada chamada sempre que existe outro tipo esperando', () => {
    assert.equal(pickNextType('SE', { SP: 0, SE: 3, SG: 3 }), 'SG');
    assert.equal(pickNextType('SG', { SP: 0, SE: 3, SG: 3 }), 'SE');
  });

  it('com filas vazias escolhe a próxima existente (nenhum guichê ocioso)', () => {
    assert.equal(pickNextType('SP', { SP: 4, SE: 0, SG: 0 }), 'SP');
    assert.equal(pickNextType('SG', { SP: 0, SE: 0, SG: 2 }), 'SG');
    assert.equal(pickNextType(null, { SP: 0, SE: 0, SG: 0 }), null);
  });
});

describe('Máquina de estados (RF-25, RF-26)', () => {
  it('aceita o fluxo completo de atendimento', () => {
    const flow = ['EMITIDA', 'AGUARDANDO', 'CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO', 'ATENDIDA'];
    for (let i = 1; i < flow.length; i += 1) assert.ok(canTransition(flow[i - 1], flow[i]), `${flow[i - 1]} -> ${flow[i]}`);
  });

  it('permite iniciar direto após a primeira chamada', () => {
    assert.ok(canTransition(STATUS.CHAMADA, STATUS.EM_ATENDIMENTO));
  });

  it('só marca NÃO_COMPARECEU depois da segunda chamada (RF-18)', () => {
    assert.ok(!canTransition(STATUS.CHAMADA, STATUS.NAO_COMPARECEU));
    assert.ok(canTransition(STATUS.CHAMADA_NOVAMENTE, STATUS.NAO_COMPARECEU));
  });

  it('senha não comparecida ou descartada não volta para a fila', () => {
    assert.ok(!canTransition(STATUS.NAO_COMPARECEU, STATUS.AGUARDANDO));
    assert.ok(!canTransition(STATUS.DESCARTADA, STATUS.AGUARDANDO));
    assert.ok(canTransition(STATUS.AGUARDANDO, STATUS.DESCARTADA));
  });

  it('recusa transições inválidas com erro 409', () => {
    assert.throws(() => assertTransition(STATUS.AGUARDANDO, STATUS.ATENDIDA), (e) => e.status === 409);
    assert.throws(() => assertTransition(STATUS.ATENDIDA, STATUS.EM_ATENDIMENTO), (e) => e.status === 409);
    assert.throws(() => assertTransition(STATUS.CHAMADA_NOVAMENTE, STATUS.CHAMADA_NOVAMENTE), (e) => e.status === 409);
  });
});

describe('Numeração YYMMDD-PPSQ (RF-08)', () => {
  it('formata conforme o exemplo da planilha', () => {
    assert.equal(formatTicketNumber('2026-09-23', 'SP', 1), '260923-SP001');
    assert.equal(formatTicketNumber('2026-01-05', 'SE', 42), '260105-SE042');
    assert.equal(formatTicketNumber('2026-12-31', 'SG', 999), '261231-SG999');
  });

  it('rejeita sequência fora de 1..999 e tipo inválido', () => {
    assert.throws(() => formatTicketNumber('2026-09-23', 'SP', 0));
    assert.throws(() => formatTicketNumber('2026-09-23', 'SP', 1000));
    assert.throws(() => formatTicketNumber('2026-09-23', 'XX', 1));
  });

  it('interpreta um número válido', () => {
    assert.deepEqual(parseTicketNumber('260923-SG010'), { yy: '26', mm: '09', dd: '23', type: 'SG', seq: 10 });
    assert.equal(parseTicketNumber('260923-SX010'), null);
  });
});

describe('Relógio do laboratório (RNF-04, RF-19)', () => {
  it('usa a data no fuso do laboratório, não a UTC', () => {
    // 02:30 UTC do dia 24 ainda é dia 23 em Recife (UTC-3).
    assert.equal(serviceDate(new Date('2026-09-24T02:30:00Z')), '2026-09-23');
  });

  it('libera chamadas apenas das 7h às 17h', () => {
    assert.equal(isWithinCallHours(new Date('2026-09-23T09:59:00Z')), false); // 06:59
    assert.equal(isWithinCallHours(new Date('2026-09-23T10:00:00Z')), true); // 07:00
    assert.equal(isWithinCallHours(new Date('2026-09-23T19:59:00Z')), true); // 16:59
    assert.equal(isWithinCallHours(new Date('2026-09-23T20:00:00Z')), false); // 17:00
    assert.equal(isAfterClosing(new Date('2026-09-23T20:00:00Z')), true);
    assert.equal(isWithinIssueHours(new Date('2026-09-23T20:30:00Z')), false);
  });
});

describe('Simulação (RF-34)', () => {
  it('é determinística para a mesma semente e fecha a conta das senhas', () => {
    const a = simulateDay({ seed: 7, tickets: 200, counters: 3 });
    const b = simulateDay({ seed: 7, tickets: 200, counters: 3 });
    assert.deepEqual(a, b);
    const { emitidas, atendidas, naoCompareceu, descartadas } = a.total;
    assert.equal(emitidas, 200);
    assert.equal(atendidas + naoCompareceu + descartadas, emitidas);
  });

  it('respeita a taxa de abandono aproximada de 5%', () => {
    const r = simulateDay({ seed: 1, tickets: 2000, counters: 30 });
    const rate = r.total.naoCompareceu / (r.total.emitidas - r.total.descartadas);
    assert.ok(rate > 0.03 && rate < 0.07, `taxa ${rate}`);
  });

  it('valida os parâmetros', () => {
    assert.ok(simulateDay({ counters: 0 }).errors.length);
  });
});
