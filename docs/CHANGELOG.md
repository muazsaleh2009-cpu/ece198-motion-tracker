# Changelog

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
