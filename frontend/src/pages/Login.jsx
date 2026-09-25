import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../components/AppHeader.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';

// RF-01: login com usuário e senha, vinculando o atendente ao guichê.
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [counters, setCounters] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', counterId: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get('/counters')
      .then(setCounters)
      .catch((err) => setError(err.message));
  }, []);

  if (user) return <Navigate to={user.mustChangePassword ? '/trocar-senha' : user.role === 'GESTOR' ? '/gestor' : '/atendimento'} replace />;

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(form);
      if (me.user.mustChangePassword) navigate('/trocar-senha');
      else navigate(form.counterId ? '/atendimento' : '/gestor');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card card">
        <p>
          <Brand />
        </p>
        <h1>Entrar</h1>
        <p className="muted">Acesso exclusivo para atendentes e gestor. Os logins são criados pelo gestor.</p>
        <Alert>{error}</Alert>
        <form onSubmit={handleSubmit} noValidate>
          <Field id="username" label="Usuário">
            <input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={form.username}
              onChange={update('username')}
            />
          </Field>
          <Field id="password" label="Senha">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={update('password')}
            />
          </Field>
          <Field id="counter" label="Guichê" hint="Obrigatório para atender. O gestor pode entrar sem guichê só para a gestão.">
            <select id="counter" value={form.counterId} onChange={update('counterId')} aria-describedby="counter-hint">
              <option value="">Sem guichê (apenas gestão)</option>
              {counters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
