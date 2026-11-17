"""Live camera runner: webcam -> MediaPipe -> BlockSession -> session.json.

This is the only module that imports cv2 / mediapipe, so everything else stays testable.
The Arduino / serial output of the old motion_tracker.py is intentionally not part of this.
"""

import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from . import config
from .block import ACTIVE, DONE, REST, BlockSession
from .checkin import QUESTIONS, SKIP_KEYS, score_from_key
from .pose import PoseFrame
from .session import SessionRecorder

DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "pose_landmarker.task"

CHECKIN_TIMEOUT_POLLS = 600        # 600 polls x 50 ms = 30 s per question, then it counts as skipped

GREEN, YELLOW, RED, WHITE = (80, 220, 80), (0, 220, 255), (60, 60, 255), (255, 255, 255)


def _open_camera(cv2, index: int):
    # AVFoundation is the macOS backend the original script used; fall back to the default.
    for backend in (getattr(cv2, "CAP_AVFOUNDATION", None), None):
        cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
        if cap.isOpened():
            return cap
        cap.release()
    raise RuntimeError(f"Camera {index} unavailable")


def _draw(cv2, img, block: BlockSession, frame: Optional[PoseFrame], res, queue_pos: str):
    spec, rx = block.spec, block.prescription
    h, w = img.shape[:2]
    if frame is not None:
        side = block.tracker.side
        for chain in spec.chains:
            for s in spec.sides_for(side):
                from .landmarks import LIMB
                pts = [frame.get(LIMB[s][n], config.VISIBILITY_THRESHOLD) for n in chain]
                for a, b in zip(pts, pts[1:]):
                    if a and b:
                        cv2.line(img, (int(a.x), int(a.y)), (int(b.x), int(b.y)), GREEN, 3)

    lines = [
        (f"{spec.name}  [{queue_pos}]", WHITE),
        (f"Set {min(block.set_number, rx.sets)}/{rx.sets}   Reps {block.reps_in_set}/{rx.reps_per_set}", WHITE),
    ]
    if res is not None and res.angle is not None:
        lines.append((f"{spec.angle_label}: {res.angle:.0f} deg (target {rx.target_angle_deg:.0f})", YELLOW))
    if block.phase == REST:
        lines.append((f"REST {block.rest_remaining(time.monotonic()):.0f}s  (press n to skip)", YELLOW))
    if res is not None:
        for msg in res.warnings[:2]:
            lines.append((msg, RED))
    if block.last_rep is not None:
        r = block.last_rep
        lines.append((f"Last rep: form {r['form_score']:.0f}/100  ROM {r['rom_pct']:.0f}%", GREEN if r["counted"] else RED))
    y = 32
    for text, color in lines:
        cv2.putText(img, text, (16, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4)
        cv2.putText(img, text, (16, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        y += 30
    cv2.putText(img, "q quit   e end set   n next exercise", (16, h - 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, WHITE, 1)


def _ask_checkin(cv2, img, block: BlockSession) -> bool:
    """Show the pain / effort questions over the last frame and read the answers from the keyboard.
    Returns False if the patient pressed q (quit the whole session)."""
    answers = {}
    for name, question, scale in QUESTIONS:
        for _ in range(CHECKIN_TIMEOUT_POLLS):      # a patient who walks away must not leave the session hanging
            view = img.copy() if hasattr(img, "copy") else img
            h = view.shape[0]
            for i, (text, size, color) in enumerate((
                    (f"{block.spec.name}: done", 0.8, GREEN), (question, 1.0, WHITE), (scale, 0.7, YELLOW),
                    ("press 0-9 (t = 10)    space = skip", 0.6, WHITE))):
                y = int(h * 0.35) + i * 48
                cv2.putText(view, text, (40, y), cv2.FONT_HERSHEY_SIMPLEX, size, (0, 0, 0), 5)
                cv2.putText(view, text, (40, y), cv2.FONT_HERSHEY_SIMPLEX, size, color, 2)
            cv2.imshow("TherapyPal", view)
            key = cv2.waitKey(50) & 0xFF
            if key == ord("q"):
                return False
            score = score_from_key(key)
            if score is not None:
                answers[name] = score
                break
            if key in SKIP_KEYS:
                break
    if answers:
        block.set_checkin(answers.get("pain_0_10"), answers.get("effort_0_10"))
    return True


def run_session(blocks: List[BlockSession], recorder: SessionRecorder, camera_index: int = 0,
                model_path: Path = DEFAULT_MODEL, show_window: bool = True, checkin: bool = True) -> SessionRecorder:
    """Run the given blocks one after another through the camera and fill the recorder."""
    import cv2
    import mediapipe as mp

    if not Path(model_path).exists():
        raise FileNotFoundError(
            f"Pose model not found at {model_path}. Download the MediaPipe Pose Landmarker (Full) "
            "model and save it as pose_landmarker.task (see README).")

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1)
    cap = _open_camera(cv2, camera_index)
    start, last_ts = time.monotonic(), -1
    quit_all = False
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            for n, block in enumerate(blocks, 1):
                done_block = False
                img = None
                while not done_block and not quit_all:
                    ok, img = cap.read()
                    if not ok:
                        print("Camera frame unavailable")
                        quit_all = True
                        break
                    h, w = img.shape[:2]
                    if recorder.device["frame_size"] is None:
                        recorder.device["frame_size"] = [w, h]
                    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    ts = max(last_ts + 1, int((time.monotonic() - start) * 1000))
                    last_ts = ts
                    result = detector.detect_for_video(
                        mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)
                    frame = (PoseFrame.from_mediapipe(result.pose_landmarks[0], w, h)
                             if result.pose_landmarks else None)
                    res = block.feed(time.monotonic(), frame)
                    if show_window:
                        _draw(cv2, img, block, frame, res, f"{n}/{len(blocks)}")
                        cv2.imshow("TherapyPal", img)
                        key = cv2.waitKey(1) & 0xFF
                        if key == ord("q"):
                            quit_all = True
                        elif key == ord("e"):
                            block.end_set_early()
                        elif key == ord("n"):
                            done_block = True
                        elif key == ord(" "):
                            block.skip_rest()
                    if block.phase == DONE:
                        done_block = True
                if checkin and show_window and not quit_all and img is not None and block.reps_counted > 0:
                    quit_all = not _ask_checkin(cv2, img, block)
                recorder.add_block(block.finish("session_ended" if quit_all else "exercise_skipped"))
                if quit_all:
                    break
    finally:
        cap.release()
        if show_window:
            cv2.destroyAllWindows()
        recorder.ended_at = datetime.now().astimezone()
    return recorder
