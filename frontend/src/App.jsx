import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Panel from './pages/Panel.jsx';
import Terminal from './pages/Terminal.jsx';
import Totem from './pages/Totem.jsx';

// A área do gestor (com o calendário e suas dependências) só é baixada quando aberta,
// mantendo leves o totem e o painel.
const ManagerLayout = lazy(() => import('./pages/admin/ManagerLayout.jsx'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const Reports = lazy(() => import('./pages/admin/Reports.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const Counters = lazy(() => import('./pages/admin/Counters.jsx'));
const Contingency = lazy(() => import('./pages/admin/Contingency.jsx'));
const Simulation = lazy(() => import('./pages/admin/Simulation.jsx'));

function NotFound() {
  return (
    <main className="page">
      <h1>Página não encontrada</h1>
      <Link to="/">Voltar ao início</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <AuthProvider>
        <Suspense
          fallback={
            <p className="page muted" role="status">
              Carregando…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Totem e painel: sem login, acessam apenas os próprios endpoints (RNF-03) */}
            <Route path="/totem" element={<Totem />} />
            <Route path="/painel" element={<Panel />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/trocar-senha"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atendimento"
              element={
                <ProtectedRoute roles={['ATENDENTE', 'GESTOR']}>
                  <Terminal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestor"
              element={
                <ProtectedRoute roles={['GESTOR']}>
                  <ManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="atendentes" element={<Users />} />
              <Route path="guiches" element={<Counters />} />
              <Route path="contingencia" element={<Contingency />} />
              <Route path="simulacao" element={<Simulation />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
