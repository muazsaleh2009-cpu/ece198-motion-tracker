import React, { useMemo, useState } from 'react';
import { blockPoint, exerciseSummaries, filterBlocks, filterRows } from '../lib/analytics.js';
import { BY_KEY } from '../lib/catalog.js';
import { formatShort } from '../lib/dates.js';
import { Ledger, MiniBar, StatusBadge, TrendBadge, deg, num, pct } from '../components/ui.jsx';
import RomDial from '../components/RomDial.jsx';
import { TimeChart } from '../components/charts.jsx';
import BlockDetail from '../components/BlockDetail.jsx';

const painOf = (bs) => { const v = bs.map((b) => b.patient_report?.pain_0_10).filter((x) => x != null); return v.length ? Math.max(...v) : null; };

export default function ExerciseView({ exKey, all, blocks, filters }) {
  const spec = BY_KEY[exKey];
  const [open, setOpen] = useState(null);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const f = useMemo(() => ({ ...filters, exercises: new Set([exKey]) }), [filters, exKey]);
  const rows = useMemo(() => filterRows(all.rows, f), [all.rows, f]);
  const myBlocks = useMemo(() => filterBlocks(blocks, f), [blocks, f]);
  const sum = useMemo(() => exerciseSummaries(rows, myBlocks)[0], [rows, myBlocks]);
  const points = useMemo(() => myBlocks.map(blockPoint), [myBlocks]);
  const unplanned = all.unplanned.filter((b) => b.exercise_key === exKey && (!f.from || b.date >= f.from) && (!f.to || b.date <= f.to));

  if (!sum) {
    return <section className="kc-card"><div className="kc-empty-chart">{spec.name} is not in the plan and has no recorded sessions in this period.</div></section>;
  }
  const latest = [...myBlocks].reverse()[0];
  const ad = sum.adherence;
  const pf = sum.performance;
  const values = points.flatMap((p) => [p.peak, p.target, p.start]).filter((v) => v != null).concat([spec.start_angle_deg, spec.default_target_angle_deg]);
  const yLo = Math.max(-20, Math.floor((Math.min(...values) - 8) / 10) * 10);
  const yHi = Math.ceil((Math.max(...values) + 8) / 10) * 10;
  const tip = (p) => ({ title: `${formatShort(p.date)} ${p.time}`, rows: [['Reps', `${p.reps} / ${p.planned}`], ['Form', num(p.form, 0)], ['Range reached', `${num(p.rom, 0)}%`]] });
  const best = points.length ? (spec.direction === 'increase' ? Math.max(...points.map((p) => p.peak)) : Math.min(...points.map((p) => p.peak))) : null;

  return (
    <div className="kc-stack">
      <header className="kc-hero">
        <h1 className="kc-h1">{spec.name}</h1>
        <p className="kc-lede">{spec.description}</p>
      </header>

      <section className="kc-card" aria-label="About this exercise">
        <div className="kc-about">
          <RomDial name="Latest session" start={latest?.angle.start_angle_deg ?? spec.start_angle_deg} target={latest?.angle.target_angle_deg ?? spec.default_target_angle_deg} peak={latest?.summary.avg_peak_angle_deg ?? null} caption={latest ? `${formatShort(latest.date)} · ${num(latest.summary.avg_rom_pct, 0)}% of range` : 'No sessions yet'} />
          <dl className="kc-kv">
            <dt>Measured angle</dt><dd>{spec.angle_label}</dd>
            <dt>Meaning</dt><dd style={{ fontWeight: 500 }}>{spec.convention}</dd>
            <dt>Range</dt><dd>Starts near {spec.start_angle_deg}°. Default target {spec.default_target_angle_deg}° (allowed {spec.target_bounds_deg[0]}° to {spec.target_bounds_deg[1]}°)</dd>
            <dt>Camera set-up</dt><dd style={{ fontWeight: 500 }}>{spec.setup}</dd>
          </dl>
          <div>
            <strong style={{ fontSize: '.9rem' }}>Form checks used for the score</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: '.92rem' }}>
              {spec.form_checks.map((c) => <li key={c.key}>{c.label}: flagged beyond {c.limit_deg}°{c.mode === 'drift' ? ' of movement during a rep' : ''}</li>)}
              <li>Tempo: one repetition should take {spec.rep_duration_s[0]} to {spec.rep_duration_s[1]} s</li>
            </ul>
          </div>
        </div>
      </section>

      <Ledger items={[
        { label: 'Adherence', value: ad.repsRate == null ? '–' : Math.round(ad.repsRate * 100), unit: ad.repsRate == null ? '' : '%', note: <span>{ad.repsDone} of {ad.repsPlanned} reps · {ad.done} full · {ad.partial} part · {ad.missed} missed</span> },
        { label: 'Form score', value: num(pf.form, 0), unit: '/ 100', note: <><span>Trend</span><TrendBadge trend={sum.improvement.form} /></> },
        { label: 'Range reached', value: pf.rom == null ? '–' : Math.round(pf.rom), unit: pf.rom == null ? '' : '%', note: <><span>{pct(pf.reachedPct)} hit target</span><TrendBadge trend={sum.improvement.rom} unit="%" /></> },
        { label: 'Best peak angle', value: best == null ? '–' : Math.round(best), unit: best == null ? '' : '°', note: <><span>Average {deg(pf.peak, 0)}</span><TrendBadge trend={sum.improvement.peak} unit="°" /></> },
        { label: 'Pain after exercise', value: sum.pain.mean == null ? '–' : num(sum.pain.mean, 1), unit: sum.pain.mean == null ? '' : '/ 10', note: sum.pain.n ? <><span>Latest {sum.pain.latest}/10</span><TrendBadge trend={sum.improvement.pain} /></> : <span>No ratings yet</span> },
      ]} />

      <div className="kc-grid-eq">
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Peak angle vs target</h2><p className="kc-panel-desc">{spec.angle_label}. {spec.direction === 'decrease' ? 'Lower is closer to the target.' : 'Higher is closer to the target.'}</p></div></div>
          {points.length ? (
            <TimeChart ariaLabel={`${spec.name} peak angle against target`} yMin={yLo} yMax={yHi} yTicks={Math.round((yHi - yLo) / 10) + 1 > 7 ? 5 : Math.round((yHi - yLo) / 10) + 1} yFormat={(v) => `${Math.round(v)}°`}
              series={[
                { id: 'peak', name: 'Average peak angle', color: 'teal', points: points.map((p) => ({ x: p.date, y: p.peak, tip: tip(p) })) },
                { id: 'target', name: 'Prescribed target', color: 'amber', dashed: true, noDots: true, thin: true, points: points.map((p) => ({ x: p.date, y: p.target })) },
              ]}
              refLines={[{ y: spec.start_angle_deg, label: `Start ${spec.start_angle_deg}°`, color: 'grey' }]} />
          ) : <div className="kc-empty-chart">No sessions recorded in this period.</div>}
        </section>
        <section className="kc-card">
          <div className="kc-panel-header"><div><h2 className="kc-panel-title">Form and range reached</h2><p className="kc-panel-desc">Per session. Scores of 85 and above are good form.</p></div></div>
          {points.length ? (
            <TimeChart ariaLabel={`${spec.name} form score and range`} yFormat={(v) => `${v}`} yMin={Math.max(0, Math.floor((Math.min(...points.flatMap((x) => [x.form, x.rom]).filter((v) => v != null), 85) - 10) / 10) * 10)} yMax={100}
              series={[
                { id: 'form', name: 'Form score', color: 'teal', points: points.map((p) => ({ x: p.date, y: p.form, tip: tip(p) })) },
                { id: 'rom', name: 'Range reached %', color: 'blue', dashed: true, points: points.map((p) => ({ x: p.date, y: p.rom, tip: tip(p) })) },
              ]}
              refLines={[{ y: 85, label: 'Good form (85)', color: 'amber' }]} />
          ) : <div className="kc-empty-chart">No sessions recorded in this period.</div>}
        </section>
      </div>

      <div className="kc-grid-eq">
      <section className="kc-card" aria-label="Pain and effort">
        <div className="kc-panel-header"><div><h2 className="kc-panel-title">Pain and effort</h2><p className="kc-panel-desc">The patient&apos;s own ratings after each session, 0 to 10. Pain should stay low and fall as the patient gets stronger.</p></div></div>
        {points.some((p) => p.pain != null || p.effort != null) ? (
          <TimeChart ariaLabel={`${spec.name} pain and effort ratings`} yMin={0} yMax={10} yTicks={6} yFormat={(v) => `${v}`}
            series={[
              { id: 'pain', name: 'Pain', color: 'rose', points: points.filter((p) => p.pain != null).map((p) => ({ x: p.date, y: p.pain, tip: tip(p) })) },
              { id: 'effort', name: 'Effort', color: 'blue', dashed: true, points: points.filter((p) => p.effort != null).map((p) => ({ x: p.date, y: p.effort, tip: tip(p) })) },
            ]}
            refLines={[{ y: 6, label: 'High pain (6)', color: 'rose' }]} />
        ) : <div className="kc-empty-chart">No ratings yet. The tracker asks for pain and effort after each exercise.</div>}
      </section>

      {sum.flags.length > 0 && (
        <section className="kc-card" aria-label="Common issues">
          <h2 className="kc-panel-title" style={{ marginBottom: 12 }}>Common issues</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sum.flags.map((fl) => (
              <div key={fl.flag} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '.9em' }}>
                <span style={{ flex: '0 0 280px', maxWidth: '45%' }}>{fl.label}</span>
                <MiniBar value={Math.min(1, fl.pct)} tone="var(--kc-accent)" />
                <span className="kc-num">{fl.count} reps ({pct(fl.pct)})</span>
              </div>
            ))}
          </div>
        </section>
      )}

      </div>

      <section className="kc-card kc-card-flush" aria-label="Scheduled sessions">
        <div className="kc-card-head"><div><h2 className="kc-panel-title">Every scheduled session</h2><p className="kc-panel-desc">Planned vs done. Open a row to see each set and repetition.</p></div>{rows.some((r) => r.status === 'upcoming') && <button type="button" className="kc-btn kc-btn-secondary kc-btn-sm" aria-pressed={showUpcoming} onClick={() => setShowUpcoming((v) => !v)}>{showUpcoming ? 'Hide' : 'Show'} {rows.filter((r) => r.status === 'upcoming').length} upcoming</button>}</div>
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Date</th><th>Planned</th><th>Done</th><th>Peak angle</th><th>Form</th><th>Pain</th><th>Status</th><th><span className="kc-sr">Details</span></th></tr></thead>
            <tbody>
              {[...rows].filter((r) => showUpcoming || (r.status !== 'upcoming')).reverse().flatMap((r) => {
                const isOpen = open === r.occ_id;
                const peak = r.blocks.length ? r.blocks.reduce((s, b) => s + b.summary.avg_peak_angle_deg * b.summary.reps_completed, 0) / Math.max(1, r.reps_done) : null;
                return [
                  <tr key={r.occ_id}>
                    <td className="kc-num"><strong>{formatShort(r.date)}</strong></td>
                    <td className="kc-num">{r.sets} × {r.reps_per_set} to {deg(r.target_angle_deg)}</td>
                    <td className="kc-num"><MiniBar value={r.pct} />{r.reps_done} / {r.planned_reps}</td>
                    <td className="kc-num">{peak == null ? '–' : deg(peak, 1)}</td>
                    <td className="kc-num"><strong>{num(r.form, 0)}</strong></td>
                    <td className="kc-num">{painOf(r.blocks) == null ? <span className="kc-muted">–</span> : <span style={{ color: painOf(r.blocks) >= 6 ? 'var(--kc-danger)' : undefined, fontWeight: 700 }}>{painOf(r.blocks)}</span>}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.blocks.length > 0 && <button type="button" className="kc-expander" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.occ_id)}>{isOpen ? 'Hide' : 'Details'}</button>}</td>
                  </tr>,
                  isOpen && <tr key={`${r.occ_id}-d`} className="kc-row-detail"><td colSpan={8}>{r.blocks.map((b) => <BlockDetail key={b.block_id} block={b} />)}</td></tr>,
                ];
              })}
              {unplanned.map((b) => (
                <tr key={b.block_id}><td className="kc-num"><strong>{formatShort(b.date)}</strong></td><td className="kc-muted">Not on plan</td><td className="kc-num">{b.summary.reps_completed} reps</td><td className="kc-num">{deg(b.summary.avg_peak_angle_deg, 1)}</td><td className="kc-num"><strong>{num(b.summary.avg_form_score, 0)}</strong></td><td className="kc-num">{b.patient_report?.pain_0_10 ?? '–'}</td><td><StatusBadge status="partial" /></td><td /></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
