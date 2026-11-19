// Centralized HTTP API & URL helper separating Player sessions from Admin sessions.

const LOCAL_DEV_PORTS = new Set([
  '3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009',
  '4173', '5173', '5174', '5175', '5176', '5177', '5178', '5179',
]);

export function resolveServerBaseUrl(): string {
  const meta = document.querySelector('meta[name="anaconda-server"]')?.getAttribute('content')?.trim();
  if (meta && !meta.includes('your-backend.example.com')) return meta.replace(/\/+$/, '');
  const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_SERVER_URL;
  if (envUrl) return String(envUrl).trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const loc = window.location;
    if (LOCAL_DEV_PORTS.has(loc.port)) {
      return `${loc.protocol}//${loc.hostname}:4000`;
    }
    return '';
  }
  return '';
}

export const SERVER_URL = resolveServerBaseUrl();

export function resolveMediaUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/uploads/') && SERVER_URL) return `${SERVER_URL}${url}`;
  return url;
}

export function getPlayerToken(): string | null {
  try { return localStorage.getItem('ap_token'); } catch { return null; }
}

export function setPlayerToken(token: string | null) {
  try {
    if (token) localStorage.setItem('ap_token', token);
    else localStorage.removeItem('ap_token');
  } catch { /* ignore storage restrictions */ }
}

export function getAdminToken(): string | null {
  try { return sessionStorage.getItem('ap_admin_token') || localStorage.getItem('ap_admin_token'); } catch { return null; }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem('ap_admin_token', token);
      localStorage.removeItem('ap_admin_token');
    } else {
      sessionStorage.removeItem('ap_admin_token');
      localStorage.removeItem('ap_admin_token');
    }
  } catch { /* ignore */ }
}

async function rawFetch(url: string, opts: RequestInit = {}, token?: string | null): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (!(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const fullUrl = url.startsWith('http') ? url : `${SERVER_URL}${url}`;
  try {
    const res = await fetch(fullUrl, { ...opts, headers });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err?.message || 'Network unreachable' } };
  }
}

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/admin/',
  '/api/config',
  '/api/shop/catalog',
  '/api/rewards/catalog',
  '/api/events',
  '/api/lobbies',
  '/api/leaderboard',
  '/api/ads/active',
  '/api/ads/impression',
  '/api/ads/click',
];

function requiresPlayerAuth(path: string): boolean {
  return path.startsWith('/api/') && !PUBLIC_API_PREFIXES.some(p => path.startsWith(p));
}

let pendingGuestAuth: Promise<string | null> | null = null;
let guestAuthFailedAt = 0;

export async function ensurePlayerSession(): Promise<string | null> {
  const existing = getPlayerToken();
  if (existing) return existing;
  if (Date.now() - guestAuthFailedAt < 5000) return null;
  if (!pendingGuestAuth) {
    pendingGuestAuth = (async () => {
      const res = await rawFetch('/api/auth/guest', { method: 'POST' }, null);
      if (res.ok && res.data?.token) {
        setPlayerToken(res.data.token);
        return res.data.token as string;
      }
      guestAuthFailedAt = Date.now();
      return null;
    })().finally(() => { pendingGuestAuth = null; });
  }
  return pendingGuestAuth;
}

export async function api(path: string, opts: RequestInit = {}) {
  let token = getPlayerToken();
  if (!token && requiresPlayerAuth(path)) {
    token = await ensurePlayerSession();
  }
  const res = await rawFetch(path, opts, token);
  if (res.status === 401 && requiresPlayerAuth(path)) {
    setPlayerToken(null);
    const freshToken = await ensurePlayerSession();
    if (freshToken) {
      return rawFetch(path, opts, freshToken);
    }
  }
  return res;
}

export async function adminApi(path: string, opts: RequestInit = {}) {
  return rawFetch(path, opts, getAdminToken());
}

export async function adminUploadFile(file: File): Promise<{ ok: boolean; mediaUrl?: string; mediaType?: 'image' | 'video'; error?: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await rawFetch('/api/admin/ads/upload', { method: 'POST', body: form }, getAdminToken());
  if (!res.ok) return { ok: false, error: res.data?.error || 'Upload failed' };
  return { ok: true, mediaUrl: res.data.mediaUrl, mediaType: res.data.mediaType };
}

export function fmtNum(n: number | undefined | null): string {
  return Math.round(n || 0).toLocaleString();
}

export function fmtTime(secs: number | undefined | null): string {
  const s = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}:${String(rem).padStart(2, '0')}` : `${rem}s`;
}

