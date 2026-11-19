/** Escape dynamic text before interpolating into HTML templates to prevent XSS. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate a URL before rendering it inside href/src attributes. */
export function safeUrl(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* reject javascript:, data:, vbscript: */ }
  return '';
}

