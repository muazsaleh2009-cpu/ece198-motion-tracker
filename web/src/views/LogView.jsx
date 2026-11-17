import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { filterBlocks, performance, repsToCsv } from '../lib/analytics.js';
import { BY_KEY, flagLabel } from '../lib/catalog.js';
import { formatShort } from '../lib/dates.js';
import { repsOfBlock } from '../lib/sessions.js';
import { Badge, Segmented, deg, downloadFile, num } from '../components/ui.jsx';
import BlockDetail from '../components/BlockDetail.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import { filterNotes } from '../lib/notes.js';

const STATUS_TONE = { completed: ['good', 'Completed'], partial: ['warn', 'Partly done'], no_reps: ['bad', 'No reps counted'] };
const PAGE = 300;

/** The raw log: every recorded block or repetition for the chosen exercises and dates. */
export default function LogView({ blocks, filters, notes = [] }) {
  const [mode, setMode] = useState('sessions');
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const f = useMemo(() => filterBlocks(blocks, filters), [blocks, filters]);
  const newestFirst = useMemo(() => [...f].reverse(), [f]);
  const reps = useMemo(() => (mode === 'reps' ? newestFirst.flatMap((b) => repsOfBlock(b).map((r) => ({ ...r, b })).reverse()) : []), [mode, newestFirst]);
  const perf = useMemo(() => performance(f), [f]);
  const shownNotes = useMemo(() => filterNotes(notes, filters), [notes, filters]);

  const stamp = new Date().toISOString().slice(0, 10);
  const label = `${filters.from || 'start'}_to_${filters.to || 'latest'}`;

  return (
    <div className="kc-stack">
    <header className="kc-hero"><h1 className="kc-h1">Log</h1><p className="kc-lede">Every recorded exercise, by session or by repetition, for the exercises and dates selected above.</p></header>
    <section className="kc-card kc-card-flush" aria-label="Session log">
      <div className="kc-card-head">
        <div>
          <h2 className="kc-panel-title">Recorded exercises</h2>
          <p className="kc-panel-desc">{f.length} exercise session{f.length === 1 ? '' : 's'} · {perf.reps} counted repetitions · average form {num(perf.form, 0)} · {num(perf.minutes, 0)} min of exercise</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented label="Log detail" value={mode} onChange={(m) => { setMode(m); setLimit(PAGE); }} options={[{ id: 'sessions', label: 'By session' }, { id: 'reps', label: 'Every repetition' }]} />
          <button type="button" className="kc-btn kc-btn-secondary kc-btn-sm" disabled={!f.length} onClick={() => downloadFile(`therapypal-reps_${label}_${stamp}.csv`, repsToCsv(f), 'text/csv')}><Download size={14} aria-hidden="true" /> CSV</button>
          <button type="button" className="kc-btn kc-btn-secondary kc-btn-sm" disabled={!f.length} onClick={() => downloadFile(`therapypal-log_${label}_${stamp}.json`, JSON.stringify(f, null, 2))}><Download size={14} aria-hidden="true" /> JSON</button>
        </div>
      </div>

      {shownNotes.length > 0 && (
        <div style={{ padding: '4px 24px 8px', borderBottom: '1px solid var(--kc-border)' }}>
          <strong style={{ fontSize: '.9rem' }}>Supervisor notes in this period</strong>
          <NotesPanel notes={shownNotes} readOnly options={[]} />
        </div>
      )}
      {f.length === 0 ? (
        <div className="kc-empty-chart" style={{ margin: 20 }}>No recorded sessions match these filters.</div>
      ) : mode === 'sessions' ? (
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Date</th><th>Exercise</th><th>Side</th><th>Reps</th><th>Peak angle</th><th>Range</th><th>Form</th><th>Pain</th><th>Status</th><th><span className="kc-sr">Details</span></th></tr></thead>
            <tbody>
              {newestFirst.slice(0, limit).flatMap((b) => {
                const isOpen = open === b.block_id;
                const [tone, text] = STATUS_TONE[b.status] || ['neutral', b.status];
                const s = b.summary;
                return [
                  <tr key={b.block_id}>
                    <td className="kc-num"><strong>{formatShort(b.date)}</strong> <span className="kc-muted">{b.time}</span></td>
                    <td><strong>{BY_KEY[b.exercise_key]?.name}</strong></td>
                    <td>{b.side}</td>
                    <td className="kc-num">{s.reps_completed} / {s.reps_planned}</td>
                    <td className="kc-num">{deg(s.avg_peak_angle_deg, 1)} <span className="kc-muted">/ {deg(b.angle.target_angle_deg)}</span></td>
                    <td className="kc-num">{num(s.avg_rom_pct, 0)}%</td>
                    <td className="kc-num"><strong>{num(s.avg_form_score, 0)}</strong></td>
                    <td className="kc-num">{b.patient_report?.pain_0_10 == null ? <span className="kc-muted">–</span> : <strong style={{ color: b.patient_report.pain_0_10 >= 6 ? 'var(--kc-danger)' : undefined }}>{b.patient_report.pain_0_10}</strong>}</td>
                    <td><Badge tone={tone}>{text}</Badge></td>
                    <td><button type="button" className="kc-expander" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : b.block_id)}>{isOpen ? 'Hide' : 'Details'}</button></td>
                  </tr>,
                  isOpen && <tr key={`${b.block_id}-d`} className="kc-row-detail"><td colSpan={10}><BlockDetail block={b} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Date</th><th>Exercise</th><th>Set</th><th>Rep</th><th>Peak angle</th><th>Range</th><th>Form</th><th>Hold</th><th>Duration</th><th>Notes</th></tr></thead>
            <tbody>
              {reps.slice(0, limit).map((r, i) => (
                <tr key={i} style={r.counted ? undefined : { opacity: 0.65 }}>
                  <td className="kc-num">{formatShort(r.b.date)} <span className="kc-muted">{r.b.time}</span></td>
                  <td>{BY_KEY[r.b.exercise_key]?.name}</td>
                  <td className="kc-num">{r.set_number}</td>
                  <td className="kc-num">{r.counted ? r.rep_index : 'not counted'}</td>
                  <td className="kc-num">{deg(r.peak_angle_deg, 1)}</td>
                  <td className="kc-num">{num(r.rom_pct, 0)}%</td>
                  <td className="kc-num"><strong>{num(r.form_score, 0)}</strong></td>
                  <td className="kc-num">{r.hold_s ? `${num(r.hold_s, 1)} s` : '–'}</td>
                  <td className="kc-num">{num(r.duration_s, 1)} s</td>
                  <td>{(r.flags || []).map((fl) => <Badge key={fl} tone={fl === 'short_of_target' ? 'neutral' : 'warn'}>{flagLabel(fl, r.b.exercise_key)}</Badge>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {((mode === 'sessions' ? newestFirst.length : reps.length) > limit) && (
        <div style={{ padding: 14, textAlign: 'center' }}>
          <button type="button" className="kc-btn kc-btn-secondary" onClick={() => setLimit(limit + PAGE)}>Show more ({(mode === 'sessions' ? newestFirst.length : reps.length) - limit} remaining)</button>
        </div>
      )}
    </section>
    </div>
  );
}
