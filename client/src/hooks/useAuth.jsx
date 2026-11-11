import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '@/lib/api';
import { browserTimezone, setTimezone } from '@/lib/dates';
import { DEFAULT_TARGETS } from '@/lib/glucose';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  // Keep the date helpers in step with the user's own timezone.
  const setUser = useCallback((u) => {
    setTimezone(u?.timezone);
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, [setUser]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.me().then((r) => setUser(r.user)).catch(logout).finally(() => setLoading(false));
  }, [logout, setUser]);

  const value = useMemo(() => ({
    user,
    loading,
    logout,
    setUser,
    async login(credentials) {
      const r = await api.login(credentials);
      tokenStore.set(r.token);
      setUser(r.user);
    },
    async signup(data) {
      // The browser's timezone becomes the account's starting timezone (editable in Settings).
      const r = await api.signup({ ...data, timezone: browserTimezone() });
      tokenStore.set(r.token);
      setUser(r.user);
    },
    async refresh() {
      const r = await api.me();
      setUser(r.user);
      return r.user;
    },
  }), [user, loading, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** The signed-in patient's target ranges (falls back to defaults). */
export const useTargets = () => useContext(AuthContext)?.user?.settings ?? DEFAULT_TARGETS;
