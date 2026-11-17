"""ExerciseTracker: everything needed to follow ONE exercise, frame by frame.

It owns the pieces that are specific to a camera stream (which side is being exercised,
which way the patient faces, tracking quality) and delegates counting to RepCounter.
It never touches the camera or MediaPipe, so it can be tested with synthetic poses.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple

from . import config
from .exercises import ExerciseSpec
from .geometry import length, vec
from .landmarks import L_EAR, LIMB, NOSE, R_EAR, other
from .pose import PoseFrame
from .reps import MOVING, RepCounter, RepResult


@dataclass
class FrameResult:
    status: str                       # ok | no_pose | low_visibility | calibrating | wrong_view | rest
    angle: Optional[float] = None     # smoothed angle in degrees
    raw_angle: Optional[float] = None
    progress: Optional[float] = None  # 0 = start position, 1 = target
    phase: str = "ready"              # ready | moving
    rep: Optional[RepResult] = None   # set on the frame a repetition ends
    warnings: List[str] = field(default_factory=list)


def _spread(values: List[float]) -> float:
    """Robust range of a signal: 90th minus 10th percentile (ignores single noisy frames)."""
    if len(values) < 5:
        return 0.0
    v = sorted(values)
    return v[int(0.9 * (len(v) - 1))] - v[int(0.1 * (len(v) - 1))]


class FacingEstimator:
    """Which way is the patient facing in a side view? +1 = image right, -1 = image left.

    Uses the feet (toes ahead of heels) and the head (nose ahead of ears), smoothed over time.
    """

    def __init__(self):
        self._score: Optional[float] = None
        self.facing = 0

    def update(self, frame: PoseFrame) -> int:
        cue = self._cue(frame)
        if cue is not None:
            self._score = cue if self._score is None else 0.85 * self._score + 0.15 * cue
            if abs(self._score) > 0.02:
                self.facing = 1 if self._score > 0 else -1
        return self.facing

    @staticmethod
    def _cue(frame: PoseFrame) -> Optional[float]:
        thr = config.FACING_VISIBILITY
        # Scale by trunk length so the cue does not depend on how far the patient stands.
        scale = 200.0
        sh = [frame.get(LIMB[s]["shoulder"], thr) for s in ("left", "right")]
        hp = [frame.get(LIMB[s]["hip"], thr) for s in ("left", "right")]
        sh, hp = [p for p in sh if p], [p for p in hp if p]
        if sh and hp:
            sx, sy = sum(p.x for p in sh) / len(sh), sum(p.y for p in sh) / len(sh)
            hx, hy = sum(p.x for p in hp) / len(hp), sum(p.y for p in hp) / len(hp)
            scale = max(length((hx - sx, hy - sy)), 1.0)

        cues = []
        for s in ("left", "right"):
            heel, foot = frame.get(LIMB[s]["heel"], thr), frame.get(LIMB[s]["foot"], thr)
            if heel and foot:
                cues.append(max(-1.0, min(1.0, (foot.x - heel.x) / (0.25 * scale))))
        nose = frame.get(NOSE, thr)
        ears = [p for p in (frame.get(L_EAR, thr), frame.get(R_EAR, thr)) if p]
        if nose and ears:
            ear_x = sum(p.x for p in ears) / len(ears)
            cues.append(max(-1.0, min(1.0, (nose.x - ear_x) / (0.25 * scale))))
        return sum(cues) / len(cues) if cues else None


class ExerciseTracker:
    def __init__(self, spec: ExerciseSpec, side: str = "auto",
                 target_angle: Optional[float] = None, record_trace: bool = True):
        self.spec = spec
        self.target = spec.default_target_angle_deg if target_angle is None else float(target_angle)
        self.counter = RepCounter(spec, self.target)
        self.facing_estimator = FacingEstimator() if spec.needs_facing else None
        self.record_trace = record_trace

        self._queued: Deque[RepResult] = deque()
        if not spec.sided:
            self.side, self._side_locked = "both", True
        elif side in ("left", "right"):
            self.side, self._side_locked = side, True
        else:
            # Side "auto": watch both limbs and lock onto the one that actually moves.
            self.side, self._side_locked = "left", False
            self._cand: Dict[str, Deque[Tuple[float, float, Dict[str, Optional[float]]]]] = {
                "left": deque(maxlen=450), "right": deque(maxlen=450)}
            self._auto_t0: Optional[float] = None
            self._moved_t: Optional[float] = None
            self._votes = {"left": 0.0, "right": 0.0}

        self.frames = 0
        self.valid_frames = 0
        self.view_checked_frames = 0
        self.view_mismatch_frames = 0
        self.trace: List[List[float]] = []
        self._next_trace_t = 0.0

    # -- per frame ----------------------------------------------------------
    def update(self, t: float, frame: Optional[PoseFrame]) -> FrameResult:
        self.frames += 1
        if frame is None:
            new = [self.counter.update(t, None)] if self._side_locked else []
            return self._result(FrameResult("no_pose", warnings=["No person detected"]), new)

        facing = self.facing_estimator.update(frame) if self.facing_estimator else 0
        warnings: List[str] = []
        status = "ok"
        mismatch = self._view_mismatch(frame)
        if mismatch is not None:
            self.view_checked_frames += 1
            if mismatch:
                self.view_mismatch_frames += 1
                status = "wrong_view"
                warnings.append(f"Turn to the {self.spec.view} view for this exercise")

        new_reps: List[RepResult] = []
        if not self._side_locked:
            if self._observe_candidates(t, frame, facing, new_reps):
                self.valid_frames += 1
            if not self._side_locked:
                warnings.append("Start the exercise so the working side can be detected")
                return self._result(FrameResult("calibrating", warnings=warnings), new_reps)

        raw = self.spec.measure(frame, self.side, facing)
        features = {name: fn(frame, self.side, facing) for name, fn in self.spec.features.items()}
        if raw is None:
            status = "low_visibility" if status == "ok" else status
            warnings.append("Keep the working limb fully in view")
        else:
            self.valid_frames += 1

        rep = self.counter.update(t, raw, features)
        if rep is not None:
            new_reps.append(rep)

        if self.record_trace and self.counter.angle is not None and t >= self._next_trace_t:
            self.trace.append([round(t, 2), round(self.counter.angle, 1)])
            self._next_trace_t = t + 1.0 / config.TRACE_HZ

        return self._result(FrameResult(
            status=status, angle=self.counter.angle, raw_angle=raw,
            progress=self.counter.progress, phase=self.counter.state, warnings=warnings), new_reps)

    def _result(self, res: FrameResult, new_reps: List[RepResult]) -> FrameResult:
        """Attach at most one finished repetition per frame (extras wait in a queue)."""
        self._queued.extend(new_reps)
        if self._queued:
            res.rep = self._queued.popleft()
        return res

    def reset_rep_state(self) -> None:
        self.counter.reset()

    # -- helpers ------------------------------------------------------------
    def _observe_candidates(self, t: float, frame: PoseFrame, facing: int,
                            new_reps: List[RepResult]) -> bool:
        """Auto side detection. Returns True if any side could be measured this frame."""
        if self._auto_t0 is None:
            self._auto_t0 = t
        measured = False
        for s in ("left", "right"):
            raw = self.spec.measure(frame, s, facing)
            if raw is not None:
                measured = True
                feats = {n: fn(frame, s, facing) for n, fn in self.spec.features.items()}
                self._cand[s].append((t, raw, feats))
            self._votes[s] += frame.mean_visibility(self.spec.required_landmarks(s))

        span = abs(self.counter.span)
        ranges = {s: _spread([a for _, a, _ in self._cand[s]]) for s in ("left", "right")}
        best, worst = sorted(ranges, key=ranges.get, reverse=True)
        moved = ranges[best] >= config.SIDE_LOCK_RANGE * span
        clear = ranges[best] >= config.SIDE_LOCK_DOMINANCE * ranges[worst]
        if moved and self._moved_t is None:
            self._moved_t = t
        ambiguous = self._moved_t is not None and t - self._moved_t >= config.SIDE_AMBIGUOUS_S
        timed_out = t - self._auto_t0 >= config.SIDE_AUTO_TIMEOUT_S
        if (moved and clear) or ambiguous or timed_out:
            if not moved or ranges[best] < 1.05 * ranges[worst]:
                # nobody moved, or both moved the same: fall back to the more visible limb
                best = "left" if self._votes["left"] >= self._votes["right"] else "right"
            self._lock_side(best, new_reps)
        return measured

    def _lock_side(self, side: str, new_reps: List[RepResult]) -> None:
        """Commit to a side and replay what it did so far, so the first repetition is not lost."""
        self.side, self._side_locked = side, True
        self.counter.reset()
        for t, raw, feats in self._cand[side]:
            rep = self.counter.update(t, raw, feats)
            if rep is not None:
                new_reps.append(rep)
            if self.record_trace and self.counter.angle is not None and t >= self._next_trace_t:
                self.trace.append([round(t, 2), round(self.counter.angle, 1)])
                self._next_trace_t = t + 1.0 / config.TRACE_HZ
        self._cand = {"left": deque(), "right": deque()}

    def _view_mismatch(self, frame: PoseFrame) -> Optional[bool]:
        """True if the body looks like the wrong camera view for this exercise."""
        sh = [frame.get(LIMB[s]["shoulder"], config.VISIBILITY_THRESHOLD) for s in ("left", "right")]
        hp = [frame.get(LIMB[s]["hip"], config.VISIBILITY_THRESHOLD) for s in ("left", "right")]
        if not all(sh) or not all(hp):
            return None
        width = abs(sh[0].x - sh[1].x)
        mid_s = ((sh[0].x + sh[1].x) / 2, (sh[0].y + sh[1].y) / 2)
        mid_h = ((hp[0].x + hp[1].x) / 2, (hp[0].y + hp[1].y) / 2)
        trunk = length((mid_h[0] - mid_s[0], mid_h[1] - mid_s[1]))
        if trunk < config.MIN_SEGMENT_PX:
            return None
        ratio = width / trunk
        if self.spec.view == "side":
            return ratio > config.VIEW_RATIO_THRESHOLD
        return ratio < config.VIEW_RATIO_THRESHOLD

    def tracking_summary(self) -> Dict:
        valid_pct = 100.0 * self.valid_frames / self.frames if self.frames else 0.0
        view_pct = (100.0 * self.view_mismatch_frames / self.view_checked_frames
                    if self.view_checked_frames else 0.0)
        return {
            "frames": self.frames,
            "valid_frames": self.valid_frames,
            "valid_pct": round(valid_pct, 1),
            "camera_view_mismatch_pct": round(view_pct, 1),
            "side_used": self.side,
        }
