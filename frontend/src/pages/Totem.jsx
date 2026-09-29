import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useServerConfig } from '../hooks/useServerConfig.js';
import { api, newIdempotencyKey } from '../services/api.js';
import { formatDateTime } from '../services/format.js';
import { chime, speak, spellDigits } from '../services/speech.js';
import '../styles/totem.css';

// RF-07: o cliente escolhe o tipo, sem informar nenhum dado pessoal (RF-35, RNF-07).
const OPTIONS = [
  { type: 'SP', title: 'Prioritária', text: 'Idosos (60+), gestantes, lactantes, pessoas com deficiência, com criança de colo e demais prioridades legais', icon: '★' },
  { type: 'SE', title: 'Retirada de exames', text: 'Buscar resultados de exames já realizados', icon: '▤' },
  { type: 'SG', title: 'Geral', text: 'Coleta, cadastro e demais atendimentos', icon: '●' },
];

const RETURN_AFTER_MS = 20_000;

export default function Totem() {
  const [params] = useSearchParams();
  const autoPrint = params.get('imprimir') === 'auto';
  const { config } = useServerConfig();
  const [state, setState] = useState({ step: 'choose' });
  const pendingKey = useRef(null);
  const audio = useRef(null);

  function feedback(text) {
    try {
      audio.current ??= new AudioContext();
      chime(audio.current);
    } catch {
      // sem áudio disponível
    }
    speak(text);
  }

  async function emit(option) {
    // Mesma chave em caso de nova tentativa: o servidor não cria senha duplicada (RNF-06).
    pendingKey.current ??= { key: newIdempotencyKey(), type: option.type };
    if (pendingKey.current.type !== option.type) pendingKey.current = { key: newIdempotencyKey(), type: option.type };
    setState({ step: 'loading', option });
    try {
      const ticket = await api.post('/totem/tickets', { type: option.type }, { idempotencyKey: pendingKey.current.key });
      pendingKey.current = null;
      setState({ step: 'done', ticket, option });
      feedback(`Senha ${option.title}, ${spellDigits(ticket.number.slice(-3))}. Aguarde a chamada no painel.`);
    } catch (error) {
      if (error.code === 'FORA_DO_EXPEDIENTE') pendingKey.current = null;
      setState({ step: 'error', option, error });
    }
  }

  useEffect(() => {
    if (state.step !== 'done' && state.step !== 'error') return undefined;
    if (state.step === 'done' && autoPrint) window.print();
    const timer = setTimeout(() => {
      pendingKey.current = null;
      setState({ step: 'choose' });
    }, RETURN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [state.step, autoPrint]);

  const closed = config && !config.issueOpen;

  return (
    <main className="totem" aria-live="polite">
      <header className="totem-header no-print">
        <span className="brand-mark" aria-hidden="true">
          nT
        </span>
        <div>
          <p className="totem-lab">Laboratório de Análises Clínicas</p>
          <h1>Retire sua senha</h1>
        </div>
      </header>

      {state.step === 'choose' && closed && (
        <section className="totem-message no-print">
          <h2>Emissão de senhas encerrada</h2>
          <p>
            O atendimento funciona das {config.hours.issueStart}h às {config.hours.callEnd}h.
          </p>
        </section>
      )}

      {state.step === 'choose' && !closed && (
        <section className="totem-choose no-print" aria-labelledby="totem-question">
          <h2 id="totem-question">Toque no tipo de atendimento</h2>
          <div className="totem-options">
            {OPTIONS.map((option) => (
              <button key={option.type} type="button" className={`totem-option t-${option.type}`} onClick={() => emit(option)}>
                <span className="totem-icon" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="totem-option-title">{option.title}</span>
                <span className="totem-option-text">{option.text}</span>
              </button>
            ))}
          </div>
          <p className="totem-note">Não pedimos nenhum dado pessoal.</p>
        </section>
      )}

      {state.step === 'loading' && (
        <section className="totem-message" role="status">
          <h2>Emitindo sua senha…</h2>
        </section>
      )}

      {state.step === 'error' && (
        <section className="totem-message totem-error no-print" role="alert">
          <h2>{state.error.offline ? 'Totem temporariamente indisponível' : 'Não foi possível emitir a senha'}</h2>
          <p>{state.error.offline ? 'Por favor, procure a recepção para receber uma senha manual.' : state.error.message}</p>
          <div className="totem-actions">
            {state.error.code !== 'FORA_DO_EXPEDIENTE' && (
              <button type="button" className="btn btn-primary totem-big-btn" onClick={() => emit(state.option)}>
                Tentar novamente
              </button>
            )}
            <button type="button" className="btn totem-big-btn" onClick={() => setState({ step: 'choose' })}>
              Voltar
            </button>
          </div>
        </section>
      )}

      {state.step === 'done' && (
        <section className="totem-ticket" aria-labelledby="ticket-title">
          {/* RF-09: comprovante na tela e impresso */}
          <div className="receipt">
            <p className="receipt-lab">nassauTickets · Laboratório de Análises Clínicas</p>
            <h2 id="ticket-title" className="receipt-type">
              Senha {state.ticket.typeLabel}
            </h2>
            <p className="receipt-number" aria-label={`Número da senha ${state.ticket.number}`}>
              {state.ticket.number}
            </p>
            <p className="receipt-seq">
              {state.ticket.type}
              {state.ticket.number.slice(-3)}
            </p>
            <p className="receipt-time">Emitida em {formatDateTime(state.ticket.issuedAt)}</p>
            <p className="receipt-help">Aguarde a chamada no painel. Ela mostra a senha e o guichê.</p>
          </div>
          <div className="totem-actions no-print">
            <button type="button" className="btn btn-accent totem-big-btn" onClick={() => window.print()}>
              Imprimir comprovante
            </button>
            <button type="button" className="btn totem-big-btn" onClick={() => setState({ step: 'choose' })}>
              Concluir
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
