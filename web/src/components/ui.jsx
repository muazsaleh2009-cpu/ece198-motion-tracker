import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Minus, TrendingDown, TrendingUp, Upload } from 'lucide-react';

export const pct = (v, d = 0) => (v == null ? '–' : `${(v * 100).toFixed(d)}%`);
export const num = (v, d = 0) => (v == null ? '–' : Number(v).toFixed(d));
export const deg = (v, d = 0) => (v == null ? '–' : `${Number(v).toFixed(d)}°`);

/** The headline numbers as one ruled strip. items: [{ label, value, unit?, note? }] */
export function Ledger({ items }) {
  return (
    <section className={`kc-ledger ${items.length === 4 ? 'kc-ledger-4' : ''}`} aria-label="Summary">
      {items.map((it) => (
        <div key={it.label} className="kc-ledger-item">
          <span className="kc-ledger-label">{it.label}</span>
          <span className="kc-ledger-value">{it.value}{it.unit && <span className="kc-ledger-unit">{it.unit}</span>}</span>
          {it.note && <div className="kc-ledger-note">{it.note}</div>}
        </div>
      ))}
    </section>
  );
}

export function Badge({ tone = 'neutral', icon: Icon, children, title }) {
  return (
    <span className={`kc-badge kc-tone-${tone}`} title={title}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS = {
  done: ['good', 'Done'],
  partial: ['warn', 'Partly done'],
  missed: ['bad', 'Missed'],
  today: ['info', 'Due today'],
  upcoming: ['neutral', 'Upcoming'],
};
export function StatusBadge({ status }) {
  const [tone, label] = STATUS[status] || ['neutral', status];
  return <Badge tone={tone}>{label}</Badge>;
}
export const statusTone = (status) => (STATUS[status] || ['neutral'])[0];

/** Direction of change with the amount, e.g. "▲ +6.2 pts". `unit` is "pts", "°" or "%". */
export function TrendBadge({ trend, unit = 'pts' }) {
  if (!trend || trend.label === 'insufficient') {
    return <Badge tone="neutral" icon={Minus} title="Needs at least 4 recorded sessions">Not enough data</Badge>;
  }
  const d = trend.delta;
  const text = `${d > 0 ? '+' : ''}${d.toFixed(1)}${unit === '°' ? '°' : ` ${unit}`}`;
  if (trend.label === 'improving') return <Badge tone="good" icon={TrendingUp}>{text}</Badge>;
  if (trend.label === 'declining') return <Badge tone="bad" icon={TrendingDown}>{text}</Badge>;
  return <Badge tone="neutral" icon={Minus}>Stable ({text})</Badge>;
}

export function Notice({ tone = 'info', title, children, onClose }) {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return (
    <div className={`kc-notice kc-tone-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="kc-notice-text">
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="kc-expander" style={{ color: 'inherit' }}>
          ✕
        </button>
      )}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="kc-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)} className={`kc-seg-btn ${value === o.id ? 'kc-seg-active' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label, tone = 'var(--kc-primary)' }) {
  const v = Math.max(0, Math.min(100, Math.round((value || 0) * 100)));
  return (
    <div className="kc-progress-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="kc-progress-fill" style={{ width: `${v}%`, background: tone }} />
    </div>
  );
}

export function MiniBar({ value, tone }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const color = tone || (v >= 0.8 ? 'var(--kc-primary)' : v >= 0.5 ? 'var(--kc-accent)' : 'var(--kc-danger)');
  return (
    <span className="kc-mini-bar" aria-hidden="true">
      <span className="kc-mini-fill" style={{ width: `${v * 100}%`, background: color }} />
    </span>
  );
}

/** Click or drop JSON files. Calls onFiles([{ name, text }]) */
export function FileDrop({ title, hint, multiple, onFiles, id }) {
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  const read = async (fileList) => {
    const files = [...fileList].filter(Boolean);
    if (!files.length) return;
    const out = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    onFiles(out);
    if (ref.current) ref.current.value = '';
  };
  return (
    <label
      htmlFor={id}
      className={`kc-drop ${over ? 'kc-drop-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files); }}
    >
      <Upload size={26} aria-hidden="true" color="var(--kc-primary)" />
      <strong>{title}</strong>
      <span className="kc-muted" style={{ fontSize: '.85em' }}>{hint}</span>
      <input ref={ref} id={id} type="file" accept=".json,application/json" multiple={multiple} onChange={(e) => read(e.target.files)} />
    </label>
  );
}

export function downloadFile(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
