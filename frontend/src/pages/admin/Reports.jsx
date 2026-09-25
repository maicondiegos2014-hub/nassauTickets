import { useEffect, useState } from 'react';
import PeriodFilter, { initialPeriod, periodLabel, periodParams } from '../../components/PeriodFilter.jsx';
import { Alert, DataTable } from '../../components/ui.jsx';
import { useReport } from '../../hooks/useReport.js';
import { api } from '../../services/api.js';
import { downloadCsv, printPdf } from '../../services/exporters.js';
import { formatDateTime } from '../../services/format.js';
import { buildSections, REPORTS, sectionToCsv } from './reportDefinitions.js';

// RF-27 a RF-32: relatórios do gestor, com exportação em PDF e planilha.
export default function Reports() {
  const [reportName, setReportName] = useState('summary');
  const [period, setPeriod] = useState(initialPeriod);
  const [filters, setFilters] = useState({ userId: '', counterId: '' });
  const [users, setUsers] = useState([]);
  const [counters, setCounters] = useState([]);
  const report = REPORTS.find((r) => r.name === reportName);

  useEffect(() => {
    api.get('/admin/users').then(setUsers).catch(() => {});
    api.get('/admin/counters').then(setCounters).catch(() => {});
  }, []);

  const params = { ...periodParams(period), ...(report.filters ? filters : {}) };
  const { data, error, loading } = useReport(reportName, params);
  const sections = buildSections(reportName, data);

  const subtitle = [
    periodLabel(period),
    report.filters && filters.userId && `Usuário: ${users.find((u) => String(u.id) === filters.userId)?.fullName}`,
    report.filters && filters.counterId && `Guichê: ${counters.find((c) => String(c.id) === filters.counterId)?.name}`,
  ]
    .filter(Boolean)
    .join(' · ');

  function logExport(format) {
    api.post(`/reports/${reportName}/exports`, { format, filters: params }).catch(() => {});
  }

  function exportCsv() {
    logExport('csv');
    downloadCsv(
      `nassauTickets-${reportName}-${Object.values(periodParams(period)).join('_')}.csv`,
      sections.map((s) => sectionToCsv(s, `${report.label} · ${subtitle}`)),
    );
  }

  function exportPdf() {
    logExport('pdf');
    printPdf(`nassauTickets - ${report.label} - ${subtitle}`);
  }

  return (
    <>
      <div className="card no-print">
        <div className="form-row">
          <div className="field">
            <label htmlFor="report">Relatório</label>
            <select id="report" value={reportName} onChange={(e) => setReportName(e.target.value)}>
              {REPORTS.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
        {report.filters && (
          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <div className="field">
              <label htmlFor="f-user">{reportName === 'audit' ? 'Atendente' : 'Usuário'}</label>
              <select id="f-user" value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}>
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-counter">Guichê</label>
              <select id="f-counter" value={filters.counterId} onChange={(e) => setFilters((f) => ({ ...f, counterId: e.target.value }))}>
                <option value="">Todos</option>
                {counters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="toolbar" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={exportPdf} disabled={!data || loading}>
            Exportar PDF
          </button>
          <button type="button" className="btn" onClick={exportCsv} disabled={!data || loading}>
            Exportar planilha (CSV)
          </button>
          {loading && (
            <span className="muted" role="status">
              Carregando…
            </span>
          )}
        </div>
      </div>

      <Alert>{error?.message}</Alert>

      <div className="card">
        <div className="print-only">
          <h1>nassauTickets — {report.label}</h1>
          <p>
            {subtitle} · emitido em {formatDateTime(new Date())}
          </p>
        </div>
        <h2 className="no-print">
          {report.label} <span className="muted">· {subtitle}</span>
        </h2>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: '1rem' }}>
            <DataTable
              caption={`${section.title} (${section.rows.length} ${section.rows.length === 1 ? 'linha' : 'linhas'})`}
              columns={section.columns}
              rows={section.rows}
              footer={section.footer}
            />
          </div>
        ))}
      </div>
    </>
  );
}
