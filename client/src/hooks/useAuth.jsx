import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.me().then((r) => setUser(r.user)).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  const value = useMemo(() => ({
    user,
    loading,
    logout,
    async login(credentials) {
      const r = await api.login(credentials);
      tokenStore.set(r.token);
      setUser(r.user);
    },
    async signup(data) {
      const r = await api.signup(data);
      tokenStore.set(r.token);
      setUser(r.user);
    },
  }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
