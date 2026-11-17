"""The camera screens: every screen draws, text stays readable, the logo and fonts ship with the package."""

import time
import unittest

try:
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw
    HAVE_IMAGING = True
except ImportError:                                   # CI without the imaging packages: these tests are skipped
    HAVE_IMAGING = False

from tracker.coach import CUES, Message
from tracker.exercises import all_exercises
from tracker.ui import View
from tracker.ui import theme as T


@unittest.skipUnless(HAVE_IMAGING, "needs numpy, Pillow and opencv")
class Screens(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tracker.ui import Renderer
        cls.r = Renderer(cv2)
        cls.cam = np.full((720, 1280, 3), (180, 190, 185), np.uint8)

    def draw(self, **kw):
        out = self.r.render(View(**kw))
        self.assertEqual(out.shape, (800, 1280, 3))
        self.assertEqual(out.dtype, np.uint8)
        return out

    def test_every_screen_draws(self):
        msg = Message("Bend your knees", "Keep going to the gold mark.", "go")
        for kind in ("welcome", "intro", "exercise", "rest", "checkin", "summary"):
            out = self.draw(kind=kind, image=self.cam, message=msg, exercise_name="Squat", index=1, total=3,
                            reps_per_set=10, sets=3, angle=40.0, target_angle=90.0, progress=0.4,
                            rest_remaining=12.0, rest_total=30.0, question="Pain?", items=[("Squat", "10 of 10 reps")])
            self.assertGreater(float(out.std()), 20, f"{kind} looks empty")

    def test_screens_survive_missing_data(self):
        self.draw(kind="exercise", image=None, message=None, angle=None, progress=None, last_rep=None)
        self.draw(kind="rest", image=None, rest_remaining=0.0, rest_total=0.0)
        self.draw(kind="exercise", image=self.cam, reps_per_set=40, reps_in_set=12, last_rep={"counted": False, "flags": []})
        self.draw(kind="welcome", items=[(f"Exercise {i}", "3 sets of 10 reps") for i in range(9)])
        self.draw(kind="summary", items=[])

    def test_the_picture_is_mirrored_like_a_mirror(self):
        img = np.zeros((720, 1280, 3), np.uint8)
        img[:, :640] = (0, 0, 255)                                   # BGR red on the left half of the camera picture
        plain = self.draw(kind="exercise", image=img, mirror=False)
        mirrored = self.draw(kind="exercise", image=img, mirror=True)
        left, right = (130, 300), (730, 300)                         # inside the camera card, left and right of centre
        self.assertGreater(int(plain[left[1], left[0], 2]), 200)     # red on the left
        self.assertLess(int(plain[right[1], right[0], 2]), 120)
        self.assertGreater(int(mirrored[right[1], right[0], 2]), 200)   # now on the right
        self.assertLess(int(mirrored[left[1], left[0], 2]), 120)

    def test_the_skeleton_follows_the_mirror(self):
        img = np.zeros((720, 1280, 3), np.uint8)
        seg = [((200.0, 300.0), (260.0, 500.0))]
        a = self.draw(kind="exercise", image=img, segments=seg, mirror=False)
        b = self.draw(kind="exercise", image=img, segments=seg, mirror=True)
        self.assertFalse(np.array_equal(a, b))

    def test_the_big_headline_stays_big(self):
        """Readable from across the room: every cue word fits the message card at a large size."""
        probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
        from tracker.ui.fonts import fit_size
        for key, (out, back) in CUES.items():
            for head in (out, back, "Step back a little", "Exercise complete", "That one didn't count", "I can't see you"):
                size = fit_size(probe, head, "bold", 800 - 70, 68, 36)
                self.assertGreaterEqual(size, 50, f"{head!r} had to shrink to {size}px")

    def test_longest_exercise_name_fits_the_header(self):
        probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
        from tracker.ui.fonts import fit_size
        for spec in all_exercises():
            self.assertGreaterEqual(fit_size(probe, spec.name, "bold", 560, 36, 22), 28, spec.name)

    def test_brand_assets_ship_with_the_package(self):
        for name in ("logo_full.png", "logo_mark.png", "logo_wordmark.png"):
            im = Image.open(T.ASSETS / name)
            self.assertEqual(im.mode, "RGBA")
            self.assertGreater(im.getchannel("A").getbbox()[2], 100)
        for f in T.FONT_FILES.values():
            self.assertTrue((T.ASSETS / "fonts" / f).exists(), f)
        self.assertTrue((T.ASSETS / "fonts" / "OFL.txt").exists())          # the font licence travels with the fonts

    def test_fast_enough_for_a_live_camera(self):
        view = View(kind="exercise", image=self.cam, message=Message("Bend your knees", "Keep going.", "go"),
                    reps_per_set=10, sets=3, angle=40.0, target_angle=90.0, progress=0.4,
                    segments=[((300.0, 300.0), (400.0, 500.0))], joints=[(300.0, 300.0)])
        self.r.render(view)                                                  # warm the caches
        t0 = time.perf_counter()
        for _ in range(10):
            self.r.render(view)
        per_frame_ms = (time.perf_counter() - t0) * 100
        self.assertLess(per_frame_ms, 120, f"{per_frame_ms:.0f} ms per frame")


if __name__ == "__main__":
    unittest.main()
