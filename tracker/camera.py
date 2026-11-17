"""Live camera runner: webcam -> MediaPipe -> BlockSession -> session.json, shown on the TherapyPal screens.

This is the only module that imports cv2 / mediapipe, so everything else stays testable.
What the patient sees is drawn by tracker/ui; what the screen says comes from tracker/coach.py.

Flow for a session:  welcome -> for each exercise: get ready (starts by itself when the patient is in
position) -> sets and rests -> pain / effort questions -> summary.
The Arduino / serial output of the old motion_tracker.py is intentionally not part of this.
"""

import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from . import config
from .block import ACTIVE, DONE, REST, BlockSession
from .checkin import QUESTIONS, SKIP_KEYS, score_from_key
from .coach import Coach, ReadyGate, assess_position
from .exercises import get_exercise
from .landmarks import LIMB
from .pose import PoseFrame
from .session import SessionRecorder
from .voice import Voice

DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "pose_landmarker.task"
WINDOW = "TherapyPal"

CHECKIN_TIMEOUT_POLLS = 600        # 600 polls x 50 ms = 30 s per question, then it counts as skipped
POST_EXERCISE_HOLD_S = 1.4         # keep "Exercise complete" on screen this long
SUMMARY_TIMEOUT_POLLS = 600        # 600 x 100 ms = 60 s, then the summary closes by itself
NO_KEY = 255

CHECKIN_LABELS = {                 # question key -> (low end, high end, colour ramp)
    "pain_0_10": ("0 = none", "10 = worst", "pain"),
    "effort_0_10": ("0 = very easy", "10 = maximal", "effort"),
}


def _open_camera(cv2, index: int):
    # AVFoundation is the macOS backend the original script used; fall back to the default.
    for backend in (getattr(cv2, "CAP_AVFOUNDATION", None), None):
        cap = cv2.VideoCapture(index, backend) if backend is not None else cv2.VideoCapture(index)
        if cap.isOpened():
            return cap
        cap.release()
    raise RuntimeError(f"Camera {index} unavailable. On a Mac, allow the camera for Terminal "
                       "(System Settings > Privacy & Security > Camera) and try again.")


class _Eye:
    """Reads one camera frame and runs MediaPipe on it."""

    def __init__(self, cv2, mp, cap, detector, recorder):
        self.cv2, self.mp, self.cap, self.detector, self.recorder = cv2, mp, cap, detector, recorder
        self.start, self.last_ts = time.monotonic(), -1

    def read(self):
        """Returns (image, PoseFrame or None), or None when the camera stopped giving pictures."""
        ok, img = self.cap.read()
        if not ok:
            print("Camera frame unavailable")
            return None
        h, w = img.shape[:2]
        if self.recorder.device["frame_size"] is None:
            self.recorder.device["frame_size"] = [w, h]
        rgb = self.cv2.cvtColor(img, self.cv2.COLOR_BGR2RGB)
        ts = max(self.last_ts + 1, int((time.monotonic() - self.start) * 1000))
        self.last_ts = ts
        result = self.detector.detect_for_video(self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb), ts)
        frame = PoseFrame.from_mediapipe(result.pose_landmarks[0], w, h) if result.pose_landmarks else None
        return img, frame


class _Window:
    """The OpenCV window: shows a screen, reads keys, handles the full-screen and voice keys."""

    def __init__(self, cv2, renderer, voice: Voice, mirror: bool, fullscreen: bool):
        self.cv2, self.renderer, self.voice, self.mirror = cv2, renderer, voice, mirror
        self.fullscreen = False
        try:
            cv2.namedWindow(WINDOW, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(WINDOW, 1280, 800)
        except AttributeError:                      # test doubles have no window functions
            pass
        if fullscreen:
            self._set_fullscreen(True)

    def _set_fullscreen(self, on: bool) -> None:
        try:
            self.cv2.setWindowProperty(WINDOW, self.cv2.WND_PROP_FULLSCREEN,
                                       self.cv2.WINDOW_FULLSCREEN if on else self.cv2.WINDOW_NORMAL)
            self.fullscreen = on
        except (AttributeError, Exception):         # a failed full-screen switch must never stop a session
            pass

    def show(self, view) -> None:
        view.mirror = self.mirror
        view.voice_on = self.voice.enabled
        view.fullscreen = self.fullscreen
        self.cv2.imshow(WINDOW, self.renderer.render(view))

    def key(self, wait_ms: int = 1) -> int:
        """Wait up to wait_ms for a key. F (full screen) and V (voice) are handled here and reported as no key."""
        k = self.cv2.waitKey(wait_ms) & 0xFF
        if k == ord("f"):
            self._set_fullscreen(not self.fullscreen)
            return NO_KEY
        if k == ord("v"):
            self.voice.toggle()
            return NO_KEY
        return k


def _limb_drawing(block: BlockSession, frame: Optional[PoseFrame]):
    """The chains the exercise follows, as line segments and joints in camera pixels."""
    if frame is None:
        return [], []
    spec, tracker = block.spec, block.tracker
    side = tracker.side if getattr(tracker, "_side_locked", True) else "both"   # side not decided yet: show both limbs
    segments, joints = [], []
    for chain in spec.chains:
        for s in spec.sides_for(side):
            pts = [frame.get(LIMB[s][n], config.VISIBILITY_THRESHOLD) for n in chain]
            for a, b in zip(pts, pts[1:]):
                if a and b:
                    segments.append(((a.x, a.y), (b.x, b.y)))
            joints += [(p.x, p.y) for p in pts if p]
    return segments, joints


class _Runner:
    def __init__(self, cv2, mp, cap, detector, recorder, blocks, window, voice, checkin, guided, patient_name):
        self.cv2, self.recorder, self.blocks = cv2, recorder, blocks
        self.eye = _Eye(cv2, mp, cap, detector, recorder)
        self.win, self.voice = window, voice
        self.checkin, self.guided, self.patient_name = checkin, guided, patient_name
        self.show = window is not None
        self.quit = False

    # -- small helpers ---------------------------------------------------------
    def _look(self):
        got = self.eye.read()
        if got is None:
            self.quit = True
        return got

    def _view(self, kind, block, n, **kw):
        from .ui import View
        rx = block.prescription
        return View(kind=kind, exercise_name=block.spec.name, index=n, total=len(self.blocks),
                    subtitle=f"{block.spec.group}, {block.spec.view} view",
                    set_number=block.set_number, sets=rx.sets, reps_in_set=block.reps_in_set,
                    reps_per_set=rx.reps_per_set, start_angle=block.spec.start_angle_deg,
                    target_angle=rx.target_angle_deg, angle_label=block.spec.angle_label,
                    last_rep=block.last_rep, description=block.spec.description, setup=block.spec.setup, **kw)

    # -- screens -----------------------------------------------------------------
    def welcome(self) -> None:
        from .ui import View
        items = [(b.spec.name, f"{b.prescription.sets} sets of {b.prescription.reps_per_set} reps") for b in self.blocks]
        name = (self.patient_name or "").strip()
        view = View(kind="welcome", greeting=f"Hello, {name}" if name else "Welcome", items=items,
                    footer="Press SPACE to start")
        self.voice.say("Welcome to TherapyPal. Press the space bar when you are ready.")
        while not self.quit:
            if self._look() is None:
                break
            self.win.show(view)
            k = self.win.key(30)
            if k == ord("q"):
                self.quit = True
            elif k == ord(" "):
                break

    def intro(self, block: BlockSession, coach: Coach, n: int) -> str:
        """Wait until the patient is in position. Returns 'go', 'skip' or 'quit'."""
        gate = ReadyGate()
        while not self.quit:
            got = self._look()
            if got is None:
                return "quit"
            img, frame = got
            now = time.monotonic()
            reason = assess_position(block.spec, frame, block.tracker.view_mismatch(frame) if frame else None)
            gate.update(now, reason == "ok")
            msg = coach.intro(reason, gate, now)
            segments, joints = _limb_drawing(block, frame)
            self.voice.say(msg.speech)
            self.win.show(self._view("intro", block, n, image=img, segments=segments, joints=joints, message=msg,
                                     countdown=gate.countdown_number(now) if reason == "ok" else 0,
                                     position_ok=reason == "ok"))
            k = self.win.key(1)
            if k == ord("q"):
                self.quit = True
            elif k == ord("n"):
                return "skip"
            elif k == ord(" "):
                gate.force_go()
            if gate.state == "go":
                return "go"
        return "quit"

    def exercise(self, block: BlockSession, coach: Coach, n: int) -> str:
        """Run all sets of one exercise. Returns 'done', 'skip' or 'quit'."""
        phase, finished_at = block.phase, None
        while not self.quit:
            got = self._look()
            if got is None:
                return "quit"
            img, frame = got
            now = time.monotonic()
            res = block.feed(now, frame) if finished_at is None else None
            if res is not None and res.rep is not None and block.last_rep is not None:
                coach.after_rep(block.last_rep, block, now)
            if block.phase != phase and block.phase in (REST, DONE):
                coach.set_done(block, now)
            phase = block.phase
            if block.phase == DONE and finished_at is None:
                finished_at = now
            if block.phase == REST:
                msg, kind = coach.rest(block, now), "rest"
            else:
                msg, kind = coach.live(block, res, now), "exercise"
            segments, joints = _limb_drawing(block, frame)
            self.voice.say(msg.speech)
            k = NO_KEY
            if self.show:
                self.win.show(self._view(kind, block, n, image=img, segments=segments, joints=joints, message=msg,
                                         angle=getattr(res, "angle", None), progress=getattr(res, "progress", None),
                                         rest_remaining=block.rest_remaining(now), rest_total=block.prescription.rest_seconds))
                k = self.win.key(1)
            if k == ord("q"):
                self.quit = True
            elif k == ord("e"):
                block.end_set_early()
            elif k == ord("n"):
                return "skip"
            elif k == ord(" "):
                block.skip_rest()
            if block.phase == DONE and (not self.guided or now - finished_at >= POST_EXERCISE_HOLD_S):
                return "done"
        return "quit"

    def ask_checkin(self, block: BlockSession, n: int) -> None:
        """Pain and effort questions. A patient who walks away does not leave the session hanging."""
        answers = {}
        for name, question, _scale in QUESTIONS:
            low, high, palette = CHECKIN_LABELS.get(name, ("0", "10", "effort"))
            polls = 0
            while polls < CHECKIN_TIMEOUT_POLLS and not self.quit:
                view = self._view("checkin", block, n, question=question, low_label=low, high_label=high, palette=palette,
                                  seconds_left=(CHECKIN_TIMEOUT_POLLS - polls) * 0.05,
                                  seconds_total=CHECKIN_TIMEOUT_POLLS * 0.05)
                self.win.show(view)
                key = self.win.key(50)
                polls += 1
                if key == ord("q"):
                    self.quit = True
                    break
                score = score_from_key(key)
                if score is not None:
                    answers[name] = score
                    view.selected = score
                    self.win.show(view)
                    self.win.key(350)             # let the chosen number show for a moment
                    break
                if key in SKIP_KEYS:
                    break
            if self.quit:
                break
        if answers:
            block.set_checkin(answers.get("pain_0_10"), answers.get("effort_0_10"))

    def summary(self) -> None:
        from .ui import View
        items = []
        for b in self.recorder.blocks:
            s = b.get("summary") or {}
            name = get_exercise(b["exercise_key"]).name
            form = s.get("avg_form_score")
            detail = f"{s.get('reps_completed', 0)} of {s.get('reps_planned', 0)} reps"
            if form is not None:
                detail += f" · form {form:.0f}"
            items.append((name, detail))
        view = View(kind="summary", greeting="Well done!", items=items, footer="Press any key to finish")
        self.voice.say("Well done. That is everything for today.")
        for _ in range(SUMMARY_TIMEOUT_POLLS):
            self.win.show(view)
            k = self.win.key(100)
            if k != NO_KEY:
                break


def run_session(blocks: List[BlockSession], recorder: SessionRecorder, camera_index: int = 0,
                model_path: Path = DEFAULT_MODEL, show_window: bool = True, checkin: bool = True,
                guided: bool = True, voice: Optional[Voice] = None, patient_name: Optional[str] = None,
                mirror: bool = True, fullscreen: bool = False, renderer=None) -> SessionRecorder:
    """Run the given blocks one after another through the camera and fill the recorder.

    guided=False skips the welcome and get-ready screens and starts every exercise at once
    (for scripted tests and for people who want the old straight-to-the-exercise behaviour).
    """
    import cv2
    import mediapipe as mp

    if not Path(model_path).exists():
        raise FileNotFoundError(
            f"Pose model not found at {model_path}. Download the MediaPipe Pose Landmarker (Full) "
            "model and save it as pose_landmarker.task (see README).")

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.VIDEO, num_poses=1)
    voice = voice or Voice(enabled=False)
    window = None
    if show_window:
        if renderer is None:
            from .ui import Renderer
            renderer = Renderer(cv2)
        window = _Window(cv2, renderer, voice, mirror, fullscreen)
    else:
        guided = checkin = False

    cap = _open_camera(cv2, camera_index)
    try:
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
            run = _Runner(cv2, mp, cap, detector, recorder, blocks, window, voice, checkin, guided, patient_name)
            if guided:
                run.welcome()
            for n, block in enumerate(blocks, 1):
                if run.quit:
                    break
                coach = Coach(block.spec)
                outcome = "go"
                if guided:
                    outcome = run.intro(block, coach, n)
                if outcome == "go":
                    outcome = run.exercise(block, coach, n)
                if outcome == "skip":
                    ended_by = "exercise_skipped"
                else:
                    ended_by = "session_ended" if run.quit else "exercise_skipped"
                if checkin and show_window and not run.quit and outcome in ("done", "skip") and block.reps_counted > 0:
                    run.ask_checkin(block, n)
                recorder.add_block(block.finish(ended_by))
            if guided and not run.quit and recorder.blocks:
                run.summary()
    finally:
        cap.release()
        voice.stop()
        if show_window:
            cv2.destroyAllWindows()
        recorder.ended_at = datetime.now().astimezone()
    return recorder
