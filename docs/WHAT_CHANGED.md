# What to change in the repository

## Old files → new structure

| old file | what it did | now |
|---|---|---|
| `motion_tracker.py` | camera loop, knee angle, serial output | `tracker/camera.py` (loop), `tracker/exercises.py` (angles). Serial output dropped, as requested. |
| `angle_test.py`, `angle_test_backup.py`, `angle_debug.py`, `angle_peak.py` | experiments with the knee angle | superseded by `tracker/geometry.py` + `tracker/exercises.py` and `tests/test_angles.py` |
| `rep_test.py` | knee rep counter (interior angle ≤ 105° → ≥ 160°, smoothing 0.30 per frame) | `tracker/reps.py`: one counter for every exercise |
| `pose_test.py`, `camera_test.py` | smoke tests | `tracker/camera.py` |
| `requirements.txt` | mediapipe, opencv | unchanged |

Move the old scripts to a `legacy/` folder (or delete them once you are happy). Nothing imports them.

## The five changes that make "many exercises" possible

1. **One angle convention per exercise**, defined in one place (`exercises.py`). The old code reported the *interior*
   knee angle (180° = straight, ~90° = bent). The new code reports **flexion** (0° = straight, larger = more bent)
   so every exercise reads the same way: 0° is the resting position. The old thresholds 105° / 160° interior are
   75° / 20° of knee flexion.
2. **Shoulder and hip angles are measured against the trunk**, not against vertical, so leaning does not fake or hide
   movement. Extension is flexion with the sign flipped.
3. **Thresholds are fractions of the prescribed range**, not fixed degrees. `progress = (angle − start) / (target − start)`.
   A rep starts at 35%, ends back at 25%, and counts at ≥ 70%. The same state machine therefore counts squats
   (angle rises), elbow extensions (angle falls), and any future exercise.
4. **Form checks are data**: each exercise lists the compensations to watch (trunk lean, upper-arm drift…) with a limit
   in degrees. They feed the score and the flags.
5. **The output is a contract**: `session.json` (see `DATA_CONTRACT.md`) holds every set, every rep, the flags, and the
   angle trace, so the website never has to guess.

## Behaviour that differs from the old squat counter

* Old: counted when the interior angle dipped below 105° (flexion ≥ 75°). New, default squat target 90°: counts at
  ≥ 70% of (90° − 5°) = **~65° of flexion**. Lower `COUNT_FRACTION` in `config.py` (or prescribe a smaller target) to
  match the old depth exactly; raise it to demand more depth.
* Smoothing is now time-based (`SMOOTHING_TAU_S = 0.10 s`) instead of 0.30 per frame, so it behaves the same at any frame rate.

## Website

`App.jsx` was one file with hard-coded sessions and a "Simulate AI Session" form. It is now split into
`web/src/{lib,components,views}` (data logic separated from the screens), starts blank, and works from uploaded files.
The visual design, class names and the Large Text / High Contrast toggles are kept. The simulated-session modal is removed.
