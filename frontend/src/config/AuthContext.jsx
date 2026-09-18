import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  clearTokens,
  getAccessToken,
  getApiErrorMessage,
  getMe,
  loginRequest,
  logoutRequest,
  setTokens,
  setUnauthorizedHandler,
  signup,
} from './auth.js';

/** logout after 1 hour of no activity */
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

const AuthContext = createContext(null);

export function homePathForUser(user) {
  if (!user) return '/login';
  if (user.role_name === 'USER') return '/user/generate';
  return '/admin';
}

export function canAccessRoute(user, allowed) {
  if (!user) return false;
  if (!allowed) return true;
  const isAdmin = user.role_name === 'ADMIN';
  if (allowed === 'admin') return isAdmin;
  if (isAdmin) return true;
  if (allowed === 'user') return user.role_name === 'USER';
  return false;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const idleTimerRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
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
        if (getAccessToken()) await loadMe();
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
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }
  }, []);

  const logoutToLogin = useCallback(async () => {
    await logout();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens();
      setUser(null);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!userRef.current && !getAccessToken()) return;
    idleTimerRef.current = setTimeout(() => {
      logoutToLogin();
    }, IDLE_TIMEOUT_MS);
  }, [logoutToLogin]);

  useEffect(() => {
    if (!user && !getAccessToken()) return undefined;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const onActivity = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, resetIdleTimer]);

  const value = useMemo(
    () => ({
      user,
      booting,
      isAuthenticated: Boolean(user),
      login,
      registerOrganization,
      logout,
      logoutToLogin,
      refreshMe: loadMe,
      getApiErrorMessage,
    }),
    [user, booting, login, registerOrganization, logout, logoutToLogin, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
