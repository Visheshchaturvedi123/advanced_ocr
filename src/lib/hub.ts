export const DEFAULT_HUB_URL = 'http://127.0.0.1:47821';
export const HUB_URL_STORAGE_KEY = 'brahma-hub-url';
export const HUB_TOKEN_STORAGE_KEY = 'brahma-hub-token';

export interface HubHealth {
  status: string;
  service: string;
  version: string;
  port: number;
  capabilities: string[];
}

export interface HubCheckResult {
  ok: boolean;
  status?: number;
  health?: HubHealth;
  error?: string;
}

export const getHubUrl = (): string => {
  try {
    const saved = localStorage.getItem(HUB_URL_STORAGE_KEY)?.trim();
    if (saved) return saved.replace(/\/+$/, '');
  } catch {}
  return DEFAULT_HUB_URL;
};

export const saveHubUrl = (url: string) => {
  const clean = (url.trim() || DEFAULT_HUB_URL).replace(/\/+$/, '');
  try {
    localStorage.setItem(HUB_URL_STORAGE_KEY, clean);
  } catch {}
  return clean;
};

export const getHubToken = (): string => {
  try {
    return localStorage.getItem(HUB_TOKEN_STORAGE_KEY)?.trim() || '';
  } catch {}
  return '';
};

export const saveHubToken = (token: string) => {
  const clean = token.trim();
  try {
    if (clean) localStorage.setItem(HUB_TOKEN_STORAGE_KEY, clean);
    else localStorage.removeItem(HUB_TOKEN_STORAGE_KEY);
  } catch {}
  return clean;
};

export const clearHubConfig = () => {
  try {
    localStorage.removeItem(HUB_TOKEN_STORAGE_KEY);
    localStorage.removeItem(HUB_URL_STORAGE_KEY);
  } catch {}
};

export const hubUrl = (path: string, options?: { token?: boolean }) => {
  const base = getHubUrl();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!options?.token) return `${base}${suffix}`;
  const token = getHubToken();
  if (!token) return `${base}${suffix}`;
  const separator = suffix.includes('?') ? '&' : '?';
  return `${base}${suffix}${separator}token=${encodeURIComponent(token)}`;
};

export const hubFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getHubToken();
  if (token) headers.set('X-Brahma-Token', token);
  return fetch(hubUrl(path), { ...init, headers });
};

export const checkHub = async (): Promise<HubCheckResult> => {
  const token = getHubToken();
  if (!token) {
    return { ok: false, error: 'Add the Hub token from hub\\data\\hub-token.txt.' };
  }
  try {
    const response = await hubFetch('/api/hub/health', { method: 'GET' });
    if (response.status === 401) {
      return { ok: false, status: 401, error: 'Hub token is incorrect. Copy it again from hub\\data\\hub-token.txt.' };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, error: `Hub returned HTTP ${response.status}.` };
    }
    const health = (await response.json()) as HubHealth;
    return { ok: true, status: response.status, health };
  } catch (err: any) {
    return {
      ok: false,
      error: 'Hub is not running. Start hub\\start-brahma-hub.bat and try again.',
    };
  }
};
