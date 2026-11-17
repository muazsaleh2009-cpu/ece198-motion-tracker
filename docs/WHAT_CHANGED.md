# What changed in the repository

The original flat scripts were moved to `legacy/` (nothing imports them). The tracker lives in `tracker/`, the
website in `web/`. Use `python -m tracker` instead of `python motion_tracker.py`.

| old file | now |
|---|---|
| `motion_tracker.py` | `legacy/motion_tracker.py` (kept: it is the only copy of the Arduino serial output). Loop is now `tracker/camera.py`. |
| `angle_test.py`, `angle_test_backup.py`, `angle_debug.py`, `angle_peak.py` | `legacy/`. Replaced by `tracker/geometry.py`, `tracker/exercises.py`, `tests/test_angles.py` |
| `rep_test.py` | `legacy/`. Replaced by `tracker/reps.py` |
| `pose_test.py`, `camera_test.py` | `legacy/`. Replaced by `tracker/camera.py` |
| `requirements.txt` | unchanged |

Angle convention changed on purpose: the old code reported the interior knee angle (180° straight); the new code
reports flexion (0° straight). The old thresholds 105° and 160° interior are 75° and 20° of flexion.
See [CHANGELOG.md](CHANGELOG.md) for what is new.
