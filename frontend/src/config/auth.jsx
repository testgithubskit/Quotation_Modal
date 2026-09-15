import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearTokens,
  getAccessToken,
  getApiErrorMessage,
  getMe,
  loginRequest,
  logoutRequest,
  setTokens,
  signup,
} from './auth.js';

const AuthContext = createContext(null);

export function mapBackendRole(roleName) {
  if (roleName === 'ADMIN') return 'admin';
  if (roleName === 'USER') return 'user';
  return 'supervisor';
}

export function canAccessRoute(user, allowed) {
  if (!user) return false;
  if (!allowed) return true;
  const role = user.role_name;
  if (allowed === 'admin') return role === 'ADMIN';
  if (role === 'ADMIN') return true;
  if (allowed === 'supervisor') return role === 'SUPERVISOR';
  if (allowed === 'user') return role === 'USER';
  return false;
}

export function homePathForUser(user) {
  if (!user) return '/login';
  const role = user.role_name;
  if (role === 'ADMIN') return '/admin';
  if (role === 'USER') return '/user/reports';
  return '/supervisor/activities';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const loadMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return null;
    }
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (getAccessToken()) {
          await loadMe();
        }
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const login = useCallback(async (email, password) => {
    const tokens = await loginRequest({ email, password });
    setTokens(tokens);
    return loadMe();
  }, [loadMe]);

  const registerOrganization = useCallback(async (payload) => {
    const tokens = await signup(payload);
    setTokens(tokens);
    return loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) await logoutRequest();
    } catch {
      // ignore
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      isAuthenticated: Boolean(user),
      role: user ? mapBackendRole(user.role_name) : null,
      login,
      registerOrganization,
      logout,
      getApiErrorMessage,
    }),
    [user, booting, login, registerOrganization, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Re-export for pages that call the API like CMF (import { API_BASE_URL, api } from '../config/auth.js')
export { API_BASE_URL, api, getApiErrorMessage } from './auth.js';
