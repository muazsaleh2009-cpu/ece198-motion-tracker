"""Generic repetition counter. One state machine serves every exercise.

Instead of hard-coded angle thresholds (the old rep_test.py used 105 / 160 degrees for the
knee only), the angle is converted to a PROGRESS value:

    progress = (angle - start_angle) / (target_angle - start_angle)

0 = resting position, 1 = prescribed target. Thresholds are fractions of that range (see
config.py), so the same code handles angles that grow (squat) and shrink (elbow extension).

    READY  --(progress >= LEAVE_ZONE for N frames)-->  MOVING
    MOVING --(progress <= START_ZONE for N frames)-->  rep finished
             counted if the peak reached COUNT_FRACTION of the target, else logged as partial
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple

from . import config
from .exercises import ExerciseSpec
from .geometry import TimeEMA

READY = "ready"
MOVING = "moving"


@dataclass
class RepResult:
    """Raw measurements of one finished repetition attempt (before scoring)."""

    counted: bool                 # reached COUNT_FRACTION of the target range
    aborted: bool                 # tracking was lost / rep stalled, so data is incomplete
    start_t: float                # seconds (block clock): left the start position
    peak_t: float
    end_t: float                  # back at the start position
    start_angle: float            # smoothed angle just before the rep (patient's baseline)
    peak_angle: float             # extreme angle toward the target
    progress_peak: float          # 1.0 = exactly the target angle
    hold_s: float                 # longest continuous time spent near the target
    excursions: Dict[str, float] = field(default_factory=dict)  # form-check key -> max degrees

    @property
    def duration_s(self) -> float:
        return max(0.0, self.end_t - self.start_t)

    @property
    def time_to_peak_s(self) -> float:
        return max(0.0, self.peak_t - self.start_t)

    @property
    def return_s(self) -> float:
        return max(0.0, self.end_t - self.peak_t)


class RepCounter:
    def __init__(self, spec: ExerciseSpec, target_angle: float):
        span = target_angle - spec.start_angle_deg
        if abs(span) < 5.0:
            raise ValueError(
                f"Target {target_angle} deg is too close to the start angle "
                f"({spec.start_angle_deg} deg) for '{spec.key}'."
            )
        self.spec = spec
        self.target = float(target_angle)
        self.start = float(spec.start_angle_deg)
        self.span = span
        self._ema = TimeEMA()
        self.reset()

    # -- public -------------------------------------------------------------
    def reset(self) -> None:
        """Forget the current rep (used between sets)."""
        self._ema.reset()
        self.state = READY
        self.angle: Optional[float] = None        # smoothed
        self.progress: Optional[float] = None
        self._ready_buf: Deque[Tuple[float, Dict[str, float]]] = deque(maxlen=8)
        self._last_start_zone_t: Optional[float] = None
        self._leave_streak = 0
        self._leave_t: Optional[float] = None
        self._return_streak = 0
        self._return_t: Optional[float] = None
        self._lost_since: Optional[float] = None
        self._begin_rep_state()

    def progress_of(self, angle: float) -> float:
        return (angle - self.start) / self.span

    def update(self, t: float, raw_angle: Optional[float],
               features: Optional[Dict[str, Optional[float]]] = None) -> Optional[RepResult]:
        """Feed one frame. Returns a RepResult when a repetition attempt ends, else None."""
        features = features or {}

        if raw_angle is None:
            if self._lost_since is None:
                self._lost_since = t
            if t - self._lost_since > config.LOST_TIMEOUT_S:
                result = self._abort(t) if self.state == MOVING else None
                self._ema.reset()
                self.angle = self.progress = None
                self.state = READY
                self._leave_streak = self._return_streak = 0
                self._ready_buf.clear()
                return result
            return None
        self._lost_since = None

        angle = self._ema.update(raw_angle, t)
        p = self.progress_of(angle)
        self.angle, self.progress = angle, p

        if self.state == READY:
            return self._update_ready(t, angle, p, features)
        return self._update_moving(t, angle, p, features)

    # -- READY --------------------------------------------------------------
    def _update_ready(self, t, angle, p, features) -> Optional[RepResult]:
        if p <= config.START_ZONE:
            self._last_start_zone_t = t
            # Only true resting frames define the patient's baseline for this repetition.
            self._ready_buf.append((angle, dict(features)))
        if p < config.LEAVE_ZONE:
            self._leave_streak = 0
            return None

        if self._leave_streak == 0:
            self._leave_t = t
        self._leave_streak += 1
        if self._leave_streak < config.CONFIRM_FRAMES:
            return None

        # A repetition has begun.
        self.state = MOVING
        self._begin_rep_state()
        self._rep_start_t = self._last_start_zone_t if self._last_start_zone_t is not None else self._leave_t
        baseline_angles = [a for a, _ in self._ready_buf]
        self._rep_start_angle = (sum(baseline_angles) / len(baseline_angles)
                                 if baseline_angles else self.start)
        for name in {c.feature for c in self.spec.checks}:
            vals = [f[name] for _, f in self._ready_buf if f.get(name) is not None]
            if vals:
                self._baseline[name] = sum(vals) / len(vals)
        self._observe(t, angle, p, features)
        return None

    # -- MOVING -------------------------------------------------------------
    def _update_moving(self, t, angle, p, features) -> Optional[RepResult]:
        self._observe(t, angle, p, features)

        if t - self._rep_start_t > config.MAX_REP_S:
            return self._abort(t)

        if p <= config.START_ZONE:
            if self._return_streak == 0:
                self._return_t = t
            self._return_streak += 1
            if self._return_streak >= config.CONFIRM_FRAMES:
                return self._finish(self._return_t)
        else:
            self._return_streak = 0
        return None

    def _observe(self, t, angle, p, features) -> None:
        if p > self._peak_p:
            self._peak_p, self._peak_angle, self._peak_t = p, angle, t
        self._samples.append((t, p))
        for check in self.spec.checks:
            value = features.get(check.feature)
            if value is None:
                continue
            if check.mode == "drift":
                base = self._baseline.get(check.feature)
                if base is None:
                    continue
                excursion = abs(value - base)
            else:
                excursion = abs(value)
            if excursion > self._excursions.get(check.key, 0.0):
                self._excursions[check.key] = excursion

    # -- ending a rep ----------------------------------------------------------
    def _finish(self, end_t: float) -> Optional[RepResult]:
        peak_p = self._peak_p
        result = None
        if peak_p >= config.LEAVE_ZONE:  # ignore wiggles that never became a real attempt
            result = RepResult(
                counted=peak_p >= config.COUNT_FRACTION,
                aborted=False,
                start_t=self._rep_start_t, peak_t=self._peak_t, end_t=end_t,
                start_angle=self._rep_start_angle, peak_angle=self._peak_angle,
                progress_peak=peak_p, hold_s=self._hold_time(),
                excursions=dict(self._excursions),
            )
        self._after_rep()
        return result

    def _abort(self, t: float) -> Optional[RepResult]:
        result = None
        if self._peak_p >= config.LEAVE_ZONE:
            result = RepResult(
                counted=False, aborted=True,
                start_t=self._rep_start_t, peak_t=self._peak_t, end_t=t,
                start_angle=self._rep_start_angle, peak_angle=self._peak_angle,
                progress_peak=self._peak_p, hold_s=self._hold_time(),
                excursions=dict(self._excursions),
            )
        self._after_rep()
        return result

    def _hold_time(self) -> float:
        """Longest continuous time spent within HOLD_BAND of the rep's OWN peak.

        Measured at the patient's own end position (not at the prescribed target), so that a
        patient who only reaches 80% of the range but holds it for 3 s is credited with a 3 s
        hold; falling short of the range is already penalised by the ROM component.
        """
        if not self._samples:
            return 0.0
        threshold = self._peak_p - config.HOLD_BAND
        best, run_start, last_t = 0.0, None, None
        for t, p in self._samples:
            if p >= threshold:
                if run_start is None:
                    run_start = t
                last_t = t
                best = max(best, last_t - run_start)
            else:
                run_start = None
        return best

    def _after_rep(self) -> None:
        self.state = READY
        self._leave_streak = self._return_streak = 0
        self._ready_buf.clear()
        self._last_start_zone_t = None
        self._begin_rep_state()

    def _begin_rep_state(self) -> None:
        self._rep_start_t = 0.0
        self._rep_start_angle = self.start
        self._peak_p = float("-inf")
        self._peak_angle = self.start
        self._peak_t = 0.0
        self._samples: List[Tuple[float, float]] = []   # (time, progress) during the rep
        self._baseline: Dict[str, float] = {}
        self._excursions: Dict[str, float] = {}
