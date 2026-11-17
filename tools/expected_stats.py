#!/usr/bin/env python3
"""Independent recomputation of the website's headline numbers from the raw JSON files.

Used only to cross-check web/src/lib/analytics.js: it shares no code with it (and reads the plan
through tracker.plan, the Python implementation of the schedule rules).

    python tools/expected_stats.py samples samples/expected_stats.json --today 2026-11-15
"""

import argparse
import glob
import json
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tracker.plan import item_dates, resolve_prescription  # noqa: E402
from tracker.exercises import get_exercise  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("out")
    ap.add_argument("--today", required=True)
    args = ap.parse_args(argv)
    today = date.fromisoformat(args.today)

    plan = json.load(open(os.path.join(args.folder, "plan.json")))
    occ = {}
    for item in plan["items"]:
        spec = get_exercise(item["exercise_key"])
        for d in item_dates(item, plan):
            rx, _ = resolve_prescription(item, d, spec)
            occ[(item["item_id"], d.isoformat())] = {
                "key": item["exercise_key"], "date": d, "planned": rx.sets * rx.reps_per_set, "done": 0}

    forms, roms = [], []
    per_ex_forms = defaultdict(list)
    per_ex_pain = defaultdict(list)      # (started_at, pain, effort) per block with a check-in
    reps_total = 0
    for path in sorted(glob.glob(os.path.join(args.folder, "sessions", "*.json"))):
        s = json.load(open(path))
        for b in s["blocks"]:
            m = b["summary"]
            occ[(b["plan_item_id"], b["scheduled_date"])]["done"] += m["reps_completed"]
            if m["avg_form_score"] is not None and m["reps_completed"] > 0:
                forms.append((m["avg_form_score"], m["reps_completed"]))
                roms.append((m["avg_rom_pct"], m["reps_completed"]))
                per_ex_forms[b["exercise_key"]].append((m["avg_form_score"], m["reps_completed"]))
            reps_total += m["reps_completed"]
            rep = b.get("patient_report")
            if rep and rep.get("pain_0_10") is not None:
                per_ex_pain[b["exercise_key"]].append((b["started_at"], rep["pain_0_10"], rep.get("effort_0_10")))

    def wavg(pairs):
        return sum(v * w for v, w in pairs) / sum(w for _, w in pairs)

    due = [o for o in occ.values() if o["date"] < today or o["done"] > 0]
    stats = {
        "occurrences": len(occ),
        "due": len(due),
        "done": sum(1 for o in due if o["done"] >= o["planned"]),
        "partial": sum(1 for o in due if 0 < o["done"] < o["planned"]),
        "missed": sum(1 for o in due if o["done"] == 0),
        "reps_planned": sum(o["planned"] for o in due),
        "reps_credited": sum(min(o["done"], o["planned"]) for o in due),
        "reps_total": reps_total,
        "form_weighted": wavg(forms),
        "rom_weighted": wavg(roms),
    }

    # streaks over days that had planned work
    by_day = defaultdict(lambda: [0, 0])
    for o in due:
        by_day[o["date"]][0] += o["planned"]
        by_day[o["date"]][1] += min(o["done"], o["planned"])
    ok = [v[1] / v[0] >= 0.8 for _, v in sorted(by_day.items())]
    longest = run = 0
    for flag in ok:
        run = run + 1 if flag else 0
        longest = max(longest, run)
    stats["longest_streak"], stats["current_streak"] = longest, run

    per_ex = {}
    for key in {o["key"] for o in occ.values()}:
        mine = [o for o in due if o["key"] == key]
        per_ex[key] = {
            "reps_credited": sum(min(o["done"], o["planned"]) for o in mine),
            "missed": sum(1 for o in mine if o["done"] == 0),
            "form_weighted": wavg(per_ex_forms[key]),
        }
    stats["per_exercise"] = per_ex

    # Patient check-ins: pain 0-10 (lower is better). Flare = the last two sessions of an exercise both >= 6, or the latest >= 8.
    pains = [p for rows in per_ex_pain.values() for _, p, _ in rows]
    stats["pain_blocks"] = len(pains)
    stats["pain_mean"] = sum(pains) / len(pains)
    stats["pain_max"] = max(pains)
    flare, last3_missed = [], []
    for key, rows in per_ex_pain.items():
        rows.sort()
        per_ex[key]["pain_mean"] = sum(p for _, p, _ in rows) / len(rows)
        per_ex[key]["pain_latest"] = rows[-1][1]
        if rows[-1][1] >= 8 or (len(rows) >= 2 and rows[-1][1] >= 6 and rows[-2][1] >= 6):
            flare.append(key)
    for key in {o["key"] for o in occ.values()}:
        mine = sorted((o for o in due if o["key"] == key), key=lambda o: o["date"])
        if len(mine) >= 3 and all(o["done"] == 0 for o in mine[-3:]):
            last3_missed.append(key)
    stats["pain_flare"] = sorted(flare)
    stats["last3_missed"] = sorted(last3_missed)
    json.dump(stats, open(args.out, "w"), indent=2, sort_keys=True)
    print(json.dumps({k: v for k, v in stats.items() if k != "per_exercise"}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
