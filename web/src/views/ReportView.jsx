import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { attention, exerciseSummaries, filterBlocks, filterRows, overallSummary } from '../lib/analytics.js';
import { formatLong } from '../lib/dates.js';
import { filterNotes } from '../lib/notes.js';
import { Ledger, TrendBadge, num, pct } from '../components/ui.jsx';
import AttentionList from '../components/AttentionList.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import RomDial from '../components/RomDial.jsx';
import { BY_KEY } from '../lib/catalog.js';
import { formatShort } from '../lib/dates.js';
import { leadSentence } from './Overview.jsx';

/** A single printable page for the supervisor or the patient's file. Uses the period and exercises chosen above. */
export default function ReportView({ plan, all, blocks, filters, today, notes }) {
  const rows = useMemo(() => filterRows(all.rows, filters), [all.rows, filters]);
  const fBlocks = useMemo(() => filterBlocks(blocks, filters), [blocks, filters]);
  const overall = useMemo(() => overallSummary(rows, fBlocks), [rows, fBlocks]);
  const sums = useMemo(() => exerciseSummaries(rows, fBlocks), [rows, fBlocks]);
  const alerts = useMemo(() => attention(all.rows, blocks, today), [all.rows, blocks, today]);
  const shown = useMemo(() => filterNotes(notes, filters), [notes, filters]);
  const a = overall.adherence;
  const p = overall.performance;
  const pain = overall.pain;
  const from = filters.from || fBlocks[0]?.date || rows[0]?.date;
  const to = filters.to || fBlocks[fBlocks.length - 1]?.date || today;

  return (
    <div className="kc-report">
      <header className="kc-hero">
        <h1 className="kc-h1">Exercise progress report</h1>
        <p className="kc-lede">{plan.patient.name || plan.patient.id}{plan.patient.condition ? `, ${plan.patient.condition.toLowerCase()}` : ''}. {leadSentence({ overall, alerts, hasSessions: blocks.length > 0 })}</p>
        <p className="kc-meta">{plan.name} · {from ? formatLong(from) : 'start'} to {to ? formatLong(to) : 'latest'}{plan.supervisor?.name ? ` · supervisor ${plan.supervisor.name}` : ''} · prepared {formatLong(today)}</p>
        <div className="kc-no-print" style={{ marginTop: 6 }}>
          <button type="button" className="kc-btn kc-btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>
          <span className="kc-help" style={{ marginLeft: 12 }}>The report follows the period and exercises selected above.</span>
        </div>
      </header>

      <Ledger items={[
        { label: 'Adherence', value: a.repsRate == null ? '–' : Math.round(a.repsRate * 100), unit: a.repsRate == null ? '' : '%', note: <span>{a.repsDone} of {a.repsPlanned} reps</span> },
        { label: 'Form score', value: num(p.form, 0), unit: '/ 100', note: <TrendBadge trend={overall.improvement.form} /> },
        { label: 'Range of motion', value: p.rom == null ? '–' : Math.round(p.rom), unit: p.rom == null ? '' : '%', note: <span>{pct(p.reachedPct)} of reps hit target</span> },
        { label: 'Pain after exercise', value: pain.mean == null ? '–' : num(pain.mean, 1), unit: pain.mean == null ? '' : '/ 10', note: pain.n ? <span>Highest {pain.max}/10</span> : <span>No ratings</span> },
        { label: 'Longest streak', value: overall.streaks.longest, unit: overall.streaks.longest === 1 ? 'day' : 'days', note: <span>Current {overall.streaks.current}</span> },
      ]} />

      <section className="kc-card">
        <h2 className="kc-panel-title" style={{ marginBottom: 12 }}>Needs attention</h2>
        <AttentionList items={alerts} />
      </section>

      <section className="kc-card">
        <h2 className="kc-panel-title" style={{ marginBottom: 12 }}>Range of motion, latest session</h2>
        <div className="kc-dials">
          {sums.map((s) => {
            const latest = [...fBlocks].reverse().find((b) => b.exercise_key === s.key);
            const spec = BY_KEY[s.key];
            return <RomDial key={s.key} name={s.name} start={latest?.angle.start_angle_deg ?? spec.start_angle_deg} target={latest?.angle.target_angle_deg ?? spec.default_target_angle_deg} peak={latest?.summary.avg_peak_angle_deg ?? null} caption={latest ? `${formatShort(latest.date)} · ${num(latest.summary.avg_rom_pct, 0)}% of range` : 'No sessions'} />;
          })}
        </div>
      </section>

      <section className="kc-card kc-card-flush">
        <div className="kc-card-head"><h2 className="kc-panel-title">By exercise</h2></div>
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Exercise</th><th>Reps done / planned</th><th>Sessions missed</th><th>Form</th><th>Range</th><th>Pain (latest, average)</th></tr></thead>
            <tbody>
              {sums.map((s) => (
                <tr key={s.key}>
                  <td><strong>{s.name}</strong></td>
                  <td className="kc-num">{s.adherence.repsPlanned ? `${s.adherence.repsDone} / ${s.adherence.repsPlanned} (${pct(s.adherence.repsRate)})` : '–'}</td>
                  <td className="kc-num">{s.adherence.due ? s.adherence.missed : '–'}</td>
                  <td className="kc-num">{num(s.performance.form, 0)}</td>
                  <td className="kc-num">{s.performance.rom == null ? '–' : `${num(s.performance.rom, 0)}%`}</td>
                  <td className="kc-num">{s.pain.n ? `${s.pain.latest} · ${num(s.pain.mean, 1)}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kc-card">
        <h2 className="kc-panel-title" style={{ marginBottom: 8 }}>Supervisor notes</h2>
        <NotesPanel notes={shown} readOnly options={[]} />
        <div className="kc-sig kc-print-only"><div>Supervisor signature</div><div>Date</div></div>
      </section>
    </div>
  );
}
