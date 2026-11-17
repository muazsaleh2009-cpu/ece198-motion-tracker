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
├── tracker/cli.py           command line (python -m tracker, or the run_session.py shortcut)
│   └── checkin.py           post-exercise pain / effort questions
├── tracker/coach.py         the short instructions shown (and spoken) to the patient
├── tracker/ui/              the camera screens: theme, fonts, renderer (uses the logo and Poppins in tracker/assets/)
├── tracker/voice.py         optional spoken instructions
├── run_session.py           shortcut for python -m tracker
├── legacy/                  the original single-exercise scripts, kept for reference
├── Makefile                 make setup / test / web / check
├── .github/workflows/ci.yml python tests, web tests and a production build on every push
├── tools/                   export_catalog.py · simulate.py · expected_stats.py
├── tests/                   86 tests (angles, counting, scoring, schedule rules, output, check-in, coach, voice, screens, camera loop)
├── samples/                 demo plan + 21 simulated sessions + catalog
├── docs/                    DATA_CONTRACT.md (exact file formats, read first) · ARCHITECTURE.md · CHANGELOG.md
└── web/                     the dashboard (React)
```

## Run the tracker

```bash
pip install -r requirements.txt           # mediapipe, opencv, Pillow
# the MediaPipe "Pose Landmarker (Full)" model is included as pose_landmarker.task

python -m tracker --list                                   # the exercises and their angles
python -m tracker --plan plan.json                         # everything scheduled today
python -m tracker --plan plan.json --date 2026-11-18 --only squat,elbow_extension
python -m tracker --exercise squat --sets 2 --reps 8 --target 90   # ad-hoc, no plan
```

The window is a designed screen: the TherapyPal logo, a very large rep counter, one big instruction at a time
(for example "Bend your knees"), a dial that matches the website's, and a rest timer. The exercise starts by itself
once the patient has stood in position for a moment (3, 2, 1), so nobody has to walk back to the keyboard.

```bash
python -m tracker --plan plan.json --voice --fullscreen     # spoken instructions + full screen
python tools/preview_ui.py screens/                         # draw every screen to PNG files, no camera needed
```

Other flags: `--voice-rate 170` (words per minute) · `--no-intro` (start each exercise at once) · `--no-mirror`.
Voice uses the built-in macOS `say` command (`espeak` on Linux); nothing to install. It is off by default.

Keys in the window: `q` quit · `e` end set early · `n` next exercise · `space` start now / skip rest · `v` voice on or off · `f` full screen.
After each exercise the patient is asked for pain and effort (0-9, `t` = 10, `space` skips). Use `--no-checkin` to turn that off.
Each run writes one `sessions/session_<date>_<time>_<patient>.json`. Upload it on the website's Data tab.

## Add an exercise

Add one `_add(ExerciseSpec(...))` block at the bottom of `tracker/exercises.py` (a measuring function, start
angle, default target, allowed range, form checks). Then `python tools/export_catalog.py web/src/data/exerciseCatalog.json`.
Nothing else changes: counting, scoring, JSON output, plan validation and the website all read the catalog.
`tests/test_angles.py::test_all_exercises_round_trip` automatically covers it.

## Run the website

```bash
cd web && npm install && npm run dev      # then open http://localhost:5173
# first run: the app is blank. Upload samples/plan.json, then the files in samples/sessions/ on the Data tab,
# or press "Build a plan here instead" to write a plan in the browser.
```

## Tests

```bash
make test                                 # everything
python -m pytest -q                       # model
cd web && npm test                        # analytics + features vs an independent python computation
```

## Limits to know about

* Angles are measured **in the 2D camera image**. Side exercises need a true side view and front exercises a true
  front view; the tracker reports `camera_view_mismatch_pct` when the body looks like the wrong view, but
  out-of-plane movement will still under-read angles.
* The model has been tested on **synthetic poses** and the website on simulated sessions. It has not yet been run on
  real patients. Check angles against a goniometer before using scores clinically, and tune `tracker/config.py`.
* The Arduino/serial output of the old `motion_tracker.py` is not included. It still lives in `legacy/motion_tracker.py`.
* Pain and effort are self-reported by the patient. The website flags a pain flare for the supervisor; it is not a diagnosis.
