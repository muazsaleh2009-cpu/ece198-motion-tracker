import React, { useMemo, useState } from 'react';
import { addDays, daysBetween, formatShort } from '../lib/dates.js';

// Series colours are CSS variables, so charts follow the light / dark / high-contrast themes.
// Series also differ by dash pattern, so colour is never the only cue.
export const SERIES_COLORS = { teal: 'var(--kc-s1)', amber: 'var(--kc-s2)', blue: 'var(--kc-s3)', violet: 'var(--kc-s4)', grey: 'var(--kc-s5)', rose: 'var(--kc-danger)' };
const color = (c) => SERIES_COLORS[c] || c;

/**
 * Line chart with a real time (or numeric) x-axis, optional reference lines and hover/focus tooltips.
 *
 * series:    [{ id, name, color, dashed?, points: [{ x, y, tip?: { title, rows: [[label, value]] } }] }]
 * refLines:  [{ y, label, color? }]
 * xType:     'date' (x = "YYYY-MM-DD") or 'number' (x = seconds, etc.)
 */
export function TimeChart({ series, refLines = [], xType = 'date', yMin = 0, yMax = 100, yFormat = (v) => v, xFormat, height = 280, highContrast, ariaLabel, yTicks = 5, gapX = null }) {
  const [hover, setHover] = useState(null);
  const W = 760;
  const pad = { top: 18, right: 22, bottom: 34, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const all = series.flatMap((s) => s.points.map((p) => ({ ...p, sid: s.id })));
  const xs = all.map((p) => (xType === 'date' ? daysBetween('2000-01-01', p.x) : p.x));
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const span = xMax - xMin || 1;
  const sx = (x) => pad.left + (xs.length > 0 && xMax === xMin ? plotW / 2 : ((x - xMin) / span) * plotW);
  const sy = (y) => pad.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;
  const xv = (p) => (xType === 'date' ? daysBetween('2000-01-01', p.x) : p.x);
  const fx = xFormat || (xType === 'date' ? (v) => formatShort(v) : (v) => `${v}s`);

  const grid = Array.from({ length: yTicks }, (_, i) => yMin + ((yMax - yMin) * i) / (yTicks - 1));
  const nTicks = Math.min(6, Math.max(2, xs.length ? new Set(xs).size : 2));
  const xTicks = Array.from({ length: nTicks }, (_, i) => xMin + (span * i) / (nTicks - 1));
  const tickLabel = (v) => (xType === 'date' ? formatShort(addDays('2000-01-01', Math.round(v))) : fx(Math.round(v * 10) / 10));

  const flat = useMemo(() => {
    const idx = [];
    series.forEach((s) => s.points.forEach((p) => idx.push({ s, p, x: xv(p) })));
    return idx.sort((a, b) => a.x - b.x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  // With gapX set, the line is broken wherever two samples are further apart than that (e.g. rest between sets).
  const path = (pts) => pts.map((p, i) => `${i && !(gapX != null && xv(p) - xv(pts[i - 1]) > gapX) ? 'L' : 'M'} ${sx(xv(p)).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const gridColor = 'var(--kc-grid)';
  const labelColor = 'var(--kc-axis)';
  const active = hover != null ? flat[hover] : null;
  const group = active ? flat.filter((f) => Math.abs(f.x - active.x) < 1e-9) : [];

  return (
    <div className="kc-chart-shell">
      {active && (
        <div className="kc-svg-tooltip" role="status">
          <strong>{active.p.tip?.title || fx(active.p.x)}</strong>
          {group.map(({ s, p }) => (
            <div key={s.id}>
              <div className="kc-tip-row">
                <span style={{ color: color(s.color), fontWeight: 700 }}>{s.name}</span>
                <strong>{yFormat(p.y)}</strong>
              </div>
              {(p.tip?.rows || []).map(([k, v]) => (
                <div key={k} className="kc-tip-row" style={{ fontSize: '.92em' }}>
                  <span className="kc-muted">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={ariaLabel}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={sy(v)} y2={sy(v)} stroke={gridColor} strokeDasharray={v === yMin ? 'none' : '4 4'} />
            <text x={pad.left - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill={labelColor}>{yFormat(Math.round(v * 10) / 10)}</text>
          </g>
        ))}
        {xTicks.map((v, i) => (
          <text key={i} x={sx(v)} y={height - 10} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="11" fontWeight="600" fill={labelColor}>{tickLabel(v)}</text>
        ))}
        {refLines.map((r) => (
          <g key={r.label}>
            <line x1={pad.left} x2={W - pad.right} y1={sy(r.y)} y2={sy(r.y)} stroke={color(r.color || 'grey')} strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={W - pad.right - 4} y={sy(r.y) - 5} textAnchor="end" fontSize="10.5" fontWeight="700" fill={color(r.color || 'grey')}>{r.label}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => xv(a) - xv(b));
          const c = color(s.color);
          return (
            <g key={s.id}>
              {pts.length > 1 && <path d={path(pts)} fill="none" stroke={c} strokeWidth={s.thin ? 2 : 3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '7 5' : 'none'} />}
              {!s.noDots && pts.map((p, i) => (
                <circle key={i} cx={sx(xv(p))} cy={sy(p.y)} r={hover != null && flat[hover].p === p ? 6.5 : 4} fill={c} stroke="var(--kc-dot-ring)" strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {flat.map((f, i) => (
          <rect
            key={i}
            x={sx(f.x) - 9} y={pad.top} width="18" height={plotH}
            fill="transparent" tabIndex={0}
            aria-label={`${f.s.name} ${fx(f.p.x)} ${yFormat(f.p.y)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            style={{ cursor: 'pointer', outline: 'none' }}
          />
        ))}
      </svg>
      <div className="kc-chart-legend">
        {series.map((s) => (
          <span key={s.id} className="kc-legend-item">
            <span className="kc-legend-swatch" style={{ background: color(s.color), opacity: s.dashed ? 0.7 : 1 }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}


/** Planned vs done repetitions per week, with the adherence % above each pair. */
export function WeeklyBars({ weeks, highContrast }) {
  const [hover, setHover] = useState(null);
  const W = 760;
  const H = 280;
  const pad = { top: 26, right: 22, bottom: 36, left: 50 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = Math.max(10, ...weeks.map((w) => Math.max(w.planned, w.done))) * 1.1;
  const slot = plotW / Math.max(1, weeks.length);
  const barW = Math.min(30, slot * 0.34);
  const sy = (v) => pad.top + plotH - (v / max) * plotH;
  const labelColor = 'var(--kc-axis)';
  const gridColor = 'var(--kc-grid)';
  const teal = color('teal');
  const outline = color('grey');
  const active = hover != null ? weeks[hover] : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r));
  return (
    <div className="kc-chart-shell">
      {active && (
        <div className="kc-svg-tooltip" role="status">
          <strong>Week of {formatShort(active.week)}</strong>
          <div className="kc-tip-row"><span className="kc-muted">Planned reps</span><span>{active.planned}</span></div>
          <div className="kc-tip-row"><span className="kc-muted">Done reps</span><span>{active.done}</span></div>
          <div className="kc-tip-row"><span className="kc-muted">Adherence</span><strong>{active.adherence == null ? '–' : `${Math.round(active.adherence * 100)}%`}</strong></div>
          <div className="kc-tip-row"><span className="kc-muted">Form score</span><span>{active.form == null ? '–' : active.form.toFixed(0)}</span></div>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Planned versus completed repetitions per week">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={sy(v)} y2={sy(v)} stroke={gridColor} strokeDasharray={v === 0 ? 'none' : '4 4'} />
            <text x={pad.left - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill={labelColor}>{v}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = pad.left + slot * i + slot / 2;
          return (
            <g key={w.week} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`Week of ${formatShort(w.week)}: ${w.done} of ${w.planned} repetitions`} style={{ cursor: 'pointer', outline: 'none' }}>
              <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH} fill="transparent" />
              <rect x={cx - barW - 2} y={sy(w.planned)} width={barW} height={Math.max(0, pad.top + plotH - sy(w.planned))} rx="4" fill="none" stroke={outline} strokeWidth="2" strokeDasharray="4 3" />
              <rect x={cx + 2} y={sy(w.done)} width={barW} height={Math.max(0, pad.top + plotH - sy(w.done))} rx="4" fill={teal} opacity={hover === i ? 1 : 0.85} />
              {w.adherence != null && (
                <text x={cx} y={Math.min(sy(w.planned), sy(w.done)) - 7} textAnchor="middle" fontSize="11" fontWeight="800" fill={w.adherence >= 0.8 ? teal : color('amber')}>{Math.round(w.adherence * 100)}%</text>
              )}
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill={labelColor}>{formatShort(w.week)}</text>
            </g>
          );
        })}
      </svg>
      <div className="kc-chart-legend">
        <span className="kc-legend-item"><span className="kc-legend-swatch" style={{ background: 'transparent', border: `2px dashed ${outline}`, height: 10, width: 14 }} />Planned reps</span>
        <span className="kc-legend-item"><span className="kc-legend-swatch" style={{ background: teal, height: 10, width: 14 }} />Done reps (% = adherence)</span>
      </div>
    </div>
  );
}
