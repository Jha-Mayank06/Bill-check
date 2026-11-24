import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { clearToken, getToken, setToken } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await clearToken();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
          const { user: me } = await api.me();
          setUser(me);
        }
      } catch {
        await logout();
      } finally {
        setLoading(false);
      }
    })();
  }, [logout]);

  const login = useCallback(async (empId, password) => {
    const { token, user: me } = await api.login(empId.trim(), password);
    setAuthToken(token);
    await setToken(token);
    setUser(me);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
