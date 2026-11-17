// Pain, attention list, day cells, notes and the plan builder. Run with: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan, expandPlan } from '../src/lib/plan.js';
import { validateSession, mergeSessions, flattenBlocks } from '../src/lib/sessions.js';
import { matchPlan, painStats, isPainFlare, attention, dayCells, dayStatus, exerciseSummaries, overallSummary } from '../src/lib/analytics.js';
import { addNote, filterNotes, makeNote, removeNote, sanitizeNotes } from '../src/lib/notes.js';
import { blankDraft, draftToPlan, newItemDraft, planToDraft } from '../src/lib/planBuilder.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.join(here, '..', '..', 'samples');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok', name); };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

const expect = JSON.parse(fs.readFileSync(path.join(samples, 'expected_stats.json'), 'utf8'));
const planRaw = JSON.parse(fs.readFileSync(path.join(samples, 'plan.json'), 'utf8'));
const { plan } = validatePlan(planRaw);
const occurrences = expandPlan(plan);
let sessions = [];
fs.readdirSync(path.join(samples, 'sessions')).filter((f) => f.endsWith('.json')).sort().forEach((f) => {
  const v = validateSession(JSON.parse(fs.readFileSync(path.join(samples, 'sessions', f), 'utf8')), f);
  assert.equal(v.errors.length, 0);
  sessions = mergeSessions(sessions, [v.session]).sessions;
});
const blocks = flattenBlocks(sessions);
const TODAY = '2026-11-15';
const { rows } = matchPlan(occurrences, blocks, TODAY);

console.log('pain (equal to the independent python computation)');
test('overall pain statistics', () => {
  const p = painStats(blocks);
  assert.equal(p.n, expect.pain_blocks);
  close(p.mean, expect.pain_mean);
  assert.equal(p.max, expect.pain_max);
});
test('per-exercise pain mean and latest', () => {
  const sums = exerciseSummaries(rows, blocks);
  Object.entries(expect.per_exercise).forEach(([key, e]) => {
    const s = sums.find((x) => x.key === key);
    close(s.pain.mean, e.pain_mean);
    assert.equal(s.pain.latest, e.pain_latest);
  });
});
test('pain flare and missed-run alerts match python exactly', () => {
  const found = attention(rows, blocks, TODAY);
  const ids = (prefix) => found.filter((a) => a.id.startsWith(prefix)).map((a) => a.id.slice(prefix.length)).sort();
  assert.deepEqual(ids('pain-'), expect.pain_flare);
  assert.deepEqual(ids('missed-'), expect.last3_missed);
  assert.equal(found[0].severity, 'high');
  assert.ok(found[0].detail.includes('7/10'));
});
test('flare rule: latest >= 8, or two in a row >= 6, otherwise not', () => {
  const b = (n) => ({ patient_report: { pain_0_10: n } });
  assert.equal(isPainFlare([b(2), b(8)]), true);
  assert.equal(isPainFlare([b(6), b(6)]), true);
  assert.equal(isPainFlare([b(7), b(5)]), false);
  assert.equal(isPainFlare([b(9), b(3)]), false);
  assert.equal(isPainFlare([b(7)]), false);
  assert.equal(isPainFlare([{ summary: {} }]), false);
});
test('pain improvement is "improving" when the rating falls', () => {
  const o = overallSummary(rows, blocks);
  assert.equal(o.improvement.pain.label === 'insufficient', false);
  assert.ok(['improving', 'stable', 'declining'].includes(o.improvement.pain.label));
});
test('a malformed patient_report is dropped with a warning, the block is kept', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(samples, 'sessions', fs.readdirSync(path.join(samples, 'sessions'))[0]), 'utf8'));
  raw.blocks[0].patient_report = { pain_0_10: 11, effort_0_10: 3 };
  const v = validateSession(raw, 'x.json');
  assert.ok(v.session);
  assert.equal(v.session.blocks[0].patient_report, undefined);
  assert.ok(v.warnings.some((w) => w.includes('patient_report')));
});

console.log('attention rules on constructed data');
const row = (o) => ({ exercise_key: 'squat', planned_reps: 30, reps_credited: 0, reps_done: 0, blocks: [], status: 'missed', ...o });
test('three missed sessions in a row', () => {
  const rs = [row({ date: '2026-11-09' }), row({ date: '2026-11-11' }), row({ date: '2026-11-13' })];
  const found = attention(rs, [], '2026-11-15');
  assert.ok(found.some((a) => a.id === 'missed-squat' && a.severity === 'high'));
  assert.ok(found.some((a) => a.id === 'inactive'));
});
test('two missed then one done is not a missed run', () => {
  const rs = [row({ date: '2026-11-09' }), row({ date: '2026-11-11' }), row({ date: '2026-11-13', reps_done: 30, reps_credited: 30, status: 'done' })];
  assert.ok(!attention(rs, [], '2026-11-15').some((a) => a.id === 'missed-squat'));
});
test('upcoming sessions never trigger anything', () => {
  const rs = [row({ date: '2026-11-20', status: 'upcoming' }), row({ date: '2026-11-22', status: 'upcoming' }), row({ date: '2026-11-24', status: 'upcoming' })];
  assert.deepEqual(attention(rs, [], '2026-11-15'), []);
});
test('target rarely reached over the last three sessions (one grouped item, not one per exercise)', () => {
  const mk = (d) => ({ exercise_key: 'squat', date: d, started_at: `${d}T09:00:00-05:00`, angle: { start_angle_deg: 5, target_angle_deg: 90, direction: 'increase' }, summary: { reps_completed: 10, reps_planned: 10, reps_reached_target: 2, avg_form_score: 80, avg_rom_pct: 70, avg_peak_angle_deg: 65 } });
  const found = attention([], [mk('2026-11-09'), mk('2026-11-11'), mk('2026-11-13')], '2026-11-14');
  const r = found.find((a) => a.id === 'range');
  assert.ok(r && r.severity === 'low' && r.title.includes('Squat'));
});

console.log('day cells');
test('statuses', () => {
  assert.equal(dayStatus([]), 'rest');
  assert.equal(dayStatus([row({ status: 'upcoming' })]), 'upcoming');
  assert.equal(dayStatus([row({ status: 'today' })]), 'today');
  assert.equal(dayStatus([row({ status: 'done', reps_credited: 30, reps_done: 30 })]), 'done');
  assert.equal(dayStatus([row({ status: 'done', reps_credited: 30, reps_done: 30 }), row({ status: 'missed' })]), 'partial');
  assert.equal(dayStatus([row({ status: 'partial', reps_credited: 12, reps_done: 12 })]), 'partial');
  assert.equal(dayStatus([row({ status: 'missed' }), row({ status: 'missed' })]), 'missed');
});
test('a range of dates yields one cell per day, matching the plan', () => {
  const cells = dayCells(rows, '2026-10-19', '2026-11-15');
  assert.equal(cells.length, 28);
  assert.equal(cells[0].date, '2026-10-19');
  const planned = cells.reduce((s, c) => s + c.planned, 0);
  assert.equal(planned, rows.filter((r) => r.date <= '2026-11-15').reduce((s, r) => s + r.planned_reps, 0));
  assert.ok(cells.some((c) => c.status === 'done'));
});

console.log('notes');
test('validation', () => {
  assert.ok(makeNote({ date: 'nope', text: 'x' }, 'n1', 't').error);
  assert.ok(makeNote({ date: '2026-11-15', text: '   ' }, 'n1', 't').error);
  assert.ok(makeNote({ date: '2026-11-15', text: 'x'.repeat(601) }, 'n1', 't').error);
  const { note } = makeNote({ date: '2026-11-15', text: ' Ease off the squat ', exercise_key: 'squat', author: ' Dr. S ' }, 'n1', '2026-11-15T10:00:00Z');
  assert.equal(note.text, 'Ease off the squat');
  assert.equal(note.author, 'Dr. S');
});
test('add keeps date order, remove, filter and sanitize', () => {
  const mk = (id, date, ex) => makeNote({ date, text: id, exercise_key: ex }, id, `2026-11-15T10:00:0${id}Z`).note;
  let n = [];
  n = addNote(n, mk('2', '2026-11-12', 'squat'));
  n = addNote(n, mk('1', '2026-11-10', null));
  n = addNote(n, mk('3', '2026-11-14', 'hip_extension'));
  assert.deepEqual(n.map((x) => x.id), ['1', '2', '3']);
  assert.deepEqual(filterNotes(n, { from: '2026-11-11', to: '2026-11-30', exercises: new Set(['squat']) }).map((x) => x.id), ['2']);
  assert.deepEqual(filterNotes(n, { from: null, to: null, exercises: new Set(['squat']) }).map((x) => x.id), ['1', '2']); // day-wide note always shows
  assert.deepEqual(removeNote(n, '2').map((x) => x.id), ['1', '3']);
  assert.equal(sanitizeNotes([...n, { id: 5 }, null, { id: 'z', date: 'bad', text: 'x', created_at: 't' }]).length, 3);
});

console.log('plan builder');
const key = (r) => `${r.date}|${r.exercise_key}|${r.planned_reps}|${r.target_angle_deg}|${r.hold_seconds}|${r.rest_seconds}`;
test('a blank draft is not valid until the patient is named, then it is', () => {
  const d = blankDraft('2026-11-17');
  assert.ok(validatePlan(draftToPlan(d)).errors.some((e) => e.includes('patient.id')));
  d.patient.id = 'pt-9';
  const v = validatePlan(draftToPlan(d));
  assert.deepEqual(v.errors, []);
  assert.equal(v.plan.items[0].exercise_key, 'squat');
  assert.equal(v.plan.start_date, '2026-11-16');
});
test('the sample plan survives plan -> form -> plan with the same schedule and prescriptions', () => {
  const again = validatePlan(draftToPlan(planToDraft(plan)));
  assert.deepEqual(again.errors, []);
  assert.deepEqual(expandPlan(again.plan).map(key).sort(), occurrences.map(key).sort());
  assert.equal(again.plan.items.find((i) => i.exercise_key === 'squat').progression.length, 1);
});
test('item ids are unique and readable when an exercise is added twice', () => {
  const d = blankDraft('2026-11-17');
  d.patient.id = 'p';
  d.items.push(newItemDraft('squat', d.start_date), newItemDraft('hip_extension', d.start_date));
  const p = draftToPlan(d);
  assert.deepEqual(p.items.map((i) => i.item_id), ['squat-1', 'squat-2', 'hip_extension-1']);
  assert.deepEqual(validatePlan(p).errors, []);
});
test('out-of-range targets and empty weekday lists are reported, in plain words', () => {
  const d = blankDraft('2026-11-17');
  d.patient.id = 'p';
  d.items[0].target_angle_deg = 200;
  d.items[0].days = [];
  const errs = validatePlan(draftToPlan(d)).errors.join(' | ');
  assert.match(errs, /target_angle_deg/);
  assert.match(errs, /schedule/);
});
test('side is written only for exercises that have a side', () => {
  const d = blankDraft('2026-11-17');
  d.patient.id = 'p';
  d.items[0].side = 'left';                                  // squat is two-sided
  d.items.push({ ...newItemDraft('hip_extension', d.start_date), side: 'left' });
  const p = draftToPlan(d);
  assert.equal(p.items[0].side, undefined);
  assert.equal(p.items[1].side, 'left');
});

console.log(`\n${passed} feature tests passed`);
