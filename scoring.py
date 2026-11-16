"""Turns a RepResult into the per-repetition record stored in the session file.

FORM SCORE (0 to 100), computed per repetition:

    rom          = min(1, progress_peak)              how much of the prescribed angle was reached
    compensation = mean over the exercise's form checks of  1 - excess/limit  (clamped to 0..1)
                   where excess = max(0, excursion - limit). No excess = 1.0.
    tempo        = 1 if the repetition lasted between the exercise's min and max duration,
                   otherwise duration/min (too fast) or max/duration (too slow)
    hold         = min(1, hold_s / prescribed_hold)   only if a hold was prescribed;
                   hold_s = longest time within 10% of the range of the rep's own peak

    score = 100 * (0.50 rom + 0.30 compensation + 0.20 tempo)             (no hold prescribed)
    score = 100 * (0.45 rom + 0.25 compensation + 0.15 tempo + 0.15 hold) (hold prescribed)

All four components are stored too, so the website can show which one is dragging the score.
"""

from typing import Dict, List

from . import config
from .exercises import ExerciseSpec
from .reps import RepResult


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_rep(spec: ExerciseSpec, target_angle: float, result: RepResult,
              hold_required_s: float = 0.0) -> Dict:
    rom = _clamp01(result.progress_peak)

    comp_parts: List[float] = []
    flags: List[str] = []
    for check in spec.checks:
        excursion = result.excursions.get(check.key)
        if excursion is None:
            continue  # feature could not be measured, so no penalty
        excess = max(0.0, excursion - check.limit_deg)
        comp_parts.append(_clamp01(1.0 - excess / check.limit_deg))
        if excess > 0:
            flags.append(check.key)
    compensation = sum(comp_parts) / len(comp_parts) if comp_parts else 1.0

    d = result.duration_s
    if d < spec.min_rep_s:
        tempo = _clamp01(d / spec.min_rep_s)
        flags.append("too_fast")
    elif d > spec.max_rep_s:
        tempo = _clamp01(spec.max_rep_s / d)
        flags.append("too_slow")
    else:
        tempo = 1.0

    components = {"rom": rom, "compensation": compensation, "tempo": tempo, "hold": None}
    if hold_required_s > 0:
        hold = _clamp01(result.hold_s / hold_required_s)
        components["hold"] = hold
        if hold < 1.0:
            flags.append("hold_short")
        w = config.WEIGHTS_WITH_HOLD
        score = (w["rom"] * rom + w["compensation"] * compensation
                 + w["tempo"] * tempo + w["hold"] * hold)
    else:
        w = config.WEIGHTS
        score = w["rom"] * rom + w["compensation"] * compensation + w["tempo"] * tempo

    reached = result.progress_peak >= config.TARGET_FRACTION
    if result.counted and not reached:
        flags.append("short_of_target")
    if result.aborted:
        flags.append("tracking_lost")

    return {
        "counted": bool(result.counted and not result.aborted),
        "t_start_s": round(result.start_t, 2),
        "t_end_s": round(result.end_t, 2),
        "duration_s": round(result.duration_s, 2),
        "time_to_peak_s": round(result.time_to_peak_s, 2),
        "return_s": round(result.return_s, 2),
        "start_angle_deg": round(result.start_angle, 1),
        "peak_angle_deg": round(result.peak_angle, 1),
        "target_angle_deg": round(target_angle, 1),
        "rom_deg": round(abs(result.peak_angle - result.start_angle), 1),
        "rom_pct": round(100.0 * max(0.0, result.progress_peak), 1),
        "reached_target": bool(reached),
        "hold_s": round(result.hold_s, 2),
        "form_score": round(100.0 * score, 1),
        "components": {k: (None if v is None else round(v, 3)) for k, v in components.items()},
        "excursions_deg": {k: round(v, 1) for k, v in result.excursions.items()},
        "flags": flags,
    }
