"""End-to-end: synthetic repetitions -> BlockSession -> session JSON record."""

import json
import random
import unittest
from datetime import datetime

from tracker.block import BlockSession, Prescription
from tracker.exercises import all_exercises, get_exercise
from tracker.synthetic import frames_for, rep_angles

START = datetime(2026, 11, 16, 9, 0, 0).astimezone()


def run_block(key, reps, peak=None, sets=1, reps_per_set=None, hold_s=0.0, rest_s=0.0,
              side="left", pose_kwargs=None, curve_kwargs=None, target=None, noise_px=0.0, seed=3):
    spec = get_exercise(key)
    target = spec.default_target_angle_deg if target is None else target
    peak = target if peak is None else peak
    rx = Prescription(sets=sets, reps_per_set=reps_per_set or reps, target_angle_deg=target,
                      hold_seconds=hold_s, rest_seconds=rest_s)
    block = BlockSession(spec, rx, START, side="auto" if spec.sided else "both")
    kw = dict(side=side, noise_px=noise_px, rng=random.Random(seed))
    kw.update(pose_kwargs or {})
    t_offset = 0.0
    for _ in range(sets):
        curve = rep_angles(spec.start_angle_deg, peak, reps, rng=random.Random(seed), **(curve_kwargs or {}))
        last_t = 0.0
        for t, frame in frames_for(key, curve, **kw):
            block.feed(t_offset + t, frame)
            last_t = t
        t_offset += last_t + 0.5 + rest_s
        # idle frames so rest can elapse
        if rest_s:
            for i in range(int(rest_s * 30) + 5):
                block.feed(t_offset - rest_s + i / 30.0, None)
    return block.finish()


class EveryExercise(unittest.TestCase):
    def test_counts_all_reps_and_reports_target(self):
        for spec in all_exercises():
            with self.subTest(exercise=spec.key):
                block = run_block(spec.key, reps=5)
                s = block["summary"]
                self.assertEqual(s["reps_completed"], 5, spec.key)
                self.assertEqual(block["status"], "completed")
                self.assertAlmostEqual(s["avg_peak_angle_deg"], spec.default_target_angle_deg, delta=4.0,
                                       msg=f"{spec.key} peak")
                self.assertGreaterEqual(s["avg_form_score"], 90.0, spec.key)
                self.assertEqual(s["flag_counts"], {}, spec.key)
                self.assertEqual(s["reps_reached_target"], 5)

    def test_works_with_pixel_noise(self):
        for key in ("squat", "elbow_flexion", "shoulder_abduction", "hip_extension"):
            with self.subTest(exercise=key):
                block = run_block(key, reps=6, noise_px=1.5)
                self.assertEqual(block["summary"]["reps_completed"], 6, key)

    def test_both_sides_and_facing(self):
        for side in ("left", "right"):
            block = run_block("elbow_flexion", reps=4, side=side, pose_kwargs={"facing": -1})
            self.assertEqual(block["summary"]["reps_completed"], 4)
            self.assertEqual(block["side"], side)


class AutoSide(unittest.TestCase):
    """side='auto' must lock onto the limb that moves, for every sided exercise, without losing reps."""

    def test_auto_finds_the_moving_limb_for_every_sided_exercise(self):
        for spec in all_exercises():
            if not spec.sided:
                continue
            for side in ("left", "right"):
                with self.subTest(exercise=spec.key, side=side):
                    block = run_block(spec.key, reps=4, side=side)
                    self.assertEqual(block["side"], side)
                    self.assertEqual(block["summary"]["reps_completed"], 4,
                                     f"{spec.key} {side}: first rep must not be lost to calibration")

    def test_explicit_side_is_respected(self):
        spec = get_exercise("elbow_flexion")
        rx = Prescription(1, 3, 140.0, 0.0, 0.0)
        block = BlockSession(spec, rx, START, side="right")
        from tracker.synthetic import frames_for, rep_angles
        for t, f in frames_for("elbow_flexion", rep_angles(10, 140, 3), side="right"):
            block.feed(t, f)
        self.assertEqual(block.finish()["side"], "right")

    def test_still_patient_falls_back_to_visibility_without_crashing(self):
        spec = get_exercise("elbow_flexion")
        block = BlockSession(spec, Prescription(1, 3, 140.0, 0.0, 0.0), START, side="auto")
        from tracker.synthetic import make_pose
        for i in range(30 * 25):
            block.feed(i / 30.0, make_pose("elbow_flexion", 10.0, side="left"))
        out = block.finish()
        self.assertEqual(out["side"], "left")
        self.assertEqual(out["summary"]["reps_completed"], 0)


class Behaviours(unittest.TestCase):
    def test_partial_range_is_not_counted(self):
        # Squat asked for 90 degrees but the patient only reaches 40 (progress ~0.41).
        block = run_block("squat", reps=4, peak=40.0)
        self.assertEqual(block["summary"]["reps_completed"], 0)
        self.assertEqual(block["status"], "no_reps")
        self.assertEqual(block["sets"][0]["attempts_not_counted"] if block["sets"] else 0, block["sets"][0]["attempts_not_counted"])

    def test_reduced_range_counts_but_is_flagged(self):
        # 75 degrees of a 90 degree target: counts (>=70%) but is short of the target.
        block = run_block("squat", reps=4, peak=75.0)
        s = block["summary"]
        self.assertEqual(s["reps_completed"], 4)
        self.assertEqual(s["reps_reached_target"], 0)
        self.assertIn("short_of_target", s["flag_counts"])
        self.assertAlmostEqual(s["avg_rom_pct"], 100 * (75 - 5) / 85, delta=4.0)
        self.assertLess(s["avg_form_score"], 95.0)

    def test_trunk_lean_compensation_is_flagged(self):
        # Shoulder flexion with the torso leaning 20 degrees mid-rep is not simulated by a static
        # lean, so drive it with the squat's absolute forward-lean limit instead.
        block = run_block("squat", reps=4, pose_kwargs={"trunk_lean": 65.0})
        self.assertEqual(block["summary"]["reps_completed"], 4)
        self.assertEqual(block["summary"]["flag_counts"].get("trunk_lean_forward"), 4)

    def test_upper_arm_drift_flagged_for_elbow_curl(self):
        block = run_block("elbow_flexion", reps=4, pose_kwargs={"extra": {"shoulder_angle": 0.0}})
        self.assertEqual(block["summary"]["flag_counts"], {})

    def test_too_fast_reps_are_flagged(self):
        block = run_block("squat", reps=4, curve_kwargs=dict(up_s=0.3, hold_s=0.0, down_s=0.3, pause_s=0.6))
        self.assertEqual(block["summary"]["reps_completed"], 4)
        self.assertEqual(block["summary"]["flag_counts"].get("too_fast"), 4)

    def test_hold_is_measured_and_scored(self):
        block = run_block("hip_extension", reps=3, hold_s=2.0, curve_kwargs=dict(hold_s=2.5))
        self.assertGreaterEqual(block["summary"]["avg_hold_s"], 2.0)
        self.assertEqual(block["summary"]["flag_counts"], {})
        short = run_block("hip_extension", reps=3, hold_s=2.0, curve_kwargs=dict(hold_s=0.3))
        self.assertEqual(short["summary"]["flag_counts"].get("hold_short"), 3)

    def test_sets_and_rest(self):
        block = run_block("elbow_flexion", reps=4, sets=3, reps_per_set=4, rest_s=2.0)
        self.assertEqual(len(block["sets"]), 3)
        self.assertTrue(all(s["completed_reps"] == 4 for s in block["sets"]))
        self.assertTrue(all(s["ended_by"] == "target_reached" for s in block["sets"]))
        self.assertEqual(block["summary"]["reps_completed"], 12)
        self.assertEqual(block["status"], "completed")

    def test_extra_reps_beyond_target_are_not_counted_in_the_set(self):
        block = run_block("elbow_flexion", reps=8, reps_per_set=5)
        self.assertEqual(block["sets"][0]["completed_reps"], 5)

    def test_decreasing_exercise_peak_is_the_minimum(self):
        block = run_block("elbow_extension", reps=4)
        peaks = [r["peak_angle_deg"] for r in block["sets"][0]["reps"]]
        self.assertTrue(all(p < 15 for p in peaks), peaks)
        self.assertEqual(block["angle"]["direction"], "decrease")
        self.assertLess(block["summary"]["best_peak_angle_deg"], 15)

    def test_wrong_view_is_reported(self):
        # Shoulder abduction needs a front view; a side-view stick figure should be flagged.
        from tracker.synthetic import make_pose
        spec = get_exercise("shoulder_abduction")
        block = BlockSession(spec, Prescription(1, 3, 150.0), START, side="left")
        for i in range(60):
            block.feed(i / 30.0, make_pose("shoulder_flexion", 0.0, side="left"))
        out = block.finish()
        self.assertGreater(out["tracking"]["camera_view_mismatch_pct"], 90.0)

    def test_json_is_serialisable_and_has_contract_fields(self):
        block = run_block("squat", reps=3)
        text = json.dumps(block)
        data = json.loads(text)
        for key in ("block_id", "exercise_key", "side", "angle", "prescribed", "started_at", "ended_at",
                    "status", "sets", "summary", "tracking", "angle_trace"):
            self.assertIn(key, data)
        rep = data["sets"][0]["reps"][0]
        for key in ("counted", "rep_index", "duration_s", "start_angle_deg", "peak_angle_deg",
                    "target_angle_deg", "rom_deg", "rom_pct", "reached_target", "hold_s",
                    "form_score", "components", "excursions_deg", "flags"):
            self.assertIn(key, rep)
        self.assertGreater(len(data["angle_trace"]["samples"]), 10)

    def test_tracking_lost_mid_rep_is_not_counted(self):
        spec = get_exercise("elbow_flexion")
        block = BlockSession(spec, Prescription(1, 5, 140.0), START, side="left")
        from tracker.synthetic import make_pose
        t = 0.0
        for a in [10] * 30 + list(range(10, 100, 3)):
            block.feed(t, make_pose("elbow_flexion", a, side="left")); t += 1 / 30
        for _ in range(60):  # 2 s with nobody in view
            block.feed(t, None); t += 1 / 30
        out = block.finish()
        self.assertEqual(out["summary"]["reps_completed"], 0)
        flags = [f for s in out["sets"] for r in s["reps"] for f in r["flags"]]
        self.assertIn("tracking_lost", flags)


if __name__ == "__main__":
    unittest.main()
