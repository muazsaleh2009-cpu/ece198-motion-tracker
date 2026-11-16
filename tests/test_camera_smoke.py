"""Drive tracker/camera.py with fake cv2 + mediapipe modules, so the conversion of MediaPipe's
normalised landmarks and the whole loop are exercised without a webcam or model file."""

import json
import os
import sys
import tempfile
import types
import unittest
from datetime import datetime

from tracker.block import BlockSession, Prescription
from tracker.exercises import get_exercise
from tracker.session import SessionRecorder
from tracker.synthetic import make_pose, rep_angles

W, H = 1280, 1000


class _LM:
    def __init__(self, x, y, v):
        self.x, self.y, self.visibility = x, y, v


def _build_fakes(key, angles):
    """Return (cv2_module, mp_module, clock) replaying `angles` as camera frames."""
    frames = iter(angles)
    state = {"t": 0.0, "pose": None}

    class Img:
        shape = (H, W, 3)

    class Cap:
        def isOpened(self): return True
        def release(self): pass
        def read(self):
            try:
                t, a = next(frames)
            except StopIteration:
                return False, None
            state["t"], state["pose"] = t, make_pose(key, a, side="left")
            return True, Img()

    cv2 = types.ModuleType("cv2")
    cv2.VideoCapture = lambda *a, **k: Cap()
    cv2.CAP_AVFOUNDATION = 1200
    cv2.COLOR_BGR2RGB = 4
    cv2.cvtColor = lambda img, code: img
    for name in ("line", "putText", "imshow", "destroyAllWindows"):
        setattr(cv2, name, lambda *a, **k: None)
    cv2.waitKey = lambda ms: 255
    cv2.FONT_HERSHEY_SIMPLEX = 0

    class Detector:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def detect_for_video(self, image, ts):
            pose = state["pose"]
            lms = []
            for i in range(33):
                p = pose.points.get(i)
                lms.append(_LM(p.x / W, p.y / H, p.visibility) if p else _LM(0.0, 0.0, 0.0))
            return types.SimpleNamespace(pose_landmarks=[lms])

    mp = types.ModuleType("mediapipe")
    mp.Image = lambda **k: None
    mp.ImageFormat = types.SimpleNamespace(SRGB=1)
    vision = types.SimpleNamespace(
        PoseLandmarkerOptions=lambda **k: None, RunningMode=types.SimpleNamespace(VIDEO=1),
        PoseLandmarker=types.SimpleNamespace(create_from_options=lambda o: Detector()))
    mp.tasks = types.SimpleNamespace(vision=vision, BaseOptions=lambda **k: None)
    return cv2, mp, state


class CameraLoop(unittest.TestCase):
    def test_full_session_through_the_camera_loop(self):
        key = "elbow_flexion"
        spec = get_exercise(key)
        curve = list(rep_angles(spec.start_angle_deg, spec.default_target_angle_deg, 5, fps=30))
        cv2, mp, state = _build_fakes(key, curve)
        sys.modules["cv2"], sys.modules["mediapipe"] = cv2, mp
        try:
            from tracker import camera
            camera.time = types.SimpleNamespace(monotonic=lambda: state["t"])  # replay clock
            with tempfile.TemporaryDirectory() as d:
                model = os.path.join(d, "pose_landmarker.task")
                open(model, "wb").close()
                started = datetime(2026, 11, 16, 9, 0).astimezone()
                block = BlockSession(spec, Prescription(1, 5, spec.default_target_angle_deg), started, side="left",
                                     plan_item_id="elbow-1", scheduled_date="2026-11-16", block_id="elbow-1-2026-11-16")
                rec = SessionRecorder(patient_id="pt-001", plan_id="p1", started_at=started)
                camera.run_session([block], rec, model_path=model, show_window=True)
                path = rec.save(d)
                data = json.load(open(path))
            self.assertEqual(data["device"]["frame_size"], [W, H])
            b = data["blocks"][0]
            self.assertEqual(b["summary"]["reps_completed"], 5)
            self.assertEqual(b["plan_item_id"], "elbow-1")
            self.assertGreaterEqual(b["tracking"]["valid_pct"], 95.0)
            self.assertAlmostEqual(b["summary"]["avg_peak_angle_deg"], spec.default_target_angle_deg, delta=4)
        finally:
            sys.modules.pop("cv2", None)
            sys.modules.pop("mediapipe", None)
            sys.modules.pop("tracker.camera", None)

    def test_missing_model_file_gives_a_clear_error(self):
        cv2, mp, _ = _build_fakes("squat", [])
        sys.modules["cv2"], sys.modules["mediapipe"] = cv2, mp
        try:
            from tracker import camera
            rec = SessionRecorder()
            with self.assertRaises(FileNotFoundError) as cm:
                camera.run_session([], rec, model_path="/nonexistent/pose_landmarker.task")
            self.assertIn("pose_landmarker.task", str(cm.exception))
        finally:
            sys.modules.pop("cv2", None); sys.modules.pop("mediapipe", None); sys.modules.pop("tracker.camera", None)


if __name__ == "__main__":
    unittest.main()
