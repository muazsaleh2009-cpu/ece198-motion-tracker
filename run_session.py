#!/usr/bin/env python3
"""TherapyPal session runner.

  python run_session.py --list
  python run_session.py --plan plan.json                  # everything scheduled for today
  python run_session.py --plan plan.json --date 2026-11-18
  python run_session.py --plan plan.json --only squat,elbow_extension
  python run_session.py --exercise squat --sets 2 --reps 8 --target 90   # ad-hoc, no plan

Each run writes ONE file, sessions/session_<date>_<time>_<patient>.json, which the website imports.
"""

import argparse
import sys
from datetime import date, datetime

from tracker.block import BlockSession, Prescription
from tracker.camera import DEFAULT_MODEL, run_session
from tracker.exercises import all_exercises, get_exercise
from tracker.plan import items_for_date, load_plan, parse_date, resolve_prescription
from tracker.session import SessionRecorder


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="list supported exercises and exit")
    ap.add_argument("--plan", help="plan.json exported from the website")
    ap.add_argument("--date", help="plan date YYYY-MM-DD (default: today)")
    ap.add_argument("--only", help="comma-separated exercise keys to run from the plan")
    ap.add_argument("--exercise", help="ad-hoc exercise key (no plan)")
    ap.add_argument("--sets", type=int)
    ap.add_argument("--reps", type=int)
    ap.add_argument("--target", type=float, help="target angle in degrees")
    ap.add_argument("--hold", type=float, default=None, help="hold seconds at the target")
    ap.add_argument("--rest", type=float, default=30.0)
    ap.add_argument("--side", choices=["left", "right", "auto"], default="auto")
    ap.add_argument("--patient", help="patient id (default: from plan)")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--model", default=str(DEFAULT_MODEL))
    ap.add_argument("--out", default="sessions", help="folder for session JSON files")
    ap.add_argument("--no-window", action="store_true")
    args = ap.parse_args(argv)

    if args.list:
        for s in all_exercises():
            print(f"{s.key:24} {s.group:11} {s.angle_label:34} start {s.start_angle_deg:>5.0f}  "
                  f"target {s.default_target_angle_deg:>4.0f}  view: {s.view}")
        return 0

    started = datetime.now().astimezone()
    plan_id = patient_id = None
    blocks = []

    if args.plan:
        plan = load_plan(args.plan)
        plan_id, patient_id = plan.get("plan_id"), (plan.get("patient") or {}).get("id")
        day = parse_date(args.date) if args.date else date.today()
        only = set(args.only.split(",")) if args.only else None
        for item in items_for_date(plan, day):
            if only and item["exercise_key"] not in only:
                continue
            spec = get_exercise(item["exercise_key"])
            rx, side = resolve_prescription(item, day, spec)
            blocks.append(BlockSession(spec, rx, started, side=side or "auto", plan_item_id=item["item_id"],
                                       scheduled_date=day.isoformat(), block_id=f"{item['item_id']}-{day.isoformat()}"))
        if not blocks:
            print(f"Nothing scheduled on {day.isoformat()}.")
            return 0
    elif args.exercise:
        spec = get_exercise(args.exercise)
        rx = Prescription(sets=args.sets or spec.default_sets, reps_per_set=args.reps or spec.default_reps,
                          target_angle_deg=args.target if args.target is not None else spec.default_target_angle_deg,
                          hold_seconds=spec.default_hold_s if args.hold is None else args.hold, rest_seconds=args.rest)
        blocks.append(BlockSession(spec, rx, started, side=args.side))
    else:
        ap.print_help()
        return 2

    recorder = SessionRecorder(patient_id=args.patient or patient_id, plan_id=plan_id,
                               started_at=started, camera_index=args.camera)
    print("Today:", ", ".join(f"{b.spec.name} ({b.prescription.sets}x{b.prescription.reps_per_set})" for b in blocks))
    try:
        run_session(blocks, recorder, camera_index=args.camera, model_path=args.model, show_window=not args.no_window)
    except KeyboardInterrupt:
        pass
    except (FileNotFoundError, RuntimeError) as e:   # missing model file, camera unavailable
        print(f"Error: {e}", file=sys.stderr)
        return 1
    finally:
        if recorder.blocks:
            print("Saved", recorder.save(args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
