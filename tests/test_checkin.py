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


class Prompt(unittest.TestCase):
    def test_prompt_reads_two_answers_and_can_skip(self):
        from types import SimpleNamespace
        from tracker import camera
        from tracker.block import BlockSession, Prescription
        from tracker.exercises import get_exercise

        class Img:
            shape = (720, 1280, 3)
            def copy(self): return self

        def make(keys):
            it = iter(keys)
            cv2 = SimpleNamespace(putText=lambda *a, **k: None, imshow=lambda *a, **k: None,
                                  waitKey=lambda ms: next(it), FONT_HERSHEY_SIMPLEX=0)
            return cv2

        spec = get_exercise("squat")
        mk = lambda: BlockSession(spec, Prescription(1, 3, 90), START, side="both")
        b = mk()
        self.assertTrue(camera._ask_checkin(make([255, ord("4"), ord("t")]), Img(), b))   # unrelated key is ignored
        self.assertEqual(b.patient_report["pain_0_10"], 4)
        self.assertEqual(b.patient_report["effort_0_10"], 10)
        b = mk()
        self.assertTrue(camera._ask_checkin(make([ord("2"), ord(" ")]), Img(), b))        # skip the second question
        self.assertEqual(b.patient_report, {"pain_0_10": 2, "effort_0_10": None, "note": None})
        b = mk()
        self.assertTrue(camera._ask_checkin(make([32, 32]), Img(), b))                    # skip both
        self.assertIsNone(b.patient_report)
        b = mk()
        self.assertFalse(camera._ask_checkin(make([ord("q")]), Img(), b))                 # q quits everything


if __name__ == "__main__":
    unittest.main()
