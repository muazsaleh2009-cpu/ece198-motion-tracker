# Architecture

```
                 plan.json                              session_*.json
  website  ───────────────────▶  tracker (Python)  ───────────────────▶  website
  (React, browser only)           MediaPipe + webcam                     (IndexedDB in the browser)
```

The two halves share nothing but the two files in [DATA_CONTRACT.md](DATA_CONTRACT.md). No server is needed:
the website runs in the browser and keeps its data in IndexedDB (in memory if the browser blocks it), and the tracker
writes files to `sessions/`.

## Tracker (`tracker/`)

One exercise = one `ExerciseSpec` in `exercises.py` (which landmarks, how the angle is computed, start and
target angle, form checks). Everything downstream is generic.

1. `camera.py` reads frames and asks MediaPipe for landmarks (the only file that imports cv2 and mediapipe).
2. `tracker.py` turns landmarks into one smoothed angle per frame, choosing the moving side.
3. `reps.py` counts repetitions with one state machine (start at 35% of range, end at 25%, counted at 70%).
4. `scoring.py` gives each rep a form score from range, compensation, tempo and hold.
5. `block.py` groups reps into sets and one prescribed exercise, and holds the optional `patient_report`.
6. `session.py` writes `session_*.json`. `checkin.py` handles the pain and effort questions.

What the patient sees and hears is split in three so it can be tested without a camera:
`coach.py` (pure Python) decides the short instruction, its tone and the spoken sentence; `ui/` draws it with a
`View` data object (Pillow for text, OpenCV for the skeleton and dial; 1280x800, scaled by the window; the mirror
flip happens inside the renderer, so the tracker still sees the unflipped picture); `voice.py` speaks it
(`say` / `espeak`, repeats nothing within 4 s). `ReadyGate` in `coach.py` starts an exercise after the patient has
held position for 1.5 s plus a 3 s countdown. `tools/preview_ui.py` renders every screen to PNG.

Everything except `camera.py` is pure Python and is tested with synthetic stick-figure poses (`synthetic.py`).

## Website (`web/src/`)

| folder | what it holds |
|---|---|
| `lib/analytics.js` | every number on screen: adherence, performance, improvement, pain flare, attention list |
| `lib/plan.js`, `planBuilder.js` | read, validate and write plan.json; the form behind the plan builder |
| `lib/sessions.js`, `storage.js`, `notes.js` | importing session files, IndexedDB, supervisor notes |
| `components/` | RomDial (the range-of-motion dial), charts, heatmap, week strip, attention list, plan builder |
| `views/` | Overview, Exercises, Log, Plan, Report, Data |
| `styles.js` | all CSS, with design tokens for light, dark and high contrast |

## How the numbers are checked

`tools/expected_stats.py` recomputes the headline numbers from the same sample files in plain Python, written
separately from the JavaScript. `web/tests/analytics.test.mjs` and `tests/e2e.mjs` compare the website against it.
If both sides share a misunderstanding of a definition, this will not catch it, so the definitions are written
down in DATA_CONTRACT.md section 3 for a clinician to read.

## Adding an exercise

Add one `ExerciseSpec`, run `make catalog`, run `make test`. The website, plan builder and validation read the catalog.
