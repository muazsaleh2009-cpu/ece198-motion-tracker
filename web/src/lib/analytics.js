// Planned-versus-actual analytics. Pure functions, no React, so they can be tested in Node.
//
// DEFINITIONS (the same ones are shown to the user on the Overview tab):
//   Occurrence   one exercise scheduled on one day (from the plan).
//   Due          an occurrence whose date is before today, or that already has recorded work.
//   Adherence    repetitions done / repetitions planned, over due occurrences. Extra reps beyond
//                the plan do not count, so a double session cannot hide a missed one.
//   Performance  rep-weighted averages of form score, range of motion and target-reached rate.
//   Consistency  (a) adherence as above, (b) the current/longest streak of days with >= 80%
//                of the planned repetitions done, (c) rep-to-rep spread of the peak angle.
//   Improvement  mean of the last third of sessions minus the mean of the first third
//                (needs 4 or more sessions). Changes within +/-2 points (or degrees) are "stable".
//   Pain         the patient's own 0-10 rating after each exercise (lower is better). A "flare" is the
//                latest rating >= 8, or the last two ratings of an exercise both >= 6.
//   Attention    the short list a supervisor should look at first (attention()).
import { BY_KEY, flagLabel } from './catalog.js';
import { addDays, daysBetween, weekStart } from './dates.js';
import { repsOfBlock } from './sessions.js';

export const IMPROVE_THRESHOLD = 2;
export const MIN_POINTS_FOR_TREND = 4;
export const STREAK_DAY_THRESHOLD = 0.8;

const sum = (a) => a.reduce((x, y) => x + y, 0);
export const mean = (a) => (a.length ? sum(a) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};
export const round = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const wmean = (pairs) => {
  const valid = pairs.filter(([v, w]) => v != null && w > 0);
  const w = sum(valid.map(([, x]) => x));
  return w > 0 ? sum(valid.map(([v, x]) => v * x)) / w : null;
};

/** One chartable point per exercise block. */
export function blockPoint(b) {
  const s = b.summary;
  return {
    block_id: b.block_id,
    session_id: b.session_id,
    date: b.date,
    time: b.time,
    exercise_key: b.exercise_key,
    reps: s.reps_completed,
    planned: s.reps_planned,
    form: s.avg_form_score,
    rom: s.avg_rom_pct,
    peak: s.avg_peak_angle_deg,
    start: b.angle.start_angle_deg,
    target: b.angle.target_angle_deg,
    direction: b.angle.direction,
    reached: s.reps_reached_target,
    hold: s.avg_hold_s,
    status: b.status,
    pain: b.patient_report?.pain_0_10 ?? null,
    effort: b.patient_report?.effort_0_10 ?? null,
  };
}

// ---------------------------------------------------------------------------
// Plan matching
// ---------------------------------------------------------------------------
/** Attach recorded blocks to planned occurrences. Returns { rows, unplanned }. */
export function matchPlan(occurrences, blocks, today) {
  const rows = occurrences.map((o) => ({ ...o, blocks: [] }));
  const byId = new Map(rows.map((r) => [r.occ_id, r]));
  const byKeyDate = new Map();
  rows.forEach((r) => {
    const k = `${r.exercise_key}|${r.date}`;
    byKeyDate.set(k, [...(byKeyDate.get(k) || []), r]);
  });

  const unplanned = [];
  blocks.forEach((b) => {
    let row = b.plan_item_id && b.scheduled_date ? byId.get(`${b.plan_item_id}|${b.scheduled_date}`) : null;
    if (!row) {
      const candidates = byKeyDate.get(`${b.exercise_key}|${b.date}`) || [];
      row = candidates.find((r) => r.blocks.length === 0) || null; // ad-hoc session done on a planned day
    }
    if (row) row.blocks.push(b);
    else unplanned.push(b);
  });

  rows.forEach((r) => {
    r.reps_done = sum(r.blocks.map((b) => b.summary.reps_completed));
    r.reps_credited = Math.min(r.reps_done, r.planned_reps);
    r.pct = r.planned_reps ? r.reps_done / r.planned_reps : 0;
    const perf = performance(r.blocks);
    r.form = perf.form;
    r.rom = perf.rom;
    if (r.reps_done >= r.planned_reps) r.status = 'done';
    else if (r.reps_done > 0) r.status = 'partial';
    else if (r.date < today) r.status = 'missed';
    else if (r.date === today) r.status = 'today';
    else r.status = 'upcoming';
  });
  return { rows, unplanned };
}

export const isDue = (r) => r.status === 'done' || r.status === 'partial' || r.status === 'missed';

// ---------------------------------------------------------------------------
// Adherence and consistency
// ---------------------------------------------------------------------------
export function adherence(rows) {
  const due = rows.filter(isDue);
  const planned = sum(due.map((r) => r.planned_reps));
  const credited = sum(due.map((r) => r.reps_credited));
  return {
    due: due.length,
    done: due.filter((r) => r.status === 'done').length,
    partial: due.filter((r) => r.status === 'partial').length,
    missed: due.filter((r) => r.status === 'missed').length,
    upcoming: rows.filter((r) => r.status === 'upcoming' || r.status === 'today').length,
    repsPlanned: planned,
    repsDone: credited,
    repsRate: planned ? credited / planned : null,
  };
}

/** Streaks over days that had planned work: a day counts when >= 80% of its planned reps were done. */
export function streaks(rows) {
  const days = new Map();
  rows.filter(isDue).forEach((r) => {
    const d = days.get(r.date) || { planned: 0, done: 0 };
    d.planned += r.planned_reps;
    d.done += r.reps_credited;
    days.set(r.date, d);
  });
  const ordered = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v.done / v.planned >= STREAK_DAY_THRESHOLD);
  let longest = 0;
  let run = 0;
  ordered.forEach((ok) => {
    run = ok ? run + 1 : 0;
    longest = Math.max(longest, run);
  });
  return { current: run, longest, days: ordered.length };
}

/** Planned vs done per calendar week (Monday start). */
export function weeklySeries(rows, blocks) {
  const weeks = new Map();
  const get = (start) => {
    if (!weeks.has(start)) weeks.set(start, { week: start, planned: 0, done: 0, forms: [] });
    return weeks.get(start);
  };
  rows.filter(isDue).forEach((r) => {
    const w = get(weekStart(r.date));
    w.planned += r.planned_reps;
    w.done += r.reps_credited;
  });
  blocks.forEach((b) => {
    const w = get(weekStart(b.date));
    if (b.summary.avg_form_score != null) w.forms.push([b.summary.avg_form_score, b.summary.reps_completed]);
  });
  return [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({
      week: w.week,
      planned: w.planned,
      done: w.done,
      adherence: w.planned ? w.done / w.planned : null,
      form: wmean(w.forms),
    }));
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------
export function performance(blocks) {
  const s = blocks.map((b) => b.summary);
  const reps = sum(s.map((x) => x.reps_completed));
  const rep = (b) => repsOfBlock(b).filter((r) => r.counted);
  const spreads = blocks.map((b) => sd(rep(b).map((r) => r.peak_angle_deg))).filter((v) => v != null);
  return {
    blocks: blocks.length,
    reps,
    form: wmean(s.map((x) => [x.avg_form_score, x.reps_completed])),
    rom: wmean(s.map((x) => [x.avg_rom_pct, x.reps_completed])),
    peak: wmean(s.map((x) => [x.avg_peak_angle_deg, x.reps_completed])),
    reachedPct: reps ? sum(s.map((x) => x.reps_reached_target || 0)) / reps : null,
    spread: mean(spreads), // degrees; smaller = steadier repetitions
    minutes: sum(blocks.map((b) => b.duration_s || 0)) / 60,
  };
}

/** Compare the first third of the series with the last third. `points` must be in time order. */
export function improvement(points, key, { threshold = IMPROVE_THRESHOLD, sign = 1 } = {}) {
  const vals = points.map((p) => p[key]).filter((v) => v != null);
  if (vals.length < MIN_POINTS_FOR_TREND) return { label: 'insufficient', delta: null, first: null, last: null, n: vals.length };
  const k = Math.max(1, Math.ceil(vals.length / 3));
  const first = mean(vals.slice(0, k));
  const last = mean(vals.slice(-k));
  const delta = sign * (last - first);
  const label = delta >= threshold ? 'improving' : delta <= -threshold ? 'declining' : 'stable';
  return { label, delta, first, last, n: vals.length };
}

export function flagSummary(blocks) {
  const counts = new Map();
  let reps = 0;
  blocks.forEach((b) => {
    reps += b.summary.reps_completed;
    Object.entries(b.summary.flag_counts || {}).forEach(([flag, n]) => {
      const key = `${b.exercise_key}|${flag}`;
      counts.set(key, (counts.get(key) || 0) + n);
    });
  });
  return [...counts.entries()]
    .map(([key, count]) => {
      const [exercise, flag] = key.split('|');
      return { exercise, flag, label: flagLabel(flag, exercise), count, pct: reps ? count / reps : null };
    })
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Per-exercise table and the written summary
// ---------------------------------------------------------------------------
export function exerciseSummaries(rows, blocks) {
  const keys = [...new Set([...rows.map((r) => r.exercise_key), ...blocks.map((b) => b.exercise_key)])];
  return keys
    .map((key) => {
      const spec = BY_KEY[key];
      const myRows = rows.filter((r) => r.exercise_key === key);
      const myBlocks = blocks.filter((b) => b.exercise_key === key);
      const points = myBlocks.map(blockPoint);
      const sign = spec?.direction === 'decrease' ? -1 : 1;
      return {
        key,
        name: spec?.name || key,
        group: spec?.group || '',
        adherence: adherence(myRows),
        performance: performance(myBlocks),
        improvement: {
          form: improvement(points, 'form'),
          rom: improvement(points, 'rom'),
          peak: improvement(points, 'peak', { sign }),
          pain: improvement(points, 'pain', { sign: -1 }),
        },
        flags: flagSummary(myBlocks),
        pain: painStats(myBlocks),
        lastDate: points.length ? points[points.length - 1].date : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);

/** Plain-language findings for the supervisor. */
export function insights(summaries, overall) {
  const out = [];
  const a = overall.adherence;
  if (a.due > 0) {
    out.push({ tone: a.repsRate >= 0.8 ? 'good' : 'warn', text: `${pct(a.repsRate)} of the planned repetitions were done (${a.done} of ${a.due} scheduled exercises completed in full, ${a.partial} partly, ${a.missed} missed).` });
  }
  if (overall.streaks.longest > 1) {
    out.push({ tone: 'neutral', text: `Current streak: ${overall.streaks.current} ${overall.streaks.current === 1 ? 'day' : 'days'} on plan. Longest: ${overall.streaks.longest}.` });
  }
  summaries.forEach((s) => {
    const f = s.improvement.form;
    if (f.label === 'improving') out.push({ tone: 'good', text: `${s.name}: form score improved by ${round(f.delta)} points (${round(f.first, 0)} to ${round(f.last, 0)}).` });
    if (f.label === 'declining') out.push({ tone: 'warn', text: `${s.name}: form score fell by ${round(Math.abs(f.delta))} points (${round(f.first, 0)} to ${round(f.last, 0)}). Worth a check-in.` });
    const p = s.improvement.peak;
    if (p.label === 'improving') out.push({ tone: 'good', text: `${s.name}: reaching ${round(p.delta)}° closer to the target angle than at the start.` });
    const top = s.flags.find((x) => x.flag !== 'short_of_target'); // range is already reported by the ROM metric
    if (top && top.pct >= 0.25) out.push({ tone: 'warn', text: `${s.name}: "${top.label}" on ${pct(top.pct)} of repetitions.` });
    if (s.adherence.due >= 3 && s.adherence.repsRate != null && s.adherence.repsRate < 0.6) {
      out.push({ tone: 'warn', text: `${s.name}: only ${pct(s.adherence.repsRate)} of planned repetitions done.` });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Filtering and export
// ---------------------------------------------------------------------------
export function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}

export function filterRows(rows, { exercises, from, to }) {
  return rows.filter((r) => (!exercises || exercises.size === 0 || exercises.has(r.exercise_key)) && inRange(r.date, from, to));
}

export function filterBlocks(blocks, { exercises, from, to }) {
  return blocks.filter((b) => (!exercises || exercises.size === 0 || exercises.has(b.exercise_key)) && inRange(b.date, from, to));
}

export function presetRange(id, today, planStart) {
  if (id === '7d') return { from: addDays(today, -6), to: today };
  if (id === '30d') return { from: addDays(today, -29), to: today };
  if (id === '3m') return { from: addDays(today, -89), to: today };
  if (id === 'plan') return { from: planStart || null, to: today };
  return { from: null, to: null };
}

const csvCell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One CSV row per repetition attempt. */
export function repsToCsv(blocks) {
  const header = ['date', 'time', 'session_id', 'block_id', 'exercise', 'side', 'set', 'rep', 'counted', 'start_angle_deg', 'peak_angle_deg', 'target_angle_deg', 'rom_pct', 'reached_target', 'hold_s', 'duration_s', 'form_score', 'flags', 'pain_0_10', 'effort_0_10'];
  const lines = [header.join(',')];
  blocks.forEach((b) => {
    repsOfBlock(b).forEach((r) => {
      lines.push([b.date, b.time, b.session_id, b.block_id, BY_KEY[b.exercise_key]?.name || b.exercise_key, b.side, r.set_number, r.rep_index, r.counted, r.start_angle_deg, r.peak_angle_deg, r.target_angle_deg, r.rom_pct, r.reached_target, r.hold_s, r.duration_s, r.form_score, (r.flags || []).join(' '), b.patient_report?.pain_0_10, b.patient_report?.effort_0_10].map(csvCell).join(','));
    });
  });
  return lines.join('\n');
}

/** One-call helper used by the views. */
export function analyse(plan, occurrences, blocks, today) {
  const { rows, unplanned } = matchPlan(occurrences, blocks, today);
  return { rows, unplanned };
}

export function overallSummary(rows, blocks) {
  const points = blocks.map(blockPoint);
  return {
    adherence: adherence(rows),
    performance: performance(blocks),
    streaks: streaks(rows),
    improvement: { form: improvement(points, 'form'), rom: improvement(points, 'rom'), pain: improvement(points, 'pain', { sign: -1 }) },
    flags: flagSummary(blocks),
    weekly: weeklySeries(rows, blocks),
    pain: painStats(blocks),
  };
}


// ---------------------------------------------------------------------------
// Patient check-ins (pain and effort)
// ---------------------------------------------------------------------------
export const PAIN_HIGH = 6;     // a rating at or above this is "high"
export const PAIN_SEVERE = 8;

/** Pain statistics over blocks that have a check-in. `blocks` must be in time order (flattenBlocks sorts them). */
export function painStats(blocks) {
  const rated = blocks.filter((b) => b.patient_report?.pain_0_10 != null);
  const vals = rated.map((b) => b.patient_report.pain_0_10);
  const effort = blocks.map((b) => b.patient_report?.effort_0_10).filter((v) => v != null);
  return {
    n: vals.length,
    mean: mean(vals),
    max: vals.length ? Math.max(...vals) : null,
    latest: vals.length ? vals[vals.length - 1] : null,
    latestDate: rated.length ? rated[rated.length - 1].date : null,
    highCount: vals.filter((v) => v >= PAIN_HIGH).length,
    effortMean: mean(effort),
  };
}

/** True when the exercise's most recent ratings call for a check-in (see the Pain definition above). */
export function isPainFlare(blocks) {
  const v = blocks.filter((b) => b.patient_report?.pain_0_10 != null).map((b) => b.patient_report.pain_0_10);
  if (!v.length) return false;
  return v[v.length - 1] >= PAIN_SEVERE || (v.length >= 2 && v[v.length - 1] >= PAIN_HIGH && v[v.length - 2] >= PAIN_HIGH);
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * What a supervisor should look at first. `rows` are matched plan rows, `blocks` all recorded blocks
 * (not filtered by the period shown, so a problem is never hidden by a filter). Returns
 * [{ id, severity: 'high' | 'medium' | 'low', exercise, title, detail }], most severe first.
 */
export function attention(rows, blocks, today) {
  const out = [];
  const rarely = [];
  const keys = [...new Set([...rows.map((r) => r.exercise_key), ...blocks.map((b) => b.exercise_key)])];
  keys.forEach((key) => {
    const name = BY_KEY[key]?.name || key;
    const myBlocks = blocks.filter((b) => b.exercise_key === key);
    const myDue = rows.filter((r) => r.exercise_key === key && isDue(r)).sort((a, b) => a.date.localeCompare(b.date));

    if (isPainFlare(myBlocks)) {
      const rated = myBlocks.filter((b) => b.patient_report?.pain_0_10 != null);
      const last = rated.slice(-2);
      out.push({ id: `pain-${key}`, severity: 'high', exercise: key, title: `${name}: pain reported`,
        detail: `Pain ${last.map((b) => `${b.patient_report.pain_0_10}/10`).join(' and ')} on the last ${last.length === 1 ? 'session' : 'two sessions'} (${last.map((b) => b.date).join(', ')}). Worth a call before the next session.` });
    }
    if (myDue.length >= 3 && myDue.slice(-3).every((r) => r.reps_done === 0)) {
      out.push({ id: `missed-${key}`, severity: 'high', exercise: key, title: `${name}: last 3 sessions missed`,
        detail: `Nothing recorded on ${myDue.slice(-3).map((r) => r.date).join(', ')}.` });
    }
    const f = improvement(myBlocks.map(blockPoint), 'form');
    if (f.label === 'declining') {
      out.push({ id: `form-${key}`, severity: 'medium', exercise: key, title: `${name}: form is slipping`,
        detail: `Form score fell ${round(Math.abs(f.delta))} points (${round(f.first, 0)} to ${round(f.last, 0)}).` });
    }
    const ad = adherence(rows.filter((r) => r.exercise_key === key));
    if (ad.due >= 3 && ad.repsRate != null && ad.repsRate < 0.6 && !out.some((o) => o.id === `missed-${key}`)) {
      out.push({ id: `adh-${key}`, severity: 'medium', exercise: key, title: `${name}: under 60% of reps done`,
        detail: `${ad.repsDone} of ${ad.repsPlanned} planned repetitions.` });
    }
    const recent = myBlocks.slice(-3);
    if (recent.length === 3 && recent.every((b) => b.summary.reps_completed > 0 && b.summary.reps_reached_target / b.summary.reps_completed < 0.5)) rarely.push(name);
  });
  if (rarely.length) {
    out.push({ id: 'range', severity: 'low', exercise: null, title: `Target angle rarely reached: ${rarely.join(', ')}`,
      detail: 'Fewer than half of the repetitions reached the target in each of the last 3 sessions. The target may be too ambitious, or the movement is limited.' });
  }

  const due = rows.filter(isDue);
  if (due.length >= 3) {
    const lastBlock = blocks.length ? blocks[blocks.length - 1].date : null;
    const idle = lastBlock ? daysBetween(lastBlock, today) : null;
    if (lastBlock == null) {
      out.push({ id: 'inactive', severity: 'medium', exercise: null, title: 'No sessions recorded yet', detail: `${due.length} sessions were scheduled so far and none has been imported.` });
    } else if (idle >= 5) {
      out.push({ id: 'inactive', severity: 'medium', exercise: null, title: `No session for ${idle} days`, detail: `The last recorded session was on ${lastBlock}.` });
    }
  }
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------------------
// Day-level views: this week's strip and the calendar heat map
// ---------------------------------------------------------------------------
/** Status of one calendar day from the plan rows scheduled on it. */
export function dayStatus(dayRows) {
  if (!dayRows.length) return 'rest';
  if (dayRows.some((r) => r.status === 'today')) return 'today';
  if (dayRows.every((r) => r.status === 'upcoming')) return 'upcoming';
  const due = dayRows.filter(isDue);
  const done = sum(due.map((r) => r.reps_credited));
  if (due.length && due.every((r) => r.status === 'done')) return 'done';
  if (done === 0) return 'missed';
  return 'partial';
}

/** One entry per day from `from` to `to` (inclusive): { date, status, planned, done, exercises }. */
export function dayCells(rows, from, to) {
  const byDate = new Map();
  rows.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) || []), r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dayRows = byDate.get(d) || [];
    out.push({
      date: d,
      status: dayStatus(dayRows),
      planned: sum(dayRows.map((r) => r.planned_reps)),
      done: sum(dayRows.map((r) => r.reps_credited)),
      exercises: dayRows.map((r) => r.exercise_key),
    });
  }
  return out;
}
