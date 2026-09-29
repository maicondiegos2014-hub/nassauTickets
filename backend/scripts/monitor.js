// RNF-17: monitor externo. Consulta /api/health a cada minuto e alerta após falha
// (backend fora do ar ou banco indisponível) — alerta em até 5 min.
// Uso: HEALTH_URL=http://servidor:3000/api/health ALERT_WEBHOOK_URL=... npm run monitor
const url = process.env.HEALTH_URL ?? 'http://localhost:3000/api/health';
const webhook = process.env.ALERT_WEBHOOK_URL;
const intervalMs = Number(process.env.MONITOR_INTERVAL_MS ?? 60_000);
const failuresToAlert = Number(process.env.MONITOR_FAILURES ?? 2);

let failures = 0;
let alerted = false;

function log(level, msg, extra = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, service: 'nassautickets-monitor', msg, ...extra }));
}

async function notify(text) {
  log('fatal', text, { alert: true });
  if (!webhook) return;
  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch (error) {
    log('error', 'Falha ao enviar alerta', { error: error.message });
  }
}

async function check() {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.database) throw new Error(`status ${res.status}, banco ${body.database ? 'ok' : 'indisponível'}`);
    if (alerted) await notify(`[nassauTickets] Serviço recuperado: ${url}`);
    failures = 0;
    alerted = false;
  } catch (error) {
    failures += 1;
    log('warn', 'Falha no health check', { failures, error: error.message });
    if (failures >= failuresToAlert && !alerted) {
      alerted = true;
      await notify(`[nassauTickets] ALERTA: ${url} falhou ${failures}x seguidas (${error.message})`);
    }
  }
}

log('info', 'Monitor iniciado', { url, intervalMs });
check();
setInterval(check, intervalMs);
