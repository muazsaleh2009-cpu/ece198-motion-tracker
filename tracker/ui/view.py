"""What a screen needs in order to be drawn. Plain data: the camera loop fills it in, the renderer draws it."""

from dataclasses import dataclass, field
from typing import Any, List, Optional, Sequence, Tuple

Point = Tuple[float, float]


@dataclass
class View:
    kind: str                                   # welcome | intro | exercise | rest | checkin | summary

    # camera picture (BGR numpy array, already mirrored) and the limb drawn on it, in that picture's pixels
    image: Any = None
    mirror: bool = True                         # show the picture like a mirror (the tracker still sees it unflipped)
    segments: Sequence[Tuple[Point, Point]] = ()
    joints: Sequence[Point] = ()

    # which exercise
    exercise_name: str = ""
    subtitle: str = ""                          # e.g. "Lower body, side view"
    index: int = 0                              # 1-based position in today's list
    total: int = 0

    # the coach's message (tracker.coach.Message) and the countdown shown over the picture
    message: Any = None
    countdown: int = 0

    # exercise / rest
    set_number: int = 1
    sets: int = 1
    reps_in_set: int = 0
    reps_per_set: int = 0
    angle: Optional[float] = None
    start_angle: float = 0.0
    target_angle: float = 0.0
    angle_label: str = ""
    progress: Optional[float] = None
    last_rep: Optional[dict] = None
    rest_remaining: float = 0.0
    rest_total: float = 0.0

    # intro
    description: str = ""
    setup: str = ""
    position_ok: bool = False

    # check-in
    question: str = ""
    low_label: str = ""
    high_label: str = ""
    palette: str = "pain"                       # pain | effort
    selected: Optional[int] = None
    seconds_left: float = 0.0
    seconds_total: float = 1.0

    # welcome / summary
    greeting: str = ""
    items: List[Tuple[str, str]] = field(default_factory=list)      # (name, detail) rows
    footer: str = ""

    # small helpers for the key hints
    voice_on: bool = False
    fullscreen: bool = False
