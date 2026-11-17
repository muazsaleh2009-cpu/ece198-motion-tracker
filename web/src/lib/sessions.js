// Session import: validate files written by the Python tracker and flatten them for analysis.
import { BY_KEY, SCHEMA_MAJOR } from './catalog.js';
import { dateOfTimestamp, timeOfTimestamp } from './dates.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Keep patient_report only if it holds whole numbers 0-10 (it is optional, so a bad one is dropped with a warning). */
function cleanReport(block, label, warnings) {
  const r = block.patient_report;
  if (r == null) return block;
  const ok = (v) => v == null || (Number.isInteger(v) && v >= 0 && v <= 10);
  if (typeof r !== 'object' || !ok(r.pain_0_10) || !ok(r.effort_0_10)) {
    warnings.push(`${label}: patient_report must hold whole numbers from 0 to 10, so it was ignored.`);
    const { patient_report, ...rest } = block;
    return rest;
  }
  return block;
}

/** Validate one session.json. Returns { errors, warnings, session }. Unknown exercises are dropped with a warning. */
export function validateSession(input, fileName = 'file') {
  const errors = [];
  const warnings = [];
  const where = `${fileName}`;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: [`${where}: not a session file (expected a JSON object).`], warnings, session: null };
  }
  if (Array.isArray(input.items) && !input.blocks) {
    return { errors: [`${where}: this looks like a PLAN. Upload it under "Exercise plan".`], warnings, session: null };
  }
  const major = String(input.schema_version ?? '').split('.')[0];
  if (major !== SCHEMA_MAJOR) errors.push(`${where}: unsupported schema_version "${input.schema_version ?? ''}" (this app reads ${SCHEMA_MAJOR}.x).`);
  if (!input.session_id) errors.push(`${where}: missing "session_id".`);
  if (!input.started_at) errors.push(`${where}: missing "started_at".`);
  if (!Array.isArray(input.blocks)) errors.push(`${where}: missing "blocks".`);
  if (errors.length) return { errors, warnings, session: null };

  const blocks = [];
  input.blocks.forEach((b, i) => {
    const label = `${where} block ${i + 1}`;
    if (!BY_KEY[b?.exercise_key]) {
      warnings.push(`${label}: exercise "${b?.exercise_key}" is not in this app's catalog, so it was skipped.`);
      return;
    }
    if (!b.summary || !b.prescribed || !Array.isArray(b.sets) || !b.started_at) {
      warnings.push(`${label}: incomplete block (needs started_at, prescribed, sets and summary), so it was skipped.`);
      return;
    }
    if (!isNum(b.summary.reps_completed)) {
      warnings.push(`${label}: summary.reps_completed is missing, so it was skipped.`);
      return;
    }
    blocks.push(cleanReport(b, label, warnings));
  });
  if (blocks.length === 0) return { errors: [`${where}: no usable exercise blocks.`], warnings, session: null };

  return {
    errors,
    warnings,
    session: {
      schema_version: input.schema_version,
      session_id: input.session_id,
      patient_id: input.patient_id ?? null,
      plan_id: input.plan_id ?? null,
      started_at: input.started_at,
      ended_at: input.ended_at ?? null,
      duration_s: input.duration_s ?? null,
      device: input.device ?? null,
      blocks,
    },
  };
}

/** Add sessions to the store; a session already present (same session_id) is replaced. */
export function mergeSessions(existing, incoming) {
  const byId = new Map(existing.map((s) => [s.session_id, s]));
  let added = 0;
  let replaced = 0;
  incoming.forEach((s) => {
    byId.has(s.session_id) ? replaced++ : added++;
    byId.set(s.session_id, s);
  });
  const sessions = [...byId.values()].sort((a, b) => a.started_at.localeCompare(b.started_at));
  return { sessions, added, replaced };
}

/** One record per exercise block, with the calendar date and the session it came from. */
export function flattenBlocks(sessions) {
  const out = [];
  sessions.forEach((s) => {
    s.blocks.forEach((b) => {
      out.push({
        ...b,
        session_id: s.session_id,
        patient_id: s.patient_id,
        date: dateOfTimestamp(b.started_at),
        time: timeOfTimestamp(b.started_at),
      });
    });
  });
  return out.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

/** Counted repetitions of a block, flattened with their set number. */
export function repsOfBlock(block) {
  const out = [];
  block.sets.forEach((set) => set.reps.forEach((rep) => out.push({ ...rep, set_number: set.set_number })));
  return out;
}
