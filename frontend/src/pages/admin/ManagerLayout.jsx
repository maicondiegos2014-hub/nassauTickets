import { NavLink, Outlet } from 'react-router-dom';
import AppHeader from '../../components/AppHeader.jsx';

const TABS = [
  { to: '/gestor', label: 'Desempenho', end: true },
  { to: '/gestor/relatorios', label: 'Relatórios' },
  { to: '/gestor/atendentes', label: 'Atendentes' },
  { to: '/gestor/guiches', label: 'Guichês' },
  { to: '/gestor/contingencia', label: 'Contingência' },
  { to: '/gestor/simulacao', label: 'Simulação' },
];

// Área do gestor: cadastros e relatórios (RF-03). O servidor recusa qualquer outro perfil.
export default function ManagerLayout() {
  return (
    <>
      <AppHeader />
      <main className="page" id="conteudo">
        <div className="page-title no-print">
          <h1>Gestão do atendimento</h1>
        </div>
        <nav className="tabs" aria-label="Seções da gestão">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </main>
    </>
  );
}
