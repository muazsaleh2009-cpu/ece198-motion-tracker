// tests/features.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// src/data/exerciseCatalog.json
var exerciseCatalog_default = {
  schema_version: "1.1",
  exercises: [
    {
      key: "squat",
      name: "Squat",
      group: "Lower body",
      joint: "knee",
      movement: "flexion",
      camera_view: "side",
      sided: false,
      angle_label: "Knee flexion",
      convention: "0 deg = standing with straight knees; larger = deeper squat (knees bent). Average of both knees.",
      direction: "increase",
      start_angle_deg: 5,
      default_target_angle_deg: 90,
      target_bounds_deg: [
        30,
        135
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 10,
      default_hold_s: 0,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Bend both knees and hips to lower the body, then stand back up.",
      form_checks: [
        {
          key: "trunk_lean_forward",
          label: "Forward trunk lean",
          mode: "abs",
          limit_deg: 55,
          message: "Keep your chest up, you are leaning too far forward"
        }
      ]
    },
    {
      key: "standing_knee_flexion",
      name: "Standing knee flexion (hamstring curl)",
      group: "Lower body",
      joint: "knee",
      movement: "flexion",
      camera_view: "side",
      sided: true,
      angle_label: "Knee flexion",
      convention: "0 deg = leg straight; larger = heel moving toward the buttock.",
      direction: "increase",
      start_angle_deg: 5,
      default_target_angle_deg: 90,
      target_bounds_deg: [
        30,
        135
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 0,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Standing, bend one knee to bring the heel toward the buttock, then lower it.",
      form_checks: [
        {
          key: "thigh_drift",
          label: "Thigh movement",
          mode: "drift",
          limit_deg: 15,
          message: "Keep your thigh still and move only the lower leg"
        },
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "seated_knee_extension",
      name: "Seated knee extension",
      group: "Lower body",
      joint: "knee",
      movement: "extension",
      camera_view: "side",
      sided: true,
      angle_label: "Knee flexion (0 = fully extended)",
      convention: "Measured as knee flexion: starts about 90 deg (knee bent, seated) and falls toward 0 deg (leg straight).",
      direction: "decrease",
      start_angle_deg: 90,
      default_target_angle_deg: 0,
      target_bounds_deg: [
        0,
        45
      ],
      rep_duration_s: [
        2,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 2,
      setup: "Sit side-on to the camera on a chair, 2 to 3 m away, with the working leg toward the camera and the whole leg visible.",
      description: "Seated, straighten the knee until the leg is level, then lower it.",
      form_checks: [
        {
          key: "thigh_drift",
          label: "Thigh movement",
          mode: "drift",
          limit_deg: 15,
          message: "Keep your thigh still and move only the lower leg"
        },
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "hip_flexion",
      name: "Standing hip flexion (march)",
      group: "Lower body",
      joint: "hip",
      movement: "flexion",
      camera_view: "side",
      sided: true,
      angle_label: "Hip flexion",
      convention: "0 deg = thigh in line with the trunk (standing); larger = knee lifted forward.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 80,
      target_bounds_deg: [
        30,
        120
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 10,
      default_hold_s: 1,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Standing tall, lift one knee toward the chest, then lower it.",
      form_checks: [
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "hip_extension",
      name: "Standing hip extension",
      group: "Lower body",
      joint: "hip",
      movement: "extension",
      camera_view: "side",
      sided: true,
      angle_label: "Hip extension",
      convention: "0 deg = thigh in line with the trunk (standing); larger = leg swung backward behind the body.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 20,
      target_bounds_deg: [
        8,
        30
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Standing tall, swing one straight leg backward without leaning, then return.",
      form_checks: [
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "hip_abduction",
      name: "Standing hip abduction",
      group: "Lower body",
      joint: "hip",
      movement: "abduction",
      camera_view: "front",
      sided: true,
      angle_label: "Hip abduction",
      convention: "0 deg = leg straight down beside the other leg; larger = leg lifted out to the side.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 35,
      target_bounds_deg: [
        10,
        45
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Face the camera, 2 to 3 m away, with your whole body in view and arms/legs clear of your body.",
      description: "Standing tall, lift one straight leg out to the side, then lower it.",
      form_checks: [
        {
          key: "trunk_lean_sideways",
          label: "Sideways trunk lean",
          mode: "drift",
          limit_deg: 10,
          message: "Stand tall, do not lean to the side"
        }
      ]
    },
    {
      key: "elbow_flexion",
      name: "Elbow flexion (bicep curl)",
      group: "Upper body",
      joint: "elbow",
      movement: "flexion",
      camera_view: "side",
      sided: true,
      angle_label: "Elbow flexion",
      convention: "0 deg = arm straight; larger = elbow more bent (hand toward the shoulder).",
      direction: "increase",
      start_angle_deg: 10,
      default_target_angle_deg: 140,
      target_bounds_deg: [
        60,
        150
      ],
      rep_duration_s: [
        1.5,
        6
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 0,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "With the upper arm still at your side, bend the elbow to bring the hand to the shoulder.",
      form_checks: [
        {
          key: "upper_arm_drift",
          label: "Upper arm movement",
          mode: "drift",
          limit_deg: 20,
          message: "Keep your upper arm still next to your body"
        },
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "elbow_extension",
      name: "Elbow extension (triceps)",
      group: "Upper body",
      joint: "elbow",
      movement: "extension",
      camera_view: "side",
      sided: true,
      angle_label: "Elbow flexion (0 = fully extended)",
      convention: "Measured as elbow flexion: starts about 90 deg (elbow bent) and falls toward 0 deg (arm straight).",
      direction: "decrease",
      start_angle_deg: 90,
      default_target_angle_deg: 0,
      target_bounds_deg: [
        0,
        45
      ],
      rep_duration_s: [
        1.5,
        6
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Starting with the elbow bent at 90 degrees, straighten the arm fully, then bend it again.",
      form_checks: [
        {
          key: "upper_arm_drift",
          label: "Upper arm movement",
          mode: "drift",
          limit_deg: 20,
          message: "Keep your upper arm still next to your body"
        },
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "shoulder_flexion",
      name: "Shoulder flexion (forward raise)",
      group: "Upper body",
      joint: "shoulder",
      movement: "flexion",
      camera_view: "side",
      sided: true,
      angle_label: "Shoulder flexion",
      convention: "0 deg = arm hanging beside the trunk; 90 deg = arm horizontal in front; 180 deg = overhead.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 150,
      target_bounds_deg: [
        60,
        180
      ],
      rep_duration_s: [
        2,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "Raise the straight arm forward and up, then lower it slowly.",
      form_checks: [
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "shoulder_extension",
      name: "Shoulder extension",
      group: "Upper body",
      joint: "shoulder",
      movement: "extension",
      camera_view: "side",
      sided: true,
      angle_label: "Shoulder extension",
      convention: "0 deg = arm hanging beside the trunk; larger = arm swung backward behind the body.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 45,
      target_bounds_deg: [
        10,
        60
      ],
      rep_duration_s: [
        1.5,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view.",
      description: "With a straight arm, swing it backward behind the body without leaning, then return.",
      form_checks: [
        {
          key: "trunk_motion",
          label: "Trunk motion",
          mode: "drift",
          limit_deg: 12,
          message: "Keep your body still and move only the working joint"
        }
      ]
    },
    {
      key: "shoulder_abduction",
      name: "Shoulder abduction (lateral raise)",
      group: "Upper body",
      joint: "shoulder",
      movement: "abduction",
      camera_view: "front",
      sided: true,
      angle_label: "Shoulder abduction",
      convention: "0 deg = arm hanging beside the trunk; 90 deg = arm horizontal out to the side; 180 deg = overhead.",
      direction: "increase",
      start_angle_deg: 0,
      default_target_angle_deg: 150,
      target_bounds_deg: [
        60,
        180
      ],
      rep_duration_s: [
        2,
        8
      ],
      default_sets: 3,
      default_reps: 12,
      default_hold_s: 1,
      setup: "Face the camera, 2 to 3 m away, with your whole body in view and arms/legs clear of your body.",
      description: "Raise the straight arm out to the side and up, then lower it slowly.",
      form_checks: [
        {
          key: "trunk_lean_sideways",
          label: "Sideways trunk lean",
          mode: "drift",
          limit_deg: 10,
          message: "Stand tall, do not lean to the side"
        }
      ]
    }
  ]
};

// src/lib/catalog.js
var SCHEMA_MAJOR = String(exerciseCatalog_default.schema_version).split(".")[0];
var CATALOG = exerciseCatalog_default.exercises;
var BY_KEY = Object.fromEntries(CATALOG.map((e) => [e.key, e]));
var GROUPS = [...new Set(CATALOG.map((e) => e.group))];
var BUILT_IN_FLAGS = {
  short_of_target: "Did not reach the target angle",
  too_fast: "Repetition too fast",
  too_slow: "Repetition too slow",
  hold_short: "Hold shorter than prescribed",
  tracking_lost: "Tracking lost during repetition"
};
function flagLabel(flag, exerciseKey) {
  if (BUILT_IN_FLAGS[flag]) return BUILT_IN_FLAGS[flag];
  const check = (BY_KEY[exerciseKey]?.form_checks || []).find((c) => c.key === flag);
  return check ? check.message : flag;
}

// src/lib/dates.js
var DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
function parseISO(str) {
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
var isISODate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;
function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
var daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
var weekdayIndex = (iso) => (parseISO(iso).getDay() + 6) % 7;
var weekStart = (iso) => addDays(iso, -weekdayIndex(iso));
var dateOfTimestamp = (ts) => String(ts).slice(0, 10);
var timeOfTimestamp = (ts) => String(ts).slice(11, 16);

// src/lib/plan.js
var DEFAULT_OPEN_ENDED_DAYS = 83;
var isInt = (v) => Number.isInteger(v);
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
function validatePlan(input) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { errors: ["The file is not a plan: expected a JSON object."], warnings, plan: null };
  }
  if (Array.isArray(input.blocks) && !input.items) {
    return { errors: ["This looks like a SESSION file recorded by the tracker, not a plan. Upload it under Data \u2192 Session files (after the plan is loaded)."], warnings, plan: null };
  }
  const major = String(input.schema_version ?? "").split(".")[0];
  if (!input.schema_version) errors.push('Missing "schema_version" (expected "1.0").');
  else if (major !== SCHEMA_MAJOR) errors.push(`Unsupported schema_version "${input.schema_version}": this app reads version ${SCHEMA_MAJOR}.x.`);
  if (!input.plan_id || typeof input.plan_id !== "string") errors.push('Missing "plan_id" (a text identifier for this plan).');
  if (!input.patient || !input.patient.id) errors.push('Missing "patient.id".');
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('"items" must be a non-empty list of exercises.');
    return { errors, warnings, plan: null };
  }
  const seen = /* @__PURE__ */ new Set();
  const items = input.items.map((raw, i) => {
    const label = `Item ${i + 1}${raw?.item_id ? ` (${raw.item_id})` : ""}`;
    const spec = BY_KEY[raw?.exercise_key];
    if (!raw?.item_id) errors.push(`${label}: missing "item_id".`);
    else if (seen.has(raw.item_id)) errors.push(`${label}: duplicate item_id "${raw.item_id}".`);
    seen.add(raw?.item_id);
    if (!spec) {
      errors.push(`${label}: unknown exercise_key "${raw?.exercise_key}". Supported: ${CATALOG.map((e) => e.key).join(", ")}.`);
      return null;
    }
    if (!isInt(raw.sets) || raw.sets < 1) errors.push(`${label}: "sets" must be a whole number of at least 1.`);
    if (!isInt(raw.reps_per_set) || raw.reps_per_set < 1) errors.push(`${label}: "reps_per_set" must be a whole number of at least 1.`);
    const target = raw.target_angle_deg ?? spec.default_target_angle_deg;
    const [lo, hi] = spec.target_bounds_deg;
    if (!isNum(target) || target < lo || target > hi) {
      errors.push(`${label}: "target_angle_deg" for ${spec.name} must be between ${lo}\xB0 and ${hi}\xB0 (${spec.angle_label}).`);
    }
    const hold = raw.hold_seconds ?? spec.default_hold_s;
    const rest = raw.rest_seconds ?? 30;
    if (!isNum(hold) || hold < 0) errors.push(`${label}: "hold_seconds" must be 0 or more.`);
    if (!isNum(rest) || rest < 0) errors.push(`${label}: "rest_seconds" must be 0 or more.`);
    const side = raw.side ?? "auto";
    if (spec.sided && !["left", "right", "auto"].includes(side)) errors.push(`${label}: "side" must be "left", "right" or "auto".`);
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
        errors.push(`${label}: progression step ${k + 1} target must be between ${lo}\xB0 and ${hi}\xB0.`);
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
      notes: raw.notes || "",
      schedule: sched,
      progression
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
      notes: input.notes || "",
      items
    }
  };
}
function itemDates(item, plan2 = null) {
  const s = item.schedule;
  if (Array.isArray(s.dates) && s.dates.length) return [...new Set(s.dates)].sort();
  const end = s.end_date || plan2?.end_date || addDays(s.start_date, DEFAULT_OPEN_ENDED_DAYS);
  const wanted = new Set(s.days_of_week.map((d) => DAY_KEYS.indexOf(String(d).toLowerCase().slice(0, 3))));
  const out = [];
  for (let d = s.start_date; d <= end; d = addDays(d, 1)) if (wanted.has(weekdayIndex(d))) out.push(d);
  return out;
}
function prescriptionOn(item, date) {
  const rx = {
    sets: item.sets,
    reps_per_set: item.reps_per_set,
    target_angle_deg: item.target_angle_deg,
    hold_seconds: item.hold_seconds,
    rest_seconds: item.rest_seconds
  };
  [...item.progression].sort((a, b) => a.from_date.localeCompare(b.from_date)).forEach((step) => {
    if (step.from_date <= date) Object.keys(rx).forEach((k) => step[k] != null && (rx[k] = step[k]));
  });
  return rx;
}
function expandPlan(plan2) {
  const out = [];
  plan2.items.forEach((item) => {
    itemDates(item, plan2).forEach((date) => {
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
        rest_seconds: rx.rest_seconds
      });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.item_id.localeCompare(b.item_id));
}

// src/lib/sessions.js
var isNum2 = (v) => typeof v === "number" && Number.isFinite(v);
function cleanReport(block, label, warnings) {
  const r = block.patient_report;
  if (r == null) return block;
  const ok = (v) => v == null || Number.isInteger(v) && v >= 0 && v <= 10;
  if (typeof r !== "object" || !ok(r.pain_0_10) || !ok(r.effort_0_10)) {
    warnings.push(`${label}: patient_report must hold whole numbers from 0 to 10, so it was ignored.`);
    const { patient_report, ...rest } = block;
    return rest;
  }
  return block;
}
function validateSession(input, fileName = "file") {
  const errors = [];
  const warnings = [];
  const where = `${fileName}`;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { errors: [`${where}: not a session file (expected a JSON object).`], warnings, session: null };
  }
  if (Array.isArray(input.items) && !input.blocks) {
    return { errors: [`${where}: this looks like a PLAN. Upload it under "Exercise plan".`], warnings, session: null };
  }
  const major = String(input.schema_version ?? "").split(".")[0];
  if (major !== SCHEMA_MAJOR) errors.push(`${where}: unsupported schema_version "${input.schema_version ?? ""}" (this app reads ${SCHEMA_MAJOR}.x).`);
  if (!input.session_id) errors.push(`${where}: missing "session_id".`);
  if (!input.started_at) errors.push(`${where}: missing "started_at".`);
  if (!Array.isArray(input.blocks)) errors.push(`${where}: missing "blocks".`);
  if (errors.length) return { errors, warnings, session: null };
  const blocks2 = [];
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
    if (!isNum2(b.summary.reps_completed)) {
      warnings.push(`${label}: summary.reps_completed is missing, so it was skipped.`);
      return;
    }
    blocks2.push(cleanReport(b, label, warnings));
  });
  if (blocks2.length === 0) return { errors: [`${where}: no usable exercise blocks.`], warnings, session: null };
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
      blocks: blocks2
    }
  };
}
function mergeSessions(existing, incoming) {
  const byId = new Map(existing.map((s) => [s.session_id, s]));
  let added = 0;
  let replaced = 0;
  incoming.forEach((s) => {
    byId.has(s.session_id) ? replaced++ : added++;
    byId.set(s.session_id, s);
  });
  const sessions2 = [...byId.values()].sort((a, b) => a.started_at.localeCompare(b.started_at));
  return { sessions: sessions2, added, replaced };
}
function flattenBlocks(sessions2) {
  const out = [];
  sessions2.forEach((s) => {
    s.blocks.forEach((b) => {
      out.push({
        ...b,
        session_id: s.session_id,
        patient_id: s.patient_id,
        date: dateOfTimestamp(b.started_at),
        time: timeOfTimestamp(b.started_at)
      });
    });
  });
  return out.sort((a, b) => a.started_at.localeCompare(b.started_at));
}
function repsOfBlock(block) {
  const out = [];
  block.sets.forEach((set) => set.reps.forEach((rep) => out.push({ ...rep, set_number: set.set_number })));
  return out;
}

// src/lib/analytics.js
var IMPROVE_THRESHOLD = 2;
var MIN_POINTS_FOR_TREND = 4;
var STREAK_DAY_THRESHOLD = 0.8;
var sum = (a) => a.reduce((x, y) => x + y, 0);
var mean = (a) => a.length ? sum(a) / a.length : null;
var sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};
var round = (v, d = 1) => v == null ? null : Math.round(v * 10 ** d) / 10 ** d;
var wmean = (pairs) => {
  const valid = pairs.filter(([v, w2]) => v != null && w2 > 0);
  const w = sum(valid.map(([, x]) => x));
  return w > 0 ? sum(valid.map(([v, x]) => v * x)) / w : null;
};
function blockPoint(b) {
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
    effort: b.patient_report?.effort_0_10 ?? null
  };
}
function matchPlan(occurrences2, blocks2, today) {
  const rows2 = occurrences2.map((o) => ({ ...o, blocks: [] }));
  const byId = new Map(rows2.map((r) => [r.occ_id, r]));
  const byKeyDate = /* @__PURE__ */ new Map();
  rows2.forEach((r) => {
    const k = `${r.exercise_key}|${r.date}`;
    byKeyDate.set(k, [...byKeyDate.get(k) || [], r]);
  });
  const unplanned = [];
  blocks2.forEach((b) => {
    let row2 = b.plan_item_id && b.scheduled_date ? byId.get(`${b.plan_item_id}|${b.scheduled_date}`) : null;
    if (!row2) {
      const candidates = byKeyDate.get(`${b.exercise_key}|${b.date}`) || [];
      row2 = candidates.find((r) => r.blocks.length === 0) || null;
    }
    if (row2) row2.blocks.push(b);
    else unplanned.push(b);
  });
  rows2.forEach((r) => {
    r.reps_done = sum(r.blocks.map((b) => b.summary.reps_completed));
    r.reps_credited = Math.min(r.reps_done, r.planned_reps);
    r.pct = r.planned_reps ? r.reps_done / r.planned_reps : 0;
    const perf = performance(r.blocks);
    r.form = perf.form;
    r.rom = perf.rom;
    if (r.reps_done >= r.planned_reps) r.status = "done";
    else if (r.reps_done > 0) r.status = "partial";
    else if (r.date < today) r.status = "missed";
    else if (r.date === today) r.status = "today";
    else r.status = "upcoming";
  });
  return { rows: rows2, unplanned };
}
var isDue = (r) => r.status === "done" || r.status === "partial" || r.status === "missed";
function adherence(rows2) {
  const due = rows2.filter(isDue);
  const planned = sum(due.map((r) => r.planned_reps));
  const credited = sum(due.map((r) => r.reps_credited));
  return {
    due: due.length,
    done: due.filter((r) => r.status === "done").length,
    partial: due.filter((r) => r.status === "partial").length,
    missed: due.filter((r) => r.status === "missed").length,
    upcoming: rows2.filter((r) => r.status === "upcoming" || r.status === "today").length,
    repsPlanned: planned,
    repsDone: credited,
    repsRate: planned ? credited / planned : null
  };
}
function streaks(rows2) {
  const days = /* @__PURE__ */ new Map();
  rows2.filter(isDue).forEach((r) => {
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
function weeklySeries(rows2, blocks2) {
  const weeks = /* @__PURE__ */ new Map();
  const get = (start) => {
    if (!weeks.has(start)) weeks.set(start, { week: start, planned: 0, done: 0, forms: [] });
    return weeks.get(start);
  };
  rows2.filter(isDue).forEach((r) => {
    const w = get(weekStart(r.date));
    w.planned += r.planned_reps;
    w.done += r.reps_credited;
  });
  blocks2.forEach((b) => {
    const w = get(weekStart(b.date));
    if (b.summary.avg_form_score != null) w.forms.push([b.summary.avg_form_score, b.summary.reps_completed]);
  });
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).map((w) => ({
    week: w.week,
    planned: w.planned,
    done: w.done,
    adherence: w.planned ? w.done / w.planned : null,
    form: wmean(w.forms)
  }));
}
function performance(blocks2) {
  const s = blocks2.map((b) => b.summary);
  const reps = sum(s.map((x) => x.reps_completed));
  const rep = (b) => repsOfBlock(b).filter((r) => r.counted);
  const spreads = blocks2.map((b) => sd(rep(b).map((r) => r.peak_angle_deg))).filter((v) => v != null);
  return {
    blocks: blocks2.length,
    reps,
    form: wmean(s.map((x) => [x.avg_form_score, x.reps_completed])),
    rom: wmean(s.map((x) => [x.avg_rom_pct, x.reps_completed])),
    peak: wmean(s.map((x) => [x.avg_peak_angle_deg, x.reps_completed])),
    reachedPct: reps ? sum(s.map((x) => x.reps_reached_target || 0)) / reps : null,
    spread: mean(spreads),
    // degrees; smaller = steadier repetitions
    minutes: sum(blocks2.map((b) => b.duration_s || 0)) / 60
  };
}
function improvement(points, key2, { threshold = IMPROVE_THRESHOLD, sign = 1 } = {}) {
  const vals = points.map((p) => p[key2]).filter((v) => v != null);
  if (vals.length < MIN_POINTS_FOR_TREND) return { label: "insufficient", delta: null, first: null, last: null, n: vals.length };
  const k = Math.max(1, Math.ceil(vals.length / 3));
  const first = mean(vals.slice(0, k));
  const last = mean(vals.slice(-k));
  const delta = sign * (last - first);
  const label = delta >= threshold ? "improving" : delta <= -threshold ? "declining" : "stable";
  return { label, delta, first, last, n: vals.length };
}
function flagSummary(blocks2) {
  const counts = /* @__PURE__ */ new Map();
  let reps = 0;
  blocks2.forEach((b) => {
    reps += b.summary.reps_completed;
    Object.entries(b.summary.flag_counts || {}).forEach(([flag, n]) => {
      const key2 = `${b.exercise_key}|${flag}`;
      counts.set(key2, (counts.get(key2) || 0) + n);
    });
  });
  return [...counts.entries()].map(([key2, count]) => {
    const [exercise, flag] = key2.split("|");
    return { exercise, flag, label: flagLabel(flag, exercise), count, pct: reps ? count / reps : null };
  }).sort((a, b) => b.count - a.count);
}
function exerciseSummaries(rows2, blocks2) {
  const keys = [.../* @__PURE__ */ new Set([...rows2.map((r) => r.exercise_key), ...blocks2.map((b) => b.exercise_key)])];
  return keys.map((key2) => {
    const spec = BY_KEY[key2];
    const myRows = rows2.filter((r) => r.exercise_key === key2);
    const myBlocks = blocks2.filter((b) => b.exercise_key === key2);
    const points = myBlocks.map(blockPoint);
    const sign = spec?.direction === "decrease" ? -1 : 1;
    return {
      key: key2,
      name: spec?.name || key2,
      group: spec?.group || "",
      adherence: adherence(myRows),
      performance: performance(myBlocks),
      improvement: {
        form: improvement(points, "form"),
        rom: improvement(points, "rom"),
        peak: improvement(points, "peak", { sign }),
        pain: improvement(points, "pain", { sign: -1 })
      },
      flags: flagSummary(myBlocks),
      pain: painStats(myBlocks),
      lastDate: points.length ? points[points.length - 1].date : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function overallSummary(rows2, blocks2) {
  const points = blocks2.map(blockPoint);
  return {
    adherence: adherence(rows2),
    performance: performance(blocks2),
    streaks: streaks(rows2),
    improvement: { form: improvement(points, "form"), rom: improvement(points, "rom"), pain: improvement(points, "pain", { sign: -1 }) },
    flags: flagSummary(blocks2),
    weekly: weeklySeries(rows2, blocks2),
    pain: painStats(blocks2)
  };
}
var PAIN_HIGH = 6;
var PAIN_SEVERE = 8;
function painStats(blocks2) {
  const rated = blocks2.filter((b) => b.patient_report?.pain_0_10 != null);
  const vals = rated.map((b) => b.patient_report.pain_0_10);
  const effort = blocks2.map((b) => b.patient_report?.effort_0_10).filter((v) => v != null);
  return {
    n: vals.length,
    mean: mean(vals),
    max: vals.length ? Math.max(...vals) : null,
    latest: vals.length ? vals[vals.length - 1] : null,
    latestDate: rated.length ? rated[rated.length - 1].date : null,
    highCount: vals.filter((v) => v >= PAIN_HIGH).length,
    effortMean: mean(effort)
  };
}
function isPainFlare(blocks2) {
  const v = blocks2.filter((b) => b.patient_report?.pain_0_10 != null).map((b) => b.patient_report.pain_0_10);
  if (!v.length) return false;
  return v[v.length - 1] >= PAIN_SEVERE || v.length >= 2 && v[v.length - 1] >= PAIN_HIGH && v[v.length - 2] >= PAIN_HIGH;
}
var SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
function attention(rows2, blocks2, today) {
  const out = [];
  const rarely = [];
  const keys = [.../* @__PURE__ */ new Set([...rows2.map((r) => r.exercise_key), ...blocks2.map((b) => b.exercise_key)])];
  keys.forEach((key2) => {
    const name = BY_KEY[key2]?.name || key2;
    const myBlocks = blocks2.filter((b) => b.exercise_key === key2);
    const myDue = rows2.filter((r) => r.exercise_key === key2 && isDue(r)).sort((a, b) => a.date.localeCompare(b.date));
    if (isPainFlare(myBlocks)) {
      const rated = myBlocks.filter((b) => b.patient_report?.pain_0_10 != null);
      const last = rated.slice(-2);
      out.push({
        id: `pain-${key2}`,
        severity: "high",
        exercise: key2,
        title: `${name}: pain reported`,
        detail: `Pain ${last.map((b) => `${b.patient_report.pain_0_10}/10`).join(" and ")} on the last ${last.length === 1 ? "session" : "two sessions"} (${last.map((b) => b.date).join(", ")}). Worth a call before the next session.`
      });
    }
    if (myDue.length >= 3 && myDue.slice(-3).every((r) => r.reps_done === 0)) {
      out.push({
        id: `missed-${key2}`,
        severity: "high",
        exercise: key2,
        title: `${name}: last 3 sessions missed`,
        detail: `Nothing recorded on ${myDue.slice(-3).map((r) => r.date).join(", ")}.`
      });
    }
    const f = improvement(myBlocks.map(blockPoint), "form");
    if (f.label === "declining") {
      out.push({
        id: `form-${key2}`,
        severity: "medium",
        exercise: key2,
        title: `${name}: form is slipping`,
        detail: `Form score fell ${round(Math.abs(f.delta))} points (${round(f.first, 0)} to ${round(f.last, 0)}).`
      });
    }
    const ad = adherence(rows2.filter((r) => r.exercise_key === key2));
    if (ad.due >= 3 && ad.repsRate != null && ad.repsRate < 0.6 && !out.some((o) => o.id === `missed-${key2}`)) {
      out.push({
        id: `adh-${key2}`,
        severity: "medium",
        exercise: key2,
        title: `${name}: under 60% of reps done`,
        detail: `${ad.repsDone} of ${ad.repsPlanned} planned repetitions.`
      });
    }
    const recent = myBlocks.slice(-3);
    if (recent.length === 3 && recent.every((b) => b.summary.reps_completed > 0 && b.summary.reps_reached_target / b.summary.reps_completed < 0.5)) rarely.push(name);
  });
  if (rarely.length) {
    out.push({
      id: "range",
      severity: "low",
      exercise: null,
      title: `Target angle rarely reached: ${rarely.join(", ")}`,
      detail: "Fewer than half of the repetitions reached the target in each of the last 3 sessions. The target may be too ambitious, or the movement is limited."
    });
  }
  const due = rows2.filter(isDue);
  if (due.length >= 3) {
    const lastBlock = blocks2.length ? blocks2[blocks2.length - 1].date : null;
    const idle = lastBlock ? daysBetween(lastBlock, today) : null;
    if (lastBlock == null) {
      out.push({ id: "inactive", severity: "medium", exercise: null, title: "No sessions recorded yet", detail: `${due.length} sessions were scheduled so far and none has been imported.` });
    } else if (idle >= 5) {
      out.push({ id: "inactive", severity: "medium", exercise: null, title: `No session for ${idle} days`, detail: `The last recorded session was on ${lastBlock}.` });
    }
  }
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
}
function dayStatus(dayRows) {
  if (!dayRows.length) return "rest";
  if (dayRows.some((r) => r.status === "today")) return "today";
  if (dayRows.every((r) => r.status === "upcoming")) return "upcoming";
  const due = dayRows.filter(isDue);
  const done = sum(due.map((r) => r.reps_credited));
  if (due.length && due.every((r) => r.status === "done")) return "done";
  if (done === 0) return "missed";
  return "partial";
}
function dayCells(rows2, from, to) {
  const byDate = /* @__PURE__ */ new Map();
  rows2.forEach((r) => byDate.set(r.date, [...byDate.get(r.date) || [], r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dayRows = byDate.get(d) || [];
    out.push({
      date: d,
      status: dayStatus(dayRows),
      planned: sum(dayRows.map((r) => r.planned_reps)),
      done: sum(dayRows.map((r) => r.reps_credited)),
      exercises: dayRows.map((r) => r.exercise_key)
    });
  }
  return out;
}

// src/lib/notes.js
var MAX_NOTE_LENGTH = 600;
function makeNote({ date, text: text2, exercise_key = null, author = "" }, id, nowISO) {
  const body = String(text2 ?? "").trim();
  if (!isISODate(date)) return { error: "Choose a date for the note." };
  if (!body) return { error: "Write something in the note first." };
  if (body.length > MAX_NOTE_LENGTH) return { error: `Keep the note under ${MAX_NOTE_LENGTH} characters (it is ${body.length}).` };
  return { note: { id, date, exercise_key: exercise_key || null, text: body, author: String(author || "").trim() || null, created_at: nowISO } };
}
var addNote = (notes, note) => [...notes, note].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
var removeNote = (notes, id) => notes.filter((n) => n.id !== id);
function filterNotes(notes, { from, to, exercises }) {
  return notes.filter((n) => (!from || n.date >= from) && (!to || n.date <= to) && (!exercises || exercises.size === 0 || !n.exercise_key || exercises.has(n.exercise_key)));
}
function sanitizeNotes(list) {
  return (Array.isArray(list) ? list : []).filter((n) => n && typeof n.id === "string" && isISODate(n.date) && typeof n.text === "string" && n.text.trim() && typeof n.created_at === "string");
}

// src/lib/planBuilder.js
var uidCounter = 0;
var uid = () => `u${++uidCounter}`;
function newItemDraft(key2, startISO) {
  const spec = BY_KEY[key2];
  return {
    uid: uid(),
    exercise_key: key2,
    sets: spec.default_sets,
    reps_per_set: spec.default_reps,
    target_angle_deg: spec.default_target_angle_deg,
    hold_seconds: spec.default_hold_s,
    rest_seconds: 45,
    side: "auto",
    notes: "",
    days: ["mon", "wed", "fri"],
    start_date: startISO || "",
    end_date: "",
    progression: []
  };
}
function blankDraft(todayISO = toISO(/* @__PURE__ */ new Date())) {
  const monday = addDays(todayISO, -weekdayIndex(todayISO));
  return {
    plan_id: "plan-001",
    name: "Home exercise programme",
    patient: { id: "", name: "", condition: "" },
    supervisor: { name: "", role: "Physiotherapist", contact: "" },
    start_date: monday,
    end_date: addDays(monday, 7 * 8 - 1),
    goals: "",
    notes: "",
    items: [newItemDraft("squat", monday)]
  };
}
var num = (v) => v === "" || v == null ? void 0 : Number(v);
var text = (v) => v == null ? "" : String(v);
function draftToPlan(d, nowISO = (/* @__PURE__ */ new Date()).toISOString()) {
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
      rest_seconds: num(it.rest_seconds)
    };
    if (spec?.sided) out.side = it.side || "auto";
    if (text(it.notes).trim()) out.notes = text(it.notes).trim();
    out.schedule = {
      start_date: it.start_date || d.start_date || void 0,
      ...it.end_date || d.end_date ? { end_date: it.end_date || d.end_date } : {},
      days_of_week: DAY_KEYS.filter((k) => it.days.includes(k))
    };
    const steps = it.progression.filter((p) => p.from_date).map((p) => {
      const step = { from_date: p.from_date };
      ["sets", "reps_per_set", "target_angle_deg", "hold_seconds", "rest_seconds"].forEach((k) => {
        if (num(p[k]) !== void 0) step[k] = num(p[k]);
      });
      return step;
    });
    if (steps.length) out.progression = steps;
    return JSON.parse(JSON.stringify(out));
  });
  const plan2 = {
    schema_version: "1.1",
    plan_id: text(d.plan_id).trim(),
    name: text(d.name).trim() || text(d.plan_id).trim(),
    created_at: nowISO,
    ...d.start_date ? { start_date: d.start_date } : {},
    ...d.end_date ? { end_date: d.end_date } : {},
    patient: { id: text(d.patient.id).trim(), name: text(d.patient.name).trim(), condition: text(d.patient.condition).trim() },
    supervisor: { name: text(d.supervisor.name).trim(), role: text(d.supervisor.role).trim(), contact: text(d.supervisor.contact).trim() },
    goals: text(d.goals).split("\n").map((g) => g.trim()).filter(Boolean),
    notes: text(d.notes).trim(),
    items
  };
  return plan2;
}
function planToDraft(plan2) {
  return {
    plan_id: plan2.plan_id,
    name: plan2.name || "",
    patient: { id: plan2.patient.id || "", name: plan2.patient.name || "", condition: plan2.patient.condition || "" },
    supervisor: { name: plan2.supervisor?.name || "", role: plan2.supervisor?.role || "", contact: plan2.supervisor?.contact || "" },
    start_date: plan2.start_date || "",
    end_date: plan2.end_date || "",
    goals: (plan2.goals || []).join("\n"),
    notes: plan2.notes || "",
    items: plan2.items.map((it) => {
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
        side: it.side || "auto",
        notes: it.notes || "",
        // A plan written with explicit dates cannot be shown as weekdays; the form keeps its first and last date as a range.
        days: explicit ? [...new Set(s.dates.map((x) => DAY_KEYS[weekdayIndex(x)]))] : (s.days_of_week || []).map((x) => String(x).toLowerCase().slice(0, 3)),
        start_date: explicit ? [...s.dates].sort()[0] : s.start_date || "",
        end_date: explicit ? [...s.dates].sort().slice(-1)[0] : s.end_date || "",
        progression: (it.progression || []).map((p) => ({ from_date: p.from_date, sets: p.sets ?? "", reps_per_set: p.reps_per_set ?? "", target_angle_deg: p.target_angle_deg ?? "", hold_seconds: p.hold_seconds ?? "", rest_seconds: p.rest_seconds ?? "" }))
      };
    })
  };
}

// tests/features.test.mjs
var here = path.dirname(fileURLToPath(import.meta.url));
var samples = path.join(here, "..", "..", "samples");
var passed = 0;
var test = (name, fn) => {
  fn();
  passed++;
  console.log("  ok", name);
};
var close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
var expect = JSON.parse(fs.readFileSync(path.join(samples, "expected_stats.json"), "utf8"));
var planRaw = JSON.parse(fs.readFileSync(path.join(samples, "plan.json"), "utf8"));
var { plan } = validatePlan(planRaw);
var occurrences = expandPlan(plan);
var sessions = [];
fs.readdirSync(path.join(samples, "sessions")).filter((f) => f.endsWith(".json")).sort().forEach((f) => {
  const v = validateSession(JSON.parse(fs.readFileSync(path.join(samples, "sessions", f), "utf8")), f);
  assert.equal(v.errors.length, 0);
  sessions = mergeSessions(sessions, [v.session]).sessions;
});
var blocks = flattenBlocks(sessions);
var TODAY = "2026-11-15";
var { rows } = matchPlan(occurrences, blocks, TODAY);
console.log("pain (equal to the independent python computation)");
test("overall pain statistics", () => {
  const p = painStats(blocks);
  assert.equal(p.n, expect.pain_blocks);
  close(p.mean, expect.pain_mean);
  assert.equal(p.max, expect.pain_max);
});
test("per-exercise pain mean and latest", () => {
  const sums = exerciseSummaries(rows, blocks);
  Object.entries(expect.per_exercise).forEach(([key2, e]) => {
    const s = sums.find((x) => x.key === key2);
    close(s.pain.mean, e.pain_mean);
    assert.equal(s.pain.latest, e.pain_latest);
  });
});
test("pain flare and missed-run alerts match python exactly", () => {
  const found = attention(rows, blocks, TODAY);
  const ids = (prefix) => found.filter((a) => a.id.startsWith(prefix)).map((a) => a.id.slice(prefix.length)).sort();
  assert.deepEqual(ids("pain-"), expect.pain_flare);
  assert.deepEqual(ids("missed-"), expect.last3_missed);
  assert.equal(found[0].severity, "high");
  assert.ok(found[0].detail.includes("7/10"));
});
test("flare rule: latest >= 8, or two in a row >= 6, otherwise not", () => {
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
  assert.equal(o.improvement.pain.label === "insufficient", false);
  assert.ok(["improving", "stable", "declining"].includes(o.improvement.pain.label));
});
test("a malformed patient_report is dropped with a warning, the block is kept", () => {
  const raw = JSON.parse(fs.readFileSync(path.join(samples, "sessions", fs.readdirSync(path.join(samples, "sessions"))[0]), "utf8"));
  raw.blocks[0].patient_report = { pain_0_10: 11, effort_0_10: 3 };
  const v = validateSession(raw, "x.json");
  assert.ok(v.session);
  assert.equal(v.session.blocks[0].patient_report, void 0);
  assert.ok(v.warnings.some((w) => w.includes("patient_report")));
});
console.log("attention rules on constructed data");
var row = (o) => ({ exercise_key: "squat", planned_reps: 30, reps_credited: 0, reps_done: 0, blocks: [], status: "missed", ...o });
test("three missed sessions in a row", () => {
  const rs = [row({ date: "2026-11-09" }), row({ date: "2026-11-11" }), row({ date: "2026-11-13" })];
  const found = attention(rs, [], "2026-11-15");
  assert.ok(found.some((a) => a.id === "missed-squat" && a.severity === "high"));
  assert.ok(found.some((a) => a.id === "inactive"));
});
test("two missed then one done is not a missed run", () => {
  const rs = [row({ date: "2026-11-09" }), row({ date: "2026-11-11" }), row({ date: "2026-11-13", reps_done: 30, reps_credited: 30, status: "done" })];
  assert.ok(!attention(rs, [], "2026-11-15").some((a) => a.id === "missed-squat"));
});
test("upcoming sessions never trigger anything", () => {
  const rs = [row({ date: "2026-11-20", status: "upcoming" }), row({ date: "2026-11-22", status: "upcoming" }), row({ date: "2026-11-24", status: "upcoming" })];
  assert.deepEqual(attention(rs, [], "2026-11-15"), []);
});
test("target rarely reached over the last three sessions (one grouped item, not one per exercise)", () => {
  const mk = (d) => ({ exercise_key: "squat", date: d, started_at: `${d}T09:00:00-05:00`, angle: { start_angle_deg: 5, target_angle_deg: 90, direction: "increase" }, summary: { reps_completed: 10, reps_planned: 10, reps_reached_target: 2, avg_form_score: 80, avg_rom_pct: 70, avg_peak_angle_deg: 65 } });
  const found = attention([], [mk("2026-11-09"), mk("2026-11-11"), mk("2026-11-13")], "2026-11-14");
  const r = found.find((a) => a.id === "range");
  assert.ok(r && r.severity === "low" && r.title.includes("Squat"));
});
console.log("day cells");
test("statuses", () => {
  assert.equal(dayStatus([]), "rest");
  assert.equal(dayStatus([row({ status: "upcoming" })]), "upcoming");
  assert.equal(dayStatus([row({ status: "today" })]), "today");
  assert.equal(dayStatus([row({ status: "done", reps_credited: 30, reps_done: 30 })]), "done");
  assert.equal(dayStatus([row({ status: "done", reps_credited: 30, reps_done: 30 }), row({ status: "missed" })]), "partial");
  assert.equal(dayStatus([row({ status: "partial", reps_credited: 12, reps_done: 12 })]), "partial");
  assert.equal(dayStatus([row({ status: "missed" }), row({ status: "missed" })]), "missed");
});
test("a range of dates yields one cell per day, matching the plan", () => {
  const cells = dayCells(rows, "2026-10-19", "2026-11-15");
  assert.equal(cells.length, 28);
  assert.equal(cells[0].date, "2026-10-19");
  const planned = cells.reduce((s, c) => s + c.planned, 0);
  assert.equal(planned, rows.filter((r) => r.date <= "2026-11-15").reduce((s, r) => s + r.planned_reps, 0));
  assert.ok(cells.some((c) => c.status === "done"));
});
console.log("notes");
test("validation", () => {
  assert.ok(makeNote({ date: "nope", text: "x" }, "n1", "t").error);
  assert.ok(makeNote({ date: "2026-11-15", text: "   " }, "n1", "t").error);
  assert.ok(makeNote({ date: "2026-11-15", text: "x".repeat(601) }, "n1", "t").error);
  const { note } = makeNote({ date: "2026-11-15", text: " Ease off the squat ", exercise_key: "squat", author: " Dr. S " }, "n1", "2026-11-15T10:00:00Z");
  assert.equal(note.text, "Ease off the squat");
  assert.equal(note.author, "Dr. S");
});
test("add keeps date order, remove, filter and sanitize", () => {
  const mk = (id, date, ex) => makeNote({ date, text: id, exercise_key: ex }, id, `2026-11-15T10:00:0${id}Z`).note;
  let n = [];
  n = addNote(n, mk("2", "2026-11-12", "squat"));
  n = addNote(n, mk("1", "2026-11-10", null));
  n = addNote(n, mk("3", "2026-11-14", "hip_extension"));
  assert.deepEqual(n.map((x) => x.id), ["1", "2", "3"]);
  assert.deepEqual(filterNotes(n, { from: "2026-11-11", to: "2026-11-30", exercises: /* @__PURE__ */ new Set(["squat"]) }).map((x) => x.id), ["2"]);
  assert.deepEqual(filterNotes(n, { from: null, to: null, exercises: /* @__PURE__ */ new Set(["squat"]) }).map((x) => x.id), ["1", "2"]);
  assert.deepEqual(removeNote(n, "2").map((x) => x.id), ["1", "3"]);
  assert.equal(sanitizeNotes([...n, { id: 5 }, null, { id: "z", date: "bad", text: "x", created_at: "t" }]).length, 3);
});
console.log("plan builder");
var key = (r) => `${r.date}|${r.exercise_key}|${r.planned_reps}|${r.target_angle_deg}|${r.hold_seconds}|${r.rest_seconds}`;
test("a blank draft is not valid until the patient is named, then it is", () => {
  const d = blankDraft("2026-11-17");
  assert.ok(validatePlan(draftToPlan(d)).errors.some((e) => e.includes("patient.id")));
  d.patient.id = "pt-9";
  const v = validatePlan(draftToPlan(d));
  assert.deepEqual(v.errors, []);
  assert.equal(v.plan.items[0].exercise_key, "squat");
  assert.equal(v.plan.start_date, "2026-11-16");
});
test("the sample plan survives plan -> form -> plan with the same schedule and prescriptions", () => {
  const again = validatePlan(draftToPlan(planToDraft(plan)));
  assert.deepEqual(again.errors, []);
  assert.deepEqual(expandPlan(again.plan).map(key).sort(), occurrences.map(key).sort());
  assert.equal(again.plan.items.find((i) => i.exercise_key === "squat").progression.length, 1);
});
test("item ids are unique and readable when an exercise is added twice", () => {
  const d = blankDraft("2026-11-17");
  d.patient.id = "p";
  d.items.push(newItemDraft("squat", d.start_date), newItemDraft("hip_extension", d.start_date));
  const p = draftToPlan(d);
  assert.deepEqual(p.items.map((i) => i.item_id), ["squat-1", "squat-2", "hip_extension-1"]);
  assert.deepEqual(validatePlan(p).errors, []);
});
test("out-of-range targets and empty weekday lists are reported, in plain words", () => {
  const d = blankDraft("2026-11-17");
  d.patient.id = "p";
  d.items[0].target_angle_deg = 200;
  d.items[0].days = [];
  const errs = validatePlan(draftToPlan(d)).errors.join(" | ");
  assert.match(errs, /target_angle_deg/);
  assert.match(errs, /schedule/);
});
test("side is written only for exercises that have a side", () => {
  const d = blankDraft("2026-11-17");
  d.patient.id = "p";
  d.items[0].side = "left";
  d.items.push({ ...newItemDraft("hip_extension", d.start_date), side: "left" });
  const p = draftToPlan(d);
  assert.equal(p.items[0].side, void 0);
  assert.equal(p.items[1].side, "left");
});
console.log(`
${passed} feature tests passed`);
