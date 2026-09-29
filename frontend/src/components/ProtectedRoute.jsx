import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Esconde telas de quem não tem acesso. É só conforto de navegação:
 * a proteção real está no servidor (RNF-01).
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p className="page muted" role="status">
        Carregando…
      </p>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/atendimento" replace />;
  return children;
}
