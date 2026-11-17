"""The coach's rules: where to stand, when to start by itself, and what to say during and after a repetition."""

import unittest
from datetime import datetime

from tracker import coach as C
from tracker.block import REST, BlockSession, Prescription
from tracker.exercises import all_exercises, get_exercise
from tracker.pose import Point, PoseFrame
from tracker.synthetic import frames_for, make_pose, rep_angles
from tracker.tracker import FrameResult

START = datetime(2026, 11, 16, 9, 0, 0).astimezone()


def hide(frame, indices):
    pts = {i: (Point(p.x, p.y, 0.0) if i in indices else p) for i, p in frame.points.items()}
    return PoseFrame(pts)


class Position(unittest.TestCase):
    def setUp(self):
        self.squat = get_exercise("squat")
        self.pose = make_pose("squat", 5.0, side="left")

    def test_in_position(self):
        self.assertEqual(C.assess_position(self.squat, self.pose, False), "ok")

    def test_nobody_in_view(self):
        self.assertEqual(C.assess_position(self.squat, None, None), "no_pose")

    def test_wrong_view_is_reported_before_visibility(self):
        self.assertEqual(C.assess_position(self.squat, self.pose, True), "wrong_view")

    def test_a_missing_joint_means_step_back(self):
        self.assertEqual(C.assess_position(self.squat, hide(self.pose, {27, 28}), False), "partial")

    def test_a_one_sided_exercise_needs_only_one_good_side(self):
        spec = get_exercise("elbow_flexion")
        pose = make_pose("elbow_flexion", 20.0, side="left")
        self.assertEqual(C.assess_position(spec, hide(pose, {12, 14, 16}), False), "ok")   # right arm hidden, left fine
        self.assertEqual(C.assess_position(spec, hide(pose, {11, 13, 15, 12, 14, 16}), False), "partial")


class Gate(unittest.TestCase):
    def test_holds_still_then_counts_down_then_goes(self):
        g = C.ReadyGate(hold_s=1.5, countdown_s=3)
        self.assertEqual(g.update(0.0, True), "holding")
        self.assertEqual(g.update(1.4, True), "holding")
        self.assertEqual(g.update(1.6, True), "countdown")
        self.assertEqual(g.countdown_number(1.6), 3)
        g.update(2.7, True)
        self.assertEqual(g.countdown_number(2.7), 2)
        g.update(3.7, True)
        self.assertEqual(g.countdown_number(3.7), 1)
        self.assertEqual(g.update(4.6, True), "go")

    def test_not_in_position_never_starts(self):
        g = C.ReadyGate()
        for t in range(0, 20):
            self.assertEqual(g.update(float(t), False), "waiting")

    def test_stepping_out_resets_but_a_blink_is_forgiven(self):
        g = C.ReadyGate(hold_s=1.5, countdown_s=3, grace_s=0.6)
        g.update(0.0, True)
        g.update(1.0, False)           # a blink...
        self.assertEqual(g.update(1.3, True), "holding")
        self.assertEqual(g.update(1.6, True), "countdown")    # ...did not restart the clock (began at 0.0)
        g.update(2.0, False)
        self.assertNotEqual(g.update(2.7, False), "countdown")  # gone for more than the grace time: back to waiting
        self.assertEqual(g.state, "waiting")

    def test_space_starts_at_once(self):
        g = C.ReadyGate()
        g.force_go()
        self.assertEqual(g.update(0.0, False), "go")


class Intro(unittest.TestCase):
    def test_every_reason_has_a_short_headline(self):
        for spec in all_exercises():
            coach = C.Coach(spec)
            for reason in C.NOT_READY_REASONS:
                m = coach.intro(reason, C.ReadyGate(), 0.0)
                self.assertEqual(m.tone, C.WARN)
                self.assertLessEqual(len(m.headline), 22, m.headline)   # it is read from across the room
                self.assertTrue(m.speech)

    def test_view_instructions_match_the_exercise(self):
        side = C.Coach(get_exercise("squat")).intro("wrong_view", C.ReadyGate(), 0)
        front = C.Coach(get_exercise("hip_abduction")).intro("wrong_view", C.ReadyGate(), 0)
        self.assertIn("sideways", side.headline.lower())
        self.assertIn("face", front.headline.lower())

    def test_countdown_says_the_number(self):
        g = C.ReadyGate()
        g.update(0.0, True)
        g.update(1.6, True)
        m = C.Coach(get_exercise("squat")).intro("ok", g, 1.6)
        self.assertEqual(m.speech, "3")

    def test_every_exercise_has_cue_words(self):
        for spec in all_exercises():
            out, back = C.cues_for(spec)
            self.assertLessEqual(len(out), 22, out)
            self.assertLessEqual(len(back), 22, back)
        self.assertEqual(set(C.CUES), {s.key for s in all_exercises()})


class Live(unittest.TestCase):
    def _play(self, key="elbow_flexion", reps=3, peak=None):
        spec = get_exercise(key)
        rx = Prescription(1, reps, spec.default_target_angle_deg)
        block = BlockSession(spec, rx, START, side="left")
        coach = C.Coach(spec)
        seen = []
        curve = rep_angles(spec.start_angle_deg, spec.default_target_angle_deg if peak is None else peak, reps, fps=30)
        for t, frame in frames_for(key, curve, side="left"):
            res = block.feed(t, frame)
            if res is not None and res.rep is not None:
                coach.after_rep(block.last_rep, block, t)
            seen.append(coach.live(block, res, t) if block.phase != REST else coach.rest(block, t))
        return spec, block, seen

    def test_messages_follow_the_movement(self):
        spec, block, seen = self._play()
        heads = [m.headline for m in seen]
        out, back = C.cues_for(spec)
        self.assertIn(out, heads)
        self.assertIn("That's it!", heads)
        self.assertIn(back, heads)
        self.assertIn("Rep 1 of 3", heads)
        self.assertEqual(block.reps_counted, 3)

    def test_the_counted_rep_is_said_aloud(self):
        _, _, seen = self._play()
        speech = [m.speech for m in seen if m.headline == "Rep 1 of 3"]
        self.assertEqual(speech[0], "1.")

    def test_an_uncounted_rep_is_explained_kindly(self):
        spec = get_exercise("elbow_flexion")
        shallow = spec.start_angle_deg + 0.5 * (spec.default_target_angle_deg - spec.start_angle_deg)
        _, block, seen = self._play(peak=shallow)
        heads = [m.headline for m in seen]
        self.assertIn("That one didn't count", heads)
        self.assertEqual(block.reps_counted, 0)

    def test_form_tip_comes_from_the_exercise(self):
        spec = get_exercise("squat")
        coach = C.Coach(spec)
        rx = Prescription(1, 10, 90)
        block = BlockSession(spec, rx, START, side="both")
        rep = {"counted": True, "form_score": 70.0, "flags": ["trunk_lean_forward"], "rom_pct": 90.0}
        coach.after_rep(rep, block, 0.0)
        m = coach.live(block, FrameResult("ok", angle=5.0, progress=0.0), 0.5)
        self.assertEqual(m.tone, C.WARN)
        self.assertIn("chest up", m.detail)
        later = coach.live(block, FrameResult("ok", angle=5.0, progress=0.0, phase="ready"), 10.0)   # the flash ends
        self.assertNotEqual(later.headline, m.headline)

    def test_tracking_problems_are_plain(self):
        spec = get_exercise("squat")
        block = BlockSession(spec, Prescription(1, 5, 90), START, side="both")
        coach = C.Coach(spec)
        self.assertEqual(coach.live(block, FrameResult("no_pose"), 0).headline, "I can't see you")
        self.assertEqual(coach.live(block, FrameResult("wrong_view"), 0).headline, "Turn sideways")
        self.assertEqual(coach.live(block, FrameResult("low_visibility"), 0).tone, C.WARN)

    def test_set_complete_and_rest(self):
        spec = get_exercise("elbow_flexion")
        block = BlockSession(spec, Prescription(2, 3, spec.default_target_angle_deg, rest_seconds=20), START, side="left")
        coach = C.Coach(spec)
        for t, frame in frames_for("elbow_flexion", rep_angles(spec.start_angle_deg, spec.default_target_angle_deg, 3, fps=30), side="left"):
            block.feed(t, frame)
            if block.phase == REST:
                break
        m = coach.set_done(block, t)
        self.assertEqual(m.headline, "Set 1 complete")
        self.assertIn("20", m.speech)
        self.assertEqual(coach.rest(block, t + 2).headline, "Set 1 complete")       # still flashing
        self.assertEqual(coach.rest(block, t + 30).headline, "Rest")


if __name__ == "__main__":
    unittest.main()
