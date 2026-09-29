import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = ainda carregando; null = sem sessão
  const [session, setSession] = useState(undefined);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get('/auth/me');
      setSession(me);
      return me;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        return null;
      }
      // Servidor fora do ar: mantém o estado atual e deixa a tela avisar.
      setSession((current) => (current === undefined ? null : current));
      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const login = useCallback(
    async ({ username, password, counterId }) => {
      await api.post('/auth/login', { username, password, counterId: counterId || null });
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      loading: session === undefined,
      user: session?.user ?? null,
      counter: session?.counter ?? null,
      login,
      logout,
      refresh,
    }),
    [session, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
