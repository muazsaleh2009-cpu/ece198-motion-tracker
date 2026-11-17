import React, { useMemo, useState } from 'react';
import { BY_KEY } from '../lib/catalog.js';
import { DAY_KEYS, addDays, formatLong, formatShort, weekStart } from '../lib/dates.js';
import { Badge, Segmented, StatusBadge, deg, statusTone } from '../components/ui.jsx';
import PlanBuilder from '../components/PlanBuilder.jsx';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function scheduleText(item) {
  const s = item.schedule;
  if (s.dates?.length) return `${s.dates.length} specific date${s.dates.length > 1 ? 's' : ''}`;
  const days = DAY_KEYS.filter((d) => s.days_of_week.map((x) => x.toLowerCase().slice(0, 3)).includes(d)).map((d) => DAY_LABEL[DAY_KEYS.indexOf(d)]).join(', ');
  return `${days} · ${formatShort(s.start_date)}${s.end_date ? ` to ${formatShort(s.end_date)}` : ''}`;
}

export default function PlanView({ plan, rows, today, sessionCount, onApplyPlan }) {
  const [mode, setMode] = useState('view');
  const weeks = useMemo(() => {
    if (!rows.length) return [];
    const first = weekStart(rows[0].date);
    const last = weekStart(rows[rows.length - 1].date);
    const out = [];
    for (let w = first; w <= last; w = addDays(w, 7)) {
      out.push({ start: w, days: DAY_LABEL.map((_, i) => { const date = addDays(w, i); return { date, rows: rows.filter((r) => r.date === date) }; }) });
    }
    return out;
  }, [rows]);

  if (mode === 'edit') {
    return <PlanBuilder initialPlan={plan} today={today} sessionCount={sessionCount} onCancel={() => setMode('view')} onApply={(p) => { onApplyPlan(p); setMode('view'); }} />;
  }

  return (
    <div className="kc-stack">
      <header className="kc-hero" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div><h1 className="kc-h1">The plan</h1><p className="kc-lede">What was prescribed, and when.</p></div>
        <Segmented label="Plan view" value={mode} onChange={setMode} options={[{ id: 'view', label: 'Schedule' }, { id: 'edit', label: 'Edit plan' }]} />
      </header>
      <section className="kc-card">
        <div className="kc-panel-header">
          <div>
            <h2 className="kc-panel-title">{plan.name}</h2>
            <p className="kc-panel-desc">Plan ID <span className="kc-code">{plan.plan_id}</span>{plan.start_date ? ` · ${formatLong(plan.start_date)} to ${formatLong(plan.end_date || rows[rows.length - 1]?.date)}` : ''}</p>
          </div>
        </div>
        <div className="kc-grid-eq">
          <dl className="kc-kv">
            <dt>Patient</dt><dd>{plan.patient.name || plan.patient.id} <span className="kc-muted">({plan.patient.id})</span></dd>
            {plan.patient.condition && <><dt>Condition</dt><dd>{plan.patient.condition}</dd></>}
            {plan.supervisor && <><dt>Supervisor</dt><dd>{plan.supervisor.name}{plan.supervisor.role ? `, ${plan.supervisor.role}` : ''}{plan.supervisor.contact ? ` · ${plan.supervisor.contact}` : ''}</dd></>}
            <dt>Scheduled</dt><dd>{rows.length} exercise sessions on {new Set(rows.map((r) => r.date)).size} days</dd>
          </dl>
          <div>
            {plan.goals.length > 0 && <><strong style={{ fontSize: '.9rem' }}>Goals</strong><ul style={{ margin: '4px 0 10px', paddingLeft: 20, fontSize: '.9em' }}>{plan.goals.map((g) => <li key={g}>{g}</li>)}</ul></>}
            {plan.notes && <p style={{ margin: 0, fontSize: '.9em' }}><strong>Notes: </strong>{plan.notes}</p>}
          </div>
        </div>
      </section>

      <section className="kc-card kc-card-flush">
        <div className="kc-card-head"><div><h2 className="kc-panel-title">Prescribed exercises</h2><p className="kc-panel-desc">Targets change on the dates listed under "Progression".</p></div></div>
        <div className="kc-table-scroll">
          <table className="kc-table">
            <thead><tr><th>Exercise</th><th>Sets × reps</th><th>Target angle</th><th>Hold</th><th>Rest</th><th>Side</th><th>Schedule</th><th>Progression / notes</th></tr></thead>
            <tbody>
              {plan.items.map((it) => (
                <tr key={it.item_id}>
                  <td><strong>{BY_KEY[it.exercise_key].name}</strong><div className="kc-muted" style={{ fontSize: '.8em' }}>{BY_KEY[it.exercise_key].angle_label}</div></td>
                  <td className="kc-num">{it.sets} × {it.reps_per_set}</td>
                  <td className="kc-num">{deg(it.target_angle_deg)}</td>
                  <td className="kc-num">{it.hold_seconds ? `${it.hold_seconds} s` : '–'}</td>
                  <td className="kc-num">{it.rest_seconds} s</td>
                  <td>{BY_KEY[it.exercise_key].sided ? it.side : 'both'}</td>
                  <td>{scheduleText(it)}</td>
                  <td style={{ fontSize: '.85em' }}>
                    {it.progression.map((p) => (
                      <div key={p.from_date}>From {formatShort(p.from_date)}: {[p.sets != null && `${p.sets} sets`, p.reps_per_set != null && `${p.reps_per_set} reps`, p.target_angle_deg != null && deg(p.target_angle_deg), p.hold_seconds != null && `hold ${p.hold_seconds} s`].filter(Boolean).join(', ')}</div>
                    ))}
                    {it.notes && <div className="kc-muted">{it.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kc-card kc-card-flush">
        <div className="kc-card-head">
          <div><h2 className="kc-panel-title">Schedule and completion</h2><p className="kc-panel-desc">Each box shows repetitions done / planned. Hover for details.</p></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['done', 'partial', 'missed', 'upcoming'].map((s) => <StatusBadge key={s} status={s} />)}</div>
        </div>
        <div className="kc-table-scroll" style={{ padding: 16 }}>
          <div className="kc-cal" role="table" aria-label="Plan calendar">
            <div className="kc-cal-h">Week of</div>
            {DAY_LABEL.map((d) => <div key={d} className="kc-cal-h">{d}</div>)}
            {weeks.flatMap((w) => [
              <div key={`w${w.start}`} className="kc-cal-wk">{formatShort(w.start)}</div>,
              ...w.days.map((d) => (
                <div key={d.date} className={d.date === today ? 'kc-cal-today' : ''}>
                  <div className="kc-cal-date">{formatShort(d.date)}</div>
                  {d.rows.map((r) => (
                    <span key={r.occ_id} className={`kc-cal-chip kc-tone-${statusTone(r.status)}`} title={`${BY_KEY[r.exercise_key].name}: ${r.reps_done} of ${r.planned_reps} reps (${r.sets}×${r.reps_per_set}) to ${r.target_angle_deg}°`}>
                      {BY_KEY[r.exercise_key].name.split(' (')[0]} {r.status === 'upcoming' || r.status === 'today' ? `0/${r.planned_reps}` : `${r.reps_done}/${r.planned_reps}`}
                    </span>
                  ))}
                </div>
              )),
            ])}
          </div>
        </div>
      </section>
    </div>
  );
}
