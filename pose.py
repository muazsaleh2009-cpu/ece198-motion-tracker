"""A single camera frame's pose, in pixel coordinates, independent of MediaPipe."""

from dataclasses import dataclass
from typing import Dict, Iterable, Optional, Tuple

from . import config
from .landmarks import LIMB


@dataclass(frozen=True)
class Point:
    x: float  # pixels, right
    y: float  # pixels, down
    visibility: float = 1.0


class PoseFrame:
    """33 landmarks in pixel coordinates. Build it from MediaPipe or from plain (x, y)."""

    __slots__ = ("points",)

    def __init__(self, points: Dict[int, Point]):
        self.points = points

    @classmethod
    def from_mediapipe(cls, landmarks, width: int, height: int) -> "PoseFrame":
        """`landmarks` is result.pose_landmarks[0] from the MediaPipe Pose Landmarker."""
        points = {}
        for i, lm in enumerate(landmarks):
            vis = getattr(lm, "visibility", None)
            vis = 1.0 if vis is None else float(vis)
            # A landmark outside the image is a guess, so treat it as not visible.
            if not (0.0 <= lm.x <= 1.0 and 0.0 <= lm.y <= 1.0):
                vis = 0.0
            points[i] = Point(lm.x * width, lm.y * height, vis)
        return cls(points)

    @classmethod
    def from_xy(cls, xy: Dict[int, Tuple[float, float]], visibility: float = 1.0) -> "PoseFrame":
        return cls({i: Point(float(x), float(y), visibility) for i, (x, y) in xy.items()})

    def get(self, idx: int, min_visibility: float = 0.0) -> Optional[Point]:
        p = self.points.get(idx)
        if p is None or p.visibility < min_visibility:
            return None
        return p

    def limb(self, side: str, names: Iterable[str],
             min_visibility: Optional[float] = None) -> Optional[Dict[str, Point]]:
        """All named landmarks of one side, or None if any is missing/unreliable."""
        threshold = config.VISIBILITY_THRESHOLD if min_visibility is None else min_visibility
        out = {}
        for name in names:
            p = self.get(LIMB[side][name], threshold)
            if p is None:
                return None
            out[name] = p
        return out

    def mean_visibility(self, indices: Iterable[int]) -> float:
        vals = [self.points[i].visibility if i in self.points else 0.0 for i in indices]
        return sum(vals) / len(vals) if vals else 0.0
