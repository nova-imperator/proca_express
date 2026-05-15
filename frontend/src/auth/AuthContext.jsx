import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [config, setConfig] = useState({ recaptcha_site_key: null });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [u, a] = await Promise.all([
      api.get('/api/auth/me').catch(() => null),
      api.get('/api/admin/auth/me').catch(() => null),
    ]);
    setUser(u?.user || null);
    setAdmin(a?.admin || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.get('/api/config');
        setConfig(cfg || { recaptcha_site_key: null });
      } catch { /* leave defaults */ }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const loginUser = async (identifier, password, recaptcha_token) => {
    const data = await api.post('/api/auth/login', { identifier, password, recaptcha_token });
    setUser(data.user);
    return data;
  };

  const logoutUser = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  const loginAdmin = async (email, password, recaptcha_token) => {
    const data = await api.post('/api/admin/auth/login', { email, password, recaptcha_token });
    setAdmin(data.admin);
    return data;
  };

  const logoutAdmin = async () => {
    await api.post('/api/admin/auth/logout');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user, admin, loading, config,
        refresh, loginUser, logoutUser, loginAdmin, logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
