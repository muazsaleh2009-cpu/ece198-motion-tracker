"""The coach: turns what the tracker sees into short, plain instructions for the patient.

Pure Python (no cv2, no Pillow), so every rule here is unit-tested. The screen (tracker/ui) shows the
`headline` very large and the `detail` large; the optional voice (tracker/voice.py) reads `speech` aloud.

Wording rules: a headline is at most about 20 characters (it is read from across the room), uses plain
verbs, and never blames the patient.
"""

import math
from dataclasses import dataclass
from typing import Optional

from . import config
from .block import ACTIVE, DONE, REST, BlockSession
from .exercises import ExerciseSpec
from .pose import PoseFrame

# tone decides the colour on screen
GO, GOOD, WARN, REST_TONE, NEUTRAL = "go", "good", "warn", "rest", "neutral"

# (headline while moving out to the target, headline while coming back)
CUES = {
    "squat": ("Bend your knees", "Stand tall"),
    "standing_knee_flexion": ("Curl your heel up", "Lower your foot"),
    "seated_knee_extension": ("Straighten your knee", "Lower your leg"),
    "hip_flexion": ("Lift your knee", "Lower your foot"),
    "hip_extension": ("Swing your leg back", "Bring it forward"),
    "hip_abduction": ("Lift your leg out", "Lower your leg"),
    "elbow_flexion": ("Curl your arm up", "Lower your arm"),
    "elbow_extension": ("Straighten your arm", "Bend it again"),
    "shoulder_flexion": ("Raise your arm", "Lower your arm"),
    "shoulder_extension": ("Swing your arm back", "Bring it forward"),
    "shoulder_abduction": ("Lift your arm out", "Lower your arm"),
}
FLAG_TIPS = {
    "short_of_target": "Go a little further next time.",
    "too_fast": "Slow down. Take your time.",
    "too_slow": "A little quicker, keep it smooth.",
    "hold_short": "Hold the top position a little longer.",
    "tracking_lost": "Stay fully in view of the camera.",
}

NOT_READY_REASONS = ("no_pose", "partial", "wrong_view")
FLASH_SECONDS = 2.6          # how long the result of a repetition stays on screen
MOTION_EPS = 0.006           # smoothed change of progress per frame that counts as "moving"


@dataclass(frozen=True)
class Message:
    headline: str
    detail: str = ""
    tone: str = NEUTRAL
    speech: Optional[str] = None     # what the voice says; None = say nothing


def cues_for(spec: ExerciseSpec):
    if spec.key in CUES:
        return CUES[spec.key]
    verb = {"flexion": "Bend", "extension": "Straighten", "abduction": "Lift out"}.get(spec.movement, "Move")
    return (f"{verb} slowly", "Return slowly")


def assess_position(spec: ExerciseSpec, frame: Optional[PoseFrame], view_mismatch: Optional[bool]) -> str:
    """Is the patient standing where the camera can follow this exercise?

    Returns 'ok', 'no_pose' (nobody seen), 'wrong_view' (side-on versus facing the camera) or
    'partial' (the joints this exercise needs are not all visible, usually: too close or cut off).
    """
    if frame is None:
        return "no_pose"
    if view_mismatch:
        return "wrong_view"
    sides = ("left", "right") if spec.sided else ("both",)
    for side in sides:
        wanted = spec.required_landmarks(side)
        if all(frame.get(i, config.VISIBILITY_THRESHOLD) for i in wanted):
            return "ok"
    return "partial"


class ReadyGate:
    """Starts an exercise by itself once the patient has stood in position for a moment.

    A patient 2-3 m from the laptop cannot press a key, so the screen waits for them instead:
    waiting -> holding (in position, hold still) -> countdown (3, 2, 1) -> go.
    Stepping out of position drops back to waiting. Time is passed in, so it is testable.
    """

    def __init__(self, hold_s: float = 1.5, countdown_s: int = 3, grace_s: float = 0.6):
        self.hold_s, self.countdown_s, self.grace_s = hold_s, countdown_s, grace_s
        self.reset()

    def reset(self) -> None:
        self.state = "waiting"
        self._since: Optional[float] = None       # when the current stretch in position began
        self._lost_at: Optional[float] = None     # when we last saw the patient out of position

    def force_go(self) -> None:
        self.state = "go"

    def update(self, now: float, in_position: bool) -> str:
        if self.state == "go":
            return self.state
        if in_position:
            self._lost_at = None
            if self._since is None:
                self._since = now
        else:
            if self._since is not None:
                if self._lost_at is None:
                    self._lost_at = now
                if now - self._lost_at > self.grace_s:       # a blink of lost tracking is forgiven
                    self._since = None
                    self._lost_at = None
        if self._since is None:
            self.state = "waiting"
            return self.state
        waited = now - self._since
        if waited >= self.hold_s + self.countdown_s:
            self.state = "go"
        elif waited >= self.hold_s:
            self.state = "countdown"
        else:
            self.state = "holding"
        return self.state

    def countdown_number(self, now: float) -> int:
        """3, 2, 1 while counting down; 0 otherwise."""
        if self.state != "countdown" or self._since is None:
            return 0
        left = self.hold_s + self.countdown_s - (now - self._since)
        return max(1, min(self.countdown_s, int(math.ceil(left))))


class Coach:
    def __init__(self, spec: ExerciseSpec):
        self.spec = spec
        self.out_cue, self.back_cue = cues_for(spec)
        self._flash: Optional[Message] = None
        self._flash_until = 0.0
        self._last_progress: Optional[float] = None
        self._velocity = 0.0
        self._heading = "out"        # which way the patient is moving: "out" to the target, "back" to the start

    # -- before the exercise ---------------------------------------------------
    def intro(self, reason: str, gate: ReadyGate, now: float) -> Message:
        if reason == "no_pose":
            return Message("Step into view", "I can't see you yet. Stand 2 to 3 metres from the screen.", WARN,
                           "I can't see you yet. Please step back so I can see you.")
        if reason == "partial":
            return Message("Step back a little", "I need to see all of your body.", WARN,
                           "Please step back a little so I can see all of you.")
        if reason == "wrong_view":
            if self.spec.view == "side":
                return Message("Turn sideways", "Stand side-on, with the side you are exercising toward the screen.", WARN,
                               "Please turn sideways to the camera.")
            return Message("Face the screen", "Stand facing the screen with your arms and legs clear.", WARN,
                           "Please face the camera.")
        if gate.state == "countdown":
            n = gate.countdown_number(now)
            return Message("Get ready", f"Starting in {n}.", GO, str(n))
        if gate.state == "go":
            return Message("Go!", self.out_cue + ".", GO, "Go.")
        return Message("Hold still", "I can see you. Starting in a moment.", GOOD, "I can see you. Hold still.")

    # -- during the exercise ---------------------------------------------------
    def live(self, block: BlockSession, res, now: float) -> Message:
        if self._flash is not None and now < self._flash_until:
            return self._flash
        rx = block.prescription
        if res is None or getattr(res, "status", "") == "rest":
            return Message("Rest", "", REST_TONE)
        st = res.status
        if st == "no_pose":
            return Message("I can't see you", "Step back so your whole body is in view.", WARN,
                           "I can't see you. Please step back.")
        if st == "wrong_view":
            if self.spec.view == "side":
                return Message("Turn sideways", "Stand side-on to the camera.", WARN, "Please turn sideways.")
            return Message("Face the screen", "Face the camera for this exercise.", WARN, "Please face the camera.")
        if st == "low_visibility":
            return Message("Keep it in view", f"I can't see your {self.spec.joint} clearly. Step back a little.", WARN,
                           "Please keep your whole body in view.")
        if st == "calibrating":
            return Message(self.out_cue, "Do one repetition. I will work out which side you are using.", GO,
                           self.out_cue + ".")

        prog = res.progress if res.progress is not None else 0.0
        if self._last_progress is not None:
            self._velocity = 0.6 * self._velocity + 0.4 * (prog - self._last_progress)
        self._last_progress = prog
        if self._velocity > MOTION_EPS:
            self._heading = "out"
        elif self._velocity < -MOTION_EPS:
            self._heading = "back"

        if res.phase != "moving":
            self._heading = "out"
            if block.reps_in_set == 0:
                return Message(self.out_cue, "Move until the needle reaches the gold mark.", GO, self.out_cue + ".")
            return Message("Again", self.out_cue + ".", GO, None)
        if prog >= config.TARGET_FRACTION:
            if rx.hold_seconds > 0:
                return Message("Hold it there", f"Hold for {rx.hold_seconds:g} seconds.", GOOD, "Hold it there.")
            return Message("That's it!", self.back_cue + " slowly.", GOOD, "That's it.")
        if self._heading == "back":
            return Message(self.back_cue, "Slowly, under control.", NEUTRAL, self.back_cue + ".")
        return Message(self.out_cue, "Keep going to the gold mark.", GO, None)

    def after_rep(self, rep: dict, block: BlockSession, now: float) -> None:
        """Called once when a repetition ends: shows what happened for a couple of seconds."""
        total = block.prescription.reps_per_set
        done = block.reps_in_set
        tip = self._tip(rep)
        if rep["counted"]:
            good = not tip or rep["form_score"] >= 85
            head = f"Rep {done} of {total}"
            if rep["form_score"] >= 90:
                detail = "Great form."
            elif tip:
                detail = tip
            else:
                detail = "Well done."
            speech = f"{done}." if good and done < total else (f"{done}. {tip}" if tip else f"{done}.")
            tone = GOOD if good else WARN
        else:
            head = "That one didn't count"
            detail = tip or "Reach the gold mark on the dial."
            speech = "That one didn't count. " + (tip or "Try to go a little further.")
            tone = WARN
        self._flash = Message(head, detail, tone, speech)
        self._flash_until = now + FLASH_SECONDS
        self._velocity = 0.0
        self._heading = "out"

    def _tip(self, rep: dict) -> str:
        for check in self.spec.checks:
            if check.key in rep["flags"]:
                return check.message + "."
        for flag in ("too_fast", "too_slow", "hold_short", "tracking_lost", "short_of_target"):
            if flag in rep["flags"]:
                return FLAG_TIPS[flag]
        return ""

    # -- between sets ------------------------------------------------------------
    def set_done(self, block: BlockSession, now: float) -> Message:
        rx = block.prescription
        finished = block.set_number - 1 if block.phase == REST else block.set_number
        if block.phase == DONE:
            msg = Message("Exercise complete", "Great work!", GOOD, "Exercise complete. Great work.")
        else:
            msg = Message(f"Set {finished} complete", "Well done.", GOOD,
                          f"Set {finished} complete. Rest for {rx.rest_seconds:g} seconds.")
        self._flash, self._flash_until = msg, now + FLASH_SECONDS + 1.0
        return msg

    def rest(self, block: BlockSession, now: float) -> Message:
        if self._flash is not None and now < self._flash_until:
            return self._flash
        rx = block.prescription
        return Message("Rest", f"Shake it out. Set {block.set_number} starts by itself.", REST_TONE, None)
