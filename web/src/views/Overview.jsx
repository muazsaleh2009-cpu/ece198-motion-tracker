import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Info } from 'lucide-react';
import { attention, blockPoint, exerciseSummaries, filterBlocks, filterRows, insights, overallSummary } from '../lib/analytics.js';
import { BY_KEY } from '../lib/catalog.js';
import { formatLong, formatShort } from '../lib/dates.js';
import { filterNotes } from '../lib/notes.js';
import { Ledger, MiniBar, Notice, TrendBadge, num, pct } from '../components/ui.jsx';
import { TimeChart, WeeklyBars } from '../components/charts.jsx';
import AttentionList from '../components/AttentionList.jsx';
import Heatmap from '../components/Heatmap.jsx';
import NotesPanel from '../components/NotesPanel.jsx';
import RomDial from '../components/RomDial.jsx';
import WeekStrip from '../components/WeekStrip.jsx';

const SERIES = ['teal', 'amber', 'blue', 'violet', 'grey'];

/** A one-sentence summary written from the numbers, so the first thing read is the state of the programme. */
export function leadSentence({ overall, alerts, hasSessions }) {
  if (!hasSessions) return 'The plan is loaded. Run the tracker, then import the session files to see progress here.';
  const a = overall.adherence;
  const high = alerts.filter((x) => x.severity === 'high');
  const first = a.repsRate == null ? 'No sessions have fallen due yet.' : `${pct(a.repsRate)} of the planned repetitions are done.`;
  const second = high.length ? `${high.slice(0, 2).map((x) => x.title).join(' and ')}.` : alerts.length ? `${alerts.length} smaller ${alerts.length === 1 ? 'thing is' : 'things are'} worth a look.` : 'Nothing needs urgent attention.';
  return `${first} ${second}`;
}

export default function Overview({ plan, all, blocks, filters, today, notes, onAddNote, onRemoveNote, options, goExercise, goData, goReport }) {
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const rows = useMemo(() => filterRows(all.rows, filters), [all.rows, filters]);
  const fBlocks = useMemo(() => filterBlocks(blocks, filters), [blocks, filters]);
  const overall = useMemo(() => overallSummary(rows, fBlocks), [rows, fBlocks]);
  const sums = useMemo(() => exerciseSummaries(rows, fBlocks), [rows, fBlocks]);
  const found = useMemo(() => insights(sums, overall), [sums, overall]);
  const alerts = useMemo(() => attention(all.rows, blocks, today), [all.rows, blocks, today]);
  const points = useMemo(() => fBlocks.map(blockPoint), [fBlocks]);
  const planRows = useMemo(() => filterRows(all.rows, { exercises: filters.exercises, from: null, to: null }), [all.rows, filters.exercises]);
  const shownNotes = useMemo(() => filterNotes(notes, filters), [notes, filters]);

  const a = overall.adherence;
  const p = overall.performance;
  const pain = overall.pain;
  const noSessions = blocks.length === 0;
  const unplannedInRange = all.unplanned.filter((b) => (!filters.from || b.date >= filters.from) && (!filters.to || b.date <= filters.to));
  const exKeys = sums.map((s) => s.key);
  const colorOf = (key) => SERIES[exKeys.indexOf(key) % SERIES.length];
  const tipOf = (pt) => ({ title: `${formatShort(pt.date)} ${pt.time} · ${BY_KEY[pt.exercise_key]?.name}`, rows: [['Reps', `${pt.reps} / ${pt.planned}`], ['Peak angle', `${num(pt.peak, 1)}° (target ${pt.target}°)`], ...(pt.pain != null ? [['Pain', `${pt.pain} / 10`]] : [])] });
  const painSeries = exKeys.map((k) => ({
    id: k, name: BY_KEY[k].name.split(' (')[0], color: colorOf(k),
    points: points.filter((x) => x.exercise_key === k && x.pain != null).map((x) => ({ x: x.date, y: x.pain, tip: tipOf(x) })),
  })).filter((s) => s.points.length);

  const dials = sums.map((s) => {
    const latest = [...fBlocks].reverse().find((b) => b.exercise_key === s.key);
    const planned = rows.find((r) => r.exercise_key === s.key);
    const spec = BY_KEY[s.key];
    return {
      key: s.key, name: s.name,
      start: latest?.angle.start_angle_deg ?? spec.start_angle_deg,
      target: latest?.angle.target_angle_deg ?? planned?.target_angle_deg ?? spec.default_target_angle_deg,
      peak: latest?.summary.avg_peak_angle_deg ?? null,
      caption: latest ? `${formatShort(latest.date)} · ${num(latest.summary.avg_rom_pct, 0)}% of range` : 'No sessions yet',
    };
  });

  const planFrom = planRows[0]?.date || today;
  const planTo = planRows[planRows.length - 1]?.date || today;
  const pctTone = (v) => (v >= 0.8 ? 'good' : v >= 0.5 ? 'warn' : 'bad');

  return (
    <div className="kc-stack">
      <header className="kc-hero">
        <h1 className="kc-h1">{plan.patient.name || plan.patient.id}</h1>
        <p className="kc-lede">{leadSentence({ overall, alerts, hasSessions: !noSessions })}</p>
        <p className="kc-meta">{plan.name}{plan.supervisor?.name ? ` · supervised by ${plan.supervisor.name}` : ''} · {formatLong(today)}</p>
        <div className="kc-no-print" style={{ marginTop: 6 }}>
          <button type="button" className="kc-btn kc-btn-secondary kc-btn-sm" onClick={goReport}><FileText size={14} aria-hidden="true" /> Open printable report</button>
        </div>
      </header>

      {noSessions && (
        <Notice tone="info" title="No sessions imported yet">
          Run the tracker, then import the session files from the Data tab. <button type="button" className="kc-expander" onClick={goData}>Go to Data</button>
        </Notice>
      )}
      {unplannedInRange.length > 0 && (
        <Notice tone="warn" title={`${unplannedInRange.length} recorded exercise${unplannedInRange.length > 1 ? 's were' : ' was'} not on the plan`}>
          They count towards performance but not adherence: {[...new Set(unplannedInRange.map((b) => `${BY_KEY[b.exercise_key]?.name} (${formatShort(b.date)})`))].join(', ')}.
        </Notice>
      )}

      <Ledger items={[
        { label: 'Adherence', value: a.repsRate == null ? '–' : Math.round(a.repsRate * 100), unit: a.repsRate == null ? '' : '%', note: <><span>{a.repsDone} of {a.repsPlanned} reps</span>{a.repsRate != null && <span className={`kc-badge kc-tone-${pctTone(a.repsRate)}`}>{a.done} full · {a.partial} part · {a.missed} missed</span>}</> },
        { label: 'Form score', value: num(p.form, 0), unit: '/ 100', note: <><span>First vs latest</span><TrendBadge trend={overall.improvement.form} /></> },
        { label: 'Range of motion', value: p.rom == null ? '–' : Math.round(p.rom), unit: p.rom == null ? '' : '%', note: <><span>{pct(p.reachedPct)} of reps hit target</span><TrendBadge trend={overall.improvement.rom} unit="%" /></> },
        { label: 'Pain after exercise', value: pain.mean == null ? '–' : num(pain.mean, 1), unit: pain.mean == null ? '' : '/ 10', note: pain.n ? <><span>Latest {pain.latest}/10</span><TrendBadge trend={overall.improvement.pain} /></> : <span>No ratings yet</span> },
        { label: 'Streak', value: overall.streaks.current, unit: overall.streaks.current === 1 ? 'day' : 'days', note: <span>Longest {overall.streaks.longest} · {p.spread == null ? 'no spread yet' : `±${num(p.spread, 1)}° rep to rep`}</span> },
      ]} />

      <section className="kc-card" aria-labelledby="kc-week-h">
        <div className="kc-panel-header"><div><h2 id="kc-week-h" className="kc-panel-title">This week</h2></div></div>
        <WeekStrip rows={all.rows} today={today} />
      </section>

      <div className="kc-grid-eq">
        <section className="kc-card" aria-labelledby="kc-attn-h">
          <div className="kc-panel-header"><div><h2 id="kc-attn-h" className="kc-panel-title">Needs attention</h2><p className="kc-panel-desc">Checked against every session, whatever period is selected above.</p></div></div>
          <AttentionList items={showAllAlerts ? alerts : alerts.slice(0, 4)} onOpen={goExercise} />
          {alerts.length > 4 && <button type="button" className="kc-expander" style={{ marginTop: 10 }} onClick={() => setShowAllAlerts((v) => !v)}>{showAllAlerts ? 'Show fewer' : `Show all ${alerts.length}`}</button>}
        </section>
        <section className="kc-card" aria-label="Key findings">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">What the numbers say</h2></div></div>
          {found.length ? (
            <ul className="kc-insights">
              {(showAllNotes ? found : found.slice(0, 7)).map((n, i) => (
                <li key={i} className={`kc-insight kc-tone-${n.tone === 'good' ? 'good' : n.tone === 'warn' ? 'warn' : 'neutral'}`}>
                  {n.tone === 'good' ? <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} /> : n.tone === 'warn' ? <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} /> : <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />}
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          ) : <p className="kc-muted" style={{ margin: 0 }}>Findings appear once sessions are recorded.</p>}
          {found.length > 7 && <button type="button" className="kc-expander" style={{ marginTop: 10 }} onClick={() => setShowAllNotes((v) => !v)}>{showAllNotes ? 'Show fewer' : `Show all ${found.length}`}</button>}
        </section>
      </div>

      <section className="kc-card" aria-labelledby="kc-dials-h">
        <div className="kc-panel-header">
          <div><h2 id="kc-dials-h" className="kc-panel-title">How far the patient moves</h2>
            <p className="kc-panel-desc">The needle is the average peak angle of the latest session, the brass marker is the prescribed target, and the shaded band is the sweep from the starting position. Select a dial to open that exercise.</p></div>
        </div>
        {dials.length ? <div className="kc-dials">{dials.map(({ key, ...d }) => <RomDial key={key} {...d} onClick={() => goExercise(key)} />)}</div> : <div className="kc-empty-chart">No exercises in this selection.</div>}
      </section>

      <div className="kc-grid-eq">
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Weekly adherence</h2><p className="kc-panel-desc">Repetitions planned and done each week. Extra reps do not make up for missed ones.</p></div></div>
          {overall.weekly.length ? <WeeklyBars weeks={overall.weekly} /> : <div className="kc-empty-chart">Nothing was scheduled in this period.</div>}
        </section>
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Form and range of motion</h2><p className="kc-panel-desc">One point per exercise session. Hover or focus a point for details.</p></div></div>
          {points.length ? (
            <TimeChart ariaLabel="Form score and range of motion per session" yFormat={(v) => `${v}`} yMin={Math.max(0, Math.floor((Math.min(...points.flatMap((x) => [x.form, x.rom]).filter((v) => v != null), 85) - 10) / 10) * 10)} yMax={100}
              series={[
                { id: 'form', name: 'Form score', color: 'teal', points: points.filter((x) => x.form != null).map((x) => ({ x: x.date, y: x.form, tip: tipOf(x) })) },
                { id: 'rom', name: 'Range of motion %', color: 'blue', dashed: true, points: points.filter((x) => x.rom != null).map((x) => ({ x: x.date, y: x.rom, tip: tipOf(x) })) },
              ]}
              refLines={[{ y: 85, label: 'Good form (85)', color: 'amber' }]} />
          ) : <div className="kc-empty-chart">No sessions in this period.</div>}
        </section>
      </div>

      <div className="kc-grid-eq">
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Pain after each exercise</h2><p className="kc-panel-desc">The patient&apos;s own rating, 0 (none) to 10 (worst). Lower is better.</p></div></div>
          {painSeries.length ? (
            <TimeChart ariaLabel="Pain rating after each exercise session" yMin={0} yMax={10} yTicks={6} yFormat={(v) => `${v}`} series={painSeries}
              refLines={[{ y: 6, label: 'High pain (6)', color: 'rose' }]} />
          ) : <div className="kc-empty-chart">No pain ratings yet. The tracker asks for one after each exercise.</div>}
        </section>
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Every day of the plan</h2><p className="kc-panel-desc">{planFrom && formatShort(planFrom)} to {planTo && formatShort(planTo)}. Hover a square for the day&apos;s detail.</p></div></div>
          <Heatmap rows={planRows} from={planFrom} to={planTo} />
        </section>
      </div>

      <div>
        <section className="kc-card" aria-label="Supervisor notes">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Supervisor notes</h2><p className="kc-panel-desc">Short remarks kept with the data. They appear in the printed report.</p></div></div>
          <NotesPanel notes={shownNotes} today={today} options={options} defaultAuthor={plan.supervisor?.name} onAdd={onAddNote} onRemove={onRemoveNote} />
        </section>
      </div>

      <section className="kc-card kc-card-flush" aria-label="Planned versus actual by exercise">
        <div className="kc-card-head">
          <div><h2 className="kc-panel-title">Planned vs actual, by exercise</h2><p className="kc-panel-desc">Trend compares the first third of sessions with the last third and needs at least 4 sessions. Select a row to open the exercise.</p></div>
        </div>
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Exercise</th><th>Sessions</th><th>Repetitions</th><th>Form</th><th>Form trend</th><th>Range reached</th><th>Angle trend</th><th>Pain</th></tr></thead>
            <tbody>
              {sums.map((s) => {
                const ad = s.adherence;
                return (
                  <tr key={s.key} className="kc-row-click" tabIndex={0} onClick={() => goExercise(s.key)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goExercise(s.key))} aria-label={`Open ${s.name}`}>
                    <td><strong>{s.name}</strong><div className="kc-muted" style={{ fontSize: '.82rem' }}>{s.group}</div></td>
                    <td className="kc-num">{ad.due ? <>{ad.done} full · {ad.partial} part · <span style={{ color: ad.missed ? 'var(--kc-danger)' : undefined }}>{ad.missed} missed</span></> : <span className="kc-muted">none due</span>}</td>
                    <td className="kc-num">{ad.repsPlanned ? <><MiniBar value={ad.repsRate} />{ad.repsDone}/{ad.repsPlanned} ({pct(ad.repsRate)})</> : '–'}</td>
                    <td className="kc-num"><strong>{num(s.performance.form, 0)}</strong></td>
                    <td><TrendBadge trend={s.improvement.form} /></td>
                    <td className="kc-num">{s.performance.rom == null ? '–' : `${num(s.performance.rom, 0)}%`}</td>
                    <td><TrendBadge trend={s.improvement.peak} unit="°" /></td>
                    <td className="kc-num">{s.pain.n ? <><strong style={{ color: s.pain.latest >= 6 ? 'var(--kc-danger)' : undefined }}>{s.pain.latest}</strong><span className="kc-muted"> · avg {num(s.pain.mean, 1)}</span></> : <span className="kc-muted">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="kc-meta" style={{ margin: 0 }}>Period shown: {filters.from ? formatLong(filters.from) : 'start'} to {filters.to ? formatLong(filters.to) : 'latest'}. Form score: 50% range reached, 30% control, 20% tempo (plus hold, when prescribed).</p>
    </div>
  );
}
