// The plan builder form <-> plan.json. A "draft" is what the form edits: every field is a plain value
// (strings for text inputs), so it can be half-finished. draftToPlan() turns it into the exact
// structure the tracker reads, and validatePlan() (plan.js) then judges the result.
import { BY_KEY } from './catalog.js';
import { DAY_KEYS, addDays, toISO, weekdayIndex } from './dates.js';

let uidCounter = 0;
const uid = () => `u${++uidCounter}`;

export function newItemDraft(key, startISO) {
  const spec = BY_KEY[key];
  return {
    uid: uid(),
    exercise_key: key,
    sets: spec.default_sets,
    reps_per_set: spec.default_reps,
    target_angle_deg: spec.default_target_angle_deg,
    hold_seconds: spec.default_hold_s,
    rest_seconds: 45,
    side: 'auto',
    notes: '',
    days: ['mon', 'wed', 'fri'],
    start_date: startISO || '',
    end_date: '',
    progression: [],
  };
}

export function blankDraft(todayISO = toISO(new Date())) {
  const monday = addDays(todayISO, -weekdayIndex(todayISO));
  return {
    plan_id: 'plan-001',
    name: 'Home exercise programme',
    patient: { id: '', name: '', condition: '' },
    supervisor: { name: '', role: 'Physiotherapist', contact: '' },
    start_date: monday,
    end_date: addDays(monday, 7 * 8 - 1),
    goals: '',
    notes: '',
    items: [newItemDraft('squat', monday)],
  };
}

const num = (v) => (v === '' || v == null ? undefined : Number(v));
const text = (v) => (v == null ? '' : String(v));

/** Build plan.json. Item ids are `<exercise_key>-<n>`, numbered per exercise, so they stay readable and unique. */
export function draftToPlan(d, nowISO = new Date().toISOString()) {
  const counts = {};
  const items = d.items.map((it) => {
    counts[it.exercise_key] = (counts[it.exercise_key] || 0) + 1;
    const spec = BY_KEY[it.exercise_key];
    const out = {
      item_id: `${it.exercise_key}-${counts[it.exercise_key]}`,
      exercise_key: it.exercise_key,
      sets: num(it.sets),
      reps_per_set: num(it.reps_per_set),
      target_angle_deg: num(it.target_angle_deg),
      hold_seconds: num(it.hold_seconds),
      rest_seconds: num(it.rest_seconds),
    };
    if (spec?.sided) out.side = it.side || 'auto';
    if (text(it.notes).trim()) out.notes = text(it.notes).trim();
    out.schedule = {
      start_date: it.start_date || d.start_date || undefined,
      ...(it.end_date || d.end_date ? { end_date: it.end_date || d.end_date } : {}),
      days_of_week: DAY_KEYS.filter((k) => it.days.includes(k)),
    };
    const steps = it.progression.filter((p) => p.from_date).map((p) => {
      const step = { from_date: p.from_date };
      ['sets', 'reps_per_set', 'target_angle_deg', 'hold_seconds', 'rest_seconds'].forEach((k) => { if (num(p[k]) !== undefined) step[k] = num(p[k]); });
      return step;
    });
    if (steps.length) out.progression = steps;
    return JSON.parse(JSON.stringify(out)); // drop undefined
  });
  const plan = {
    schema_version: '1.1',
    plan_id: text(d.plan_id).trim(),
    name: text(d.name).trim() || text(d.plan_id).trim(),
    created_at: nowISO,
    ...(d.start_date ? { start_date: d.start_date } : {}),
    ...(d.end_date ? { end_date: d.end_date } : {}),
    patient: { id: text(d.patient.id).trim(), name: text(d.patient.name).trim(), condition: text(d.patient.condition).trim() },
    supervisor: { name: text(d.supervisor.name).trim(), role: text(d.supervisor.role).trim(), contact: text(d.supervisor.contact).trim() },
    goals: text(d.goals).split('\n').map((g) => g.trim()).filter(Boolean),
    notes: text(d.notes).trim(),
    items,
  };
  return plan;
}

/** Load an existing (validated) plan into the form for editing. */
export function planToDraft(plan) {
  return {
    plan_id: plan.plan_id,
    name: plan.name || '',
    patient: { id: plan.patient.id || '', name: plan.patient.name || '', condition: plan.patient.condition || '' },
    supervisor: { name: plan.supervisor?.name || '', role: plan.supervisor?.role || '', contact: plan.supervisor?.contact || '' },
    start_date: plan.start_date || '',
    end_date: plan.end_date || '',
    goals: (plan.goals || []).join('\n'),
    notes: plan.notes || '',
    items: plan.items.map((it) => {
      const s = it.schedule || {};
      const explicit = Array.isArray(s.dates) && s.dates.length;
      return {
        uid: uid(),
        exercise_key: it.exercise_key,
        sets: it.sets,
        reps_per_set: it.reps_per_set,
        target_angle_deg: it.target_angle_deg,
        hold_seconds: it.hold_seconds,
        rest_seconds: it.rest_seconds,
        side: it.side || 'auto',
        notes: it.notes || '',
        // A plan written with explicit dates cannot be shown as weekdays; the form keeps its first and last date as a range.
        days: explicit ? [...new Set(s.dates.map((x) => DAY_KEYS[weekdayIndex(x)]))] : (s.days_of_week || []).map((x) => String(x).toLowerCase().slice(0, 3)),
        start_date: explicit ? [...s.dates].sort()[0] : (s.start_date || ''),
        end_date: explicit ? [...s.dates].sort().slice(-1)[0] : (s.end_date || ''),
        progression: (it.progression || []).map((p) => ({ from_date: p.from_date, sets: p.sets ?? '', reps_per_set: p.reps_per_set ?? '', target_angle_deg: p.target_angle_deg ?? '', hold_seconds: p.hold_seconds ?? '', rest_seconds: p.rest_seconds ?? '' })),
      };
    }),
  };
}

/** Number of exercise sessions a draft would schedule (for the live summary). Uses the same rules as plan.js. */
export function plannedCount(plan, expand) {
  return expand(plan).length;
}
