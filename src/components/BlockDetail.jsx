import React from 'react';
import { BY_KEY, flagLabel } from '../lib/catalog.js';
import { formatDuration } from '../lib/dates.js';
import { Badge, deg, num } from './ui.jsx';
import { TimeChart } from './charts.jsx';

const ENDED = { target_reached: 'Reached rep target', manual: 'Ended by patient', session_ended: 'Session ended', exercise_skipped: 'Skipped to next exercise' };

/** Everything the tracker recorded for one exercise block: setup, sets, every repetition, the angle trace. */
export default function BlockDetail({ block }) {
  const spec = BY_KEY[block.exercise_key];
  const rx = block.prescribed;
  const samples = block.angle_trace?.samples || [];
  const all = samples.map((s) => s[1]).concat([block.angle.start_angle_deg, block.angle.target_angle_deg]);
  const lo = Math.floor((Math.min(...all) - 5) / 10) * 10;
  const hi = Math.ceil((Math.max(...all) + 5) / 10) * 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="kc-grid-eq">
        <dl className="kc-kv">
          <dt>Measured angle</dt><dd>{block.angle.name}</dd>
          <dt>Meaning</dt><dd style={{ fontWeight: 500 }}>{block.angle.convention}</dd>
          <dt>Side / camera</dt><dd>{block.side} side, {block.camera_view} view</dd>
          <dt>Prescribed</dt><dd>{rx.sets} × {rx.reps_per_set} reps to {deg(rx.target_angle_deg)}{rx.hold_seconds ? `, hold ${rx.hold_seconds} s` : ''}</dd>
          <dt>Duration</dt><dd>{formatDuration(block.duration_s)} ({block.time})</dd>
          <dt>Patient check-in</dt>
          <dd>{block.patient_report ? <>Pain {block.patient_report.pain_0_10 ?? '–'} / 10 · effort {block.patient_report.effort_0_10 ?? '–'} / 10{block.patient_report.note ? <span style={{ fontWeight: 500 }}> · “{block.patient_report.note}”</span> : null}</> : <span className="kc-muted">Not answered</span>}</dd>
          <dt>Tracking quality</dt>
          <dd>
            {num(block.tracking.valid_pct, 0)}% of frames usable
            {block.tracking.camera_view_mismatch_pct > 30 && <> <Badge tone="warn">Camera view looked wrong for {num(block.tracking.camera_view_mismatch_pct, 0)}% of frames</Badge></>}
          </dd>
        </dl>
        {samples.length > 1 ? (
          <TimeChart
            xType="number" ariaLabel={`${block.angle.name} over time`}
            series={[{ id: 'a', name: block.angle.name, color: 'teal', noDots: true, points: samples.map(([t, a]) => ({ x: t, y: a, tip: { title: `${t.toFixed(1)} s` } })) }]}
            refLines={[{ y: block.angle.target_angle_deg, label: `Target ${block.angle.target_angle_deg}°`, color: 'amber' }, { y: block.angle.start_angle_deg, label: `Start ${block.angle.start_angle_deg}°`, color: 'grey' }]}
            yMin={lo} yMax={hi} yFormat={(v) => `${v}°`} height={230} gapX={3} xFormat={(v) => `${Math.round(v)}s`}
          />
        ) : <div className="kc-empty-chart">No angle trace recorded for this block.</div>}
      </div>

      {block.sets.map((set) => (
        <div key={set.set_number}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <strong>Set {set.set_number}</strong>
            <Badge tone={set.completed_reps >= set.target_reps ? 'good' : 'warn'}>{set.completed_reps} / {set.target_reps} reps</Badge>
            <span className="kc-muted" style={{ fontSize: '.85em' }}>{ENDED[set.ended_by] || set.ended_by}{set.attempts_not_counted ? ` · ${set.attempts_not_counted} attempt${set.attempts_not_counted > 1 ? 's' : ''} not counted` : ''}</span>
          </div>
          <div className="kc-table-scroll">
            <table className="kc-table" style={{ background: 'var(--kc-surface)' }}>
              <thead>
                <tr>
                  <th>Rep</th><th>Peak angle</th><th>Range of motion</th><th>Form</th><th>Hold</th><th>Duration</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {set.reps.map((r, i) => (
                  <tr key={i} style={r.counted ? undefined : { opacity: 0.65 }}>
                    <td className="kc-num">{r.counted ? r.rep_index : 'not counted'}</td>
                    <td className="kc-num">{deg(r.peak_angle_deg, 1)} <span className="kc-muted">/ {deg(r.target_angle_deg)}</span></td>
                    <td className="kc-num">{num(r.rom_pct, 0)}%</td>
                    <td className="kc-num"><strong>{num(r.form_score, 0)}</strong></td>
                    <td className="kc-num">{r.hold_s ? `${num(r.hold_s, 1)} s` : '–'}</td>
                    <td className="kc-num">{num(r.duration_s, 1)} s</td>
                    <td>{(r.flags || []).length ? (r.flags || []).map((f) => <Badge key={f} tone={f === 'short_of_target' ? 'neutral' : 'warn'}>{flagLabel(f, block.exercise_key)}</Badge>) : <span className="kc-muted">Good form</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {spec && <p className="kc-muted" style={{ margin: 0, fontSize: '.82em' }}>Form score = 50% range reached, 30% control (no compensating movement), 20% tempo (hold counts too if one was prescribed).</p>}
    </div>
  );
}
