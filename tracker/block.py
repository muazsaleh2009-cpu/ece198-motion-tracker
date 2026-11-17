"""BlockSession: one prescribed exercise performed once (all its sets) -> one JSON "block".

It runs the set / rest logic on top of ExerciseTracker and builds the record that the
website reads. Time is passed in by the caller (seconds, any monotonic clock), so a block
can be driven by the live camera or by a recorded / simulated stream.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .checkin import normalize_checkin
from .exercises import ExerciseSpec
from .pose import PoseFrame
from .scoring import score_rep
from .tracker import ExerciseTracker, FrameResult

ACTIVE, REST, DONE = "active", "rest", "done"


@dataclass
class Prescription:
    sets: int
    reps_per_set: int
    target_angle_deg: float
    hold_seconds: float = 0.0
    rest_seconds: float = 30.0

    def to_dict(self) -> dict:
        return {
            "sets": self.sets, "reps_per_set": self.reps_per_set,
            "target_angle_deg": self.target_angle_deg,
            "hold_seconds": self.hold_seconds, "rest_seconds": self.rest_seconds,
        }


class BlockSession:
    def __init__(self, spec: ExerciseSpec, prescription: Prescription, started_at: datetime,
                 side: str = "auto", plan_item_id: Optional[str] = None,
                 scheduled_date: Optional[str] = None, record_trace: bool = True,
                 block_id: Optional[str] = None):
        self.spec = spec
        self.prescription = prescription
        self.started_at = started_at
        self.plan_item_id = plan_item_id
        self.scheduled_date = scheduled_date
        self.block_id = block_id or f"{spec.key}-{started_at.strftime('%Y%m%dT%H%M%S')}"
        self.tracker = ExerciseTracker(spec, side=side, target_angle=prescription.target_angle_deg,
                                       record_trace=record_trace)
        self.phase = ACTIVE
        self.set_number = 1
        self.sets: List[dict] = []
        self.last_rep: Optional[dict] = None   # most recent attempt, for on-screen feedback
        self._t0: Optional[float] = None
        self._set_reps: List[dict] = []
        self._set_t_start = 0.0
        self._rest_until = 0.0
        self._last_rel_t = 0.0
        self.patient_report: Optional[dict] = None

    # -- live state for the UI ---------------------------------------------
    @property
    def reps_in_set(self) -> int:
        return sum(1 for r in self._set_reps if r["counted"])

    @property
    def reps_counted(self) -> int:
        return sum(1 for s in self.sets for r in s["reps"] if r["counted"]) + self.reps_in_set

    def set_checkin(self, pain=None, effort=None, note: Optional[str] = None) -> None:
        """Attach the patient's own report (pain / effort 0-10) to this block."""
        self.patient_report = normalize_checkin(pain, effort, note)

    def rest_remaining(self, t: float) -> float:
        rel = t - (self._t0 or t)
        return max(0.0, self._rest_until - rel)

    # -- main entry ---------------------------------------------------------
    def feed(self, t: float, frame: Optional[PoseFrame]) -> Optional[FrameResult]:
        if self._t0 is None:
            self._t0 = t
        rel = t - self._t0
        self._last_rel_t = rel

        if self.phase == DONE:
            return None
        if self.phase == REST:
            if rel >= self._rest_until:
                self._begin_set(rel)
            else:
                return FrameResult("rest")

        res = self.tracker.update(rel, frame)
        if res.rep is not None:
            rep = score_rep(self.spec, self.prescription.target_angle_deg, res.rep,
                            self.prescription.hold_seconds)
            rep["rep_index"] = None
            if rep["counted"]:
                rep["rep_index"] = self.reps_in_set + 1
            self._set_reps.append(rep)
            self.last_rep = rep
            if self.reps_in_set >= self.prescription.reps_per_set:
                self._end_set(rel, "target_reached")
        return res

    def end_set_early(self) -> None:
        """Patient pressed 'end set' before reaching the rep target."""
        if self.phase == ACTIVE:
            self._end_set(self._last_rel_t, "manual")

    def skip_rest(self) -> None:
        if self.phase == REST:
            self._rest_until = self._last_rel_t

    # -- sets ---------------------------------------------------------------
    def _end_set(self, rel: float, ended_by: str) -> None:
        counted = [r for r in self._set_reps if r["counted"]]
        self.sets.append({
            "set_number": self.set_number,
            "target_reps": self.prescription.reps_per_set,
            "completed_reps": len(counted),
            "attempts_not_counted": len(self._set_reps) - len(counted),
            "t_start_s": round(self._set_t_start, 2),
            "t_end_s": round(rel, 2),
            "ended_by": ended_by,
            "reps": self._set_reps,
        })
        self._set_reps = []
        if self.set_number >= self.prescription.sets:
            self.phase = DONE
        else:
            self.set_number += 1
            self.phase = REST
            self._rest_until = rel + self.prescription.rest_seconds
        self.tracker.reset_rep_state()

    def _begin_set(self, rel: float) -> None:
        self.phase = ACTIVE
        self._set_t_start = rel
        self.tracker.reset_rep_state()

    # -- finishing ----------------------------------------------------------
    def finish(self, ended_by: str = "session_ended") -> dict:
        """Close the block (closing any set in progress) and return its JSON record."""
        if self.phase == ACTIVE and self._set_reps:
            self._end_set(self._last_rel_t, ended_by)
        duration = self._last_rel_t
        ended_at = self.started_at + timedelta(seconds=duration)

        counted = [r for s in self.sets for r in s["reps"] if r["counted"]]
        planned = self.prescription.sets * self.prescription.reps_per_set
        if len(counted) >= planned:
            status = "completed"
        elif counted:
            status = "partial"
        else:
            status = "no_reps"

        block = {
            "block_id": self.block_id,
            "exercise_key": self.spec.key,
            "plan_item_id": self.plan_item_id,
            "scheduled_date": self.scheduled_date,
            "side": self.tracker.side,
            "camera_view": self.spec.view,
            "angle": {
                "name": self.spec.angle_label,
                "unit": "deg",
                "convention": self.spec.convention,
                "start_angle_deg": self.spec.start_angle_deg,
                "target_angle_deg": self.prescription.target_angle_deg,
                "direction": "increase" if self.prescription.target_angle_deg >= self.spec.start_angle_deg else "decrease",
            },
            "prescribed": self.prescription.to_dict(),
            "started_at": self.started_at.isoformat(timespec="seconds"),
            "ended_at": ended_at.isoformat(timespec="seconds"),
            "duration_s": round(duration, 1),
            "status": status,
            "sets": self.sets,
            "summary": summarize(counted, planned, len(self.sets)),
            "tracking": self.tracker.tracking_summary(),
        }
        if self.patient_report is not None:
            block["patient_report"] = self.patient_report
        if self.tracker.record_trace:
            block["angle_trace"] = {"hz": 5, "unit": "deg", "samples": self.tracker.trace}
        return block


def summarize(counted_reps: List[dict], planned_reps: int, sets_done: int) -> dict:
    n = len(counted_reps)

    def avg(key: str) -> Optional[float]:
        return round(sum(r[key] for r in counted_reps) / n, 1) if n else None

    flag_counts: Dict[str, int] = {}
    for r in counted_reps:
        for f in r["flags"]:
            flag_counts[f] = flag_counts.get(f, 0) + 1

    peaks = [r["peak_angle_deg"] for r in counted_reps]
    forms = [r["form_score"] for r in counted_reps]
    return {
        "reps_planned": planned_reps,
        "reps_completed": n,
        "completion_pct": round(100.0 * min(1.0, n / planned_reps), 1) if planned_reps else 0.0,
        "sets_recorded": sets_done,
        "reps_reached_target": sum(1 for r in counted_reps if r["reached_target"]),
        "avg_peak_angle_deg": avg("peak_angle_deg"),
        "best_peak_angle_deg": None if not peaks else (max(peaks) if counted_reps[0]["target_angle_deg"] >= counted_reps[0]["start_angle_deg"] else min(peaks)),
        "avg_rom_pct": avg("rom_pct"),
        "avg_form_score": avg("form_score"),
        "min_form_score": min(forms) if forms else None,
        "avg_rep_duration_s": round(sum(r["duration_s"] for r in counted_reps) / n, 2) if n else None,
        "avg_hold_s": round(sum(r["hold_s"] for r in counted_reps) / n, 2) if n else None,
        "flag_counts": flag_counts,
    }
