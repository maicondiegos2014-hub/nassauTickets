import { EventEmitter } from 'node:events';

// Barramento interno: cada chamada publica um evento que o painel recebe por SSE (RF-23, RNF-11).
// Para várias instâncias do backend, troque por um pub/sub (ex.: Redis) — RNF-15.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export const PANEL_CALL = 'panel:call';
