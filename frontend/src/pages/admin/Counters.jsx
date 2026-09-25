import { useEffect, useState } from 'react';
import { Alert, DataTable, Field } from '../../components/ui.jsx';
import { api } from '../../services/api.js';

// RF-06: o gestor cadastra, edita e desativa guichês. Guichê desativado mantém o histórico.
export default function Counters() {
  const [counters, setCounters] = useState([]);
  const [form, setForm] = useState({ number: '', name: '' });
  const [editing, setEditing] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function load() {
    try {
      setCounters(await api.get('/admin/counters'));
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      await api.post('/admin/counters', { number: Number(form.number), name: form.name || undefined });
      setForm({ number: '', name: '' });
      setFeedback({ kind: 'ok', text: 'Guichê cadastrado.' });
      load();
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  async function save(event) {
    event.preventDefault();
    try {
      await api.patch(`/admin/counters/${editing.id}`, { number: Number(editing.number), name: editing.name });
      setEditing(null);
      setFeedback({ kind: 'ok', text: 'Guichê atualizado.' });
      load();
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  async function toggle(counter) {
    try {
      await api.patch(`/admin/counters/${counter.id}`, { active: !counter.active });
      setFeedback({ kind: 'ok', text: `${counter.name} ${counter.active ? 'desativado' : 'reativado'}.` });
      load();
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  const columns = [
    { key: 'number', label: 'Número', num: true, text: (c) => String(c.number) },
    { key: 'name', label: 'Nome', text: (c) => c.name },
    { key: 'active', label: 'Situação', text: (c) => (c.active ? 'Ativo' : 'Desativado') },
    {
      key: 'actions',
      label: 'Ações',
      render: (c) => (
        <div className="toolbar">
          <button type="button" className="btn btn-sm" onClick={() => setEditing({ ...c })}>
            Editar
          </button>
          <button type="button" className={`btn btn-sm ${c.active ? 'btn-danger' : ''}`} onClick={() => toggle(c)}>
            {c.active ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}
      <section className="card">
        <h2>{editing ? `Editar ${editing.name}` : 'Novo guichê'}</h2>
        {editing ? (
          <form onSubmit={save}>
            <div className="form-row">
              <Field id="e-number" label="Número (usado no áudio)">
                <input
                  id="e-number"
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={editing.number}
                  onChange={(e) => setEditing((c) => ({ ...c, number: e.target.value }))}
                />
              </Field>
              <Field id="e-name" label="Nome exibido no painel">
                <input id="e-name" required maxLength={60} value={editing.name} onChange={(e) => setEditing((c) => ({ ...c, name: e.target.value }))} />
              </Field>
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={create}>
            <div className="form-row">
              <Field id="c-number" label="Número (usado no áudio)">
                <input id="c-number" type="number" min={1} max={999} required value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
              </Field>
              <Field id="c-name" label="Nome exibido no painel (opcional)">
                <input id="c-name" maxLength={60} placeholder="Guichê N" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <button type="submit" className="btn btn-primary">
                Cadastrar
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="card">
        <h2>Guichês</h2>
        <DataTable columns={columns} rows={counters} emptyText="Nenhum guichê cadastrado." />
      </section>
    </>
  );
}
