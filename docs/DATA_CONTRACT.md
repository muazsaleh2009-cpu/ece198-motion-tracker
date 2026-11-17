# Data contract: plan.json and session.json

The Python tracker and the website only talk through two JSON files. Both carry
`"schema_version": "1.1"`. A change that the other side would have to adapt to bumps the **major**
number; the website refuses files with a different major version. A **minor** bump only adds optional fields
(1.1 added `patient_report`), so 1.0 and 1.1 files are both accepted.

```
website ──plan.json──▶ tracker (run_session.py) ──session_*.json──▶ website
```

All angles are in **degrees**, all durations in **seconds**, dates are `YYYY-MM-DD`, timestamps are
ISO 8601 **with the local UTC offset** (e.g. `2026-11-14T17:39:00-05:00`). The calendar date of a session
is the date written in the timestamp, so time zones never move a session to another day.

---------------------------------------------------------------------------------------------------

## 1. plan.json (website → tracker)

```jsonc
{
  "schema_version": "1.1",
  "plan_id": "plan-demo-001",              // required, text
  "name": "Post-rehab maintenance programme",
  "created_at": "2026-10-17T10:00:00-04:00",
  "start_date": "2026-10-19",              // optional overall range
  "end_date": "2026-12-13",
  "patient":    { "id": "pt-001", "name": "Demo Patient", "condition": "…" },   // patient.id required
  "supervisor": { "name": "Dr. Sample Physio", "role": "Physiotherapist", "contact": "…" },
  "goals": ["…"],
  "notes": "…",
  "items": [                               // required, at least one
    {
      "item_id": "squat-1",                // required, unique inside the plan
      "exercise_key": "squat",             // required, one of the keys in the catalog below
      "sets": 3,                           // required, whole number >= 1
      "reps_per_set": 10,                  // required, whole number >= 1
      "target_angle_deg": 90,              // optional (default from catalog); must be inside the allowed range
      "hold_seconds": 0,                   // optional (default from catalog)
      "rest_seconds": 45,                  // optional (default 30)
      "side": "auto",                      // "left" | "right" | "auto"; ignored for two-sided exercises (squat)
      "notes": "Chest up, heels down",
      "schedule": {                        // EITHER a rule…
        "start_date": "2026-10-19", "end_date": "2026-12-13",
        "days_of_week": ["mon", "wed", "fri"]
        // …OR explicit dates:  "dates": ["2026-10-19", "2026-10-21"]
      },
      "progression": [                     // optional; the latest step whose from_date <= today overrides the base values
        { "from_date": "2026-11-16", "target_angle_deg": 100, "reps_per_set": 12 }
        // any of: sets, reps_per_set, target_angle_deg, hold_seconds, rest_seconds
      ]
    }
  ]
}
```

*One scheduled exercise on one day* is called an **occurrence**. A rule with no `end_date` of its own runs to the plan's `end_date`, or for 84 days if the plan has none.
`python tools/export_catalog.py` writes `exercise_catalog.json`, which the website imports, so valid
`exercise_key`s, default targets and allowed target ranges can never drift apart.

### Exercise catalog (generated, 11 exercises)

| key | measured angle | 0° / start means | default target | allowed target | camera |
|---|---|---|---|---|---|
| `squat` | knee flexion (both knees averaged) | 5° (standing, knee straight) | 90° | 30–135° | side |
| `standing_knee_flexion` | knee flexion | 5° | 90° | 30–135° | side |
| `seated_knee_extension` | knee flexion (0 = straight) | **starts 90°, falls to target** | 0° | 0–45° | side |
| `hip_flexion` | thigh forward of trunk | 0° (thigh in line with trunk) | 80° | 30–120° | side |
| `hip_extension` | thigh backward of trunk | 0° | 20° | 8–30° | side |
| `hip_abduction` | thigh out from body midline | 0° | 35° | 10–45° | front |
| `elbow_flexion` | elbow flexion | 10° | 140° | 60–150° | side |
| `elbow_extension` | elbow flexion (0 = straight) | **starts 90°, falls to target** | 0° | 0–45° | side |
| `shoulder_flexion` | upper arm forward of trunk | 0° (arm by the side) | 150° | 60–180° | side |
| `shoulder_extension` | upper arm backward of trunk | 0° | 45° | 10–60° | side |
| `shoulder_abduction` | upper arm out from body midline | 0° | 150° | 60–180° | front |

---------------------------------------------------------------------------------------------------

## 2. session.json (tracker → website)

One file per camera session. A session contains one **block** per exercise performed; a block contains
**sets**; a set contains **reps** (every attempt, counted or not).

```jsonc
{
  "schema_version": "1.1",
  "session_id": "20261114T173900-a1b2c3",       // unique; re-importing the same id replaces, never duplicates
  "patient_id": "pt-001",                        // website rejects a session whose patient differs from the plan
  "plan_id": "plan-demo-001",
  "started_at": "2026-11-14T17:39:00-05:00",
  "ended_at":   "2026-11-14T17:58:10-05:00",
  "duration_s": 1150.0,
  "device": { "tracker": "therapypal-tracker", "tracker_version": "1.1.0", "pose_model": "mediapipe-pose-landmarker",
              "camera_index": 0, "frame_size": [1280, 720] },
  "blocks": [ /* block, see below */ ]
}
```

### block

| field | meaning |
|---|---|
| `block_id` | unique id (`<plan item>-<date>` when run from a plan) |
| `exercise_key` | key from the catalog |
| `plan_item_id`, `scheduled_date` | which plan occurrence this block fulfils; **null** for ad-hoc blocks (the website then matches by exercise + date) |
| `side` | `left` / `right` / `both` (what was actually tracked) |
| `camera_view` | `side` / `front` |
| `angle` | `{name, unit, convention, start_angle_deg, target_angle_deg, direction}`: `direction` is `increase` or `decrease` (how the angle moves toward the target) |
| `prescribed` | `{sets, reps_per_set, target_angle_deg, hold_seconds, rest_seconds}`: the prescription that applied on that day (after progression) |
| `started_at`, `ended_at`, `duration_s` | block timing |
| `status` | `completed` (all planned reps counted) · `partial` · `no_reps` |
| `sets[]` | see below |
| `summary` | `reps_planned`, `reps_completed`, `completion_pct`, `sets_recorded`, `reps_reached_target`, `avg_peak_angle_deg`, `best_peak_angle_deg`, `avg_rom_pct`, `avg_form_score`, `min_form_score`, `avg_rep_duration_s`, `avg_hold_s`, `flag_counts` (all computed over **counted** reps) |
| `tracking` | `{frames, valid_frames, valid_pct, camera_view_mismatch_pct, side_used}`: data quality |
| `patient_report` | optional (1.1): `{pain_0_10, effort_0_10, note}`, integers 0-10, each key present only if answered. See below |
| `angle_trace` | `{hz: 5, unit: "deg", samples: [[t_seconds, angle], …]}`: smoothed angle over time, `t` counted from the block start |

### set → rep

```jsonc
{ "set_number": 1, "target_reps": 10, "completed_reps": 9, "attempts_not_counted": 1,
  "t_start_s": 0.0, "t_end_s": 74.2,
  "ended_by": "target_reached",     // | "manual" | "session_ended" | "exercise_skipped"
  "reps": [ {
      "counted": true, "rep_index": 1,            // rep_index is null when not counted
      "t_start_s": 4.1, "t_end_s": 7.3, "duration_s": 3.2, "time_to_peak_s": 1.5, "return_s": 1.7,
      "start_angle_deg": 5.2, "peak_angle_deg": 71.3, "target_angle_deg": 90.0,
      "rom_deg": 66.1,                             // |peak - start|
      "rom_pct": 76.0,                             // 100 * (peak-start)/(target-start); 100 = exactly the target
      "reached_target": false,                     // rom_pct >= 90
      "hold_s": 0.8,                               // longest time within 10% of the range of this rep's own peak
      "form_score": 89.0,                          // 0-100, see below
      "components": { "rom": 0.76, "compensation": 1.0, "tempo": 1.0, "hold": null },
      "excursions_deg": { "trunk_lean_forward": 21.4 },  // largest compensating movement per form check (keys = the exercise's form checks)
      "flags": ["short_of_target"]                 // see below
  } ] }
```

### patient_report (new in 1.1)

After the last set of an exercise that had at least one counted rep, the tracker window asks two questions:
pain (0-10) and effort (0-10). Keys `0`-`9` answer, `t` means 10, `space`/`s`/`esc` skips, and each question
times out after about 30 s so a patient who walked away never blocks the session. Run with `--no-checkin` to
turn the questions off. Blocks without answers simply have no `patient_report`.

The website flags a **pain flare** when the latest pain rating is 8 or more, or the last two ratings are both 6 or more.

### flags

`short_of_target` (counted but < 90% of the range), `too_fast`, `too_slow`, `hold_short`, `tracking_lost`
plus the exercise's own form checks: `trunk_lean_forward` (squat), `trunk_motion`, `upper_arm_drift`,
`thigh_drift`, `trunk_lean_sideways`. Human wording for every flag comes from the catalog.

### Counting and scoring rules (identical for every exercise)

A repetition **starts** when the angle leaves the start position (progress ≥ 35% of the range for 3 frames),
**ends** when it returns (progress ≤ 25% for 3 frames), and is **counted** if the peak reached ≥ 70% of the
prescribed range (`progress = (angle − start) / (target − start)`).

`form_score = 100 × (0.50·rom + 0.30·compensation + 0.20·tempo)` (when a hold is prescribed:
`0.45·rom + 0.25·compensation + 0.15·tempo + 0.15·hold`). All components are stored per rep.

---------------------------------------------------------------------------------------------------

## 3. What the website computes from these files

| measure | definition |
|---|---|
| **Adherence** | reps done ÷ reps planned over *due* occurrences (date before today, or already has work). Extras beyond the plan do not count. |
| **Performance** | rep-weighted average of `avg_form_score`, `avg_rom_pct`, and the share of reps that reached the target |
| **Consistency** | adherence, plus streak of days with ≥ 80% of the planned reps, plus the rep-to-rep spread (SD) of the peak angle |
| **Improvement** | mean of the last third of sessions minus the mean of the first third; needs ≥ 4 sessions; within ±2 points/degrees is "stable". For exercises whose angle *falls* toward the target, "improving" means the angle got lower. |
| **Matching** | a block fulfils the occurrence named by `plan_item_id` + `scheduled_date`; otherwise the unmatched occurrence with the same exercise on the same date; otherwise it is reported as *unplanned* |
