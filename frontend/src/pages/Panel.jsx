import { useEffect, useRef, useState } from 'react';
import { ConnectionBanner, TypeBadge } from '../components/ui.jsx';
import { useInterval } from '../hooks/useInterval.js';
import { useServerConfig } from '../hooks/useServerConfig.js';
import { api, API_BASE } from '../services/api.js';
import { formatDate, formatTime } from '../services/format.js';
import { announcementText, chime, speak } from '../services/speech.js';
import '../styles/panel.css';

const CACHE_KEY = 'nassauTickets.panel.calls';

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeCache(calls) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(calls));
  } catch {
    // armazenamento indisponível: o painel continua funcionando só em memória
  }
}

/**
 * Painel de chamadas: 5 últimas senhas com o guichê (RF-21), sem a próxima da fila (RF-22),
 * atualizado em tempo real por SSE (RF-23) e com áudio em cada chamada (RF-24).
 * Se o backend cair, mantém as últimas senhas e mostra aviso (RNF-13).
 */
export default function Panel() {
  useServerConfig();
  const [calls, setCalls] = useState(readCache);
  const [online, setOnline] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const soundRef = useRef(false);
  const audioCtx = useRef(null);

  useInterval(() => setNow(new Date()), 1000);

  function applyCalls(list) {
    setCalls(list);
    writeCache(list);
  }

  function announce(call) {
    setFlashKey((k) => k + 1);
    if (!soundRef.current) return;
    chime(audioCtx.current);
    setTimeout(() => speak(announcementText(call)), 800);
  }

  useEffect(() => {
    let source;
    let retryTimer;
    let closed = false;

    async function syncList() {
      try {
        applyCalls(await api.get('/panel/calls'));
        setOnline(true);
      } catch {
        setOnline(false);
      }
    }

    function connect() {
      source = new EventSource(`${API_BASE}/panel/stream`);
      source.onopen = () => {
        setOnline(true);
        syncList();
      };
      source.addEventListener('call', (event) => {
        const payload = JSON.parse(event.data);
        applyCalls(payload.calls);
        const call = payload.calls.find((c) => c.number === payload.number);
        if (call) announce(call);
      });
      source.onerror = () => {
        setOnline(false);
        // O EventSource reconecta sozinho; se ele desistir (CLOSED), recriamos.
        if (source.readyState === EventSource.CLOSED && !closed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    syncList();
    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  // Reforço: se o SSE estiver fora, tenta ressincronizar a lista periodicamente.
  useInterval(
    async () => {
      try {
        applyCalls(await api.get('/panel/calls'));
        setOnline(true);
      } catch {
        setOnline(false);
      }
    },
    online ? null : 5000,
  );

  function enableSound() {
    try {
      audioCtx.current ??= new AudioContext();
      audioCtx.current.resume();
    } catch {
      // sem Web Audio: segue apenas com a voz
    }
    soundRef.current = true;
    setSoundOn(true);
    speak('Som do painel ativado.');
  }

  const [current, ...previous] = calls;

  return (
    <main className="panel">
      <ConnectionBanner
        offline={!online}
        message="Sistema temporariamente indisponível. As últimas chamadas continuam na tela; reconectando…"
      />
      <header className="panel-header">
        <div className="panel-brand">
          <span className="brand-mark" aria-hidden="true">
            nT
          </span>
          <span>Laboratório de Análises Clínicas</span>
        </div>
        <div className="panel-clock" aria-label="Horário atual">
          <strong>{formatTime(now).slice(0, 5)}</strong>
          <span>{formatDate(now)}</span>
        </div>
        {!soundOn && (
          <button type="button" className="btn btn-accent" onClick={enableSound}>
            Ativar som das chamadas
          </button>
        )}
      </header>

      <section className="panel-current" aria-live="assertive" aria-atomic="true">
        {current ? (
          <div key={flashKey} className={`panel-current-card t-${current.type} flash`}>
            {current.lastCall && <p className="panel-last-call">Última chamada</p>}
            <p className="panel-label">Senha</p>
            <p className="panel-number">
              {current.type}
              {String(current.seq).padStart(3, '0')}
            </p>
            <p className="panel-type">{current.typeLabel}</p>
            <div className="panel-counter">
              <span className="panel-label">Dirija-se ao</span>
              <strong>{current.counterName}</strong>
            </div>
            <p className="sr-only">{announcementText(current)}</p>
          </div>
        ) : (
          <div className="panel-current-card panel-empty">
            <p className="panel-type">Aguardando a primeira chamada do dia</p>
          </div>
        )}
      </section>

      <section className="panel-history" aria-label="Chamadas anteriores">
        <h2>Últimas chamadas</h2>
        <ol>
          {previous.map((call) => (
            <li key={call.number}>
              <TypeBadge type={call.type} />
              <span className="panel-history-number">
                {call.type}
                {String(call.seq).padStart(3, '0')}
              </span>
              <span className="panel-history-counter">{call.counterName}</span>
            </li>
          ))}
          {previous.length === 0 && <li className="panel-history-empty">—</li>}
        </ol>
      </section>
    </main>
  );
}
