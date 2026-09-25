import { useState } from 'react';
import { Alert, Bars, DataTable, Field, StatCard } from '../../components/ui.jsx';
import { api } from '../../services/api.js';

const minutes = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} min`);

// RF-34: simulação de um dia com os tempos do documento e 5% de abandono.
export default function Simulation() {
  const [form, setForm] = useState({ counters: 3, tickets: 150, SP: 20, SE: 30, SG: 50, abandonRate: 5, seed: 42 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function run(event) {
    event.preventDefault();
    setError(null);
    setRunning(true);
    try {
      setResult(
        await api.post('/admin/simulation', {
          counters: Number(form.counters),
          tickets: Number(form.tickets),
          mix: { SP: Number(form.SP), SE: Number(form.SE), SG: Number(form.SG) },
          abandonRate: Number(form.abandonRate),
          seed: Number(form.seed),
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const rows = result
    ? Object.entries(result.byType).map(([tipo, r]) => ({ key: tipo, tipo, ...r }))
    : [];

  return (
    <>
      <section className="card">
        <h2>Parâmetros</h2>
        <p className="muted">
          Tempos do documento: SG 5 ± 3 min, SP 15 ± 5 min, SE 1 min (95%) ou 5 min (5%). Chegadas distribuídas ao longo do
          expediente (7h–17h), usando a mesma regra de prioridade do atendimento real. Não altera nenhum dado.
        </p>
        <Alert>{error}</Alert>
        <form onSubmit={run}>
          <div className="form-row">
            <Field id="s-counters" label="Guichês">
              <input id="s-counters" type="number" min={1} max={50} value={form.counters} onChange={update('counters')} />
            </Field>
            <Field id="s-tickets" label="Senhas no dia">
              <input id="s-tickets" type="number" min={1} max={2997} value={form.tickets} onChange={update('tickets')} />
            </Field>
            <Field id="s-sp" label="% SP">
              <input id="s-sp" type="number" min={0} max={100} value={form.SP} onChange={update('SP')} />
            </Field>
            <Field id="s-se" label="% SE">
              <input id="s-se" type="number" min={0} max={100} value={form.SE} onChange={update('SE')} />
            </Field>
            <Field id="s-sg" label="% SG">
              <input id="s-sg" type="number" min={0} max={100} value={form.SG} onChange={update('SG')} />
            </Field>
            <Field id="s-abandon" label="% abandono">
              <input id="s-abandon" type="number" min={0} max={100} value={form.abandonRate} onChange={update('abandonRate')} />
            </Field>
            <Field id="s-seed" label="Semente">
              <input id="s-seed" type="number" value={form.seed} onChange={update('seed')} />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={running}>
              {running ? 'Simulando…' : 'Simular dia'}
            </button>
          </div>
        </form>
      </section>

      {result && (
        <>
          <div className="stats">
            <StatCard label="Emitidas" value={result.total.emitidas} />
            <StatCard label="Atendidas" value={result.total.atendidas} />
            <StatCard label="Não compareceram" value={result.total.naoCompareceu} />
            <StatCard label="Descartadas às 17h" value={result.total.descartadas} />
            <StatCard label="Espera média" value={minutes(result.total.esperaMediaMin)} />
            <StatCard label="TM geral" value={minutes(result.total.tmMin)} />
          </div>
          <div className="grid-2">
            <section className="card">
              <h2>Por tipo</h2>
              <DataTable
                columns={[
                  { key: 'tipo', label: 'Tipo', text: (r) => r.tipo },
                  { key: 'emitidas', label: 'Emitidas', num: true, text: (r) => String(r.emitidas) },
                  { key: 'atendidas', label: 'Atendidas', num: true, text: (r) => String(r.atendidas) },
                  { key: 'naoCompareceu', label: 'Não comp.', num: true, text: (r) => String(r.naoCompareceu) },
                  { key: 'descartadas', label: 'Descart.', num: true, text: (r) => String(r.descartadas) },
                  { key: 'espera', label: 'Espera', num: true, text: (r) => minutes(r.esperaMediaMin) },
                  { key: 'tm', label: 'TM', num: true, text: (r) => minutes(r.tmMin) },
                ]}
                rows={rows}
              />
            </section>
            <section className="card">
              <h2>Atendimentos por hora</h2>
              <Bars
                items={result.perHour.map((h) => ({ ...h, label: `${String(h.hora).padStart(2, '0')}h` }))}
                labelKey="label"
                valueKey="atendimentos"
              />
            </section>
            <section className="card">
              <h2>Guichês</h2>
              <DataTable
                columns={[
                  { key: 'guiche', label: 'Guichê', text: (r) => String(r.guiche) },
                  { key: 'atendimentos', label: 'Atendimentos', num: true, text: (r) => String(r.atendimentos) },
                  { key: 'ocupacao', label: 'Ocupação', num: true, text: (r) => `${String(r.ocupacaoPct).replace('.', ',')}%` },
                ]}
                rows={result.counters.map((c) => ({ ...c, key: c.guiche }))}
              />
            </section>
            <section className="card">
              <h2>Primeiras chamadas do dia</h2>
              <p className="mono" style={{ lineHeight: 2 }}>
                {result.sequence.join(' → ')}
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
