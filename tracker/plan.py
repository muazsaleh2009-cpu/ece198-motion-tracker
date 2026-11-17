"""Reads the plan.json exported by the website and works out what is due on a given day.

The same rules are implemented in the website (src/lib/plan.js). Keep them in sync.
Format: see docs/DATA_CONTRACT.md.
"""

import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .block import Prescription
from .exercises import ExerciseSpec, get_exercise

DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]  # index == date.weekday()


def parse_date(text: str) -> date:
    return datetime.strptime(text, "%Y-%m-%d").date()


def load_plan(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        plan = json.load(f)
    errors = validate_plan(plan)
    if errors:
        raise ValueError("Invalid plan:\n  - " + "\n  - ".join(errors))
    return plan


def validate_plan(plan: dict) -> List[str]:
    errors: List[str] = []
    if not isinstance(plan, dict):
        return ["Plan must be a JSON object"]
    items = plan.get("items")
    if not isinstance(items, list) or not items:
        errors.append("Plan needs a non-empty 'items' list")
        return errors
    seen = set()
    for i, item in enumerate(items, 1):
        label = f"item {i}"
        iid = item.get("item_id")
        if not iid:
            errors.append(f"{label}: missing item_id")
        elif iid in seen:
            errors.append(f"{label}: duplicate item_id '{iid}'")
        seen.add(iid)
        try:
            spec = get_exercise(item.get("exercise_key", ""))
        except KeyError as e:
            errors.append(f"{label}: {e.args[0]}")
            continue
        for key in ("sets", "reps_per_set"):
            if not isinstance(item.get(key), int) or item[key] < 1:
                errors.append(f"{label}: '{key}' must be a whole number >= 1")
        target = item.get("target_angle_deg", spec.default_target_angle_deg)
        lo, hi = spec.target_bounds_deg
        if not isinstance(target, (int, float)) or not lo <= target <= hi:
            errors.append(f"{label}: target_angle_deg for {spec.key} must be between {lo} and {hi}")
        sched = item.get("schedule") or {}
        if not sched.get("dates") and not (sched.get("start_date") and sched.get("days_of_week")):
            errors.append(f"{label}: schedule needs 'dates' or 'start_date' + 'days_of_week'")
    return errors


def item_dates(item: dict, plan: Optional[dict] = None) -> List[date]:
    """Every calendar day this plan item is scheduled.

    End date: the item's own schedule.end_date, else the plan's end_date, else 12 weeks after start.
    """
    sched = item["schedule"]
    if sched.get("dates"):
        return sorted({parse_date(d) for d in sched["dates"]})
    start = parse_date(sched["start_date"])
    end_text = sched.get("end_date") or (plan or {}).get("end_date")
    end = parse_date(end_text) if end_text else start + timedelta(days=83)
    wanted = {DAY_NAMES.index(d.lower()[:3]) for d in sched["days_of_week"]}
    out, day = [], start
    while day <= end:
        if day.weekday() in wanted:
            out.append(day)
        day += timedelta(days=1)
    return out


def resolve_prescription(item: dict, on: date, spec: ExerciseSpec) -> Tuple[Prescription, Optional[str]]:
    """Base prescription, overridden by the latest progression step whose from_date <= `on`."""
    values: Dict[str, float] = {
        "sets": item["sets"],
        "reps_per_set": item["reps_per_set"],
        "target_angle_deg": item.get("target_angle_deg", spec.default_target_angle_deg),
        "hold_seconds": item.get("hold_seconds", spec.default_hold_s),
        "rest_seconds": item.get("rest_seconds", 30),
    }
    for step in sorted(item.get("progression") or [], key=lambda s: s["from_date"]):
        if parse_date(step["from_date"]) <= on:
            for k in values:
                if k in step:
                    values[k] = step[k]
    return Prescription(**values), item.get("side")


def items_for_date(plan: dict, on: date) -> List[dict]:
    return [item for item in plan["items"] if on in set(item_dates(item, plan))]
