// Plan upload: validation, schedule expansion and the downloadable template.
// The scheduling rules are identical to tracker/plan.py. Keep the two in sync.
import { BY_KEY, CATALOG, SCHEMA_MAJOR } from './catalog.js';
import { DAY_KEYS, addDays, isISODate, parseISO, toISO, weekdayIndex } from './dates.js';

const DEFAULT_OPEN_ENDED_DAYS = 83; // 12 weeks, as in the tracker

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Validate a plan object. Returns { errors, warnings, plan }.
 * `plan` is the normalised plan (defaults filled in) and is null when there are errors.
 * Every message says which item is wrong and what is expected, because the person reading it
 * is a clinician editing a JSON file, not a developer.
 */
export function validatePlan(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['The file is not a plan: expected a JSON object.'], warnings, plan: null };
  }
  if (Array.isArray(input.blocks) && !input.items) {
    return { errors: ['This looks like a SESSION file recorded by the tracker, not a plan. Upload it under Data → Session files (after the plan is loaded).'], warnings, plan: null };
  }
  const major = String(input.schema_version ?? '').split('.')[0];
  if (!input.schema_version) errors.push('Missing "schema_version" (expected "1.0").');
  else if (major !== SCHEMA_MAJOR) errors.push(`Unsupported schema_version "${input.schema_version}": this app reads version ${SCHEMA_MAJOR}.x.`);
  if (!input.plan_id || typeof input.plan_id !== 'string') errors.push('Missing "plan_id" (a text identifier for this plan).');
  if (!input.patient || !input.patient.id) errors.push('Missing "patient.id".');
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('"items" must be a non-empty list of exercises.');
    return { errors, warnings, plan: null };
  }

  const seen = new Set();
  const items = input.items.map((raw, i) => {
    const label = `Item ${i + 1}${raw?.item_id ? ` (${raw.item_id})` : ''}`;
    const spec = BY_KEY[raw?.exercise_key];
    if (!raw?.item_id) errors.push(`${label}: missing "item_id".`);
    else if (seen.has(raw.item_id)) errors.push(`${label}: duplicate item_id "${raw.item_id}".`);
    seen.add(raw?.item_id);
    if (!spec) {
      errors.push(`${label}: unknown exercise_key "${raw?.exercise_key}". Supported: ${CATALOG.map((e) => e.key).join(', ')}.`);
      return null;
    }
    if (!isInt(raw.sets) || raw.sets < 1) errors.push(`${label}: "sets" must be a whole number of at least 1.`);
    if (!isInt(raw.reps_per_set) || raw.reps_per_set < 1) errors.push(`${label}: "reps_per_set" must be a whole number of at least 1.`);

    const target = raw.target_angle_deg ?? spec.default_target_angle_deg;
    const [lo, hi] = spec.target_bounds_deg;
    if (!isNum(target) || target < lo || target > hi) {
      errors.push(`${label}: "target_angle_deg" for ${spec.name} must be between ${lo}° and ${hi}° (${spec.angle_label}).`);
    }
    const hold = raw.hold_seconds ?? spec.default_hold_s;
    const rest = raw.rest_seconds ?? 30;
    if (!isNum(hold) || hold < 0) errors.push(`${label}: "hold_seconds" must be 0 or more.`);
    if (!isNum(rest) || rest < 0) errors.push(`${label}: "rest_seconds" must be 0 or more.`);
    const side = raw.side ?? 'auto';
    if (spec.sided && !['left', 'right', 'auto'].includes(side)) errors.push(`${label}: "side" must be "left", "right" or "auto".`);

    const sched = raw.schedule || {};
    const hasDates = Array.isArray(sched.dates) && sched.dates.length > 0;
    const hasRule = sched.start_date && Array.isArray(sched.days_of_week) && sched.days_of_week.length > 0;
    if (!hasDates && !hasRule) {
      errors.push(`${label}: "schedule" needs either "dates" (a list of YYYY-MM-DD) or "start_date" with "days_of_week".`);
    }
    if (hasDates) sched.dates.forEach((d) => !isISODate(d) && errors.push(`${label}: "${d}" is not a valid YYYY-MM-DD date.`));
    if (hasRule) {
      if (!isISODate(sched.start_date)) errors.push(`${label}: schedule.start_date must be YYYY-MM-DD.`);
      if (sched.end_date && !isISODate(sched.end_date)) errors.push(`${label}: schedule.end_date must be YYYY-MM-DD.`);
      sched.days_of_week.forEach((d) => !DAY_KEYS.includes(String(d).toLowerCase().slice(0, 3)) && errors.push(`${label}: "${d}" is not a weekday (use mon, tue, wed, thu, fri, sat, sun).`));
      if (!sched.end_date) warnings.push(input.end_date ? `${label}: no schedule.end_date, so the plan's end_date (${input.end_date}) is used.` : `${label}: no schedule.end_date and the plan has no end_date, so ${DEFAULT_OPEN_ENDED_DAYS + 1} days from the start date are used.`);
    }

    const progression = (raw.progression || []).map((step, k) => {
      if (!isISODate(step.from_date)) errors.push(`${label}: progression step ${k + 1} needs a valid "from_date".`);
      if (step.target_angle_deg != null && (step.target_angle_deg < lo || step.target_angle_deg > hi)) {
        errors.push(`${label}: progression step ${k + 1} target must be between ${lo}° and ${hi}°.`);
      }
      return step;
    });

    return {
      item_id: raw.item_id,
      exercise_key: raw.exercise_key,
      sets: raw.sets,
      reps_per_set: raw.reps_per_set,
      target_angle_deg: target,
      hold_seconds: hold,
      rest_seconds: rest,
      side,
      notes: raw.notes || '',
      schedule: sched,
      progression,
    };
  });

  if (errors.length) return { errors, warnings, plan: null };
  return {
    errors,
    warnings,
    plan: {
      schema_version: input.schema_version,
      plan_id: input.plan_id,
      name: input.name || input.plan_id,
      created_at: input.created_at || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      patient: input.patient,
      supervisor: input.supervisor || null,
      goals: input.goals || [],
      notes: input.notes || '',
      items,
    },
  };
}

/** All calendar days an item is scheduled, ascending. End date: the item's own, else the plan's, else 84 days after the start (same as tracker/plan.py). */
export function itemDates(item, plan = null) {
  const s = item.schedule;
  if (Array.isArray(s.dates) && s.dates.length) return [...new Set(s.dates)].sort();
  const end = s.end_date || plan?.end_date || addDays(s.start_date, DEFAULT_OPEN_ENDED_DAYS);
  const wanted = new Set(s.days_of_week.map((d) => DAY_KEYS.indexOf(String(d).toLowerCase().slice(0, 3))));
  const out = [];
  for (let d = s.start_date; d <= end; d = addDays(d, 1)) if (wanted.has(weekdayIndex(d))) out.push(d);
  return out;
}

/** The prescription on a given day: base values overridden by the latest progression step so far. */
export function prescriptionOn(item, date) {
  const rx = {
    sets: item.sets,
    reps_per_set: item.reps_per_set,
    target_angle_deg: item.target_angle_deg,
    hold_seconds: item.hold_seconds,
    rest_seconds: item.rest_seconds,
  };
  [...item.progression].sort((a, b) => a.from_date.localeCompare(b.from_date)).forEach((step) => {
    if (step.from_date <= date) Object.keys(rx).forEach((k) => step[k] != null && (rx[k] = step[k]));
  });
  return rx;
}

/** Every planned occurrence (one exercise on one day) with its resolved prescription. */
export function expandPlan(plan) {
  const out = [];
  plan.items.forEach((item) => {
    itemDates(item, plan).forEach((date) => {
      const rx = prescriptionOn(item, date);
      out.push({
        occ_id: `${item.item_id}|${date}`,
        item_id: item.item_id,
        exercise_key: item.exercise_key,
        date,
        side: item.side,
        notes: item.notes,
        sets: rx.sets,
        reps_per_set: rx.reps_per_set,
        planned_reps: rx.sets * rx.reps_per_set,
        target_angle_deg: rx.target_angle_deg,
        hold_seconds: rx.hold_seconds,
        rest_seconds: rx.rest_seconds,
      });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.item_id.localeCompare(b.item_id));
}

export function planRange(plan, occurrences) {
  const dates = occurrences.map((o) => o.date);
  return {
    start: plan.start_date || dates[0] || null,
    end: plan.end_date || dates[dates.length - 1] || null,
  };
}

/** A starting point the clinician can edit: downloaded from the Import tab. */
export function planTemplate(startISO) {
  const start = startISO || toISO(new Date());
  const monday = addDays(start, -weekdayIndex(start));
  const pick = ['squat', 'elbow_extension'].map((k) => BY_KEY[k]);
  return {
    schema_version: '1.1',
    plan_id: 'plan-001',
    name: 'Home exercise programme',
    created_at: new Date().toISOString(),
    start_date: monday,
    end_date: addDays(monday, 7 * 8 - 1),
    patient: { id: 'patient-001', name: 'Patient name', condition: '' },
    supervisor: { name: 'Supervisor name', role: 'Physiotherapist', contact: '' },
    goals: ['Describe the goal of the programme'],
    notes: '',
    items: pick.map((spec, i) => ({
      item_id: `${spec.key}-1`,
      exercise_key: spec.key,
      sets: spec.default_sets,
      reps_per_set: spec.default_reps,
      target_angle_deg: spec.default_target_angle_deg,
      hold_seconds: spec.default_hold_s,
      rest_seconds: 45,
      side: spec.sided ? 'auto' : undefined,
      notes: '',
      schedule: { start_date: monday, end_date: addDays(monday, 7 * 8 - 1), days_of_week: i === 0 ? ['mon', 'wed', 'fri'] : ['tue', 'thu', 'sat'] },
    })),
  };
}

export { parseISO };
