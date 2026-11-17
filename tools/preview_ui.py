"""Draw every camera screen to a PNG so the design can be looked at without a webcam.

    python tools/preview_ui.py screens/

Uses a drawn stick figure as the "camera picture". Needs numpy, Pillow and opencv (not MediaPipe).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2
import numpy as np

from tracker.coach import Message
from tracker.exercises import get_exercise
from tracker.synthetic import make_pose
from tracker.ui import Renderer, View


def fake_webcam(angle: float = 60.0, w: int = 1280, h: int = 720, key: str = "squat", mirror: bool = False):
    """A room with a floor and a stick figure: stands in for the webcam. Returns (image, segments, joints)."""
    img = np.zeros((h, w, 3), np.uint8)
    top, bottom = np.array([196, 205, 198]), np.array([150, 160, 152])
    for y in range(h):
        img[y] = top + (bottom - top) * (y / h)
    cv2.rectangle(img, (0, int(h * 0.82)), (w, h), (120, 134, 142), -1)
    pose = make_pose(key, angle, side="left")
    pts = {i: (p.x, p.y) for i, p in pose.points.items()}
    xs, ys = [p[0] for p in pts.values()], [p[1] for p in pts.values()]
    sx = (w * 0.34) / (max(xs) - min(xs) + 1e-6)
    sy = (h * 0.74) / (max(ys) - min(ys) + 1e-6)
    s = min(sx, sy)
    ox, oy = w * 0.5 - (min(xs) + max(xs)) / 2 * s, h * 0.10 - min(ys) * s
    P = {i: (x * s + ox, y * s + oy) for i, (x, y) in pts.items()}
    limbs = [(11, 13), (13, 15), (12, 14), (14, 16), (11, 12), (11, 23), (12, 24), (23, 24),
             (23, 25), (25, 27), (24, 26), (26, 28), (27, 31), (28, 32)]
    for a, b in limbs:
        cv2.line(img, tuple(map(int, P[a])), tuple(map(int, P[b])), (70, 70, 90), 16, cv2.LINE_AA)
    cv2.circle(img, tuple(map(int, P[0])), 34, (96, 110, 150), -1, cv2.LINE_AA)
    segs = [(P[23], P[25]), (P[25], P[27])]
    joints = [P[23], P[25], P[27]]
    if mirror:
        img = img[:, ::-1].copy()
        segs = [((w - a[0], a[1]), (w - b[0], b[1])) for a, b in segs]
        joints = [(w - j[0], j[1]) for j in joints]
    return img, segs, joints


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default="screens")
    args = ap.parse_args(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    r = Renderer()
    squat = get_exercise("squat")
    base = dict(exercise_name=squat.name, subtitle="Lower body, side view", index=1, total=3,
                angle_label=squat.angle_label, start_angle=squat.start_angle_deg, target_angle=90.0,
                set_number=1, sets=3, reps_per_set=10, description=squat.description, setup=squat.setup)
    rep = {"counted": True, "form_score": 92.0, "rom_pct": 97.0, "flags": []}
    shots = {}

    img, segs, joints = fake_webcam(70)
    shots["01_welcome"] = View(kind="welcome", greeting="Hello, Demo Patient", footer="Press SPACE to start",
                               items=[("Squat", "3 sets of 10 reps"), ("Elbow extension (triceps)", "3 sets of 12 reps"),
                                      ("Standing hip extension", "3 sets of 10 reps")])
    far, fsegs, fj = fake_webcam(5)
    shots["02_intro_wait"] = View(kind="intro", image=far, message=Message("Step back a little", "I need to see all of your body.", "warn"), **base)
    shots["03_intro_countdown"] = View(kind="intro", image=far, segments=fsegs, joints=fj, countdown=2, position_ok=True,
                                       message=Message("Get ready", "Starting in 2.", "go"), **base)
    shots["04_exercise_moving"] = View(kind="exercise", image=img, segments=segs, joints=joints, angle=62.0, progress=0.66,
                                       reps_in_set=4, last_rep=rep,
                                       message=Message("Bend your knees", "Keep going to the gold mark.", "go"), **base)
    img2, segs2, j2 = fake_webcam(92)
    shots["05_exercise_reached"] = View(kind="exercise", image=img2, segments=segs2, joints=j2, angle=91.0, progress=1.0,
                                        reps_in_set=4, last_rep=rep,
                                        message=Message("That's it!", "Stand tall slowly.", "good"), **base)
    shots["06_exercise_tip"] = View(kind="exercise", image=img, segments=segs, joints=joints, angle=8.0, progress=0.05,
                                    reps_in_set=5, last_rep={"counted": True, "form_score": 71.0, "rom_pct": 78.0, "flags": ["trunk_lean_forward"]},
                                    message=Message("Rep 5 of 10", "Keep your chest up, you are leaning too far forward.", "warn"), **base)
    shots["07_rest"] = View(kind="rest", image=far, reps_in_set=10, rest_remaining=22.4, rest_total=30, last_rep=rep,
                            message=Message("Rest", "Shake it out. Set 2 starts by itself.", "rest"),
                            **{**base, "set_number": 2})
    shots["08_checkin_pain"] = View(kind="checkin", exercise_name=squat.name, question="Pain during this exercise?",
                                    low_label="0 = none", high_label="10 = worst", palette="pain", seconds_left=21, seconds_total=30)
    shots["09_checkin_effort"] = View(kind="checkin", exercise_name=squat.name, question="How hard was it?",
                                      low_label="0 = very easy", high_label="10 = maximal", palette="effort", selected=6,
                                      seconds_left=12, seconds_total=30)
    shots["10_summary"] = View(kind="summary", greeting="Well done!", footer="Press any key to finish",
                               items=[("Squat", "30 of 30 reps · form 91"), ("Elbow extension (triceps)", "34 of 36 reps · form 90"),
                                      ("Standing hip extension", "28 of 30 reps · form 92")])
    import time
    for name, view in shots.items():
        t0 = time.perf_counter()
        frame = r.render(view)
        dt = (time.perf_counter() - t0) * 1000
        assert frame.shape == (800, 1280, 3), frame.shape
        cv2.imwrite(str(out / f"{name}.png"), frame)
        print(f"{name}: {dt:5.1f} ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
