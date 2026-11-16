# TherapyPal

Camera-based tracking of home physiotherapy exercises (MediaPipe Pose) plus a dashboard where patient
and supervisor see progress against the prescribed plan.

```
therapypal/
├── tracker/                 the model (pure Python; only camera.py imports cv2/mediapipe)
│   ├── config.py            every tunable number (thresholds, smoothing, scoring weights)
│   ├── exercises.py         THE EXERCISE CATALOG: one ExerciseSpec per exercise, with its angle definition
│   ├── geometry.py          2D angle maths, time-based smoothing
│   ├── pose.py / landmarks.py   landmarks in pixels, MediaPipe indices
│   ├── reps.py              one generic repetition state machine for every exercise
│   ├── scoring.py           per-rep form score and flags
│   ├── tracker.py           follows one exercise frame by frame (side choice, facing, tracking quality)
│   ├── block.py             sets, rest, and the JSON block for one prescribed exercise
│   ├── session.py           collects blocks into session.json
│   ├── plan.py              reads plan.json, works out what is due on a date
│   ├── camera.py            webcam + MediaPipe loop and the on-screen overlay
│   └── synthetic.py         stick-figure poses for tests and demo data
├── run_session.py           command line entry point
├── tools/                   export_catalog.py · simulate.py · expected_stats.py
├── tests/                   41 tests (angles, counting, scoring, schedule rules, output, camera loop)
├── samples/                 demo plan + 21 simulated sessions + catalog
├── docs/DATA_CONTRACT.md    exact file formats (read this first when changing either side)
└── web/                     the dashboard (React)
```

## Run the tracker

```bash
pip install -r requirements.txt           # mediapipe, opencv
# download the MediaPipe "Pose Landmarker (Full)" model and save it here as pose_landmarker.task

python run_session.py --list                                   # the exercises and their angles
python run_session.py --plan plan.json                         # everything scheduled today
python run_session.py --plan plan.json --date 2026-11-18 --only squat,elbow_extension
python run_session.py --exercise squat --sets 2 --reps 8 --target 90   # ad-hoc, no plan
```

Keys in the window: `q` quit · `e` end set early · `n` next exercise · `space` skip rest.
Each run writes one `sessions/session_<date>_<time>_<patient>.json`. Upload it on the website's Data tab.

## Add an exercise

Add one `_add(ExerciseSpec(...))` block at the bottom of `tracker/exercises.py` (a measuring function, start
angle, default target, allowed range, form checks). Then `python tools/export_catalog.py web/src/data/exerciseCatalog.json`.
Nothing else changes: counting, scoring, JSON output, plan validation and the website all read the catalog.
`tests/test_angles.py::test_all_exercises_round_trip` automatically covers it.

## Run the website

```bash
cd web && npm install && npm run dev      # npm test = analytics tests (needs ../samples)
```

## Tests

```bash
python -m pytest tests -q                 # model
cd web && npm test                        # analytics vs an independent python computation
```

## Limits to know about

* Angles are measured **in the 2D camera image**. Side exercises need a true side view and front exercises a true
  front view; the tracker reports `camera_view_mismatch_pct` when the body looks like the wrong view, but
  out-of-plane movement will still under-read angles.
* The model has been tested on **synthetic poses** and the website on simulated sessions. It has not yet been run on
  real patients. Check angles against a goniometer before using scores clinically, and tune `tracker/config.py`.
* The Arduino/serial output of the old `motion_tracker.py` is not included.
