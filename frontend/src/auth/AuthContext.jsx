import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.get('/api/auth/me').catch(() => null);
      setUser(u?.user || null);
    } catch {
      setUser(null);
    }
    try {
      const a = await api.get('/api/admin/auth/me').catch(() => null);
      setAdmin(a?.admin || null);
    } catch {
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const loginUser = async (identifier, password) => {
    const data = await api.post('/api/auth/login', { identifier, password });
    setUser(data.user);
    return data;
  };

  const logoutUser = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  const loginAdmin = async (email, password) => {
    const data = await api.post('/api/admin/auth/login', { email, password });
    setAdmin(data.admin);
    return data;
  };

  const logoutAdmin = async () => {
    await api.post('/api/admin/auth/logout');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, admin, loading, refresh, loginUser, logoutUser, loginAdmin, logoutAdmin }}
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
