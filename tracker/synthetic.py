"""Synthetic stick-figure poses, for tests and demo data (no camera needed).

`make_pose(exercise_key, angle, ...)` builds a PoseFrame whose joint angle for that exercise is
`angle` degrees (so it exercises the real measuring code), and `rep_angles(...)` builds a
realistic angle-versus-time curve for repetitions. Both are deterministic given a seed.
"""

import math
import random
from typing import Dict, Iterator, List, Optional, Tuple

from .geometry import rotate
from .landmarks import LIMB
from .pose import PoseFrame

TRUNK_PX, UPPER_ARM_PX, FOREARM_PX, THIGH_PX, SHANK_PX = 200.0, 120.0, 110.0, 220.0, 210.0


def _unit(v):
    n = math.hypot(*v) or 1.0
    return (v[0] / n, v[1] / n)


def _toward(v, toward, degrees):
    """Rotate v by `degrees` so that positive degrees swing it toward `toward`."""
    cross = v[0] * toward[1] - v[1] * toward[0]
    return rotate(v, degrees if cross > 0 else -degrees)


def _add(p, v, k=1.0):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def make_pose(exercise_key: str, angle: float, side: str = "left", facing: int = 1,
              trunk_lean: float = 0.0, noise_px: float = 0.0, rng: Optional[random.Random] = None,
              extra: Optional[Dict[str, float]] = None) -> PoseFrame:
    """A pose in which the measured angle of `exercise_key` equals `angle`.

    trunk_lean: forward lean in degrees (side views) or sideways lean (front views).
    extra: {'shoulder_angle': deg, 'hip_angle': deg} to simulate compensations.
    """
    extra = extra or {}
    rng = rng or random.Random(0)
    front = exercise_key in ("shoulder_abduction", "hip_abduction")
    return _front_pose(exercise_key, angle, side, trunk_lean, noise_px, rng) if front else \
        _side_pose(exercise_key, angle, side, facing, trunk_lean, noise_px, rng, extra)


def _finish(xy: Dict[int, Tuple[float, float]], noise_px: float, rng: random.Random,
            vis: Dict[int, float]) -> PoseFrame:
    pts = {}
    for i, (x, y) in xy.items():
        if noise_px:
            x, y = x + rng.gauss(0, noise_px), y + rng.gauss(0, noise_px)
        pts[i] = (x, y)
    frame = PoseFrame.from_xy(pts)
    for i, v in vis.items():
        p = frame.points[i]
        frame.points[i] = type(p)(p.x, p.y, v)
    return frame


def _limb_points(key, angle, facing, lean, extra):
    """Landmark positions (name -> (x, y)) for a pose whose measured angle is `angle`."""
    F = (float(facing), 0.0)
    hip = (400.0, 420.0)
    shoulder = (hip[0] + TRUNK_PX * math.sin(math.radians(lean)) * facing,
                hip[1] - TRUNK_PX * math.cos(math.radians(lean)))
    down = _unit((hip[0] - shoulder[0], hip[1] - shoulder[1]))  # trunk axis, pointing down the body

    shoulder_flex = extra.get("shoulder_angle", 0.0)  # upper-arm drift (elbow exercises)
    hip_flex = extra.get("hip_angle", 0.0)             # thigh drift (knee exercises)
    elbow_flex = 10.0
    knee_flex = 5.0

    if key == "squat":
        knee_flex, hip_flex = angle, 0.5 * angle
    elif key == "standing_knee_flexion":
        knee_flex = angle
    elif key == "seated_knee_extension":
        knee_flex, hip_flex = angle, 90.0 + extra.get("hip_angle", 0.0)
    elif key == "hip_flexion":
        hip_flex, knee_flex = angle, min(60.0, angle * 0.8)
    elif key == "hip_extension":
        hip_flex, knee_flex = -angle, 3.0
    elif key in ("elbow_flexion", "elbow_extension"):
        elbow_flex = angle
    elif key == "shoulder_flexion":
        shoulder_flex = angle
    elif key == "shoulder_extension":
        shoulder_flex = -angle
    else:
        raise ValueError(f"No side-view synthetic pose for {key}")

    upper = _toward(down, F, shoulder_flex)
    elbow = _add(shoulder, upper, UPPER_ARM_PX)
    wrist = _add(elbow, _toward(upper, F, elbow_flex), FOREARM_PX)
    thigh = _toward(down, F, hip_flex)
    knee = _add(hip, thigh, THIGH_PX)
    ankle = _add(knee, _toward(thigh, (-F[0], 0.0), knee_flex), SHANK_PX)
    heel = (ankle[0] - 15 * facing, ankle[1] + 10)
    foot = (ankle[0] + 45 * facing, ankle[1] + 12)
    return {"shoulder": shoulder, "elbow": elbow, "wrist": wrist, "hip": hip,
            "knee": knee, "ankle": ankle, "heel": heel, "foot": foot}


# Exercises where both limbs move together; every other exercise moves only the working side.
_BILATERAL = {"squat"}


def _side_pose(key, angle, side, facing, lean, noise_px, rng, extra) -> PoseFrame:
    from .exercises import get_exercise
    spec = get_exercise(key)
    working = _limb_points(key, angle, facing, lean, extra)
    resting = working if key in _BILATERAL else _limb_points(key, spec.start_angle_deg, facing, lean, {})
    shoulder = working["shoulder"]

    xy, vis = {}, {}
    xy[0] = (shoulder[0] + 38 * facing, shoulder[1] - 55)       # nose, ahead of the ears
    xy[7] = xy[8] = (shoulder[0] - 4 * facing, shoulder[1] - 55)
    for s in ("left", "right"):
        is_working = s == side
        pts = working if is_working else resting
        dx = 0.0 if is_working else -8.0 * facing               # the far limb sits just behind
        v = 1.0 if is_working else 0.9
        for name, pt in pts.items():
            idx = LIMB[s][name]
            xy[idx] = (pt[0] + dx, pt[1])
            vis[idx] = v
    return _finish(xy, noise_px, rng, vis)


def _front_pose(key, angle, side, lean, noise_px, rng) -> PoseFrame:
    """Facing the camera: the patient's left side appears on the image right."""
    sign = {"left": 1.0, "right": -1.0}
    centre, shoulder_y, hip_y = 400.0, 220.0, 420.0
    xy, vis = {}, {}
    lean_dx = TRUNK_PX * math.sin(math.radians(lean))
    for s in ("left", "right"):
        sx = centre + sign[s] * 90 + lean_dx
        hx = centre + sign[s] * 60
        xy[LIMB[s]["shoulder"]] = (sx, shoulder_y)
        xy[LIMB[s]["hip"]] = (hx, hip_y)
        xy[LIMB[s]["elbow"]] = (sx + sign[s] * 8, shoulder_y + UPPER_ARM_PX)
        xy[LIMB[s]["wrist"]] = (sx + sign[s] * 8, shoulder_y + UPPER_ARM_PX + FOREARM_PX)
        xy[LIMB[s]["knee"]] = (hx, hip_y + THIGH_PX)
        xy[LIMB[s]["ankle"]] = (hx, hip_y + THIGH_PX + SHANK_PX)
        xy[LIMB[s]["heel"]] = (hx, hip_y + THIGH_PX + SHANK_PX + 10)
        xy[LIMB[s]["foot"]] = (hx, hip_y + THIGH_PX + SHANK_PX + 12)
        vis.update({LIMB[s][n]: 1.0 for n in ("shoulder", "hip", "elbow", "wrist", "knee", "ankle")})
    xy[0], xy[7], xy[8] = (centre + lean_dx, shoulder_y - 60), (centre - 20 + lean_dx, shoulder_y - 50), (centre + 20 + lean_dx, shoulder_y - 50)

    out = (sign[side], 0.0)
    shoulder = xy[LIMB[side]["shoulder"]]
    hip = xy[LIMB[side]["hip"]]
    mid_s = ((xy[11][0] + xy[12][0]) / 2, (xy[11][1] + xy[12][1]) / 2)
    mid_h = ((xy[23][0] + xy[24][0]) / 2, (xy[23][1] + xy[24][1]) / 2)
    down = _unit((mid_h[0] - mid_s[0], mid_h[1] - mid_s[1]))  # body midline, pointing down
    if key == "shoulder_abduction":
        elbow = _add(shoulder, _toward(down, out, angle), UPPER_ARM_PX)
        xy[LIMB[side]["elbow"]] = elbow
        xy[LIMB[side]["wrist"]] = _add(elbow, _toward(down, out, angle), FOREARM_PX)
    elif key == "hip_abduction":
        knee = _add(hip, _toward(down, out, angle), THIGH_PX)
        xy[LIMB[side]["knee"]] = knee
        xy[LIMB[side]["ankle"]] = _add(knee, _toward(down, out, angle), SHANK_PX)
    else:
        raise ValueError(f"No front-view synthetic pose for {key}")
    return _finish(xy, noise_px, rng, vis)


# ---------------------------------------------------------------------------
# Angle-versus-time curves
# ---------------------------------------------------------------------------
def _smooth(u: float) -> float:
    """Ease in/out, 0..1."""
    u = max(0.0, min(1.0, u))
    return 0.5 - 0.5 * math.cos(math.pi * u)


def rep_angles(start: float, peak: float, reps: int, up_s: float = 1.5, hold_s: float = 0.5,
               down_s: float = 1.5, pause_s: float = 0.8, fps: int = 30, lead_s: float = 1.0,
               peak_jitter: float = 0.0, rng: Optional[random.Random] = None
               ) -> Iterator[Tuple[float, float]]:
    """Yield (time_s, angle) for `reps` repetitions from `start` to `peak` and back."""
    rng = rng or random.Random(1)
    dt = 1.0 / fps
    t = 0.0
    for _ in range(int(lead_s * fps)):
        yield t, start
        t += dt
    for _ in range(reps):
        p = peak + rng.uniform(-peak_jitter, peak_jitter)
        for phase_len, a0, a1 in ((up_s, start, p), (hold_s, p, p), (down_s, p, start), (pause_s, start, start)):
            n = max(1, int(phase_len * fps))
            for i in range(n):
                yield t, a0 + (a1 - a0) * _smooth((i + 1) / n)
                t += dt


def frames_for(key: str, angles: Iterator[Tuple[float, float]], **pose_kwargs
               ) -> Iterator[Tuple[float, PoseFrame]]:
    """Turn an angle curve into (time, PoseFrame). Pass extra=..., trunk_lean=..., side=..."""
    for t, a in angles:
        yield t, make_pose(key, a, **pose_kwargs)
