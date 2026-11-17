#!/usr/bin/env python3
"""Generate a sample plan and weeks of sample sessions, using the REAL tracker pipeline.

A synthetic patient is animated (joint angles over time, with the rep-to-rep variation and
compensations a real patient has), turned into landmark poses, and fed to BlockSession exactly
like camera frames would be. Nothing in the output is hand-written, so it exercises the same
code path as a live session.

    python tools/simulate.py --out samples
"""

import argparse
import json
import os
import random
import sys
from datetime import date, datetime, time, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tracker.block import BlockSession, Prescription  # noqa: E402
from tracker.exercises import get_exercise  # noqa: E402
from tracker.plan import item_dates, resolve_prescription, validate_plan  # noqa: E402
from tracker.session import SessionRecorder  # noqa: E402
from tracker.synthetic import make_pose, rep_angles  # noqa: E402

PLAN_START = date(2026, 10, 19)   # a Monday
PLAN_END = date(2026, 12, 13)
FLARE_FROM = "2026-11-09"          # squat pain flare-up used to demo the website alerts


def build_sample_plan() -> dict:
    def item(i, key, sets, reps, days, target=None, hold=None, rest=45, notes="", prog=None, side="auto"):
        spec = get_exercise(key)
        d = {
            "item_id": i, "exercise_key": key, "sets": sets, "reps_per_set": reps,
            "target_angle_deg": spec.default_target_angle_deg if target is None else target,
            "hold_seconds": spec.default_hold_s if hold is None else hold,
            "rest_seconds": rest, "side": side, "notes": notes,
            "schedule": {"start_date": PLAN_START.isoformat(), "end_date": PLAN_END.isoformat(),
                         "days_of_week": days},
        }
        if prog:
            d["progression"] = prog
        return d

    return {
        "schema_version": "1.0",
        "plan_id": "plan-demo-001",
        "name": "Post-rehab maintenance programme",
        "created_at": "2026-10-17T10:00:00-04:00",
        "start_date": PLAN_START.isoformat(),
        "end_date": PLAN_END.isoformat(),
        "patient": {"id": "pt-001", "name": "Demo Patient", "condition": "Post-operative rehabilitation, completed physiotherapy"},
        "supervisor": {"name": "Dr. Sample Physio", "role": "Physiotherapist", "contact": "clinic@example.com"},
        "goals": ["Restore full knee and elbow range of motion", "Exercise independently 3 times per week"],
        "notes": "Stop and contact the clinic if you feel sharp pain.",
        "items": [
            item("squat-1", "squat", 3, 10, ["mon", "wed", "fri"], notes="Chest up, heels down",
                 prog=[{"from_date": "2026-11-16", "target_angle_deg": 100, "reps_per_set": 12}]),
            item("elbow-ext-1", "elbow_extension", 3, 12, ["tue", "thu", "sat"], side="right",
                 notes="Keep the upper arm still"),
            item("shoulder-ext-1", "shoulder_extension", 2, 12, ["mon", "wed", "fri"], side="right"),
            item("hip-ext-1", "hip_extension", 3, 10, ["tue", "thu"], side="left", hold=2.0),
        ],
    }


class SimPatient:
    """How well the patient performs on day `progress` (0 at plan start, 1 at plan end)."""

    def __init__(self, rng: random.Random):
        self.rng = rng

    def peak_fraction(self, progress: float) -> float:
        return max(0.5, min(1.05, 0.74 + 0.24 * progress + self.rng.gauss(0, 0.04)))

    def lean_gain(self, progress: float) -> float:
        """Compensation (degrees of trunk motion) shrinks as the patient improves."""
        return max(0.0, 40.0 * (1.0 - progress) ** 1.3 + self.rng.gauss(0, 3))


def simulate_block(spec, rx: Prescription, started_at: datetime, item: dict, day: date,
                   patient: SimPatient, progress: float, rng: random.Random) -> dict:
    side = item.get("side", "auto")
    pose_side = "left" if side == "auto" else side
    block = BlockSession(spec, rx, started_at, side=side if spec.sided else "both",
                         plan_item_id=item["item_id"], scheduled_date=day.isoformat(),
                         block_id=f"{item['item_id']}-{day.isoformat()}")
    t = 0.0
    fps = 30
    # The patient occasionally stops a set early when tired.
    for set_no in range(1, rx.sets + 1):
        reps_wanted = rx.reps_per_set
        if rng.random() < 0.18 * (1.0 - 0.6 * progress):
            reps_wanted = max(3, rx.reps_per_set - rng.randint(1, 4))
        span = rx.target_angle_deg - spec.start_angle_deg
        for rep in range(reps_wanted + 1):          # +1 so the final rep is closed by the return to rest
            if rep == reps_wanted:
                curve = rep_angles(spec.start_angle_deg, spec.start_angle_deg, 1, up_s=0.2, hold_s=0.0,
                                   down_s=0.2, pause_s=0.4, lead_s=0.0, fps=fps)
                peak = spec.start_angle_deg
            else:
                frac = patient.peak_fraction(progress)
                peak = spec.start_angle_deg + span * frac
                up = rng.uniform(1.4, 2.4) if spec.min_rep_s >= 1.5 else 1.0
                down = rng.uniform(1.4, 2.4)
                hold = max(rx.hold_seconds + rng.uniform(-0.3, 0.6), 0.0)
                curve = rep_angles(spec.start_angle_deg, peak, 1, up_s=up, hold_s=hold, down_s=down,
                                   pause_s=0.7, lead_s=0.5 if rep == 0 else 0.0, fps=fps)
            lean = patient.lean_gain(progress)
            for _, angle in curve:
                done = 0.0 if span == 0 else (angle - spec.start_angle_deg) / span
                extra, trunk_lean = {}, 0.0
                if spec.key == "squat":
                    trunk_lean = 18.0 + lean * done * 1.1          # leans further forward as it deepens
                elif spec.view == "side" and "trunk_lean" in spec.features:
                    trunk_lean = lean * done * 0.5
                if "shoulder_angle" in spec.features:
                    extra["shoulder_angle"] = lean * done * 0.6    # upper arm drifting
                if "hip_angle" in spec.features and spec.key.startswith("standing_knee"):
                    extra["hip_angle"] = lean * done * 0.5
                pose = make_pose(spec.key, angle, side=pose_side, facing=1, trunk_lean=trunk_lean,
                                 noise_px=1.2, rng=rng, extra=extra)
                block.feed(t, pose)
                t += 1.0 / fps
        # idle frames: patient steps out / rests until the next set begins
        if block.phase == "active":
            block.end_set_early()
        if set_no < rx.sets:
            for _ in range(int(rx.rest_seconds * 10) + 5):
                block.feed(t, None)
                t += 0.1
    # Patient check-in: pain eases over the programme (with one flare-up on the squat so the website's
    # attention list has something to show), effort drops as the patient gets stronger.
    if block.reps_counted:
        pain = 4.5 * (1.0 - progress) + rng.gauss(0, 0.8)
        if spec.key == "squat" and day.isoformat() >= FLARE_FROM:
            pain += 3.5
        effort = 6.0 - 2.5 * progress + rng.gauss(0, 0.8)
        block.set_checkin(min(10, max(0, round(pain))), min(10, max(1, round(effort))))
    return block.finish()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="samples")
    ap.add_argument("--today", default="2026-11-15", help="last day that may contain a session")
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args(argv)

    rng = random.Random(args.seed)
    plan = build_sample_plan()
    errs = validate_plan(plan)
    assert not errs, errs
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(os.path.join(args.out, "sessions"), exist_ok=True)
    with open(os.path.join(args.out, "plan.json"), "w") as f:
        json.dump(plan, f, indent=2)

    today = date.fromisoformat(args.today)
    total_days = (PLAN_END - PLAN_START).days
    by_day = {}
    for item in plan["items"]:
        for d in item_dates(item, plan):
            if d <= today:
                by_day.setdefault(d, []).append(item)

    patient = SimPatient(rng)
    written = 0
    for day in sorted(by_day):
        if rng.random() < 0.15:           # missed the whole day
            continue
        progress = (day - PLAN_START).days / total_days
        start = datetime.combine(day, time(rng.choice([8, 9, 17, 18]), rng.randint(0, 59))).astimezone()
        rec = SessionRecorder(patient_id="pt-001", plan_id=plan["plan_id"], started_at=start,
                              camera_index=0, frame_size=(1280, 720))
        clock = start
        for item in by_day[day]:
            if rng.random() < 0.12:       # skipped one exercise
                continue
            spec = get_exercise(item["exercise_key"])
            rx, _ = resolve_prescription(item, day, spec)
            block = simulate_block(spec, rx, clock, item, day, patient, progress, rng)
            rec.add_block(block)
            clock += timedelta(seconds=block["duration_s"] + 20)
        if not rec.blocks:
            continue
        rec.ended_at = clock
        path = rec.save(os.path.join(args.out, "sessions"))
        written += 1
        print("wrote", path)
    print(f"{written} sessions, plan at {os.path.join(args.out, 'plan.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
