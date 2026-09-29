import { Link } from 'react-router-dom';
import { Brand } from '../components/AppHeader.jsx';
import { useServerConfig } from '../hooks/useServerConfig.js';

const ENTRIES = [
  { to: '/totem', title: 'Totem', text: 'Emissão anônima de senhas SP, SE e SG.' },
  { to: '/painel', title: 'Painel', text: 'Últimas 5 chamadas, com áudio.' },
  { to: '/atendimento', title: 'Atendimento', text: 'Terminal do atendente no guichê.' },
  { to: '/gestor', title: 'Gestão', text: 'Cadastros, relatórios e desempenho.' },
];

export default function Home() {
  const { config, error } = useServerConfig();
  return (
    <main className="home">
      <div className="home-inner">
        <p>
          <Brand />
        </p>
        <h1>Controle de atendimento</h1>
        <p className="muted">
          Laboratório de Análises Clínicas · chamadas das {config?.hours.callStart ?? 7}h às {config?.hours.callEnd ?? 17}h
          {config && (config.callsOpen ? ' · expediente aberto' : ' · fora do expediente')}
        </p>
        {error && (
          <p className="alert alert-error" role="alert">
            Servidor indisponível no momento.
          </p>
        )}
        <div className="home-grid">
          {ENTRIES.map((entry) => (
            <Link key={entry.to} to={entry.to} className="home-card">
              <strong>{entry.title}</strong>
              <span className="muted">{entry.text}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
