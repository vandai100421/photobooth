import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import authService from '../services/authService';
import { TOKEN_KEY } from '../utils/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await authService.me();
      setUser(res?.data?.user ?? null);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password);
    const { token, user: u } = res?.data ?? {};
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    if (u) {
      setUser(u);
    }
    return { token, user: u };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore network error when logging out
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const value = { user, loading, login, logout, reload: loadUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}

export default AuthContext;
