"""The exercise catalog: one ExerciseSpec per supported exercise.

Adding an exercise = adding one `_add(ExerciseSpec(...))` block at the bottom. Nothing else in
the tracker changes. `python tools/export_catalog.py` then regenerates the website's catalog.

ANGLE CONVENTIONS (all in degrees, 2D image plane, so the camera view matters):
  Knee / elbow flexion   = 180 - interior angle of (hip,knee,ankle) / (shoulder,elbow,wrist).
                           0 = fully straight, increases as the joint bends.
  Shoulder / hip angles  = angle between the trunk axis (shoulder->hip) and the upper arm /
                           thigh, so trunk lean is automatically removed. 0 = limb hanging
                           alongside the trunk.
      flexion   (sagittal plane, camera at the side) = limb swings forward
      extension (sagittal plane, camera at the side) = limb swings backward
      abduction (frontal plane, camera in front)     = limb swings away from the midline
"""

from dataclasses import dataclass
from statistics import mean
from typing import Callable, Dict, List, Optional, Tuple

from . import config
from .geometry import VERTICAL_UP, angle_toward, interior_angle, signed_angle, vec
from .landmarks import LIMB, other
from .pose import Point, PoseFrame

Measure = Callable[[PoseFrame, str, int], Optional[float]]


# ---------------------------------------------------------------------------
# Measurement building blocks
# ---------------------------------------------------------------------------
def _sides(side: str) -> Tuple[str, ...]:
    return ("left", "right") if side == "both" else (side,)


def _flexion_from_triplet(first: str, mid: str, last: str) -> Measure:
    """Flexion of the `mid` joint: 180 - interior angle. Averages both sides if side == 'both'."""

    def measure(frame: PoseFrame, side: str, facing: int) -> Optional[float]:
        values = []
        for s in _sides(side):
            pts = frame.limb(s, (first, mid, last))
            if pts:
                interior = interior_angle(pts[first], pts[mid], pts[last])
                if interior is not None:
                    values.append(180.0 - interior)
        return mean(values) if values else None

    return measure


def _limb_vs_trunk(joint: str, distal: str, plane: str, sign: float = 1.0) -> Measure:
    """Angle of the upper arm (joint='shoulder') or thigh (joint='hip') relative to the trunk.

    plane='sagittal': positive = forward (needs the facing direction).
    plane='frontal' : positive = away from the midline.
    `sign=-1` turns flexion into extension.
    """
    trunk_end = "hip" if joint == "shoulder" else "shoulder"

    def measure(frame: PoseFrame, side: str, facing: int) -> Optional[float]:
        pts = frame.limb(side, (joint, distal, trunk_end))
        if not pts:
            return None
        limb = vec(pts[joint], pts[distal])
        if plane == "sagittal":
            if facing == 0:
                return None
            trunk = vec(pts["shoulder"], pts["hip"])  # points down the body
            toward = (float(facing), 0.0)
        else:
            # Front view: use the body midline (mid-shoulder -> mid-hip) as the trunk axis, so
            # the natural slant of one side's shoulder-hip line does not offset the reading.
            midline = _midline(frame)
            mirror = frame.limb(other(side), (joint,))
            if midline is None or not mirror:
                return None
            trunk = midline
            dx = pts[joint].x - mirror[joint].x
            if abs(dx) < config.MIN_SEGMENT_PX:
                return None
            toward = (1.0 if dx > 0 else -1.0, 0.0)  # outward = away from the other joint
        angle = angle_toward(trunk, limb, toward)
        return None if angle is None else sign * angle

    return measure


def _midline(frame: PoseFrame):
    """Vector from the mid-shoulder to the mid-hip point (needs both shoulders and both hips)."""
    left, right = frame.limb("left", ("shoulder", "hip")), frame.limb("right", ("shoulder", "hip"))
    if not left or not right:
        return None
    sx, sy = (left["shoulder"].x + right["shoulder"].x) / 2, (left["shoulder"].y + right["shoulder"].y) / 2
    hx, hy = (left["hip"].x + right["hip"].x) / 2, (left["hip"].y + right["hip"].y) / 2
    return (hx - sx, hy - sy)


def _trunk_points(frame: PoseFrame, side: str) -> Optional[Dict[str, "Point"]]:
    """Shoulder and hip of the first usable side ('both' tries left, then right)."""
    for s in _sides(side):
        pts = frame.limb(s, ("shoulder", "hip"))
        if pts:
            return pts
    return None


def _trunk_lean_sagittal(frame: PoseFrame, side: str, facing: int) -> Optional[float]:
    """Trunk lean from vertical, degrees. Positive = leaning forward."""
    pts = _trunk_points(frame, side)
    if not pts or facing == 0:
        return None
    return angle_toward(VERTICAL_UP, vec(pts["hip"], pts["shoulder"]), (float(facing), 0.0))


def _trunk_lean_frontal(frame: PoseFrame, side: str, facing: int) -> Optional[float]:
    """Sideways trunk lean of the body midline from vertical, degrees (sign is image direction)."""
    midline = _midline(frame)
    if midline is None:
        return None
    return signed_angle(VERTICAL_UP, (-midline[0], -midline[1]))  # hip -> shoulder direction


# ---------------------------------------------------------------------------
# Spec definitions
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class FormCheck:
    """A compensation to watch for during a repetition.

    mode 'abs'  : flag when |feature| exceeds limit_deg.
    mode 'drift': flag when the feature moves more than limit_deg from its value at the start
                  of the repetition (e.g. the torso rocking, the elbow drifting away).
    """

    key: str
    label: str
    feature: str
    mode: str
    limit_deg: float
    message: str


@dataclass(frozen=True, eq=False)
class ExerciseSpec:
    key: str
    name: str
    group: str                       # "Lower body" | "Upper body"
    joint: str
    movement: str                    # flexion | extension | abduction
    view: str                        # camera placement: "side" or "front"
    sided: bool                      # True: one limb (left/right/auto). False: both together
    angle_label: str                 # what the reported angle means
    convention: str                  # plain-language definition of 0 degrees and direction
    start_angle_deg: float           # resting angle the repetition starts from
    default_target_angle_deg: float  # default prescribed peak angle
    target_bounds_deg: Tuple[float, float]  # allowed range for a prescribed target
    min_rep_s: float                 # a controlled repetition takes at least this long...
    max_rep_s: float                 # ...and at most this long
    default_sets: int
    default_reps: int
    default_hold_s: float
    setup: str                       # camera / posture instructions shown to the patient
    description: str
    chains: Tuple[Tuple[str, ...], ...]     # landmark chains drawn on the preview
    measure: Measure
    features: Dict[str, Measure]
    checks: Tuple[FormCheck, ...]
    pair: Tuple[str, ...] = ()       # frontal exercises also need these joints on the other side

    @property
    def direction(self) -> str:
        """'increase' if the angle grows toward the target, else 'decrease'."""
        return "increase" if self.default_target_angle_deg >= self.start_angle_deg else "decrease"

    @property
    def needs_facing(self) -> bool:
        return self.view == "side"

    def sides_for(self, side: str) -> Tuple[str, ...]:
        return _sides(side)

    def required_landmarks(self, side: str) -> List[int]:
        names = {n for chain in self.chains for n in chain}
        out = []
        for s in _sides(side):
            out += [LIMB[s][n] for n in names]
            out += [LIMB[other(s)][n] for n in self.pair]
        return out

    def catalog_entry(self) -> dict:
        """JSON-safe description, consumed by the website (single source of truth)."""
        return {
            "key": self.key,
            "name": self.name,
            "group": self.group,
            "joint": self.joint,
            "movement": self.movement,
            "camera_view": self.view,
            "sided": self.sided,
            "angle_label": self.angle_label,
            "convention": self.convention,
            "direction": self.direction,
            "start_angle_deg": self.start_angle_deg,
            "default_target_angle_deg": self.default_target_angle_deg,
            "target_bounds_deg": list(self.target_bounds_deg),
            "rep_duration_s": [self.min_rep_s, self.max_rep_s],
            "default_sets": self.default_sets,
            "default_reps": self.default_reps,
            "default_hold_s": self.default_hold_s,
            "setup": self.setup,
            "description": self.description,
            "form_checks": [
                {"key": c.key, "label": c.label, "mode": c.mode,
                 "limit_deg": c.limit_deg, "message": c.message}
                for c in self.checks
            ],
        }


_CATALOG: Dict[str, ExerciseSpec] = {}


def _add(spec: ExerciseSpec) -> None:
    _CATALOG[spec.key] = spec


# Reusable measurements
_KNEE_FLEXION = _flexion_from_triplet("hip", "knee", "ankle")
_ELBOW_FLEXION = _flexion_from_triplet("shoulder", "elbow", "wrist")
_SHOULDER_SAGITTAL = _limb_vs_trunk("shoulder", "elbow", "sagittal")
_HIP_SAGITTAL = _limb_vs_trunk("hip", "knee", "sagittal")

# Reusable form checks
_TRUNK_STILL = FormCheck("trunk_motion", "Trunk motion", "trunk_lean", "drift", 12.0,
                         "Keep your body still and move only the working joint")
_TRUNK_SIDEWAYS = FormCheck("trunk_lean_sideways", "Sideways trunk lean", "trunk_lean_frontal",
                            "drift", 10.0, "Stand tall, do not lean to the side")
_ELBOW_TUCKED = FormCheck("upper_arm_drift", "Upper arm movement", "shoulder_angle", "drift", 20.0,
                          "Keep your upper arm still next to your body")
_THIGH_STILL = FormCheck("thigh_drift", "Thigh movement", "hip_angle", "drift", 15.0,
                         "Keep your thigh still and move only the lower leg")

_SIDE_SETUP = "Stand (or sit) side-on to the camera, 2 to 3 m away, with the working side toward the camera and your whole body in view."
_FRONT_SETUP = "Face the camera, 2 to 3 m away, with your whole body in view and arms/legs clear of your body."

# ----- Lower body ----------------------------------------------------------
_add(ExerciseSpec(
    key="squat", name="Squat", group="Lower body", joint="knee", movement="flexion",
    view="side", sided=False,
    angle_label="Knee flexion",
    convention="0 deg = standing with straight knees; larger = deeper squat (knees bent). Average of both knees.",
    start_angle_deg=5.0, default_target_angle_deg=90.0, target_bounds_deg=(30.0, 135.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=10, default_hold_s=0.0,
    setup=_SIDE_SETUP, description="Bend both knees and hips to lower the body, then stand back up.",
    chains=(("hip", "knee", "ankle"),),
    measure=_KNEE_FLEXION,
    features={"trunk_lean": _trunk_lean_sagittal},
    checks=(FormCheck("trunk_lean_forward", "Forward trunk lean", "trunk_lean", "abs", 55.0,
                      "Keep your chest up, you are leaning too far forward"),),
))

_add(ExerciseSpec(
    key="standing_knee_flexion", name="Standing knee flexion (hamstring curl)", group="Lower body",
    joint="knee", movement="flexion", view="side", sided=True,
    angle_label="Knee flexion",
    convention="0 deg = leg straight; larger = heel moving toward the buttock.",
    start_angle_deg=5.0, default_target_angle_deg=90.0, target_bounds_deg=(30.0, 135.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=0.0,
    setup=_SIDE_SETUP, description="Standing, bend one knee to bring the heel toward the buttock, then lower it.",
    chains=(("hip", "knee", "ankle"),),
    measure=_KNEE_FLEXION,
    features={"hip_angle": _HIP_SAGITTAL, "trunk_lean": _trunk_lean_sagittal},
    checks=(_THIGH_STILL, _TRUNK_STILL),
))

_add(ExerciseSpec(
    key="seated_knee_extension", name="Seated knee extension", group="Lower body",
    joint="knee", movement="extension", view="side", sided=True,
    angle_label="Knee flexion (0 = fully extended)",
    convention="Measured as knee flexion: starts about 90 deg (knee bent, seated) and falls toward 0 deg (leg straight).",
    start_angle_deg=90.0, default_target_angle_deg=0.0, target_bounds_deg=(0.0, 45.0),
    min_rep_s=2.0, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=2.0,
    setup="Sit side-on to the camera on a chair, 2 to 3 m away, with the working leg toward the camera and the whole leg visible.",
    description="Seated, straighten the knee until the leg is level, then lower it.",
    chains=(("hip", "knee", "ankle"),),
    measure=_KNEE_FLEXION,
    features={"hip_angle": _HIP_SAGITTAL, "trunk_lean": _trunk_lean_sagittal},
    checks=(_THIGH_STILL, _TRUNK_STILL),
))

_add(ExerciseSpec(
    key="hip_flexion", name="Standing hip flexion (march)", group="Lower body",
    joint="hip", movement="flexion", view="side", sided=True,
    angle_label="Hip flexion",
    convention="0 deg = thigh in line with the trunk (standing); larger = knee lifted forward.",
    start_angle_deg=0.0, default_target_angle_deg=80.0, target_bounds_deg=(30.0, 120.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=10, default_hold_s=1.0,
    setup=_SIDE_SETUP, description="Standing tall, lift one knee toward the chest, then lower it.",
    chains=(("shoulder", "hip", "knee"),),
    measure=_HIP_SAGITTAL,
    features={"trunk_lean": _trunk_lean_sagittal},
    checks=(_TRUNK_STILL,),
))

_add(ExerciseSpec(
    key="hip_extension", name="Standing hip extension", group="Lower body",
    joint="hip", movement="extension", view="side", sided=True,
    angle_label="Hip extension",
    convention="0 deg = thigh in line with the trunk (standing); larger = leg swung backward behind the body.",
    start_angle_deg=0.0, default_target_angle_deg=20.0, target_bounds_deg=(8.0, 30.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_SIDE_SETUP, description="Standing tall, swing one straight leg backward without leaning, then return.",
    chains=(("shoulder", "hip", "knee"),),
    measure=_limb_vs_trunk("hip", "knee", "sagittal", sign=-1.0),
    features={"trunk_lean": _trunk_lean_sagittal},
    checks=(_TRUNK_STILL,),
))

_add(ExerciseSpec(
    key="hip_abduction", name="Standing hip abduction", group="Lower body",
    joint="hip", movement="abduction", view="front", sided=True,
    angle_label="Hip abduction",
    convention="0 deg = leg straight down beside the other leg; larger = leg lifted out to the side.",
    start_angle_deg=0.0, default_target_angle_deg=35.0, target_bounds_deg=(10.0, 45.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_FRONT_SETUP, description="Standing tall, lift one straight leg out to the side, then lower it.",
    chains=(("shoulder", "hip", "knee"),),
    measure=_limb_vs_trunk("hip", "knee", "frontal"),
    features={"trunk_lean_frontal": _trunk_lean_frontal},
    checks=(_TRUNK_SIDEWAYS,),
    pair=("shoulder", "hip"),
))

# ----- Upper body ----------------------------------------------------------
_add(ExerciseSpec(
    key="elbow_flexion", name="Elbow flexion (bicep curl)", group="Upper body",
    joint="elbow", movement="flexion", view="side", sided=True,
    angle_label="Elbow flexion",
    convention="0 deg = arm straight; larger = elbow more bent (hand toward the shoulder).",
    start_angle_deg=10.0, default_target_angle_deg=140.0, target_bounds_deg=(60.0, 150.0),
    min_rep_s=1.5, max_rep_s=6.0, default_sets=3, default_reps=12, default_hold_s=0.0,
    setup=_SIDE_SETUP, description="With the upper arm still at your side, bend the elbow to bring the hand to the shoulder.",
    chains=(("shoulder", "elbow", "wrist"),),
    measure=_ELBOW_FLEXION,
    features={"shoulder_angle": _SHOULDER_SAGITTAL, "trunk_lean": _trunk_lean_sagittal},
    checks=(_ELBOW_TUCKED, _TRUNK_STILL),
))

_add(ExerciseSpec(
    key="elbow_extension", name="Elbow extension (triceps)", group="Upper body",
    joint="elbow", movement="extension", view="side", sided=True,
    angle_label="Elbow flexion (0 = fully extended)",
    convention="Measured as elbow flexion: starts about 90 deg (elbow bent) and falls toward 0 deg (arm straight).",
    start_angle_deg=90.0, default_target_angle_deg=0.0, target_bounds_deg=(0.0, 45.0),
    min_rep_s=1.5, max_rep_s=6.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_SIDE_SETUP, description="Starting with the elbow bent at 90 degrees, straighten the arm fully, then bend it again.",
    chains=(("shoulder", "elbow", "wrist"),),
    measure=_ELBOW_FLEXION,
    features={"shoulder_angle": _SHOULDER_SAGITTAL, "trunk_lean": _trunk_lean_sagittal},
    checks=(_ELBOW_TUCKED, _TRUNK_STILL),
))

_add(ExerciseSpec(
    key="shoulder_flexion", name="Shoulder flexion (forward raise)", group="Upper body",
    joint="shoulder", movement="flexion", view="side", sided=True,
    angle_label="Shoulder flexion",
    convention="0 deg = arm hanging beside the trunk; 90 deg = arm horizontal in front; 180 deg = overhead.",
    start_angle_deg=0.0, default_target_angle_deg=150.0, target_bounds_deg=(60.0, 180.0),
    min_rep_s=2.0, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_SIDE_SETUP, description="Raise the straight arm forward and up, then lower it slowly.",
    chains=(("hip", "shoulder", "elbow"),),
    measure=_SHOULDER_SAGITTAL,
    features={"trunk_lean": _trunk_lean_sagittal},
    checks=(_TRUNK_STILL,),
))

_add(ExerciseSpec(
    key="shoulder_extension", name="Shoulder extension", group="Upper body",
    joint="shoulder", movement="extension", view="side", sided=True,
    angle_label="Shoulder extension",
    convention="0 deg = arm hanging beside the trunk; larger = arm swung backward behind the body.",
    start_angle_deg=0.0, default_target_angle_deg=45.0, target_bounds_deg=(10.0, 60.0),
    min_rep_s=1.5, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_SIDE_SETUP, description="With a straight arm, swing it backward behind the body without leaning, then return.",
    chains=(("hip", "shoulder", "elbow"),),
    measure=_limb_vs_trunk("shoulder", "elbow", "sagittal", sign=-1.0),
    features={"trunk_lean": _trunk_lean_sagittal},
    checks=(_TRUNK_STILL,),
))

_add(ExerciseSpec(
    key="shoulder_abduction", name="Shoulder abduction (lateral raise)", group="Upper body",
    joint="shoulder", movement="abduction", view="front", sided=True,
    angle_label="Shoulder abduction",
    convention="0 deg = arm hanging beside the trunk; 90 deg = arm horizontal out to the side; 180 deg = overhead.",
    start_angle_deg=0.0, default_target_angle_deg=150.0, target_bounds_deg=(60.0, 180.0),
    min_rep_s=2.0, max_rep_s=8.0, default_sets=3, default_reps=12, default_hold_s=1.0,
    setup=_FRONT_SETUP, description="Raise the straight arm out to the side and up, then lower it slowly.",
    chains=(("hip", "shoulder", "elbow"),),
    measure=_limb_vs_trunk("shoulder", "elbow", "frontal"),
    features={"trunk_lean_frontal": _trunk_lean_frontal},
    checks=(_TRUNK_SIDEWAYS,),
    pair=("shoulder", "hip"),
))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def get_exercise(key: str) -> ExerciseSpec:
    try:
        return _CATALOG[key]
    except KeyError:
        raise KeyError(f"Unknown exercise '{key}'. Available: {', '.join(sorted(_CATALOG))}") from None


def all_exercises() -> List[ExerciseSpec]:
    return list(_CATALOG.values())


def catalog() -> List[dict]:
    return [spec.catalog_entry() for spec in _CATALOG.values()]
