import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { setLabTimeZone } from '../services/format.js';
import { useInterval } from './useInterval.js';

/** Parâmetros públicos (fuso, expediente) vindos do servidor — nunca do relógio do navegador. */
export function useServerConfig(refreshMs = 60_000) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const data = await api.get('/config');
      setLabTimeZone(data.timezone);
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useInterval(load, refreshMs);

  return { config, error, reload: load };
}
