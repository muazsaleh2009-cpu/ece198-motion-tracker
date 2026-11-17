"""Every tunable number of the tracker lives here, so nothing is hidden in the logic."""

# --- Landmark quality -------------------------------------------------------
# A landmark below this MediaPipe visibility score (or outside the image) is ignored.
# 0.6 is the value the original scripts used.
VISIBILITY_THRESHOLD = 0.6
# Lower bar for "soft" cues that only decide which way the patient faces (feet, ears).
FACING_VISIBILITY = 0.3
# Segments shorter than this many pixels are too small to give a meaningful angle.
MIN_SEGMENT_PX = 3.0

# --- Smoothing --------------------------------------------------------------
# Time constant of the exponential smoothing filter, in seconds. Frame-rate independent.
SMOOTHING_TAU_S = 0.10

# --- Repetition state machine ----------------------------------------------
# All thresholds are fractions of the patient's range of motion for the exercise:
#   progress = (angle - start_angle) / (target_angle - start_angle)
# 0.0 = resting position, 1.0 = prescribed target angle. Works for exercises whose angle
# increases (squat) and decreases (elbow extension) alike.
START_ZONE = 0.25      # progress at or below this = back at the start position
LEAVE_ZONE = 0.35      # progress at or above this = a repetition has begun (hysteresis gap)
COUNT_FRACTION = 0.70  # a repetition counts only if it reaches this much of the target ROM
TARGET_FRACTION = 0.90 # "reached target" flag threshold
HOLD_BAND = 0.10       # hold time = time within this fraction of the range of the rep's own peak
CONFIRM_FRAMES = 3     # consecutive frames needed to confirm leaving / returning to start
LOST_TIMEOUT_S = 1.0   # tracking lost this long mid-rep aborts the rep
MAX_REP_S = 60.0       # a single repetition cannot last longer than this

# --- Side selection / output ------------------------------------------------
# side == "auto": lock onto the limb whose angle has spread over at least SIDE_LOCK_RANGE of the
# exercise's range of motion AND at least SIDE_LOCK_DOMINANCE times more than the other limb.
SIDE_LOCK_RANGE = 0.35
SIDE_LOCK_DOMINANCE = 2.0
SIDE_AMBIGUOUS_S = 4.0         # both limbs moved with no clear winner: decide after this long
SIDE_AUTO_TIMEOUT_S = 20.0     # nobody moved by then: fall back to the more visible limb
TRACE_HZ = 5                   # angle trace sampling rate stored in the session file
# Shoulder width / trunk length in the image. Side views are narrow, front views wide.
VIEW_RATIO_THRESHOLD = 0.55
VIEW_MISMATCH_WARN_PCT = 30.0  # warn when this % of frames in a block look like the wrong view

# --- Scoring weights (must each sum to 1.0) ---------------------------------
WEIGHTS = {"rom": 0.50, "compensation": 0.30, "tempo": 0.20}
WEIGHTS_WITH_HOLD = {"rom": 0.45, "compensation": 0.25, "tempo": 0.15, "hold": 0.15}
