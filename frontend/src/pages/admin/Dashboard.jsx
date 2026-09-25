import { useState } from 'react';
import PeriodFilter, { initialPeriod, periodLabel, periodParams } from '../../components/PeriodFilter.jsx';
import { Alert, Bars, DataTable, StatCard } from '../../components/ui.jsx';
import { useInterval } from '../../hooks/useInterval.js';
import { useReport } from '../../hooks/useReport.js';
import { formatDuration, formatPercent } from '../../services/format.js';

const TM_COLUMNS = [
  { key: 'nome', label: 'Nome', text: (r) => r.nome },
  { key: 'atendimentos', label: 'Atendimentos', num: true, text: (r) => String(r.atendimentos) },
  { key: 'tm', label: 'TM', num: true, text: (r) => formatDuration(r.tmSegundos) },
];

// RF-33: indicadores de desempenho (espera, TM por atendente e guichê, não comparecimento, atendimentos por hora).
export default function Dashboard() {
  const [period, setPeriod] = useState(initialPeriod);
  const { data, error, loading, reload } = useReport('dashboard', periodParams(period));
  useInterval(reload, period.period === 'day' ? 60_000 : null);

  return (
    <>
      <div className="card no-print">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>
      <Alert>{error?.message}</Alert>
      {loading && !data && (
        <p className="muted" role="status">
          Carregando…
        </p>
      )}
      {data && (
        <>
          <h2>
            Indicadores · <span className="muted">{periodLabel(period)}</span>
          </h2>
          <div className="stats">
            <StatCard label="Senhas emitidas" value={data.emitidas} />
            <StatCard label="Atendidas" value={data.atendidas} />
            <StatCard label="Espera média" value={formatDuration(data.esperaMediaSegundos)} sub="da emissão à 1ª chamada" />
            <StatCard label="TM geral" value={formatDuration(data.tmGeralSegundos)} sub="do início ao fim do atendimento" />
            <StatCard
              label="Não comparecimento"
              value={formatPercent(data.taxaNaoComparecimento)}
              sub={`${data.naoCompareceu} de ${data.chamadas} senhas chamadas`}
            />
          </div>

          <div className="grid-2">
            <section className="card">
              <h2>Espera média por tipo</h2>
              <Bars
                items={data.esperaPorTipo.map((t) => ({ ...t, label: t.tipo }))}
                labelKey="label"
                valueKey="esperaMediaSegundos"
                format={formatDuration}
              />
            </section>
            <section className="card">
              <h2>Atendimentos por hora</h2>
              <Bars
                items={data.porHora.map((h) => ({ ...h, label: `${String(h.hora).padStart(2, '0')}h` }))}
                labelKey="label"
                valueKey="atendimentos"
              />
            </section>
            <section className="card">
              <h2>TM por atendente</h2>
              <DataTable columns={TM_COLUMNS} rows={data.porAtendente.map((r) => ({ ...r, key: r.nome }))} emptyText="Sem atendimentos no período." />
            </section>
            <section className="card">
              <h2>TM por guichê</h2>
              <DataTable columns={TM_COLUMNS} rows={data.porGuiche.map((r) => ({ ...r, key: r.nome }))} emptyText="Sem atendimentos no período." />
            </section>
          </div>
        </>
      )}
    </>
  );
}
