"""Patient check-in (pain / effort): validation, key mapping, block output, and the on-screen prompt."""

import json
import unittest

from tracker.checkin import normalize_checkin, score_from_key
from tests.test_reps import START, run_block


class Rules(unittest.TestCase):
    def test_keys_map_to_scores(self):
        self.assertEqual([score_from_key(ord(c)) for c in "0579"], [0, 5, 7, 9])
        self.assertEqual(score_from_key(ord("t")), 10)
        self.assertIsNone(score_from_key(ord("x")))
        self.assertIsNone(score_from_key(32))

    def test_normalize(self):
        self.assertEqual(normalize_checkin(3, 6), {"pain_0_10": 3, "effort_0_10": 6, "note": None})
        self.assertEqual(normalize_checkin(pain=0), {"pain_0_10": 0, "effort_0_10": None, "note": None})
        self.assertEqual(normalize_checkin(None, None, "  sore  "), {"pain_0_10": None, "effort_0_10": None, "note": "sore"})
        self.assertIsNone(normalize_checkin())

    def test_rejects_out_of_range_and_non_integers(self):
        for bad in (-1, 11, 2.5, "3", True):
            with self.assertRaises(ValueError, msg=repr(bad)):
                normalize_checkin(bad, 0)


class InBlock(unittest.TestCase):
    def test_block_has_no_report_unless_answered(self):
        self.assertNotIn("patient_report", run_block("squat", 3))

    def test_report_is_written_to_the_block(self):
        from tracker.block import BlockSession, Prescription
        from tracker.exercises import get_exercise
        spec = get_exercise("squat")
        block = BlockSession(spec, Prescription(1, 3, 90), START, side="both")
        self.assertEqual(block.reps_counted, 0)
        block.set_checkin(4, 7)
        out = block.finish()
        self.assertEqual(out["patient_report"], {"pain_0_10": 4, "effort_0_10": 7, "note": None})
        json.dumps(out)


class _Window:
    """Stands in for the OpenCV window: hands out scripted key presses to the prompt (the 50 ms polls)."""
    def __init__(self, keys):
        self._keys, self.shown = iter(keys), []

    def show(self, view):
        self.shown.append(view)

    def key(self, wait_ms=1):
        return next(self._keys, 255) if wait_ms == 50 else 255     # the 350 ms "show the answer" pause is not a key read


class Prompt(unittest.TestCase):
    def _run(self, keys):
        from types import SimpleNamespace
        from tracker import camera
        from tracker.block import BlockSession, Prescription
        from tracker.exercises import get_exercise
        from tracker.voice import Voice

        block = BlockSession(get_exercise("squat"), Prescription(1, 3, 90), START, side="both")
        win = _Window(keys)
        runner = camera._Runner(None, None, None, None, SimpleNamespace(device={"frame_size": None}), [block],
                                win, Voice(enabled=False), True, True, None)
        runner.ask_checkin(block, 1)
        return block, runner, win

    def test_prompt_reads_two_answers(self):
        b, r, win = self._run([255, ord("4"), ord("t")])             # an unrelated key is ignored
        self.assertEqual(b.patient_report["pain_0_10"], 4)
        self.assertEqual(b.patient_report["effort_0_10"], 10)
        self.assertFalse(r.quit)
        self.assertEqual(win.shown[0].question, "Pain during this exercise?")
        self.assertEqual({v.palette for v in win.shown}, {"pain", "effort"})
        self.assertIn(4, [v.selected for v in win.shown])             # the chosen number is shown for a moment

    def test_a_question_can_be_skipped(self):
        b, _, _ = self._run([ord("2"), ord(" ")])
        self.assertEqual(b.patient_report, {"pain_0_10": 2, "effort_0_10": None, "note": None})
        b, _, _ = self._run([32, 32])
        self.assertIsNone(b.patient_report)

    def test_q_quits_everything(self):
        _, r, _ = self._run([ord("q")])
        self.assertTrue(r.quit)

    def test_nobody_answering_ends_by_itself(self):
        b, r, win = self._run([])                                     # 255 forever: times out, no hang
        self.assertIsNone(b.patient_report)
        self.assertFalse(r.quit)
        self.assertLessEqual(len(win.shown), 2 * 600 + 2)


if __name__ == "__main__":
    unittest.main()
