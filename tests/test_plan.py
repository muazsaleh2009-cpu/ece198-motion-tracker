"""Schedule rules shared with web/src/lib/plan.js. The numbers below are also asserted in
web/tests/analytics.test.mjs, so the two implementations cannot drift apart unnoticed."""

import unittest
from datetime import date

from tracker.plan import item_dates, resolve_prescription, validate_plan
from tracker.exercises import get_exercise

RULE = {"item_id": "x", "exercise_key": "squat", "sets": 3, "reps_per_set": 10,
        "schedule": {"start_date": "2026-10-19", "days_of_week": ["mon"]}}


class EndDateRule(unittest.TestCase):
    def test_open_ended_item_runs_to_the_plan_end_date(self):
        days = item_dates(RULE, {"end_date": "2026-12-13"})
        self.assertEqual((len(days), days[-1]), (8, date(2026, 12, 7)))

    def test_no_end_date_anywhere_means_84_days(self):
        days = item_dates(RULE, {})
        self.assertEqual((len(days), days[-1]), (12, date(2027, 1, 4)))
        self.assertEqual(len(item_dates(RULE)), 12)

    def test_item_end_date_wins_over_plan_end_date(self):
        item = {**RULE, "schedule": {**RULE["schedule"], "end_date": "2026-11-02"}}
        self.assertEqual(len(item_dates(item, {"end_date": "2026-12-13"})), 3)

    def test_explicit_dates(self):
        item = {**RULE, "schedule": {"dates": ["2026-11-03", "2026-10-30"]}}
        self.assertEqual(item_dates(item), [date(2026, 10, 30), date(2026, 11, 3)])


class Progression(unittest.TestCase):
    def test_latest_step_up_to_the_day_applies(self):
        item = {**RULE, "target_angle_deg": 90, "progression": [
            {"from_date": "2026-11-16", "target_angle_deg": 100, "reps_per_set": 12}]}
        spec = get_exercise("squat")
        before, _ = resolve_prescription(item, date(2026, 11, 13), spec)
        after, _ = resolve_prescription(item, date(2026, 11, 16), spec)
        self.assertEqual((before.reps_per_set, before.target_angle_deg), (10, 90))
        self.assertEqual((after.reps_per_set, after.target_angle_deg), (12, 100))


class Validation(unittest.TestCase):
    def test_bad_target_and_unknown_exercise_are_reported(self):
        plan = {"items": [{**RULE, "exercise_key": "nope"}, {**RULE, "item_id": "y", "target_angle_deg": 170}]}
        text = " ".join(validate_plan(plan))
        self.assertIn("Unknown exercise", text)
        self.assertIn("between 30.0 and 135.0", text)


if __name__ == "__main__":
    unittest.main()
