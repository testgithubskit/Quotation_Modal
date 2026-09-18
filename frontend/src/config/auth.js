import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

function forceLogout() {
  clearTokens();
  if (typeof unauthorizedHandler === 'function') {
    unauthorizedHandler();
  } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original?._retry) {
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      forceLogout();
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refresh })
          .then((res) => {
            setTokens(res.data);
            return res.data.access_token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const accessToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      forceLogout();
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;
  if (data?.error?.detail && data.error.detail !== 'Request validation failed') {
    return data.error.detail;
  }
  const fieldErrors = data?.error?.errors;
  if (Array.isArray(fieldErrors) && fieldErrors.length) {
    const first = fieldErrors[0];
    const loc = Array.isArray(first.loc) ? first.loc.filter((p) => p !== 'body').join('.') : '';
    const msg = first.msg || first.message || 'Invalid value';
    return loc ? `${loc}: ${msg}` : msg;
  }
  if (typeof data?.detail === 'string') return data.detail;
  if (data?.message) return data.message;
  return error?.message || fallback;
}

export function signup(payload) {
  return api.post('/auth/signup', payload).then((r) => r.data);
}

export function loginRequest(payload) {
  return api.post('/auth/login', payload).then((r) => r.data);
}

export function logoutRequest() {
  return api.post('/auth/logout').then((r) => r.data);
}

export function getMe() {
  return api.get('/auth/me').then((r) => r.data);
}
