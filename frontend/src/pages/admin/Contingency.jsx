import { useState } from 'react';
import { Alert, DataTable, Field } from '../../components/ui.jsx';
import { api } from '../../services/api.js';
import { formatDateTime, TYPE_LABELS } from '../../services/format.js';

// RNF-14: se o totem falhar, a recepção entrega senhas manuais (papel) e o gestor as
// registra aqui. O sistema gera o número oficial e coloca a senha na fila normalmente.
export default function Contingency() {
  const [form, setForm] = useState({ type: 'SG', manualRef: '' });
  const [registered, setRegistered] = useState([]);
  const [feedback, setFeedback] = useState(null);

  async function submit(event) {
    event.preventDefault();
    try {
      const ticket = await api.post('/admin/contingency', form);
      setRegistered((list) => [{ ...ticket, manualRef: form.manualRef }, ...list]);
      setFeedback({ kind: 'ok', text: `Senha manual "${form.manualRef}" registrada como ${ticket.number}.` });
      setForm((f) => ({ ...f, manualRef: '' }));
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  return (
    <>
      <section className="card">
        <h2>Registrar senha manual</h2>
        <p className="muted">
          Use quando o totem estiver fora do ar. Informe o que está escrito na senha de papel; o sistema gera o número oficial
          (YYMMDD-PPSQ), que deve ser anotado na senha entregue ao cliente.
        </p>
        {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}
        <form onSubmit={submit}>
          <div className="form-row">
            <Field id="k-type" label="Tipo">
              <select id="k-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {['SP', 'SE', 'SG'].map((t) => (
                  <option key={t} value={t}>
                    {t} — {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="k-ref" label="Identificação da senha manual">
              <input id="k-ref" required maxLength={40} placeholder="ex.: M-012" value={form.manualRef} onChange={(e) => setForm((f) => ({ ...f, manualRef: e.target.value }))} />
            </Field>
            <button type="submit" className="btn btn-primary">
              Registrar
            </button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Registradas nesta sessão</h2>
        <DataTable
          columns={[
            { key: 'manualRef', label: 'Senha manual', text: (r) => r.manualRef },
            { key: 'number', label: 'Número oficial', mono: true, text: (r) => r.number },
            { key: 'type', label: 'Tipo', text: (r) => r.typeLabel },
            { key: 'issuedAt', label: 'Registrada em', text: (r) => formatDateTime(r.issuedAt) },
          ]}
          rows={registered.map((r) => ({ ...r, key: r.number }))}
          emptyText="Nenhuma senha manual registrada."
        />
      </section>
    </>
  );
}
