import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';

// RF-02: o próprio atendente troca a senha, sem precisar do gestor.
export default function ChangePassword() {
  const { user, counter, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    try {
      await api.post('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      await refresh();
      setTimeout(() => navigate(counter ? '/atendimento' : '/gestor'), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="page" id="conteudo">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>Trocar senha</h1>
          {user?.mustChangePassword && (
            <Alert kind="warn">Você está usando uma senha provisória. Crie uma senha pessoal para continuar.</Alert>
          )}
          {done && <Alert kind="ok">Senha alterada com sucesso.</Alert>}
          <Alert>{error}</Alert>
          <form onSubmit={handleSubmit}>
            <Field id="current" label="Senha atual">
              <input id="current" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={update('currentPassword')} />
            </Field>
            <Field id="new" label="Nova senha" hint="De 8 a 72 caracteres, com letras e números.">
              <input
                id="new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                aria-describedby="new-hint"
                value={form.newPassword}
                onChange={update('newPassword')}
              />
            </Field>
            <Field id="confirm" label="Confirme a nova senha">
              <input id="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={update('confirm')} />
            </Field>
            <button type="submit" className="btn btn-primary">
              Salvar nova senha
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
