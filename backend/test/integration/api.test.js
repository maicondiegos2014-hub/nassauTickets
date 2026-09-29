// Testes de integração contra um MySQL 8 real (RNF-16).
// Localmente sobe um MySQL temporário com mysql-memory-server; no CI usa o serviço
// informado por TEST_DB_HOST/TEST_DB_PORT/TEST_DB_USER/TEST_DB_PASSWORD.
import { randomUUID } from 'node:crypto';

// Senhas geradas a cada execução: nenhuma senha fixa no repositório.
const senhaTeste = () => `Teste${randomUUID()}`;
const SENHA_PROVISORIA = senhaTeste();
const SENHA_TEMPORARIA = senhaTeste();
const SENHA_DEFINITIVA = senhaTeste();
const SENHA_NOVA = senhaTeste();
const SENHA_ERRADA = senhaTeste();

process.env.NODE_ENV = 'test';
process.env.BCRYPT_COST = '4';
process.env.LOGIN_IP_LIMIT = '100000';
process.env.TOTEM_RATE_LIMIT = '100000';
process.env.LAB_TIMEZONE = 'America/Recife';
// O relógio é congelado e avançado por horas nos testes; a expiração por inatividade é testada à parte.
process.env.SESSION_IDLE_MINUTES = '100000';
process.env.SESSION_ABSOLUTE_HOURS = '10000';
process.env.GESTOR_USERNAME = 'gestor';
process.env.GESTOR_PASSWORD = SENHA_PROVISORIA;

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

let memoryDb = null;
if (process.env.TEST_DB_HOST) {
  process.env.DB_HOST = process.env.TEST_DB_HOST;
  process.env.DB_PORT = process.env.TEST_DB_PORT ?? '3306';
  process.env.DB_USER = process.env.TEST_DB_USER ?? 'root';
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? '';
} else {
  const { createDB } = await import('mysql-memory-server');
  memoryDb = await createDB({ version: '8.0.x', logLevel: 'ERROR' });
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = String(memoryDb.port);
  process.env.DB_USER = memoryDb.username;
  process.env.DB_PASSWORD = '';
}
process.env.DB_NAME = 'nassau_tickets_test';

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { migrate } = await import('../../src/db/migrate.js');
const { closePool, query } = await import('../../src/db/pool.js');
const { setNowForTests } = await import('../../src/domain/clock.js');
const { discardLeftovers } = await import('../../src/services/ticketService.js');

const app = createApp();
const GESTOR_PASSWORD = senhaTeste();
const DAY = '2026-09-23';
// 09:00 em Recife (UTC-3)
const at = (hhmm) => new Date(`${DAY}T${hhmm}:00-03:00`);

let keySeq = 0;
const newKey = () => `test-key-${Date.now()}-${(keySeq += 1)}`;

async function resetTickets() {
  await query('DELETE FROM ticket_events');
  await query('DELETE FROM tickets');
  await query('DELETE FROM daily_sequences');
  await query('UPDATE call_control SET service_date = NULL, last_type = NULL WHERE id = 1');
}

async function login(username, password, counterId) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password, counterId });
  return { agent, res };
}

async function gestorAgent(counterId = null) {
  const { agent, res } = await login('gestor', GESTOR_PASSWORD, counterId);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return agent;
}

async function createAttendant(username, counterId) {
  const gestor = await gestorAgent();
  const created = await gestor.post('/api/admin/users').send({ username, fullName: `Atendente ${username}`, password: SENHA_TEMPORARIA });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { agent, res } = await login(username, SENHA_TEMPORARIA, counterId);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const changed = await agent.post('/api/auth/password').send({ currentPassword: SENHA_TEMPORARIA, newPassword: SENHA_DEFINITIVA });
  assert.equal(changed.status, 204);
  return { agent, id: created.body.id };
}

async function issue(type, key = newKey()) {
  return request(app).post('/api/totem/tickets').set('Idempotency-Key', key).send({ type });
}

async function callNext(agent) {
  return agent.post('/api/attendance/call-next').set('Idempotency-Key', newKey());
}

async function serve(agent, id) {
  assert.equal((await agent.post(`/api/attendance/tickets/${id}/start`)).status, 200);
  assert.equal((await agent.post(`/api/attendance/tickets/${id}/finish`)).status, 200);
}

let counters;
let ana;
let bruno;

before(async () => {
  setNowForTests(at('09:00'));
  await migrate();
  // Primeiro acesso do gestor: troca obrigatória da senha provisória.
  const { agent, res } = await login('gestor', SENHA_PROVISORIA);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.mustChangePassword, true);
  assert.equal((await agent.get('/api/reports/summary')).status, 403);
  assert.equal(
    (await agent.post('/api/auth/password').send({ currentPassword: SENHA_PROVISORIA, newPassword: GESTOR_PASSWORD })).status,
    204,
  );
  counters = (await query('SELECT id FROM counters ORDER BY number')).map((c) => c.id);
  ana = await createAttendant('ana', counters[0]);
  bruno = await createAttendant('bruno', counters[1]);
});

after(async () => {
  await closePool();
  if (memoryDb) await memoryDb.stop();
});

describe('Acesso e perfis (RF-01 a RF-06, RNF-01, RNF-02)', () => {
  it('sem login nenhuma função de atendimento fica disponível', async () => {
    assert.equal((await request(app).get('/api/attendance/current')).status, 401);
    assert.equal((await request(app).post('/api/attendance/call-next')).status, 401);
  });

  it('atendente não acessa relatórios nem cadastros pela API', async () => {
    for (const path of ['/api/reports/summary', '/api/reports/audit', '/api/reports/dashboard', '/api/admin/users', '/api/admin/counters']) {
      assert.equal((await ana.agent.get(path)).status, 403, path);
    }
    assert.equal((await ana.agent.post('/api/admin/users').send({ username: 'x', fullName: 'X', password: senhaTeste() })).status, 403);
  });

  it('não há autocadastro: rotas de criação exigem o gestor', async () => {
    assert.equal((await request(app).post('/api/admin/users').send({ username: 'invasor', fullName: 'X', password: senhaTeste() })).status, 401);
  });

  it('atendente precisa escolher um guichê ativo no login', async () => {
    assert.equal((await login('ana', SENHA_DEFINITIVA)).res.status, 400);
    const gestor = await gestorAgent();
    const created = await gestor.post('/api/admin/counters').send({ number: 90, name: 'Guichê 90' });
    assert.equal(created.status, 201);
    await gestor.patch(`/api/admin/counters/${created.body.id}`).send({ active: false });
    assert.equal((await login('ana', SENHA_DEFINITIVA, created.body.id)).res.status, 400);
    const publicCounters = await request(app).get('/api/counters');
    assert.ok(!publicCounters.body.some((c) => c.id === created.body.id));
  });

  it('um guichê não pode ser usado por dois atendentes ao mesmo tempo', async () => {
    const { res } = await login('bruno', SENHA_DEFINITIVA, counters[0]);
    assert.equal(res.status, 409);
  });

  it('bloqueia temporariamente após 5 tentativas falhas', async () => {
    await createAttendant('carla', counters[2]);
    for (let i = 0; i < 4; i += 1) assert.equal((await login('carla', SENHA_ERRADA, counters[2])).res.status, 401);
    assert.equal((await login('carla', SENHA_ERRADA, counters[2])).res.status, 429);
    assert.equal((await login('carla', SENHA_DEFINITIVA, counters[2])).res.status, 429);
    setNowForTests(at('09:20'));
    const carla = await login('carla', SENHA_DEFINITIVA, counters[2]);
    assert.equal(carla.res.status, 200);
    await carla.agent.post('/api/auth/logout');
    setNowForTests(at('09:00'));
  });

  it('atendente bloqueado não entra e perde a sessão; o histórico é mantido', async () => {
    const dani = await createAttendant('dani', counters[2]);
    const gestor = await gestorAgent();
    assert.equal((await gestor.patch(`/api/admin/users/${dani.id}`).send({ status: 'BLOQUEADO' })).status, 200);
    assert.equal((await dani.agent.get('/api/attendance/current')).status, 401);
    assert.equal((await login('dani', SENHA_DEFINITIVA, counters[2])).res.status, 403);
    const users = await gestor.get('/api/admin/users');
    assert.equal(users.body.find((u) => u.id === dani.id).status, 'BLOQUEADO');
  });

  it('o próprio atendente troca a senha (RF-02) e o logout encerra a sessão', async () => {
    const eva = await createAttendant('eva', counters[2]);
    assert.equal((await eva.agent.post('/api/auth/password').send({ currentPassword: SENHA_ERRADA, newPassword: SENHA_NOVA })).status, 400);
    assert.equal((await eva.agent.post('/api/auth/password').send({ currentPassword: SENHA_DEFINITIVA, newPassword: SENHA_NOVA })).status, 204);
    assert.equal((await eva.agent.post('/api/auth/logout')).status, 204);
    assert.equal((await eva.agent.get('/api/auth/me')).status, 401);
    assert.equal((await login('eva', SENHA_NOVA, counters[2])).res.status, 200);
  });
});

describe('Totem (RF-07 a RF-10, RNF-06)', () => {
  beforeEach(resetTickets);

  it('emite no formato YYMMDD-PPSQ com sequência por tipo', async () => {
    const sp1 = await issue('SP');
    const sg1 = await issue('SG');
    const sp2 = await issue('SP');
    assert.equal(sp1.status, 201);
    assert.equal(sp1.body.number, '260923-SP001');
    assert.equal(sg1.body.number, '260923-SG001');
    assert.equal(sp2.body.number, '260923-SP002');
    assert.deepEqual(Object.keys(sp1.body).sort(), ['issuedAt', 'number', 'type', 'typeLabel']);
  });

  it('coloca a senha em AGUARDANDO com o horário do servidor', async () => {
    await issue('SE');
    const [t] = await query('SELECT status, issued_at, queued_at FROM tickets');
    assert.equal(t.status, 'AGUARDANDO');
    assert.equal(t.issued_at.toISOString(), at('09:00').toISOString());
    const events = await query('SELECT to_status FROM ticket_events ORDER BY id');
    assert.deepEqual(events.map((e) => e.to_status), ['EMITIDA', 'AGUARDANDO']);
  });

  it('reenvio da mesma requisição não cria senha nova', async () => {
    const key = newKey();
    const first = await issue('SG', key);
    const again = await issue('SG', key);
    assert.equal(again.status, 200);
    assert.equal(again.body.number, first.body.number);
    const [{ total }] = await query('SELECT COUNT(*) AS total FROM tickets');
    assert.equal(total, 1);
  });

  it('não repete números com emissões simultâneas de vários totens', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => issue(['SP', 'SG', 'SE'][i % 3])));
    assert.ok(results.every((r) => r.status === 201));
    const numbers = results.map((r) => r.body.number);
    assert.equal(new Set(numbers).size, 40);
    const sg = numbers.filter((n) => n.includes('SG')).sort();
    assert.deepEqual(sg, Array.from({ length: sg.length }, (_, i) => `260923-SG${String(i + 1).padStart(3, '0')}`));
  });

  it('recusa tipo inválido e emissão fora do expediente', async () => {
    assert.equal((await issue('XX')).status, 400);
    setNowForTests(at('17:05'));
    assert.equal((await issue('SP')).status, 409);
    setNowForTests(at('09:00'));
  });

  it('a sequência reinicia no dia seguinte', async () => {
    await issue('SP');
    setNowForTests(new Date('2026-09-24T09:00:00-03:00'));
    assert.equal((await issue('SP')).body.number, '260924-SP001');
    setNowForTests(at('09:00'));
  });
});

describe('Atendimento (RF-12 a RF-19, RF-25)', () => {
  beforeEach(resetTickets);

  it('chama seguindo a priorização SP -> SE|SG -> SP -> SE|SG', async () => {
    for (const type of ['SG', 'SG', 'SE', 'SP', 'SP', 'SG']) await issue(type);
    const order = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await callNext(ana.agent);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      order.push(res.body.ticket.number.slice(7, 9));
      await serve(ana.agent, res.body.ticket.id);
    }
    assert.deepEqual(order, ['SP', 'SE', 'SP', 'SG', 'SG', 'SG']);
    const empty = await callNext(ana.agent);
    assert.equal(empty.body.ticket, null);
  });

  it('a regra de prioridade vale para o laboratório inteiro, entre guichês', async () => {
    for (const type of ['SP', 'SP', 'SE', 'SG']) await issue(type);
    const a = await callNext(ana.agent);
    const b = await callNext(bruno.agent);
    assert.equal(a.body.ticket.type, 'SP');
    assert.equal(b.body.ticket.type, 'SE');
    await serve(ana.agent, a.body.ticket.id);
    await serve(bruno.agent, b.body.ticket.id);
  });

  it('não chama a próxima com atendimento em andamento', async () => {
    await issue('SP');
    await issue('SG');
    const first = await callNext(ana.agent);
    assert.equal((await callNext(ana.agent)).status, 409);
    await serve(ana.agent, first.body.ticket.id);
    assert.equal((await callNext(ana.agent)).status, 200);
  });

  it('repetir a mesma chamada (mesma chave) devolve a mesma senha', async () => {
    await issue('SP');
    await issue('SP');
    const key = newKey();
    const first = await ana.agent.post('/api/attendance/call-next').set('Idempotency-Key', key);
    const again = await ana.agent.post('/api/attendance/call-next').set('Idempotency-Key', key);
    assert.equal(again.body.ticket.id, first.body.ticket.id);
    await serve(ana.agent, first.body.ticket.id);
  });

  it('ciclo completo: chamar, chamar novamente, iniciar e encerrar com horários', async () => {
    await issue('SG');
    setNowForTests(at('09:05'));
    const { ticket } = (await callNext(ana.agent)).body;
    assert.equal(ticket.status, 'CHAMADA');
    setNowForTests(at('09:06'));
    const recall = await ana.agent.post(`/api/attendance/tickets/${ticket.id}/recall`);
    assert.equal(recall.body.ticket.status, 'CHAMADA_NOVAMENTE');
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/recall`)).status, 409);
    setNowForTests(at('09:07'));
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/start`)).body.ticket.status, 'EM_ATENDIMENTO');
    setNowForTests(at('09:12'));
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/finish`)).body.ticket.status, 'ATENDIDA');
    const [row] = await query('SELECT * FROM tickets WHERE id = ?', [ticket.id]);
    assert.equal(row.first_call_at.toISOString(), at('09:05').toISOString());
    assert.equal(row.second_call_at.toISOString(), at('09:06').toISOString());
    assert.equal(row.started_at.toISOString(), at('09:07').toISOString());
    assert.equal(row.finished_at.toISOString(), at('09:12').toISOString());
    assert.equal(row.counter_id, counters[0]);
    setNowForTests(at('09:00'));
  });

  it('não comparecimento só após duas chamadas, e a senha não volta para a fila', async () => {
    await issue('SP');
    const { ticket } = (await callNext(ana.agent)).body;
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/no-show`)).status, 409);
    await ana.agent.post(`/api/attendance/tickets/${ticket.id}/recall`);
    const res = await ana.agent.post(`/api/attendance/tickets/${ticket.id}/no-show`);
    assert.equal(res.body.ticket.status, 'NAO_COMPARECEU');
    assert.equal((await callNext(ana.agent)).body.ticket, null);
  });

  it('o servidor recusa transições inválidas e ações em senha de outro guichê', async () => {
    await issue('SG');
    const { ticket } = (await callNext(ana.agent)).body;
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/finish`)).status, 409);
    assert.equal((await bruno.agent.post(`/api/attendance/tickets/${ticket.id}/start`)).status, 403);
    await serve(ana.agent, ticket.id);
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${ticket.id}/start`)).status, 409);
  });

  it('bloqueia "Chamar próxima" fora do expediente (7h–17h)', async () => {
    await issue('SG');
    setNowForTests(at('06:59'));
    assert.equal((await callNext(ana.agent)).status, 409);
    setNowForTests(at('17:00'));
    assert.equal((await callNext(ana.agent)).status, 409);
    setNowForTests(at('09:00'));
  });
});

describe('Concorrência (RF-14, RNF-05)', () => {
  beforeEach(resetTickets);

  it('chamadas simultâneas de vários guichês nunca entregam a mesma senha', async () => {
    const team = [];
    for (let i = 0; i < 8; i += 1) {
      // Novo login a cada volta: o login do gestor em createAttendant encerra a sessão anterior.
      const gestor = await gestorAgent();
      const counter = await gestor.post('/api/admin/counters').send({ number: 100 + i, name: `Guichê ${100 + i}` });
      assert.equal(counter.status, 201, JSON.stringify(counter.body));
      team.push(await createAttendant(`concorrente${i}`, counter.body.id));
    }
    for (let round = 0; round < 3; round += 1) {
      await resetTickets();
      for (const type of ['SP', 'SG', 'SE', 'SG', 'SP']) await issue(type);
      const results = await Promise.all(team.map((member) => callNext(member.agent)));
      assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.body)));
      const got = results.map((r) => r.body.ticket).filter(Boolean);
      assert.equal(got.length, 5);
      assert.equal(new Set(got.map((t) => t.id)).size, 5);
      const rows = await query('SELECT id, counter_id FROM tickets WHERE status = "CHAMADA"');
      assert.equal(new Set(rows.map((r) => r.counter_id)).size, 5);
      await Promise.all(results.map((r, i) => r.body.ticket && serve(team[i].agent, r.body.ticket.id)));
    }
  });
});

describe('Painel (RF-21 a RF-23, RNF-03)', () => {
  beforeEach(resetTickets);

  it('mostra as 5 últimas chamadas, a mais recente no topo, sem a próxima e sem dados de atendentes', async () => {
    for (let i = 0; i < 7; i += 1) await issue('SG');
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = (await callNext(ana.agent)).body.ticket;
      await serve(ana.agent, last.id);
    }
    const panel = await request(app).get('/api/panel/calls');
    assert.equal(panel.status, 200);
    assert.equal(panel.body.length, 5);
    assert.equal(panel.body[0].number, last.number);
    const json = JSON.stringify(panel.body);
    assert.ok(!json.includes('SG007'), 'não pode exibir a próxima senha');
    assert.ok(!/attendant|atendente|username|ana/i.test(json));
  });

  it('a segunda chamada volta ao topo marcada como "última chamada"', async () => {
    await issue('SP');
    await issue('SG');
    const first = (await callNext(ana.agent)).body.ticket;
    const second = (await callNext(bruno.agent)).body.ticket;
    await ana.agent.post(`/api/attendance/tickets/${first.id}/recall`);
    const panel = (await request(app).get('/api/panel/calls')).body;
    assert.equal(panel[0].number, first.number);
    assert.equal(panel[0].lastCall, true);
    assert.equal(panel[1].number, second.number);
    assert.equal(panel.length, 2);
    await serve(ana.agent, first.id);
    await serve(bruno.agent, second.id);
  });
});

describe('Fim do expediente e relatórios (RF-20, RF-26 a RF-31)', () => {
  beforeEach(resetTickets);

  it('às 17h descarta a fila, mantém o atendimento em curso e os números batem nos relatórios', async () => {
    for (const type of ['SP', 'SG', 'SE', 'SG']) await issue(type);
    setNowForTests(at('16:50'));
    const sp = (await callNext(ana.agent)).body.ticket;
    await ana.agent.post(`/api/attendance/tickets/${sp.id}/start`);

    setNowForTests(at('17:00'));
    assert.equal(await discardLeftovers(), 3);
    // O atendimento iniciado pode ser encerrado depois das 17h.
    setNowForTests(at('17:10'));
    assert.equal((await ana.agent.post(`/api/attendance/tickets/${sp.id}/finish`)).status, 200);
    setNowForTests(at('17:15'));

    const gestor = await gestorAgent();
    const summary = (await gestor.get(`/api/reports/summary?period=day&date=${DAY}`)).body;
    assert.equal(summary.total.emitidas, 4);
    assert.equal(summary.total.atendidas, 1);
    assert.equal(summary.total.descartadas, 3);
    assert.equal(summary.byType.find((t) => t.tipo === 'SP').atendidas, 1);

    const detailed = (await gestor.get(`/api/reports/detailed?period=day&date=${DAY}`)).body;
    assert.equal(detailed.rows.length, summary.total.emitidas);
    assert.equal(detailed.rows.filter((r) => r.situacao === 'Atendida').length, summary.total.atendidas);
    const discarded = detailed.rows.find((r) => r.situacao === 'Descartada');
    assert.equal(discarded.atendimento, null);
    assert.equal(discarded.guiche, null);

    const tm = (await gestor.get(`/api/reports/average-time?period=month&month=2026-09`)).body;
    assert.equal(tm.rows.find((r) => r.tipo === 'SP').tmSegundos, 20 * 60);

    const auditAll = (await gestor.get(`/api/reports/audit?from=${DAY}&to=${DAY}`)).body;
    assert.equal(auditAll.rows.length, 1);
    assert.equal(auditAll.rows[0].senha, sp.number);
    assert.ok(auditAll.rows[0].inicio && auditAll.rows[0].fim);
    const auditOther = (await gestor.get(`/api/reports/audit?from=${DAY}&to=${DAY}&userId=${bruno.id}`)).body;
    assert.equal(auditOther.rows.length, 0);

    const dash = (await gestor.get(`/api/reports/dashboard?period=day&date=${DAY}`)).body;
    assert.equal(dash.atendidas, summary.total.atendidas);
    assert.equal(dash.emitidas, summary.total.emitidas);

    const log = (await gestor.get(`/api/reports/system-log?from=${DAY}&to=${DAY}`)).body;
    assert.ok(log.rows.some((r) => r.acao === 'RELATORIO_EMITIDO'));
    assert.ok(log.rows.some((r) => r.acao === 'LOGIN'));
    assert.ok(log.rows.some((r) => r.acao === 'FIM_EXPEDIENTE_DESCARTE'));
    setNowForTests(at('09:00'));
  });

  it('toda chamada e todo atendimento ficam rastreáveis (RNF-08)', async () => {
    await issue('SE');
    const t = (await callNext(ana.agent)).body.ticket;
    await serve(ana.agent, t.id);
    const events = await query('SELECT to_status, user_id, counter_id FROM ticket_events WHERE ticket_id = ? ORDER BY id', [t.id]);
    assert.deepEqual(events.map((e) => e.to_status), ['EMITIDA', 'AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO', 'ATENDIDA']);
    for (const e of events.slice(2)) {
      assert.equal(e.user_id, ana.id);
      assert.equal(e.counter_id, counters[0]);
    }
  });
});
