"""2D angle maths on image coordinates (x right, y down).

Conventions used everywhere in this project:
  * interior_angle(a, b, c)  -> angle at b between b->a and b->c, 0..180 degrees.
  * angle_toward(trunk, limb, toward) -> how far `limb` has rotated away from `trunk`,
    positive when it rotates toward the `toward` direction, negative the other way.
"""

import math
from typing import Optional, Tuple

from . import config

Vec = Tuple[float, float]

# Image y points down, so "up" is negative y. Only the direction matters; the vector is long so
# that the minimum-segment-length guard in signed_angle never rejects this reference direction.
VERTICAL_UP: Vec = (0.0, -1000.0)


def vec(a, b) -> Vec:
    """Vector from point a to point b."""
    return (b.x - a.x, b.y - a.y)


def dot(u: Vec, v: Vec) -> float:
    return u[0] * v[0] + u[1] * v[1]


def cross(u: Vec, v: Vec) -> float:
    return u[0] * v[1] - u[1] * v[0]


def length(u: Vec) -> float:
    return math.hypot(u[0], u[1])


def interior_angle(a, b, c) -> Optional[float]:
    """Angle at b between segments b-a and b-c, 0..180 degrees (180 = straight line)."""
    u, v = vec(b, a), vec(b, c)
    if min(length(u), length(v)) < config.MIN_SEGMENT_PX:
        return None
    return math.degrees(math.atan2(abs(cross(u, v)), dot(u, v)))


def signed_angle(u: Vec, v: Vec) -> Optional[float]:
    """Rotation from u to v in degrees, (-180, 180]. Sign follows cross(u, v)."""
    if min(length(u), length(v)) < config.MIN_SEGMENT_PX:
        return None
    return math.degrees(math.atan2(cross(u, v), dot(u, v)))


def angle_toward(trunk: Vec, limb: Vec, toward: Vec) -> Optional[float]:
    """Angle of `limb` measured from `trunk`, positive when moving toward `toward`.

    Example (person facing right, so toward = (1, 0); trunk axis points down the body):
        arm hanging down      ->   0
        arm raised forward    ->  +90   (shoulder flexion)
        arm swung backward    ->  -90   (i.e. 90 degrees of shoulder extension)
    """
    ang = signed_angle(trunk, limb)
    if ang is None:
        return None
    return ang if cross(trunk, toward) > 0 else -ang


def rotate(v: Vec, degrees: float) -> Vec:
    """Rotate a vector by `degrees` using the same sign convention as signed_angle."""
    r = math.radians(degrees)
    c, s = math.cos(r), math.sin(r)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


class TimeEMA:
    """Exponential moving average with a time constant, so it behaves the same at any FPS."""

    def __init__(self, tau_s: float = config.SMOOTHING_TAU_S):
        self.tau = tau_s
        self.value: Optional[float] = None
        self._t: Optional[float] = None

    def update(self, x: float, t: float) -> float:
        if self.value is None or self._t is None:
            self.value = x
        else:
            dt = max(0.0, t - self._t)
            alpha = 1.0 - math.exp(-dt / self.tau) if self.tau > 0 else 1.0
            self.value += alpha * (x - self.value)
        self._t = t
        return self.value

    def reset(self) -> None:
        self.value = None
        self._t = None
