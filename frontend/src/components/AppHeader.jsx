import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark" aria-hidden="true">
        nT
      </span>
      nassauTickets
    </Link>
  );
}

export default function AppHeader() {
  const { user, counter, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout().catch(() => {});
    navigate('/login');
  }

  return (
    <header className="app-header">
      <Brand to="/atendimento" />
      {user && (
        <nav className="header-meta" aria-label="Conta">
          {counter && <span className="counter-chip">{counter.name}</span>}
          <span className="who">
            {user.fullName} · {user.role === 'GESTOR' ? 'Gestor' : 'Atendente'}
          </span>
          {counter && <Link to="/atendimento">Atendimento</Link>}
          {user.role === 'GESTOR' && <Link to="/gestor">Gestão</Link>}
          <Link to="/trocar-senha">Trocar senha</Link>
          <button type="button" className="btn btn-sm" onClick={handleLogout}>
            Sair
          </button>
        </nav>
      )}
    </header>
  );
}
