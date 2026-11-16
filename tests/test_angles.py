"""Hand-checked angle tests. The coordinates are written out explicitly (not generated) so a sign
error in the measuring code cannot be hidden by the same error in the synthetic generator."""

import math
import unittest

from tracker.exercises import all_exercises, get_exercise
from tracker.geometry import angle_toward, interior_angle, signed_angle
from tracker.landmarks import LIMB
from tracker.pose import Point, PoseFrame
from tracker.synthetic import make_pose


class Pt:
    def __init__(self, x, y):
        self.x, self.y = x, y


def frame_from(side, **named):
    """Build a frame from {'shoulder': (x, y), ...} for one side."""
    return PoseFrame.from_xy({LIMB[side][k]: v for k, v in named.items()})


class Geometry(unittest.TestCase):
    def test_interior_angle_straight_and_right(self):
        self.assertAlmostEqual(interior_angle(Pt(0, 0), Pt(0, 100), Pt(0, 200)), 180.0)
        self.assertAlmostEqual(interior_angle(Pt(0, 0), Pt(0, 100), Pt(100, 100)), 90.0)

    def test_angle_toward_forward_and_backward(self):
        trunk = (0.0, 100.0)  # image y points down, so this runs down the body
        facing_right, facing_left = (1.0, 0.0), (-1.0, 0.0)
        self.assertAlmostEqual(angle_toward(trunk, (100, 0), facing_right), 90.0)    # arm forward
        self.assertAlmostEqual(angle_toward(trunk, (-100, 0), facing_right), -90.0)  # arm backward
        self.assertAlmostEqual(angle_toward(trunk, (-100, 0), facing_left), 90.0)
        self.assertAlmostEqual(angle_toward(trunk, (0, 100), facing_right), 0.0)

    def test_tiny_segment_returns_none(self):
        self.assertIsNone(signed_angle((0, 0.1), (1, 0)))


class HandCheckedExercises(unittest.TestCase):
    def test_knee_flexion_90(self):
        # Hip above knee, ankle level with the knee: interior 90 => flexion 90.
        f = frame_from("left", hip=(100, 100), knee=(100, 300), ankle=(300, 300))
        self.assertAlmostEqual(get_exercise("standing_knee_flexion").measure(f, "left", 1), 90.0, places=3)

    def test_knee_straight_is_zero(self):
        f = frame_from("left", hip=(100, 100), knee=(100, 300), ankle=(100, 500))
        self.assertAlmostEqual(get_exercise("squat").measure(f, "both", 1), 0.0, places=3)

    def test_elbow_flexion_90(self):
        f = frame_from("right", shoulder=(100, 100), elbow=(100, 220), wrist=(220, 220))
        self.assertAlmostEqual(get_exercise("elbow_flexion").measure(f, "right", 1), 90.0, places=3)

    def test_shoulder_flexion_forward_and_extension_backward(self):
        base = dict(hip=(100, 400), shoulder=(100, 200))
        fwd = frame_from("left", elbow=(220, 200), **base)    # arm level, pointing right (facing right)
        back = frame_from("left", elbow=(-20, 200), **base)   # arm level, pointing left (behind)
        self.assertAlmostEqual(get_exercise("shoulder_flexion").measure(fwd, "left", 1), 90.0, places=3)
        self.assertAlmostEqual(get_exercise("shoulder_extension").measure(back, "left", 1), 90.0, places=3)
        self.assertAlmostEqual(get_exercise("shoulder_flexion").measure(back, "left", 1), -90.0, places=3)

    def test_shoulder_angle_is_measured_relative_to_the_trunk(self):
        # Facing right, torso leaning forward 30 degrees (shoulder ahead of the hip). The arm
        # hangs vertically, which is 30 degrees FORWARD of the trunk axis: +30 flexion, -30 extension.
        sh = (200.0, 200.0)
        hip = (100.0, 200 + 173.2)
        f = frame_from("left", shoulder=sh, hip=hip, elbow=(sh[0], sh[1] + 120))
        self.assertAlmostEqual(get_exercise("shoulder_flexion").measure(f, "left", 1), 30.0, delta=0.1)
        self.assertAlmostEqual(get_exercise("shoulder_extension").measure(f, "left", 1), -30.0, delta=0.1)

    def test_hip_extension_leg_behind(self):
        f = frame_from("left", shoulder=(100, 100), hip=(100, 300), knee=(100 - 110, 300 + 190.5))
        self.assertAlmostEqual(get_exercise("hip_extension").measure(f, "left", 1), 30.0, delta=0.2)
        self.assertAlmostEqual(get_exercise("hip_flexion").measure(f, "left", 1), -30.0, delta=0.2)

    def test_hip_flexion_knee_forward(self):
        f = frame_from("left", shoulder=(100, 100), hip=(100, 300), knee=(300, 300))
        self.assertAlmostEqual(get_exercise("hip_flexion").measure(f, "left", 1), 90.0, places=3)

    def test_abduction_both_sides(self):
        # Facing the camera: patient's left shoulder is on the image right (larger x).
        pts = {}
        for side, sx in (("left", 500.0), ("right", 300.0)):
            pts[LIMB[side]["shoulder"]] = (sx, 200.0)
            pts[LIMB[side]["hip"]] = (sx - (40 if side == "left" else -40), 400.0)
        pts[LIMB["left"]["hip"]] = (500.0, 400.0)
        pts[LIMB["right"]["hip"]] = (300.0, 400.0)
        pts[LIMB["left"]["elbow"]] = (500.0 + 120, 200.0)    # level, outward to image right
        pts[LIMB["right"]["elbow"]] = (300.0 - 120 * math.sin(math.radians(45)),
                                       200.0 + 120 * math.cos(math.radians(45)))  # 45 deg out
        pts[LIMB["left"]["knee"]] = (500.0 + 100, 400.0 + 100)  # leg 45 deg out
        f = PoseFrame.from_xy(pts)
        self.assertAlmostEqual(get_exercise("shoulder_abduction").measure(f, "left", 0), 90.0, places=2)
        self.assertAlmostEqual(get_exercise("shoulder_abduction").measure(f, "right", 0), 45.0, places=2)
        self.assertAlmostEqual(get_exercise("hip_abduction").measure(f, "left", 0), 45.0, places=2)

    def test_low_visibility_returns_none(self):
        f = frame_from("left", hip=(100, 100), knee=(100, 300), ankle=(100, 500))
        f.points[LIMB["left"]["knee"]] = Point(100, 300, 0.2)
        self.assertIsNone(get_exercise("squat").measure(f, "both", 1))


class SyntheticRoundTrip(unittest.TestCase):
    """Every exercise: the generator's pose must measure back to the requested angle."""

    def test_all_exercises_round_trip(self):
        for spec in all_exercises():
            lo, hi = sorted((spec.start_angle_deg, spec.default_target_angle_deg))
            for angle in (lo, (lo + hi) / 2, hi):
                for side in ("left", "right"):
                    for facing in (1, -1):
                        if spec.view == "front" and facing == -1:
                            continue
                        side_arg = "both" if not spec.sided else side
                        pose = make_pose(spec.key, angle, side=side, facing=facing)
                        got = spec.measure(pose, side_arg, facing)
                        self.assertIsNotNone(got, f"{spec.key} {side} facing {facing}")
                        self.assertAlmostEqual(got, angle, delta=0.5,
                                               msg=f"{spec.key} angle {angle} side {side} facing {facing}")


class FormFeatures(unittest.TestCase):
    """A form check whose feature cannot be measured is silently skipped, so make sure each
    one produces a number for a normal pose (this once failed for the vertical reference)."""

    def test_every_feature_is_measurable(self):
        for spec in all_exercises():
            side = "both" if not spec.sided else "left"
            pose = make_pose(spec.key, spec.start_angle_deg, side="left")
            facing = 1 if spec.view == "side" else 0
            for name, fn in spec.features.items():
                self.assertIsNotNone(fn(pose, side, facing), f"{spec.key}.{name}")
            for check in spec.checks:
                self.assertIn(check.feature, spec.features, f"{spec.key}.{check.key}")

    def test_trunk_lean_values(self):
        from tracker.exercises import _trunk_lean_sagittal, _trunk_lean_frontal
        lean = make_pose("squat", 5, side="left", trunk_lean=30.0)
        self.assertAlmostEqual(_trunk_lean_sagittal(lean, "both", 1), 30.0, delta=0.1)
        self.assertAlmostEqual(_trunk_lean_sagittal(make_pose("squat", 5, trunk_lean=0.0), "both", 1), 0.0, delta=0.1)
        front = make_pose("shoulder_abduction", 0, side="left", trunk_lean=10.0)
        self.assertAlmostEqual(abs(_trunk_lean_frontal(front, "left", 0)), 10.0, delta=0.5)
        self.assertAlmostEqual(_trunk_lean_frontal(make_pose("hip_abduction", 0, side="left"), "left", 0), 0.0, delta=0.1)


if __name__ == "__main__":
    unittest.main()
