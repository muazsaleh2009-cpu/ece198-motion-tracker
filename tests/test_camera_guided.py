"""The whole guided flow (welcome, get ready, exercise, questions, summary) with the REAL renderer,
driven by a scripted camera and keyboard. Skipped when numpy / Pillow / OpenCV are not installed."""

import json
import os
import sys
import tempfile
import types
import unittest
from datetime import datetime

try:
    import cv2 as real_cv2
    import numpy as np
    import PIL  # noqa: F401
    HAVE_IMAGING = True
except ImportError:
    HAVE_IMAGING = False

from tests.test_camera_smoke import H, W, _build_fakes
from tracker.block import BlockSession, Prescription
from tracker.exercises import get_exercise
from tracker.session import SessionRecorder
from tracker.synthetic import rep_angles

FPS = 30


class _Proxy:
    """Real OpenCV for drawing; scripted camera, window and keyboard."""
    def __init__(self, fake, keys):
        self._fake, self._keys = fake, keys

    def __getattr__(self, name):
        if name in ("VideoCapture", "CAP_AVFOUNDATION"):
            return getattr(self._fake, name)
        if name in ("imshow", "namedWindow", "resizeWindow", "setWindowProperty", "destroyAllWindows"):
            return lambda *a, **k: None
        if name == "waitKey":
            return self._keys
        return getattr(real_cv2, name)


@unittest.skipUnless(HAVE_IMAGING, "needs numpy, Pillow and opencv")
class GuidedFlow(unittest.TestCase):
    def test_welcome_to_summary(self):
        key = "elbow_flexion"
        spec = get_exercise(key)
        idle = [(i / FPS, spec.start_angle_deg) for i in range(int(7 * FPS))]                 # standing in position
        t0 = idle[-1][0] + 1 / FPS
        reps = [(t0 + t, a) for t, a in rep_angles(spec.start_angle_deg, spec.default_target_angle_deg, 3, fps=FPS)]
        t1 = reps[-1][0] + 1 / FPS
        tail = [(t1 + i / FPS, spec.start_angle_deg) for i in range(int(2.5 * FPS))]           # time for "Exercise complete"
        fake, mp, state = _build_fakes(key, idle + reps + tail)

        frame = np.zeros((H, W, 3), np.uint8)
        fake.VideoCapture = lambda *a, **k: types.SimpleNamespace(
            isOpened=lambda: True, release=lambda: None, read=_reader(fake, key, idle + reps + tail, state, frame))

        answers = iter([ord("3"), ord("6")])

        def keys(ms):
            if ms == 30:
                return ord(" ")                    # welcome: start
            if ms == 50:
                return next(answers, 255)          # pain, then effort
            if ms == 100:
                return ord(" ")                    # summary: finish
            return 255

        shown = []
        from tracker.ui import Renderer

        class Logging(Renderer):
            def render(self, view):
                if not shown or shown[-1] != view.kind:
                    shown.append(view.kind)
                return super().render(view)

        proxy = _Proxy(fake, keys)
        sys.modules["cv2"], sys.modules["mediapipe"] = proxy, mp
        try:
            from tracker import camera
            camera.time = types.SimpleNamespace(monotonic=lambda: state["t"])
            with tempfile.TemporaryDirectory() as d:
                model = os.path.join(d, "pose_landmarker.task")
                open(model, "wb").close()
                started = datetime(2026, 11, 16, 9, 0).astimezone()
                block = BlockSession(spec, Prescription(1, 3, spec.default_target_angle_deg), started, side="left")
                rec = SessionRecorder(patient_id="pt-001", started_at=started)
                camera.run_session([block], rec, model_path=model, show_window=True, guided=True,
                                   patient_name="Sam", renderer=Logging(real_cv2))
                data = json.load(open(rec.save(d)))
        finally:
            for m in ("cv2", "mediapipe", "tracker.camera"):
                sys.modules.pop(m, None)

        self.assertEqual(shown[0], "welcome")
        self.assertIn("intro", shown)
        self.assertIn("exercise", shown)
        self.assertEqual(shown[-1], "summary")
        self.assertLess(shown.index("intro"), shown.index("exercise"))
        self.assertLess(shown.index("exercise"), shown.index("checkin"))
        self.assertLess(shown.index("checkin"), shown.index("summary"))
        b = data["blocks"][0]
        self.assertEqual(b["summary"]["reps_completed"], 3)
        self.assertEqual(b["patient_report"], {"pain_0_10": 3, "effort_0_10": 6, "note": None})


def _reader(fake, key, frames, state, image):
    from tracker.synthetic import make_pose
    it = iter(frames)

    def read():
        try:
            t, a = next(it)
        except StopIteration:
            return False, None
        state["t"], state["pose"] = t, make_pose(key, a, side="left")
        return True, image.copy()
    return read


if __name__ == "__main__":
    unittest.main()
