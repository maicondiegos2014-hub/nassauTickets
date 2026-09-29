import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader.jsx';
import { Alert, ConnectionBanner, TypeBadge } from '../components/ui.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useInterval } from '../hooks/useInterval.js';
import { useServerConfig } from '../hooks/useServerConfig.js';
import { api, newIdempotencyKey } from '../services/api.js';
import { formatTime, STATUS_LABELS } from '../services/format.js';
import '../styles/terminal.css';

/**
 * Terminal do atendente (RF-12 a RF-19). As ações principais ficam sempre visíveis
 * e cada uma exige 1 clique (RNF-10). O servidor valida cada transição (RF-25).
 */
export default function Terminal() {
  useServerConfig();
  const { counter, refresh } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const callKey = useRef(null);

  const handleError = useCallback(
    (err) => {
      if (err.offline) {
        setOnline(false);
        return;
      }
      if (err.status === 401) {
        refresh().catch(() => {});
        navigate('/login');
        return;
      }
      setMessage({ kind: 'error', text: err.message });
    },
    [navigate, refresh],
  );

  const load = useCallback(async () => {
    try {
      setState(await api.get('/attendance/current'));
      setOnline(true);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    load();
  }, [load]);

  // Atualiza a fila a cada 5 s; se o servidor cair, tenta reconectar a cada 3 s (RNF-13).
  useInterval(load, online ? 5000 : 3000);

  async function run(action) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  const ticket = state?.ticket;

  const callNext = () =>
    run(async () => {
      // A mesma chave é reaproveitada se a resposta se perder, evitando chamada dupla (RNF-06).
      callKey.current ??= newIdempotencyKey();
      try {
        const res = await api.post('/attendance/call-next', undefined, { idempotencyKey: callKey.current });
        callKey.current = null;
        if (!res.ticket) setMessage({ kind: 'warn', text: 'Não há senhas aguardando no momento.' });
      } catch (err) {
        if (!err.offline) callKey.current = null;
        throw err;
      }
    });

  const act = (path, text) =>
    run(async () => {
      await api.post(`/attendance/tickets/${ticket.id}/${path}`);
      if (text) setMessage({ kind: 'ok', text });
    });

  // RF-18: após duas chamadas sem comparecimento, marca e já segue para a próxima.
  const noShowAndNext = () =>
    run(async () => {
      await api.post(`/attendance/tickets/${ticket.id}/no-show`);
      if (!state.callsOpen) return;
      callKey.current = newIdempotencyKey();
      const res = await api.post('/attendance/call-next', undefined, { idempotencyKey: callKey.current });
      callKey.current = null;
      setMessage(
        res.ticket
          ? { kind: 'ok', text: `Senha anterior marcada como não compareceu. Chamando ${res.ticket.number}.` }
          : { kind: 'warn', text: 'Senha marcada como não compareceu. Não há outras senhas aguardando.' },
      );
    });

  if (!counter) {
    return (
      <>
        <AppHeader />
        <main className="page">
          <div className="card">
            <h1>Atendimento</h1>
            <p>Você entrou sem guichê. Para atender, saia e entre novamente escolhendo o guichê.</p>
            <Link className="btn" to="/gestor">
              Ir para a gestão
            </Link>
          </div>
        </main>
      </>
    );
  }

  const status = ticket?.status;
  const disabled = busy || !online || !state;
  const canCall = !ticket && state?.callsOpen;

  return (
    <>
      <ConnectionBanner offline={!online} message="Sem conexão com o servidor. As ações estão bloqueadas; reconectando automaticamente…" />
      <AppHeader />
      <main className="page terminal" id="conteudo">
        <div className="page-title">
          <h1>Atendimento · {counter.name}</h1>
          {state && (
            <p className="muted" style={{ margin: 0 }}>
              Expediente de chamadas: {state.hours.start}h às {state.hours.end}h
            </p>
          )}
        </div>

        {state && !state.callsOpen && !ticket && (
          <Alert kind="warn">
            Fora do expediente de chamadas ({state.hours.start}h às {state.hours.end}h). O botão “Chamar próxima” está bloqueado.
          </Alert>
        )}
        {message && <Alert kind={message.kind}>{message.text}</Alert>}

        <div className="terminal-grid">
          <section className="card terminal-current" aria-live="polite" aria-labelledby="current-title">
            <h2 id="current-title">Senha no guichê</h2>
            {ticket ? (
              <>
                <div className="terminal-ticket">
                  <TypeBadge type={ticket.type} label={ticket.typeLabel} />
                  <p className="terminal-number mono">{ticket.number}</p>
                  <p className={`terminal-status s-${status}`}>{STATUS_LABELS[status]}</p>
                </div>
                <dl className="terminal-times">
                  <div>
                    <dt>1ª chamada</dt>
                    <dd>{formatTime(ticket.firstCallAt) || '—'}</dd>
                  </div>
                  <div>
                    <dt>2ª chamada</dt>
                    <dd>{formatTime(ticket.secondCallAt) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Início</dt>
                    <dd>{formatTime(ticket.startedAt) || '—'}</dd>
                  </div>
                </dl>
                {status === 'CHAMADA_NOVAMENTE' && (
                  <p className="muted">Se o cliente não comparecer após esta segunda chamada, marque “Não compareceu”.</p>
                )}
              </>
            ) : (
              <p className="terminal-free">Guichê livre. Chame a próxima senha.</p>
            )}
          </section>

          <section className="card terminal-actions" aria-label="Ações do atendimento">
            <button type="button" className="btn btn-primary terminal-btn" onClick={callNext} disabled={disabled || !canCall}>
              Chamar próxima
            </button>
            <button
              type="button"
              className="btn terminal-btn"
              onClick={() => act('recall', 'Senha chamada novamente (última chamada).')}
              disabled={disabled || status !== 'CHAMADA'}
            >
              Chamar novamente
            </button>
            <button
              type="button"
              className="btn btn-accent terminal-btn"
              onClick={() => act('start')}
              disabled={disabled || !['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(status)}
            >
              Iniciar atendimento
            </button>
            <button
              type="button"
              className="btn terminal-btn terminal-finish"
              onClick={() => act('finish', 'Atendimento encerrado. Guichê livre.')}
              disabled={disabled || status !== 'EM_ATENDIMENTO'}
            >
              Encerrar atendimento
            </button>
            <button
              type="button"
              className="btn btn-danger terminal-btn"
              onClick={noShowAndNext}
              disabled={disabled || status !== 'CHAMADA_NOVAMENTE'}
            >
              Não compareceu → próxima
            </button>
          </section>
        </div>

        {state && (
          <section className="card" aria-labelledby="queue-title">
            <h2 id="queue-title">Senhas aguardando</h2>
            <p className="muted">Apenas a quantidade por tipo. A ordem de chamada é decidida pelo sistema.</p>
            <div className="terminal-queue">
              {['SP', 'SE', 'SG'].map((type) => (
                <div key={type} className="stat">
                  <div className="label">
                    <TypeBadge type={type} />
                  </div>
                  <div className="value">{state.waiting[type]}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
