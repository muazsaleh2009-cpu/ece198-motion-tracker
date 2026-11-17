import React, { useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { BY_KEY, CATALOG, GROUPS } from '../lib/catalog.js';
import { DAY_KEYS, addDays, parseISO } from '../lib/dates.js';
import { expandPlan, validatePlan } from '../lib/plan.js';
import { blankDraft, draftToPlan, newItemDraft, planToDraft } from '../lib/planBuilder.js';
import { Notice, downloadFile } from './ui.jsx';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Field({ id, label, help, children }) {
  return <div className="kc-field"><label htmlFor={id}>{label}</label>{children}{help && <span className="kc-help">{help}</span>}</div>;
}

/**
 * Build or edit a plan without touching JSON. It edits a "draft" (lib/planBuilder.js), shows what the
 * validator says as you go, and either applies the plan here or downloads plan.json for the tracker.
 */
export default function PlanBuilder({ initialPlan, today, onApply, onCancel, sessionCount = 0 }) {
  const [draft, setDraft] = useState(() => (initialPlan ? planToDraft(initialPlan) : blankDraft(today)));
  const [adding, setAdding] = useState('squat');
  const built = useMemo(() => draftToPlan(draft), [draft]);
  const result = useMemo(() => validatePlan(built), [built]);
  const sessionsScheduled = result.plan ? expandPlan(result.plan) : [];
  const dayCount = new Set(sessionsScheduled.map((o) => o.date)).size;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setIn = (group, patch) => setDraft((d) => ({ ...d, [group]: { ...d[group], ...patch } }));
  const setItem = (uid, patch) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)) }));
  const removeItem = (uid) => setDraft((d) => ({ ...d, items: d.items.filter((it) => it.uid !== uid) }));
  const toggleDay = (it, key) => setItem(it.uid, { days: it.days.includes(key) ? it.days.filter((k) => k !== key) : [...it.days, key] });
  const addStep = (it) => setItem(it.uid, { progression: [...it.progression, { from_date: addDays(it.start_date || draft.start_date || today, 14), sets: '', reps_per_set: '', target_angle_deg: '', hold_seconds: '', rest_seconds: '' }] });
  const setStep = (it, i, patch) => setItem(it.uid, { progression: it.progression.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const removeStep = (it, i) => setItem(it.uid, { progression: it.progression.filter((_, k) => k !== i) });

  return (
    <div className="kc-stack">
      <header className="kc-hero">
        <h1 className="kc-h1">{initialPlan ? 'Edit the plan' : 'Build the plan'}</h1>
        <p className="kc-lede">Choose the exercises, how much of each, and on which days. The plan is checked as you type. Use it here, or download <span className="kc-code">plan.json</span> for the tracker.</p>
        {initialPlan && sessionCount > 0 && <p className="kc-meta">{sessionCount} recorded sessions stay in the app and are matched to the edited plan by exercise and date.</p>}
      </header>

      <section className="kc-card" aria-labelledby="kc-pb-patient">
        <h2 id="kc-pb-patient" className="kc-panel-title" style={{ marginBottom: 14 }}>Patient and supervisor</h2>
        <div className="kc-form-grid">
          <Field id="pb-pid" label="Patient ID" help="Required. Session files must carry the same ID."><input id="pb-pid" className="kc-input" value={draft.patient.id} onChange={(e) => setIn('patient', { id: e.target.value })} placeholder="pt-001" /></Field>
          <Field id="pb-pname" label="Patient name"><input id="pb-pname" className="kc-input" value={draft.patient.name} onChange={(e) => setIn('patient', { name: e.target.value })} /></Field>
          <Field id="pb-cond" label="Condition"><input id="pb-cond" className="kc-input" value={draft.patient.condition} onChange={(e) => setIn('patient', { condition: e.target.value })} placeholder="e.g. after knee surgery" /></Field>
          <Field id="pb-sname" label="Supervisor"><input id="pb-sname" className="kc-input" value={draft.supervisor.name} onChange={(e) => setIn('supervisor', { name: e.target.value })} /></Field>
          <Field id="pb-srole" label="Role"><input id="pb-srole" className="kc-input" value={draft.supervisor.role} onChange={(e) => setIn('supervisor', { role: e.target.value })} /></Field>
          <Field id="pb-scontact" label="Contact"><input id="pb-scontact" className="kc-input" value={draft.supervisor.contact} onChange={(e) => setIn('supervisor', { contact: e.target.value })} placeholder="email or phone" /></Field>
        </div>
      </section>

      <section className="kc-card" aria-labelledby="kc-pb-prog">
        <h2 id="kc-pb-prog" className="kc-panel-title" style={{ marginBottom: 14 }}>The programme</h2>
        <div className="kc-form-grid" style={{ marginBottom: 14 }}>
          <Field id="pb-name" label="Programme name"><input id="pb-name" className="kc-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field id="pb-id" label="Plan ID" help="A short unique code."><input id="pb-id" className="kc-input" value={draft.plan_id} onChange={(e) => set({ plan_id: e.target.value })} /></Field>
          <Field id="pb-start" label="Starts"><input id="pb-start" type="date" className="kc-input" value={draft.start_date} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field id="pb-end" label="Ends"><input id="pb-end" type="date" className="kc-input" value={draft.end_date} min={draft.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} /></Field>
        </div>
        <div className="kc-form-grid">
          <Field id="pb-goals" label="Goals" help="One per line."><textarea id="pb-goals" className="kc-textarea" value={draft.goals} onChange={(e) => set({ goals: e.target.value })} /></Field>
          <Field id="pb-notes" label="Notes for the patient"><textarea id="pb-notes" className="kc-textarea" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Stop and call the clinic if you feel sharp pain." /></Field>
        </div>
      </section>

      <section aria-labelledby="kc-pb-items" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 id="kc-pb-items" className="kc-panel-title">Exercises</h2>
        {draft.items.length === 0 && <div className="kc-empty-chart">No exercises yet. Add one below.</div>}
        {draft.items.map((it, n) => {
          const spec = BY_KEY[it.exercise_key];
          const [lo, hi] = spec.target_bounds_deg;
          const dom = it.uid;
          return (
            <article key={it.uid} className="kc-item-card" aria-label={spec.name}>
              <div className="kc-item-head">
                <div><strong className="kc-serif" style={{ fontSize: '1.15rem' }}>{spec.name}</strong><div className="kc-meta">{spec.angle_label} · {spec.camera_view} view · exercise {n + 1} of {draft.items.length}</div></div>
                <button type="button" className="kc-btn kc-btn-quiet kc-btn-sm" onClick={() => removeItem(it.uid)} aria-label={`Remove ${spec.name}`}><Trash2 size={14} aria-hidden="true" /> Remove</button>
              </div>
              <div className="kc-item-body">
                <div className="kc-form-grid">
                  <Field id={`sets-${dom}`} label="Sets"><input id={`sets-${dom}`} type="number" min="1" step="1" className="kc-input" value={it.sets} onChange={(e) => setItem(it.uid, { sets: e.target.value })} /></Field>
                  <Field id={`reps-${dom}`} label="Repetitions per set"><input id={`reps-${dom}`} type="number" min="1" step="1" className="kc-input" value={it.reps_per_set} onChange={(e) => setItem(it.uid, { reps_per_set: e.target.value })} /></Field>
                  <Field id={`tgt-${dom}`} label="Target angle (°)" help={`Allowed ${lo}° to ${hi}°. Starts near ${spec.start_angle_deg}°.`}><input id={`tgt-${dom}`} type="number" min={lo} max={hi} step="1" className="kc-input" value={it.target_angle_deg} onChange={(e) => setItem(it.uid, { target_angle_deg: e.target.value })} /></Field>
                  <Field id={`hold-${dom}`} label="Hold at the target (s)"><input id={`hold-${dom}`} type="number" min="0" step="0.5" className="kc-input" value={it.hold_seconds} onChange={(e) => setItem(it.uid, { hold_seconds: e.target.value })} /></Field>
                  <Field id={`rest-${dom}`} label="Rest between sets (s)"><input id={`rest-${dom}`} type="number" min="0" step="5" className="kc-input" value={it.rest_seconds} onChange={(e) => setItem(it.uid, { rest_seconds: e.target.value })} /></Field>
                  {spec.sided && (
                    <Field id={`side-${dom}`} label="Side" help="Auto picks the limb that moves."><select id={`side-${dom}`} className="kc-select" value={it.side} onChange={(e) => setItem(it.uid, { side: e.target.value })}><option value="auto">Auto</option><option value="left">Left</option><option value="right">Right</option></select></Field>
                  )}
                </div>

                <div className="kc-field">
                  <span className="kc-label" id={`days-${dom}`}>Days of the week</span>
                  <div className="kc-days" role="group" aria-labelledby={`days-${dom}`}>
                    {DAY_KEYS.map((k, i) => <button key={k} type="button" className="kc-day-btn" aria-pressed={it.days.includes(k)} onClick={() => toggleDay(it, k)}>{DAY_LABEL[i]}</button>)}
                  </div>
                </div>
                <div className="kc-form-grid">
                  <Field id={`from-${dom}`} label="From" help="Blank = the programme start."><input id={`from-${dom}`} type="date" className="kc-input" value={it.start_date} onChange={(e) => setItem(it.uid, { start_date: e.target.value })} /></Field>
                  <Field id={`to-${dom}`} label="Until" help="Blank = the programme end."><input id={`to-${dom}`} type="date" className="kc-input" value={it.end_date} min={it.start_date || undefined} onChange={(e) => setItem(it.uid, { end_date: e.target.value })} /></Field>
                  <Field id={`note-${dom}`} label="Note for this exercise"><input id={`note-${dom}`} className="kc-input" value={it.notes} onChange={(e) => setItem(it.uid, { notes: e.target.value })} placeholder="e.g. Chest up, heels down" /></Field>
                </div>

                <div className="kc-field">
                  <span className="kc-label">Progression</span>
                  <span className="kc-help">From a date, change any of the numbers. The latest step that has started applies.</span>
                  {it.progression.map((st, i) => (
                    <div key={i} className="kc-prog-row">
                      <Field id={`pf-${dom}-${i}`} label="From date"><input id={`pf-${dom}-${i}`} type="date" className="kc-input" value={st.from_date} onChange={(e) => setStep(it, i, { from_date: e.target.value })} /></Field>
                      <Field id={`ps-${dom}-${i}`} label="Sets"><input id={`ps-${dom}-${i}`} type="number" min="1" className="kc-input" value={st.sets} onChange={(e) => setStep(it, i, { sets: e.target.value })} placeholder="same" /></Field>
                      <Field id={`pr-${dom}-${i}`} label="Reps"><input id={`pr-${dom}-${i}`} type="number" min="1" className="kc-input" value={st.reps_per_set} onChange={(e) => setStep(it, i, { reps_per_set: e.target.value })} placeholder="same" /></Field>
                      <Field id={`pt-${dom}-${i}`} label="Target (°)"><input id={`pt-${dom}-${i}`} type="number" min={lo} max={hi} className="kc-input" value={st.target_angle_deg} onChange={(e) => setStep(it, i, { target_angle_deg: e.target.value })} placeholder="same" /></Field>
                      <Field id={`ph-${dom}-${i}`} label="Hold (s)"><input id={`ph-${dom}-${i}`} type="number" min="0" step="0.5" className="kc-input" value={st.hold_seconds} onChange={(e) => setStep(it, i, { hold_seconds: e.target.value })} placeholder="same" /></Field>
                      <button type="button" className="kc-btn kc-btn-quiet kc-btn-sm" onClick={() => removeStep(it, i)} aria-label={`Remove progression step ${i + 1}`}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  ))}
                  <div><button type="button" className="kc-btn kc-btn-secondary kc-btn-sm" onClick={() => addStep(it)}><Plus size={14} aria-hidden="true" /> Add a progression step</button></div>
                </div>
              </div>
            </article>
          );
        })}

        <div className="kc-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field id="pb-add" label="Add an exercise">
            <select id="pb-add" className="kc-select" value={adding} onChange={(e) => setAdding(e.target.value)} style={{ minWidth: 280 }}>
              {GROUPS.map((g) => <optgroup key={g} label={g}>{CATALOG.filter((e) => e.group === g).map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}</optgroup>)}
            </select>
          </Field>
          <button type="button" className="kc-btn kc-btn-secondary" onClick={() => set({ items: [...draft.items, newItemDraft(adding, draft.start_date)] })}><Plus size={16} aria-hidden="true" /> Add exercise</button>
        </div>
      </section>

      {result.errors.length > 0 && (
        <Notice tone="bad" title={`${result.errors.length} thing${result.errors.length > 1 ? 's' : ''} to fix before this plan can be used`}>
          <ul>{result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>
          {result.errors.length > 8 && <div>…and {result.errors.length - 8} more.</div>}
        </Notice>
      )}
      {result.plan && result.warnings.length > 0 && <Notice tone="warn" title="Worth a look"><ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></Notice>}

      <div className="kc-builder-bar" role="region" aria-label="Plan summary and actions">
        <div aria-live="polite">
          {result.plan ? <><strong>{sessionsScheduled.length} exercise sessions</strong> on {dayCount} days, {draft.start_date} to {draft.end_date || 'the last scheduled day'}.</> : <strong>Not ready yet</strong>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {onCancel && <button type="button" className="kc-btn kc-btn-quiet" onClick={onCancel}>Cancel</button>}
          <button type="button" className="kc-btn kc-btn-secondary" disabled={!result.plan} onClick={() => downloadFile('plan.json', JSON.stringify(built, null, 2))}><Download size={16} aria-hidden="true" /> Download plan.json</button>
          <button type="button" className="kc-btn kc-btn-primary" disabled={!result.plan} onClick={() => onApply(result.plan)}>{initialPlan ? 'Save changes' : 'Use this plan'}</button>
        </div>
      </div>
    </div>
  );
}
