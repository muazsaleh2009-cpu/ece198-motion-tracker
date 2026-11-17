"""MediaPipe Pose landmark indices used by TherapyPal (33-landmark model)."""

NOSE = 0
L_EAR, R_EAR = 7, 8

# Per-side lookup: LIMB["left"]["knee"] -> 25, etc. "Left" and "right" are the PATIENT's
# left and right, exactly as MediaPipe reports them.
LIMB = {
    "left": {
        "ear": 7, "shoulder": 11, "elbow": 13, "wrist": 15,
        "hip": 23, "knee": 25, "ankle": 27, "heel": 29, "foot": 31,
    },
    "right": {
        "ear": 8, "shoulder": 12, "elbow": 14, "wrist": 16,
        "hip": 24, "knee": 26, "ankle": 28, "heel": 30, "foot": 32,
    },
}


def other(side: str) -> str:
    """The opposite side."""
    return "right" if side == "left" else "left"
