# Changelog

## Unreleased
- New camera screens: TherapyPal logo, large type (Poppins), rep counter, dial, rest timer, welcome and summary screens.
- The exercise starts by itself once the patient is in position (3, 2, 1). `--no-intro` turns this off.
- Optional spoken instructions (`--voice`, or `v` in the window) using macOS `say` / `espeak`.
- `--fullscreen`, `--no-mirror`, `--voice-rate`; `tools/preview_ui.py` renders every screen to PNG.
- New modules: `tracker/coach.py` (what to say), `tracker/ui/` (drawing), `tracker/voice.py`. Pillow is now a dependency.

## 1.1.0
- Patient check-in after each exercise: pain 0-10 and effort 0-10 (`patient_report`, schema 1.1).
- Website redesign: range-of-motion dial, left navigation, light / dark / high contrast, large text.
- Plan builder: write plan.json in the browser, including weekly days and progression steps.
- Printable progress report for the supervisor, with notes.
- "Needs attention" panel: pain flare, missed sessions, declining form, low reach.
- Per-day heat map and this-week strip.
- Repository reorganised: `legacy/` for the original scripts, CI, Makefile, architecture notes.
- The tracker is now a package command: `python -m tracker` (`run_session.py` still works).

## 1.0.0
- Multi-exercise tracker (squat, elbow, shoulder, hip) with JSON output.
- Website: import plan and sessions, adherence, performance, consistency, improvement, log.
