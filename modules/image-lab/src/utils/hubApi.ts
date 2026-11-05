const DEFAULT_HUB_URL = 'http://127.0.0.1:47821';
const HUB_URL_KEY = 'brahma-hub-url';
const HUB_TOKEN_KEY = 'brahma-hub-token';

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

export const getHubBaseUrl = () => {
  const configured = readStorage(HUB_URL_KEY).trim();
  if (configured) return configured.replace(/\/+$/, '');
  try {
    if (window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }
  } catch {}
  return DEFAULT_HUB_URL;
};

export const getHubToken = () => readStorage(HUB_TOKEN_KEY).trim();

export const hubUrl = (path: string, options?: { token?: boolean }) => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const base = `${getHubBaseUrl()}${suffix}`;
  if (!options?.token) return base;
  const token = getHubToken();
  if (!token) return base;
  const separator = suffix.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
};

export const hubFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getHubToken();
  if (token) headers.set('X-Brahma-Token', token);
  return fetch(hubUrl(path), { ...init, headers });
};

export const hubAssetUrl = (path: string) => hubUrl(path, { token: true });
