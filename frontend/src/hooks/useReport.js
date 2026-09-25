import { useCallback, useEffect, useState } from 'react';
import { api, toQuery } from '../services/api.js';

/** Busca um relatório do gestor sempre que os filtros mudarem. */
export function useReport(name, filters) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const query = toQuery(filters);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);
      try {
        setData(await api.get(`/reports/${name}${query}`, { signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setError(err);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [name, query],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, error, loading, reload: () => load() };
}
