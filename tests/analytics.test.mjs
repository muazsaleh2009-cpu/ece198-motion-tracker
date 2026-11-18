// Run: node scripts/run-tests.mjs   (bundles with esbuild, then runs under Node)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan, expandPlan, planTemplate, itemDates, prescriptionOn } from '../src/lib/plan.js';
import { validateSession, mergeSessions, flattenBlocks } from '../src/lib/sessions.js';
import { matchPlan, adherence, streaks, improvement, performance, overallSummary, exerciseSummaries, filterBlocks, filterRows, repsToCsv, presetRange, weeklySeries } from '../src/lib/analytics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.join(here, '..', '..', 'samples');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok', name); };

const planRaw = JSON.parse(fs.readFileSync(path.join(samples, 'plan.json'), 'utf8'));
const files = fs.readdirSync(path.join(samples, 'sessions')).filter((f) => f.endsWith('.json')).sort();
const sessionRaws = files.map((f) => [f, JSON.parse(fs.readFileSync(path.join(samples, 'sessions', f), 'utf8'))]);

const { plan, errors: planErrors } = validatePlan(planRaw);
const occurrences = expandPlan(plan);
let sessions = [];
sessionRaws.forEach(([f, raw]) => {
  const v = validateSession(raw, f);
  assert.equal(v.errors.length, 0, v.errors.join('; '));
  sessions = mergeSessions(sessions, [v.session]).sessions;
});
const blocks = flattenBlocks(sessions);
const TODAY = '2026-11-15';

console.log('plan');
test('sample plan validates and expands', () => {
  assert.equal(planErrors.length, 0);
  const expect = JSON.parse(fs.readFileSync(path.join(samples, 'expected_stats.json'), 'utf8'));
  assert.equal(occurrences.length, expect.occurrences); // 11 weekly slots x 8 weeks = 88, computed independently in python
});
test('progression overrides apply from their date', () => {
  const squat = plan.items.find((i) => i.item_id === 'squat-1');
  assert.equal(prescriptionOn(squat, '2026-11-13').reps_per_set, 10);
  assert.equal(prescriptionOn(squat, '2026-11-16').reps_per_set, 12);
  assert.equal(prescriptionOn(squat, '2026-11-16').target_angle_deg, 100);
});
test('open-ended schedules follow the same end-date rule as the python tracker', () => {
  // numbers computed by tracker/plan.py for the same input (see tests/test_plan.py)
  const item = { ...plan.items[0], schedule: { start_date: '2026-10-19', days_of_week: ['mon'] } };
  const withPlanEnd = itemDates(item, { end_date: '2026-12-13' });
  assert.equal(withPlanEnd.length, 8);
  assert.equal(withPlanEnd[7], '2026-12-07');
  const noEnd = itemDates(item, {});
  assert.equal(noEnd.length, 12);
  assert.equal(noEnd[11], '2027-01-04');
  const own = itemDates({ ...item, schedule: { ...item.schedule, end_date: '2026-11-02' } }, { end_date: '2026-12-13' });
  assert.equal(own.length, 3);
});
test('template is itself a valid plan', () => {
  const v = validatePlan(planTemplate('2026-11-15'));
  assert.deepEqual(v.errors, []);
});
test('bad plans give specific messages', () => {
  const bad = JSON.parse(JSON.stringify(planRaw));
  bad.items[0].exercise_key = 'bicep_party';
  bad.items[1].target_angle_deg = 170;
  bad.items[2].schedule = {};
  bad.items[3].sets = 0;
  const v = validatePlan(bad);
  assert.equal(v.plan, null);
  const text = v.errors.join('\n');
  assert.match(text, /unknown exercise_key "bicep_party"/);
  assert.match(text, /must be between 0° and 45°/);
  assert.match(text, /needs either "dates"/);
  assert.match(text, /"sets" must be a whole number/);
  assert.equal(validatePlan({}).plan, null);
  assert.equal(validatePlan(null).plan, null);
});
test('a session file is rejected as a plan and a plan as a session', () => {
  assert.match(validateSession(planRaw, 'plan.json').errors[0], /looks like a PLAN/);
  const asPlan = validatePlan(sessionRaws[0][1]);
  assert.equal(asPlan.plan, null);
  assert.match(asPlan.errors[0], /looks like a SESSION file/);
});

console.log('sessions');
test('all sample sessions import', () => { assert.equal(sessions.length, 21); });
test('importing twice replaces instead of duplicating', () => {
  const again = mergeSessions(sessions, [sessions[0], sessions[1]]);
  assert.equal(again.sessions.length, 21);
  assert.equal(again.replaced, 2);
  assert.equal(again.added, 0);
});
test('unknown exercise blocks are skipped with a warning, not a crash', () => {
  const raw = JSON.parse(JSON.stringify(sessionRaws[0][1]));
  raw.blocks.push({ ...raw.blocks[0], exercise_key: 'cartwheel' });
  const v = validateSession(raw, 'x.json');
  assert.equal(v.errors.length, 0);
  assert.equal(v.warnings.length, 1);
  assert.equal(v.session.blocks.length, raw.blocks.length - 1);
});
test('a future major schema version is refused', () => {
  const raw = { ...sessionRaws[0][1], schema_version: '2.0' };
  assert.match(validateSession(raw, 'x').errors[0], /unsupported schema_version/);
});

console.log('analytics');
const { rows, unplanned } = matchPlan(occurrences, blocks, TODAY);
test('every recorded block matched a planned occurrence', () => {
  assert.equal(unplanned.length, 0);
  assert.equal(rows.reduce((n, r) => n + r.blocks.length, 0), blocks.length);
});
test('numbers equal the independent python computation', () => {
  const expect = JSON.parse(fs.readFileSync(path.join(samples, 'expected_stats.json'), 'utf8'));
  const a = adherence(rows);
  assert.equal(a.due, expect.due);
  assert.equal(a.done, expect.done);
  assert.equal(a.partial, expect.partial);
  assert.equal(a.missed, expect.missed);
  assert.equal(a.repsPlanned, expect.reps_planned);
  assert.equal(a.repsDone, expect.reps_credited);
  const p = performance(blocks);
  assert.equal(p.reps, expect.reps_total);
  assert.ok(Math.abs(p.form - expect.form_weighted) < 1e-9, `${p.form} vs ${expect.form_weighted}`);
  assert.ok(Math.abs(p.rom - expect.rom_weighted) < 1e-9);
  const st = streaks(rows);
  assert.equal(st.longest, expect.longest_streak);
  assert.equal(st.current, expect.current_streak);
  Object.entries(expect.per_exercise).forEach(([key, e]) => {
    const s = exerciseSummaries(rows, blocks).find((x) => x.key === key);
    assert.equal(s.adherence.repsDone, e.reps_credited, key);
    assert.equal(s.adherence.missed, e.missed, key);
    assert.ok(Math.abs(s.performance.form - e.form_weighted) < 1e-9, key);
  });
});
test('today and future occurrences are not counted as missed', () => {
  assert.ok(rows.filter((r) => r.date >= TODAY).every((r) => r.status === 'upcoming' || r.status === 'today'));
  assert.equal(adherence(rows).upcoming, rows.filter((r) => r.date >= TODAY).length);
});
test('improvement detects the simulated upward trend and needs enough data', () => {
  const sums = exerciseSummaries(rows, blocks);
  sums.forEach((s) => assert.equal(s.improvement.form.label, 'improving', s.key));
  assert.equal(improvement([{ x: 1 }, { x: 2 }, { x: 3 }], 'x').label, 'insufficient');
  assert.equal(improvement([1, 1, 1, 1, 1, 1].map((x) => ({ x })), 'x').label, 'stable');
  assert.equal(improvement([9, 9, 5, 5, 1, 1].map((x) => ({ x })), 'x').label, 'declining');
  // for decreasing exercises a lower angle is better: sign flips
  const elbow = sums.find((s) => s.key === 'elbow_extension');
  assert.ok(elbow.improvement.peak.delta > 0, 'elbow peak angle moved toward 0 deg = positive improvement');
});
test('date filters narrow both rows and blocks consistently', () => {
  const f = { exercises: new Set(['squat']), from: '2026-11-01', to: '2026-11-15' };
  const b = filterBlocks(blocks, f);
  const r = filterRows(rows, f);
  assert.ok(b.length > 0 && b.every((x) => x.exercise_key === 'squat' && x.date >= '2026-11-01'));
  assert.ok(r.every((x) => x.exercise_key === 'squat' && x.date >= '2026-11-01'));
  assert.deepEqual(presetRange('7d', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' });
});
test('weekly series covers every week and adherence is in 0..1', () => {
  const w = weeklySeries(rows, blocks);
  assert.ok(w.length >= 4);
  w.forEach((x) => x.adherence != null && assert.ok(x.adherence >= 0 && x.adherence <= 1.0001));
});
test('csv has one line per repetition attempt', () => {
  const csv = repsToCsv(blocks.slice(0, 3)).split('\n');
  const attempts = blocks.slice(0, 3).reduce((n, b) => n + b.sets.reduce((m, s) => m + s.reps.length, 0), 0);
  assert.equal(csv.length - 1, attempts);
  assert.match(csv[0], /^date,time,session_id/);
});
test('an ad-hoc block (no plan item) on a planned day still matches', () => {
  const b = { ...blocks[0], plan_item_id: null, scheduled_date: null };
  const m = matchPlan(occurrences, [b], TODAY);
  assert.equal(m.unplanned.length, 0);
});
test('a block on an unplanned day is reported as unplanned', () => {
  const b = { ...blocks[0], plan_item_id: null, scheduled_date: null, date: '2026-01-01' };
  assert.equal(matchPlan(occurrences, [b], TODAY).unplanned.length, 1);
});
test('overall summary assembles', () => {
  const o = overallSummary(rows, blocks);
  assert.ok(o.adherence.repsRate > 0.5 && o.adherence.repsRate <= 1);
  assert.ok(o.performance.form > 70);
});

console.log(`\n${passed} passed`);
