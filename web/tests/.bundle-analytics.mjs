// tests/analytics.test.mjs
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
function planTemplate(startISO) {
  const start = startISO || toISO(/* @__PURE__ */ new Date());
  const monday = addDays(start, -weekdayIndex(start));
  const pick = ["squat", "elbow_extension"].map((k) => BY_KEY[k]);
  return {
    schema_version: "1.1",
    plan_id: "plan-001",
    name: "Home exercise programme",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    start_date: monday,
    end_date: addDays(monday, 7 * 8 - 1),
    patient: { id: "patient-001", name: "Patient name", condition: "" },
    supervisor: { name: "Supervisor name", role: "Physiotherapist", contact: "" },
    goals: ["Describe the goal of the programme"],
    notes: "",
    items: pick.map((spec, i) => ({
      item_id: `${spec.key}-1`,
      exercise_key: spec.key,
      sets: spec.default_sets,
      reps_per_set: spec.default_reps,
      target_angle_deg: spec.default_target_angle_deg,
      hold_seconds: spec.default_hold_s,
      rest_seconds: 45,
      side: spec.sided ? "auto" : void 0,
      notes: "",
      schedule: { start_date: monday, end_date: addDays(monday, 7 * 8 - 1), days_of_week: i === 0 ? ["mon", "wed", "fri"] : ["tue", "thu", "sat"] }
    }))
  };
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
  const unplanned2 = [];
  blocks2.forEach((b) => {
    let row = b.plan_item_id && b.scheduled_date ? byId.get(`${b.plan_item_id}|${b.scheduled_date}`) : null;
    if (!row) {
      const candidates = byKeyDate.get(`${b.exercise_key}|${b.date}`) || [];
      row = candidates.find((r) => r.blocks.length === 0) || null;
    }
    if (row) row.blocks.push(b);
    else unplanned2.push(b);
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
  return { rows: rows2, unplanned: unplanned2 };
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
function improvement(points, key, { threshold = IMPROVE_THRESHOLD, sign = 1 } = {}) {
  const vals = points.map((p) => p[key]).filter((v) => v != null);
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
      const key = `${b.exercise_key}|${flag}`;
      counts.set(key, (counts.get(key) || 0) + n);
    });
  });
  return [...counts.entries()].map(([key, count]) => {
    const [exercise, flag] = key.split("|");
    return { exercise, flag, label: flagLabel(flag, exercise), count, pct: reps ? count / reps : null };
  }).sort((a, b) => b.count - a.count);
}
function exerciseSummaries(rows2, blocks2) {
  const keys = [.../* @__PURE__ */ new Set([...rows2.map((r) => r.exercise_key), ...blocks2.map((b) => b.exercise_key)])];
  return keys.map((key) => {
    const spec = BY_KEY[key];
    const myRows = rows2.filter((r) => r.exercise_key === key);
    const myBlocks = blocks2.filter((b) => b.exercise_key === key);
    const points = myBlocks.map(blockPoint);
    const sign = spec?.direction === "decrease" ? -1 : 1;
    return {
      key,
      name: spec?.name || key,
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
function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}
function filterRows(rows2, { exercises, from, to }) {
  return rows2.filter((r) => (!exercises || exercises.size === 0 || exercises.has(r.exercise_key)) && inRange(r.date, from, to));
}
function filterBlocks(blocks2, { exercises, from, to }) {
  return blocks2.filter((b) => (!exercises || exercises.size === 0 || exercises.has(b.exercise_key)) && inRange(b.date, from, to));
}
function presetRange(id, today, planStart) {
  if (id === "7d") return { from: addDays(today, -6), to: today };
  if (id === "30d") return { from: addDays(today, -29), to: today };
  if (id === "3m") return { from: addDays(today, -89), to: today };
  if (id === "plan") return { from: planStart || null, to: today };
  return { from: null, to: null };
}
var csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function repsToCsv(blocks2) {
  const header = ["date", "time", "session_id", "block_id", "exercise", "side", "set", "rep", "counted", "start_angle_deg", "peak_angle_deg", "target_angle_deg", "rom_pct", "reached_target", "hold_s", "duration_s", "form_score", "flags", "pain_0_10", "effort_0_10"];
  const lines = [header.join(",")];
  blocks2.forEach((b) => {
    repsOfBlock(b).forEach((r) => {
      lines.push([b.date, b.time, b.session_id, b.block_id, BY_KEY[b.exercise_key]?.name || b.exercise_key, b.side, r.set_number, r.rep_index, r.counted, r.start_angle_deg, r.peak_angle_deg, r.target_angle_deg, r.rom_pct, r.reached_target, r.hold_s, r.duration_s, r.form_score, (r.flags || []).join(" "), b.patient_report?.pain_0_10, b.patient_report?.effort_0_10].map(csvCell).join(","));
    });
  });
  return lines.join("\n");
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

// tests/analytics.test.mjs
var here = path.dirname(fileURLToPath(import.meta.url));
var samples = path.join(here, "..", "..", "samples");
var passed = 0;
var test = (name, fn) => {
  fn();
  passed++;
  console.log("  ok", name);
};
var planRaw = JSON.parse(fs.readFileSync(path.join(samples, "plan.json"), "utf8"));
var files = fs.readdirSync(path.join(samples, "sessions")).filter((f) => f.endsWith(".json")).sort();
var sessionRaws = files.map((f) => [f, JSON.parse(fs.readFileSync(path.join(samples, "sessions", f), "utf8"))]);
var { plan, errors: planErrors } = validatePlan(planRaw);
var occurrences = expandPlan(plan);
var sessions = [];
sessionRaws.forEach(([f, raw]) => {
  const v = validateSession(raw, f);
  assert.equal(v.errors.length, 0, v.errors.join("; "));
  sessions = mergeSessions(sessions, [v.session]).sessions;
});
var blocks = flattenBlocks(sessions);
var TODAY = "2026-11-15";
console.log("plan");
test("sample plan validates and expands", () => {
  assert.equal(planErrors.length, 0);
  const expect = JSON.parse(fs.readFileSync(path.join(samples, "expected_stats.json"), "utf8"));
  assert.equal(occurrences.length, expect.occurrences);
});
test("progression overrides apply from their date", () => {
  const squat = plan.items.find((i) => i.item_id === "squat-1");
  assert.equal(prescriptionOn(squat, "2026-11-13").reps_per_set, 10);
  assert.equal(prescriptionOn(squat, "2026-11-16").reps_per_set, 12);
  assert.equal(prescriptionOn(squat, "2026-11-16").target_angle_deg, 100);
});
test("open-ended schedules follow the same end-date rule as the python tracker", () => {
  const item = { ...plan.items[0], schedule: { start_date: "2026-10-19", days_of_week: ["mon"] } };
  const withPlanEnd = itemDates(item, { end_date: "2026-12-13" });
  assert.equal(withPlanEnd.length, 8);
  assert.equal(withPlanEnd[7], "2026-12-07");
  const noEnd = itemDates(item, {});
  assert.equal(noEnd.length, 12);
  assert.equal(noEnd[11], "2027-01-04");
  const own = itemDates({ ...item, schedule: { ...item.schedule, end_date: "2026-11-02" } }, { end_date: "2026-12-13" });
  assert.equal(own.length, 3);
});
test("template is itself a valid plan", () => {
  const v = validatePlan(planTemplate("2026-11-15"));
  assert.deepEqual(v.errors, []);
});
test("bad plans give specific messages", () => {
  const bad = JSON.parse(JSON.stringify(planRaw));
  bad.items[0].exercise_key = "bicep_party";
  bad.items[1].target_angle_deg = 170;
  bad.items[2].schedule = {};
  bad.items[3].sets = 0;
  const v = validatePlan(bad);
  assert.equal(v.plan, null);
  const text = v.errors.join("\n");
  assert.match(text, /unknown exercise_key "bicep_party"/);
  assert.match(text, /must be between 0° and 45°/);
  assert.match(text, /needs either "dates"/);
  assert.match(text, /"sets" must be a whole number/);
  assert.equal(validatePlan({}).plan, null);
  assert.equal(validatePlan(null).plan, null);
});
test("a session file is rejected as a plan and a plan as a session", () => {
  assert.match(validateSession(planRaw, "plan.json").errors[0], /looks like a PLAN/);
  const asPlan = validatePlan(sessionRaws[0][1]);
  assert.equal(asPlan.plan, null);
  assert.match(asPlan.errors[0], /looks like a SESSION file/);
});
console.log("sessions");
test("all sample sessions import", () => {
  assert.equal(sessions.length, 21);
});
test("importing twice replaces instead of duplicating", () => {
  const again = mergeSessions(sessions, [sessions[0], sessions[1]]);
  assert.equal(again.sessions.length, 21);
  assert.equal(again.replaced, 2);
  assert.equal(again.added, 0);
});
test("unknown exercise blocks are skipped with a warning, not a crash", () => {
  const raw = JSON.parse(JSON.stringify(sessionRaws[0][1]));
  raw.blocks.push({ ...raw.blocks[0], exercise_key: "cartwheel" });
  const v = validateSession(raw, "x.json");
  assert.equal(v.errors.length, 0);
  assert.equal(v.warnings.length, 1);
  assert.equal(v.session.blocks.length, raw.blocks.length - 1);
});
test("a future major schema version is refused", () => {
  const raw = { ...sessionRaws[0][1], schema_version: "2.0" };
  assert.match(validateSession(raw, "x").errors[0], /unsupported schema_version/);
});
console.log("analytics");
var { rows, unplanned } = matchPlan(occurrences, blocks, TODAY);
test("every recorded block matched a planned occurrence", () => {
  assert.equal(unplanned.length, 0);
  assert.equal(rows.reduce((n, r) => n + r.blocks.length, 0), blocks.length);
});
test("numbers equal the independent python computation", () => {
  const expect = JSON.parse(fs.readFileSync(path.join(samples, "expected_stats.json"), "utf8"));
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
test("today and future occurrences are not counted as missed", () => {
  assert.ok(rows.filter((r) => r.date >= TODAY).every((r) => r.status === "upcoming" || r.status === "today"));
  assert.equal(adherence(rows).upcoming, rows.filter((r) => r.date >= TODAY).length);
});
test("improvement detects the simulated upward trend and needs enough data", () => {
  const sums = exerciseSummaries(rows, blocks);
  sums.forEach((s) => assert.equal(s.improvement.form.label, "improving", s.key));
  assert.equal(improvement([{ x: 1 }, { x: 2 }, { x: 3 }], "x").label, "insufficient");
  assert.equal(improvement([1, 1, 1, 1, 1, 1].map((x) => ({ x })), "x").label, "stable");
  assert.equal(improvement([9, 9, 5, 5, 1, 1].map((x) => ({ x })), "x").label, "declining");
  const elbow = sums.find((s) => s.key === "elbow_extension");
  assert.ok(elbow.improvement.peak.delta > 0, "elbow peak angle moved toward 0 deg = positive improvement");
});
test("date filters narrow both rows and blocks consistently", () => {
  const f = { exercises: /* @__PURE__ */ new Set(["squat"]), from: "2026-11-01", to: "2026-11-15" };
  const b = filterBlocks(blocks, f);
  const r = filterRows(rows, f);
  assert.ok(b.length > 0 && b.every((x) => x.exercise_key === "squat" && x.date >= "2026-11-01"));
  assert.ok(r.every((x) => x.exercise_key === "squat" && x.date >= "2026-11-01"));
  assert.deepEqual(presetRange("7d", "2026-11-15"), { from: "2026-11-09", to: "2026-11-15" });
});
test("weekly series covers every week and adherence is in 0..1", () => {
  const w = weeklySeries(rows, blocks);
  assert.ok(w.length >= 4);
  w.forEach((x) => x.adherence != null && assert.ok(x.adherence >= 0 && x.adherence <= 1.0001));
});
test("csv has one line per repetition attempt", () => {
  const csv = repsToCsv(blocks.slice(0, 3)).split("\n");
  const attempts = blocks.slice(0, 3).reduce((n, b) => n + b.sets.reduce((m, s) => m + s.reps.length, 0), 0);
  assert.equal(csv.length - 1, attempts);
  assert.match(csv[0], /^date,time,session_id/);
});
test("an ad-hoc block (no plan item) on a planned day still matches", () => {
  const b = { ...blocks[0], plan_item_id: null, scheduled_date: null };
  const m = matchPlan(occurrences, [b], TODAY);
  assert.equal(m.unplanned.length, 0);
});
test("a block on an unplanned day is reported as unplanned", () => {
  const b = { ...blocks[0], plan_item_id: null, scheduled_date: null, date: "2026-01-01" };
  assert.equal(matchPlan(occurrences, [b], TODAY).unplanned.length, 1);
});
test("overall summary assembles", () => {
  const o = overallSummary(rows, blocks);
  assert.ok(o.adherence.repsRate > 0.5 && o.adherence.repsRate <= 1);
  assert.ok(o.performance.form > 70);
});
console.log(`
${passed} passed`);
