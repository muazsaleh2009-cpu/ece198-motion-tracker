"""Patient check-in after an exercise: pain and effort, the two things a supervisor cannot see on video.

Pure functions only (no cv2), so the rules are unit-tested. The camera loop in camera.py calls them.

  pain_0_10    0 = no pain, 10 = worst pain imaginable (numeric pain rating scale, NPRS)
  effort_0_10  0 = effortless, 10 = maximal effort (a simplified rating of perceived exertion)
"""

from typing import Optional

QUESTIONS = (
    ("pain_0_10", "Pain during this exercise?", "0 = none   10 = worst"),
    ("effort_0_10", "How hard was it?", "0 = very easy   10 = maximal"),
)
TEN_KEY = ord("t")      # keys 0-9 give 0-9; 't' gives 10
SKIP_KEYS = (ord(" "), 27, ord("s"))


def score_from_key(key: int) -> Optional[int]:
    """Map a pressed key to a 0-10 score; None when the key is not a score."""
    if ord("0") <= key <= ord("9"):
        return key - ord("0")
    if key == TEN_KEY:
        return 10
    return None


def normalize_checkin(pain=None, effort=None, note: Optional[str] = None) -> Optional[dict]:
    """Validate and build the block's "patient_report". Returns None when nothing was answered."""
    out = {}
    for name, value in (("pain_0_10", pain), ("effort_0_10", effort)):
        if value is None:
            out[name] = None
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value) or not 0 <= value <= 10:
            raise ValueError(f"{name} must be a whole number from 0 to 10, got {value!r}")
        out[name] = int(value)
    note = (note or "").strip() or None
    if out["pain_0_10"] is None and out["effort_0_10"] is None and note is None:
        return None
    out["note"] = note
    return out
