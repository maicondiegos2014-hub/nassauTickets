import { useEffect, useState } from 'react';
import { Alert, DataTable, Field } from '../../components/ui.jsx';
import { api } from '../../services/api.js';

const STATUS_OPTIONS = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'BLOQUEADO', label: 'Bloqueado' },
  { value: 'INATIVO', label: 'Desativado' },
];

const EMPTY = { username: '', fullName: '', password: '' };

// RF-04 / RF-05: o gestor cria os logins e ativa, bloqueia ou desativa atendentes.
export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [feedback, setFeedback] = useState(null);
  const [resetting, setResetting] = useState(null);

  async function load() {
    try {
      setUsers(await api.get('/admin/users'));
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function create(event) {
    event.preventDefault();
    try {
      const user = await api.post('/admin/users', form);
      setForm(EMPTY);
      setFeedback({ kind: 'ok', text: `Login "${user.username}" criado. A senha provisória deve ser trocada no primeiro acesso.` });
      load();
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  async function changeStatus(user, status) {
    try {
      await api.patch(`/admin/users/${user.id}`, { status });
      setFeedback({ kind: 'ok', text: `${user.fullName}: situação alterada para ${STATUS_OPTIONS.find((s) => s.value === status).label}.` });
      load();
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  async function resetPassword(event, user) {
    event.preventDefault();
    try {
      await api.post(`/admin/users/${user.id}/password`, { password: resetting.password });
      setResetting(null);
      setFeedback({ kind: 'ok', text: `Senha provisória definida para ${user.fullName}. Ela deve ser trocada no próximo acesso.` });
    } catch (err) {
      setFeedback({ kind: 'error', text: err.message });
    }
  }

  const columns = [
    { key: 'fullName', label: 'Nome', text: (u) => u.fullName },
    { key: 'username', label: 'Usuário', mono: true, text: (u) => u.username },
    { key: 'role', label: 'Perfil', text: (u) => (u.role === 'GESTOR' ? 'Gestor' : 'Atendente') },
    {
      key: 'status',
      label: 'Situação',
      render: (u) =>
        u.role === 'GESTOR' ? (
          'Ativo'
        ) : (
          <select aria-label={`Situação de ${u.fullName}`} value={u.status} onChange={(e) => changeStatus(u, e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (u) =>
        resetting?.id === u.id ? (
          <form className="toolbar" onSubmit={(e) => resetPassword(e, u)}>
            <input
              type="password"
              aria-label={`Senha provisória para ${u.fullName}`}
              placeholder="Senha provisória"
              minLength={8}
              required
              autoFocus
              autoComplete="new-password"
              style={{ width: '12rem', minHeight: 36 }}
              value={resetting.password}
              onChange={(e) => setResetting({ id: u.id, password: e.target.value })}
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Salvar
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setResetting(null)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setResetting({ id: u.id, password: '' })}>
            Redefinir senha
          </button>
        ),
    },
  ];

  return (
    <>
      {feedback && <Alert kind={feedback.kind}>{feedback.text}</Alert>}
      <section className="card">
        <h2>Novo atendente</h2>
        <form onSubmit={create}>
          <div className="form-row">
            <Field id="u-name" label="Nome completo">
              <input id="u-name" required maxLength={120} value={form.fullName} onChange={update('fullName')} />
            </Field>
            <Field id="u-login" label="Usuário">
              <input
                id="u-login"
                required
                pattern="[a-z0-9._\-]{3,40}"
                autoCapitalize="none"
                value={form.username}
                onChange={update('username')}
              />
            </Field>
            <Field id="u-pass" label="Senha provisória">
              <input id="u-pass" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={update('password')} />
            </Field>
            <button type="submit" className="btn btn-primary">
              Criar login
            </button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Usuário: letras minúsculas, números, ponto, hífen ou sublinhado. Atendentes bloqueados ou desativados não entram,
          mas seu histórico continua nos relatórios.
        </p>
      </section>
      <section className="card">
        <h2>Atendentes</h2>
        <DataTable columns={columns} rows={users} emptyText="Nenhum usuário." />
      </section>
    </>
  );
}
