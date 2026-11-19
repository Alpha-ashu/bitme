import { esc } from '../utils/escapeHtml';

export interface SeriesPoint {
  label: string;
  primary: number;
  secondary?: number;
}

/** Responsive inline SVG grouped bar/line chart with zero external chart library dependencies. */
export function renderTrendChart(
  title: string,
  points: SeriesPoint[],
  opts: { primaryLabel: string; secondaryLabel?: string; primaryColor?: string; secondaryColor?: string }
): string {
  const pColor = opts.primaryColor || '#32C766';
  const sColor = opts.secondaryColor || '#3B9EFF';
  if (!points.length) {
    return `<div class="chart-card"><div class="chart-hdr">${esc(title)}</div><div class="empty-msg">No recorded events in selected window yet.</div></div>`;
  }

  const maxVal = Math.max(1, ...points.flatMap(p => [p.primary, p.secondary || 0]));
  const w = 640;
  const h = 190;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const step = plotW / points.length;
  const barW = Math.max(4, Math.min(20, step * (opts.secondaryLabel ? 0.36 : 0.6)));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const y = padT + plotH * (1 - frac);
    const val = Math.round(maxVal * frac);
    return `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="rgba(16,42,67,0.08)" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#5A7690">${val}</text>
    `;
  }).join('');

  const bars = points.map((p, i) => {
    const cx = padL + i * step + step / 2;
    const h1 = (p.primary / maxVal) * plotH;
    const y1 = padT + plotH - h1;
    const x1 = opts.secondaryLabel ? cx - barW - 1 : cx - barW / 2;
    const labelEvery = Math.max(1, Math.ceil(points.length / 8));
    const showLbl = i % labelEvery === 0 || i === points.length - 1;
    const shortLbl = p.label.length > 7 ? p.label.slice(5) : p.label;

    let secSvg = '';
    if (opts.secondaryLabel) {
      const h2 = ((p.secondary || 0) / maxVal) * plotH;
      const y2 = padT + plotH - h2;
      secSvg = `<rect x="${(cx + 1).toFixed(1)}" y="${y2.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h2).toFixed(1)}" rx="3" fill="${sColor}"><title>${esc(p.label)} · ${esc(opts.secondaryLabel)}: ${p.secondary || 0}</title></rect>`;
    }

    return `
      <rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h1).toFixed(1)}" rx="3" fill="${pColor}">
        <title>${esc(p.label)} · ${esc(opts.primaryLabel)}: ${p.primary}</title>
      </rect>
      ${secSvg}
      ${showLbl ? `<text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#5A7690">${esc(shortLbl)}</text>` : ''}
    `;
  }).join('');

  return `
    <div class="chart-card">
      <div class="chart-hdr">
        <span>${esc(title)}</span>
        <span class="chart-legend">
          <i style="background:${pColor}"></i>${esc(opts.primaryLabel)}
          ${opts.secondaryLabel ? `<i style="background:${sColor};margin-left:10px"></i>${esc(opts.secondaryLabel)}` : ''}
        </span>
      </div>
      <svg viewBox="0 0 ${w} ${h}" class="chart-svg" role="img" aria-label="${esc(title)}">
        ${gridLines}
        ${bars}
      </svg>
    </div>
  `;
}

/** Proportional SVG Donut chart for mode usage & new-vs-returning splits. */
export function renderDonutChart(
  title: string,
  segments: Array<{ label: string; value: number; color: string }>
): string {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total === 0) {
    return `<div class="chart-card"><div class="chart-hdr">${esc(title)}</div><div class="empty-msg">No recorded activity yet.</div></div>`;
  }
  const r = 46;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const circles = segments.filter(s => s.value > 0).map(s => {
    const frac = s.value / total;
    const dash = frac * c;
    const svg = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${esc(s.label)}: ${s.value} (${Math.round(frac * 100)}%)</title></circle>`;
    offset += dash;
    return svg;
  }).join('');

  const legend = segments.map(s => {
    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
    return `<div class="donut-item"><span class="donut-dot" style="background:${s.color}"></span><span>${esc(s.label)}</span><b>${s.value} (${pct}%)</b></div>`;
  }).join('');

  return `
    <div class="chart-card">
      <div class="chart-hdr">${esc(title)}</div>
      <div class="donut-wrap">
        <svg viewBox="0 0 120 120" class="donut-svg" role="img" aria-label="${esc(title)}">
          <g transform="rotate(-90 60 60)">${circles}</g>
          <text x="60" y="64" text-anchor="middle" font-size="14" font-weight="800" fill="#102A43">${total}</text>
        </svg>
        <div class="donut-legend">${legend}</div>
      </div>
    </div>
  `;
}

/** Retention progress bars for D1 / D7 / D30 cohorts. */
export function renderRetentionBars(ret: {
  cohorts: {
    day1: { eligible: number; retained: number; rate: number };
    day7: { eligible: number; retained: number; rate: number };
    day30: { eligible: number; retained: number; rate: number };
  };
}): string {
  const rows = [
    { label: 'Day 1 Retention', d: ret.cohorts.day1, color: '#32C766' },
    { label: 'Day 7 Retention', d: ret.cohorts.day7, color: '#3B9EFF' },
    { label: 'Day 30 Retention', d: ret.cohorts.day30, color: '#A855F7' },
  ];
  return `
    <div class="chart-card">
      <div class="chart-hdr">Cohort Retention Breakdown</div>
      <div class="ret-bars">
        ${rows.map(r => `
          <div class="ret-row">
            <div class="ret-top"><span>${esc(r.label)}</span><b>${r.d.rate}% <small>(${r.d.retained}/${r.d.eligible} eligible)</small></b></div>
            <div class="ret-track"><div class="ret-fill" style="width:${Math.min(100, r.d.rate)}%;background:${r.color}"></div></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

