"""Draws every camera screen onto a 1280x800 canvas.

Pillow draws the text (Poppins) and the soft cards; OpenCV draws the anti-aliased shapes that change
every frame (skeleton, gauge, dots). The renderer only needs numpy, Pillow and cv2 (resize/lines), never
MediaPipe, so each screen can be previewed and tested without a camera.

Reading distance matters here: a patient exercising 2-3 m from a laptop cannot read small text, so the
only things that must be read from far away are big: the rep counter, the one-line coach message, the
countdown and the rest timer. Everything else is the near-reading detail.
"""

import math
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from . import theme as T
from .fonts import draw_text, draw_wrapped, fit_size, font, text_width, wrap
from .view import View

SS = 3                      # supersampling for the static shapes (cards, chips)

# --- layout (canvas pixels) -----------------------------------------------------------
HEADER_H = 84
CAM = (28, 100, 800, 450)                 # x, y, w, h of the camera card
COACH = (28, 566, 800, 170)               # message card under the camera
REP = (852, 100, 400, 206)                # rep counter card
GAUGE = (852, 322, 400, 268)              # gauge (or rest timer) card
LAST = (852, 606, 400, 130)               # last repetition card
SIDE_FULL = (852, 100, 400, 636)          # "how to" card on the get-ready screen
FOOT_Y = 770                              # baseline of the key hints


def _rounded_mask(w: int, h: int, r: int) -> Image.Image:
    m = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * SS - 1, h * SS - 1), radius=r * SS, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def paste_card(base: Image.Image, rect, fill=T.CARD, border=T.LINE, radius=T.RADIUS, shadow=True) -> None:
    x, y, w, h = rect
    if shadow:
        pad = 28
        sh = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
        sh.paste(_rounded_mask(w, h, radius), (pad, pad))
        sh = sh.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(v * 0.16))
        base.paste(Image.new("RGB", sh.size, T.INK), (x - pad, y - pad + 5), sh)
    outer = _rounded_mask(w, h, radius)
    if border is not None:
        base.paste(Image.new("RGB", (w, h), border), (x, y), outer)
        inner = _rounded_mask(w - 2, h - 2, max(radius - 1, 1))
        base.paste(Image.new("RGB", (w - 2, h - 2), fill), (x + 1, y + 1), inner)
    else:
        base.paste(Image.new("RGB", (w, h), fill), (x, y), outer)


def _rrect(cv2, img, x, y, w, h, r, color) -> None:
    """Filled rounded rectangle with smooth corners, drawn straight onto a numpy image."""
    x, y, w, h, r = int(x), int(y), int(w), int(h), int(min(r, h // 2, w // 2))
    x2, y2 = x + w, y + h
    cv2.rectangle(img, (x + r, y), (x2 - r, y2), color, -1)
    cv2.rectangle(img, (x, y + r), (x2, y2 - r), color, -1)
    for cx, cy in ((x + r, y + r), (x2 - r, y + r), (x + r, y2 - r), (x2 - r, y2 - r)):
        cv2.circle(img, (cx, cy), r, color, -1, cv2.LINE_AA)


def _mix(a, b, t: float):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


@lru_cache(maxsize=64)
def _chip(key: str, label: str) -> Image.Image:
    """A keycap with its label, e.g. [Space] Skip rest. Cached; drawn at 3x and shrunk so the edges are smooth."""
    probe = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    kw = int(max(40, text_width(probe, key, "bold", 20) + 24))
    lw = int(text_width(probe, label, "regular", 20))
    w, h = kw + 12 + lw + 4, 38
    big = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle((0, 0, kw * SS, (h - 3) * SS), radius=9 * SS, fill=T.LINE)
    d.rounded_rectangle((0, 0, kw * SS, (h - 7) * SS), radius=9 * SS, fill=T.CARD, outline=T.LINE, width=2 * SS)
    d.text((kw * SS / 2, (h - 7) * SS / 2 + 1 * SS), key, font=font("bold", 20 * SS), fill=T.INK, anchor="mm")
    d.text(((kw + 12) * SS, (h - 7) * SS / 2 + 1 * SS), label, font=font("regular", 20 * SS), fill=T.INK2, anchor="lm")
    return big.resize((w, h), Image.LANCZOS)


class Renderer:
    def __init__(self, cv2=None):
        if cv2 is None:
            import cv2 as _cv2
            cv2 = _cv2
        self.cv2 = cv2
        self._bg: Dict[str, Image.Image] = {}
        self._logos: Dict[Tuple[str, int], Image.Image] = {}
        self._cam_mask: Optional[np.ndarray] = None

    # ------------------------------------------------------------------ public
    def render(self, view: View) -> np.ndarray:
        """Return the finished screen as a BGR uint8 array of shape (800, 1280, 3), ready for cv2.imshow."""
        draw_fn = getattr(self, f"_draw_{view.kind}")
        canvas = np.array(self._background(view.kind))
        pending: List = []                     # text and pasted images, drawn after the OpenCV shapes
        draw_fn(canvas, view, pending)
        img = Image.fromarray(canvas)
        d = ImageDraw.Draw(img)
        for item in pending:
            item(img, d)
        return np.ascontiguousarray(np.asarray(img)[:, :, ::-1])

    # -------------------------------------------------------------- backgrounds
    def _background(self, kind: str) -> Image.Image:
        key = "exercise" if kind == "rest" else kind
        if key not in self._bg:
            img = Image.new("RGB", (T.W, T.H), T.BG)
            ImageDraw.Draw(img).rectangle((0, 0, T.W, HEADER_H), fill=T.CARD)
            ImageDraw.Draw(img).line((0, HEADER_H, T.W, HEADER_H), fill=T.LINE, width=2)
            for name, args in self._logo_places():
                logo = self._logo(name, args)
                img.paste(logo, (args[1], args[2]), logo)
            if key == "exercise":
                paste_card(img, CAM, fill=T.CAMERA_BG, border=None)
                for rect in (COACH, REP, GAUGE, LAST):
                    paste_card(img, rect)
            elif key == "intro":
                paste_card(img, CAM, fill=T.CAMERA_BG, border=None)
                paste_card(img, COACH)
                paste_card(img, SIDE_FULL)
            elif key == "checkin":
                paste_card(img, (60, 112, 1160, 624))
            elif key in ("welcome", "summary"):
                paste_card(img, (60, 112, 1160, 624))
            self._bg[key] = img
        return self._bg[key]

    def _logo_places(self):
        # (asset name, (height, x, y))
        return [("logo_mark.png", (56, 28, 14)), ("logo_wordmark.png", (30, 28 + 51 + 14, 27))]

    def _logo(self, name: str, args) -> Image.Image:
        height = args[0]
        key = (name, height)
        if key not in self._logos:
            src = Image.open(T.ASSETS / name).convert("RGBA")
            w = max(1, int(round(src.width * height / src.height)))
            self._logos[key] = src.resize((w, height), Image.LANCZOS)
        return self._logos[key]

    def _big_logo(self, width: int) -> Image.Image:
        key = ("logo_full.png", -width)
        if key not in self._logos:
            src = Image.open(T.ASSETS / "logo_full.png").convert("RGBA")
            self._logos[key] = src.resize((width, int(round(src.height * width / src.width))), Image.LANCZOS)
        return self._logos[key]

    # ------------------------------------------------------------------ pieces
    def _header_text(self, pending, view: View) -> None:
        def go(img, d):
            if view.exercise_name:
                size = fit_size(d, view.exercise_name, "bold", 560, 36, 22)
                draw_text(d, (T.W / 2, 46), view.exercise_name, "bold", size, T.INK, "ms")
                if view.subtitle:
                    draw_text(d, (T.W / 2, 70), view.subtitle, "regular", 18, T.INK2, "ms")
            if view.total > 1:
                label = f"Exercise {view.index} of {view.total}"
                draw_text(d, (T.W - 32, 40), label, "medium", 22, T.INK, "rs")
                x = T.W - 32
                for i in range(view.total - 1, -1, -1):
                    done = i < view.index
                    d.ellipse((x - 14, 54, x - 2, 66), fill=T.BLUE if done else T.LINE)
                    x -= 22
        pending.append(go)

    def _keys(self, pending, view: View, hints: List[Tuple[str, str]]) -> None:
        def go(img, d):
            x = 32
            for key, label in hints:
                chip = _chip(key, label)
                img.paste(chip, (x, FOOT_Y - 24), chip)
                x += chip.width + 28
        pending.append(go)

    def _camera(self, canvas, view: View, dim: float = 0.0) -> Tuple[float, float, float]:
        """Paste the camera picture into its card (rounded corners). Returns (scale, offset_x, offset_y)."""
        cv2 = self.cv2
        x, y, w, h = CAM
        if self._cam_mask is None:
            self._cam_mask = np.asarray(_rounded_mask(w, h, T.RADIUS)).astype(np.float32)[..., None] / 255.0
        layer = np.empty((h, w, 3), np.uint8)
        layer[:] = T.CAMERA_BG
        scale, ox, oy = 1.0, 0.0, 0.0
        if view.image is not None:
            ih, iw = view.image.shape[:2]
            scale = min(w / iw, h / ih)
            nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
            small = cv2.resize(view.image, (nw, nh), interpolation=cv2.INTER_AREA)[:, :, ::-1]   # BGR -> RGB
            if view.mirror:
                small = small[:, ::-1]
            ox, oy = (w - nw) // 2, (h - nh) // 2
            layer[oy:oy + nh, ox:ox + nw] = small
        if dim:
            layer = (layer * (1.0 - dim)).astype(np.uint8)
        region = canvas[y:y + h, x:x + w].astype(np.float32)
        canvas[y:y + h, x:x + w] = (layer * self._cam_mask + region * (1.0 - self._cam_mask)).astype(np.uint8)
        return scale, x + ox, y + oy

    def _skeleton(self, canvas, view: View, scale: float, ox: float, oy: float) -> None:
        cv2 = self.cv2
        tone = getattr(view.message, "tone", "neutral")
        color = {"good": T.GREEN, "warn": T.BRASS}.get(tone, (60, 160, 235))
        iw = view.image.shape[1] if view.image is not None else 0

        def p(pt):
            x = (iw - pt[0]) if (view.mirror and iw) else pt[0]
            return (int(round(ox + x * scale)), int(round(oy + pt[1] * scale)))
        for a, b in view.segments:
            cv2.line(canvas, p(a), p(b), (255, 255, 255), 11, cv2.LINE_AA)
        for a, b in view.segments:
            cv2.line(canvas, p(a), p(b), color, 6, cv2.LINE_AA)
        for pt in view.joints:
            cv2.circle(canvas, p(pt), 11, (255, 255, 255), -1, cv2.LINE_AA)
            cv2.circle(canvas, p(pt), 7, color, -1, cv2.LINE_AA)

    def _coach_card(self, canvas, pending, view: View, rect=COACH) -> None:
        """The message card: one big line, then a sentence. Colour says what kind of message it is."""
        cv2 = self.cv2
        msg = view.message
        x, y, w, h = rect
        tint, strong = T.TONES.get(getattr(msg, "tone", "neutral"), T.TONES["neutral"])
        _rrect(cv2, canvas, x, y, w, h, T.RADIUS, tint)
        _rrect(cv2, canvas, x, y, 14, h, 7, strong)
        cv2.rectangle(canvas, (x + 7, y), (x + 14, y + h), strong, -1)
        head = getattr(msg, "headline", "")
        detail = getattr(msg, "detail", "")

        def go(img, d):
            size = fit_size(d, head, "bold", w - 70, 68, 36)
            draw_text(d, (x + 40, y + 28 + size * 0.82), head, "bold", size, strong)
            if detail:
                draw_wrapped(d, x + 40, y + 28 + size * 0.82 + 44, detail, "regular", 28, T.INK,
                             w - 76, 36, max_lines=2)
        pending.append(go)

    def _rep_card(self, canvas, pending, view: View) -> None:
        cv2 = self.cv2
        x, y, w, h = REP
        n, total = view.reps_in_set, view.reps_per_set
        if total and total <= 15:
            step = min(30, (w - 56) / max(total, 1))
            for i in range(total):
                cx, cy = int(x + 28 + step * i + 9), y + h - 28
                if i < n:
                    cv2.circle(canvas, (cx, cy), 9, T.GREEN, -1, cv2.LINE_AA)
                else:
                    cv2.circle(canvas, (cx, cy), 9, T.TRACK, -1, cv2.LINE_AA)
        elif total:
            bx0, bx1, by = x + 28, x + w - 28, y + h - 28
            cv2.line(canvas, (bx0, by), (bx1, by), T.TRACK, 14, cv2.LINE_AA)
            fill = bx0 + int((bx1 - bx0) * min(1.0, n / total))
            if fill > bx0:
                cv2.line(canvas, (bx0, by), (fill, by), T.GREEN, 14, cv2.LINE_AA)

        def go(img, d):
            draw_text(d, (x + 28, y + 38), f"Set {min(view.set_number, view.sets)} of {view.sets}", "medium", 22, T.INK2)
            num = str(n)
            draw_text(d, (x + 28, y + 160), num, "bold", 136, T.INK)
            wn = text_width(d, num, "bold", 136)
            draw_text(d, (x + 28 + wn + 16, y + 124), f"of {total}", "bold", 40, T.INK)
            draw_text(d, (x + 28 + wn + 16, y + 158), "reps", "medium", 26, T.INK2)
        pending.append(go)

    def _gauge(self, canvas, pending, view: View) -> None:
        cv2 = self.cv2
        x, y, w, h = GAUGE
        cx, cy, R, t = x + w // 2, y + 176, 122, 22

        def pt(v, r):
            a = math.radians(v)
            return (cx - r * math.cos(a), cy - r * math.sin(a))

        def arc(v0, v1, color, thick=t):
            v0, v1 = max(0.0, min(180.0, v0)), max(0.0, min(180.0, v1))
            if v1 - v0 > 0.2:
                cv2.ellipse(canvas, (cx, cy), (R, R), 0, 180 + v0, 180 + v1, color, thick, cv2.LINE_AA)

        arc(0, 180, T.TRACK)
        lo, hi = sorted((view.start_angle, view.target_angle))
        arc(lo, hi, T.BAND)
        ang = view.angle
        if ang is not None:
            reached = view.progress is not None and view.progress >= 0.9
            arc(min(view.start_angle, ang), max(view.start_angle, ang), T.GREEN if reached else T.BLUE)
        for v in range(0, 181, 30):
            p0, p1 = pt(v, R + t / 2 + 3), pt(v, R + t / 2 + 10)
            cv2.line(canvas, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), T.INK2, 2, cv2.LINE_AA)
        # the target: a brass wedge pointing at the ring, like the dial on the website
        tgt = max(0.0, min(180.0, view.target_angle))
        tip, b1, b2 = pt(tgt, R - t / 2 - 2), pt(tgt - 5.0, R + t / 2 + 14), pt(tgt + 5.0, R + t / 2 + 14)
        tri = np.array([tip, b1, b2], np.int32)
        cv2.fillConvexPoly(canvas, tri, T.BRASS, cv2.LINE_AA)
        if ang is not None:
            tip_n = pt(max(0.0, min(180.0, ang)), R - t / 2 - 8)
            cv2.line(canvas, (cx, cy), (int(tip_n[0]), int(tip_n[1])), T.INK, 7, cv2.LINE_AA)
        cv2.circle(canvas, (cx, cy), 12, T.INK, -1, cv2.LINE_AA)
        cv2.circle(canvas, (cx, cy), 5, T.CARD, -1, cv2.LINE_AA)

        def go(img, d):
            for v in range(0, 181, 30):
                px, py = pt(v, R + t / 2 + 31)
                draw_text(d, (px, py + 7), str(v), "regular", 16, T.INK2, "ms")
            label = "–" if ang is None else f"{ang:.0f}°"
            draw_text(d, (cx, cy + 58), label, "bold", 54, T.INK, "ms")
            draw_text(d, (cx, cy + 84), view.angle_label or "Angle", "medium", 20, T.INK2, "ms")
        pending.append(go)

    def _rest_timer(self, canvas, pending, view: View) -> None:
        cv2 = self.cv2
        x, y, w, h = GAUGE
        cx, cy, R = x + w // 2, y + 118, 84
        cv2.ellipse(canvas, (cx, cy), (R, R), 0, 0, 360, T.TRACK, 16, cv2.LINE_AA)
        frac = 0.0 if view.rest_total <= 0 else max(0.0, min(1.0, view.rest_remaining / view.rest_total))
        if frac > 0:
            cv2.ellipse(canvas, (cx, cy), (R, R), 0, -90, -90 + 360 * frac, T.TEAL, 16, cv2.LINE_AA)

        def go(img, d):
            secs = int(math.ceil(view.rest_remaining))
            draw_text(d, (cx, cy + 30), str(secs), "bold", 92, T.INK, "ms")
            draw_text(d, (cx, cy + 62), "seconds", "medium", 22, T.INK2, "ms")
            draw_text(d, (cx, y + h - 26), f"Next: set {min(view.set_number, view.sets)} of {view.sets}",
                      "medium", 24, T.INK, "ms")
        pending.append(go)

    def _last_rep(self, pending, view: View) -> None:
        x, y, w, h = LAST
        rep = view.last_rep

        def go(img, d):
            draw_text(d, (x + 28, y + 38), "Last rep", "medium", 22, T.INK2)
            if rep is None:
                draw_wrapped(d, x + 28, y + 80, "Your first rep will show here.", "regular", 26, T.INK, w - 56, 34, 2)
                return
            if not rep["counted"]:
                draw_text(d, (x + 28, y + 96), "Not counted", "bold", 40, T.BRASS)
                return
            form = rep["form_score"]
            color = T.GREEN_DK if form >= 85 else (160, 82, 0)
            f, r_ = f"{form:.0f}", f"{rep['rom_pct']:.0f}%"
            draw_text(d, (x + 28, y + 100), f, "bold", 52, color)
            draw_text(d, (x + 28 + text_width(d, f, "bold", 52) + 6, y + 100), "form", "medium", 22, T.INK2)
            draw_text(d, (x + 205, y + 100), r_, "bold", 52, T.INK)
            draw_text(d, (x + 205 + text_width(d, r_, "bold", 52) + 6, y + 100), "range", "medium", 22, T.INK2)
        pending.append(go)

    # ----------------------------------------------------------------- screens
    def _draw_exercise(self, canvas, view: View, pending) -> None:
        self._header_text(pending, view)
        scale, ox, oy = self._camera(canvas, view)
        self._skeleton(canvas, view, scale, ox, oy)
        self._coach_card(canvas, pending, view)
        self._rep_card(canvas, pending, view)
        self._gauge(canvas, pending, view)
        self._last_rep(pending, view)
        self._keys(pending, view, [("E", "Finish set"), ("N", "Next exercise"), ("F", "Full screen"),
                                   ("V", "Voice " + ("on" if view.voice_on else "off")), ("Q", "Stop")])

    def _draw_rest(self, canvas, view: View, pending) -> None:
        self._header_text(pending, view)
        self._camera(canvas, view, dim=0.35)
        self._coach_card(canvas, pending, view)
        self._rep_card(canvas, pending, view)
        self._rest_timer(canvas, pending, view)
        self._last_rep(pending, view)
        self._keys(pending, view, [("Space", "Skip rest"), ("N", "Next exercise"), ("F", "Full screen"),
                                   ("V", "Voice " + ("on" if view.voice_on else "off")), ("Q", "Stop")])

    def _draw_intro(self, canvas, view: View, pending) -> None:
        cv2 = self.cv2
        self._header_text(pending, view)
        scale, ox, oy = self._camera(canvas, view, dim=0.55 if view.countdown else 0.0)
        self._skeleton(canvas, view, scale, ox, oy)
        self._coach_card(canvas, pending, view)
        x, y, w, h = SIDE_FULL
        cx0, cy0, cw, ch = CAM
        ok_color = T.GREEN if view.position_ok else T.BRASS
        cv2.circle(canvas, (cx0 + 40, cy0 + 40), 14, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(canvas, (cx0 + 40, cy0 + 40), 10, ok_color, -1, cv2.LINE_AA)

        def go(img, d):
            if view.countdown:
                draw_text(d, (cx0 + cw / 2, cy0 + ch / 2 + 105), str(view.countdown), "bold", 300, (255, 255, 255), "ms")
            draw_text(d, (cx0 + 64, cy0 + 47), "I can see you" if view.position_ok else "Looking for you", "medium", 22, (255, 255, 255))
            draw_text(d, (x + 32, y + 56), "How to do it", "bold", 30, T.INK)
            end = draw_wrapped(d, x + 32, y + 108, view.description, "regular", 28, T.INK, w - 64, 40, 4)
            draw_text(d, (x + 32, end + 78), "Getting ready", "bold", 30, T.INK)
            end = draw_wrapped(d, x + 32, end + 130, view.setup, "regular", 26, T.INK, w - 64, 37, 6)
            draw_wrapped(d, x + 32, y + h - 62, "Starts by itself when you are in position.", "medium", 22, T.BLUE, w - 64, 30, 2)
        pending.append(go)
        self._keys(pending, view, [("Space", "Start now"), ("N", "Skip this exercise"), ("F", "Full screen"),
                                   ("V", "Voice " + ("on" if view.voice_on else "off")), ("Q", "Stop")])

    def _draw_checkin(self, canvas, view: View, pending) -> None:
        cv2 = self.cv2
        self._header_text(pending, view)
        x0, y0 = 92, 330
        tile_w, gap, tile_h = 92, 9, 150
        for i in range(11):
            tx = x0 + i * (tile_w + gap)
            if view.palette == "pain":
                col = (_mix(T.GREEN, (226, 170, 30), i / 3) if i <= 3 else _mix((226, 170, 30), (222, 108, 46), (i - 3) / 3) if i <= 6
                       else _mix((222, 108, 46), T.RED, (i - 6) / 4))
            else:
                col = _mix((170, 206, 232), (12, 70, 128), i / 10)
            sel = view.selected == i
            if sel:
                _rrect(cv2, canvas, tx - 6, y0 - 10, tile_w + 12, tile_h + 20, 18, T.INK)
            _rrect(cv2, canvas, tx, y0, tile_w, tile_h, 14, col)
        bar_w = int(1036 * max(0.0, min(1.0, view.seconds_left / max(view.seconds_total, 1e-6))))
        _rrect(cv2, canvas, 92, 676, 1036, 10, 5, T.TRACK)
        if bar_w > 10:
            _rrect(cv2, canvas, 92, 676, bar_w, 10, 5, T.BLUE)

        def go(img, d):
            draw_text(d, (T.W / 2, 178), f"{view.exercise_name} done. Well done!", "medium", 30, T.GREEN_DK, "ms")
            size = fit_size(d, view.question, "bold", 1040, 60, 36)
            draw_text(d, (T.W / 2, 262), view.question, "bold", size, T.INK, "ms")
            for i in range(11):
                tx = x0 + i * (tile_w + gap)
                light = view.palette == "effort" and i < 4
                draw_text(d, (tx + tile_w / 2, y0 + tile_h / 2 + 22), str(i), "bold", 58,
                          T.INK if light else (255, 255, 255), "ms")
            draw_text(d, (x0, y0 + tile_h + 44), view.low_label, "medium", 26, T.INK2)
            draw_text(d, (x0 + 11 * tile_w + 10 * gap, y0 + tile_h + 44), view.high_label, "medium", 26, T.INK2, "rs")
            draw_text(d, (T.W / 2, 596), "Press a number key, 0 to 9. Press T for 10.", "bold", 30, T.INK, "ms")
            draw_text(d, (T.W / 2, 640), "Press Space to skip this question.", "regular", 24, T.INK2, "ms")
        pending.append(go)
        self._keys(pending, view, [("0-9", "Your answer"), ("T", "Ten"), ("Space", "Skip"), ("Q", "Stop")])

    def _draw_welcome(self, canvas, view: View, pending) -> None:
        cv2 = self.cv2
        self._header_text(pending, view)
        logo = self._big_logo(300)
        items = view.items[:6]
        for i in range(len(items)):
            cy = 330 + i * 66
            cv2.circle(canvas, (482, cy - 10), 22, T.BLUE, -1, cv2.LINE_AA)
        _rrect(cv2, canvas, 450, 624, 730, 64, 32, T.BLUE)

        def go(img, d):
            img.paste(logo, (96, 112 + 110), logo)
            draw_text(d, (450, 192), view.greeting or "Welcome", "bold", 46, T.INK)
            draw_text(d, (450, 246), "Today's exercises" if items else "Nothing planned for today", "medium", 28, T.INK2)
            for i, (name, detail) in enumerate(items):
                cy = 330 + i * 66
                draw_text(d, (482, cy - 10 + 1), str(i + 1), "bold", 24, (255, 255, 255), "mm")
                size = fit_size(d, name, "bold", 440, 30, 22)
                draw_text(d, (522, cy), name, "bold", size, T.INK)
                draw_text(d, (1180, cy), detail, "regular", 24, T.INK2, "rs")
            if len(view.items) > 6:
                draw_text(d, (522, 330 + 6 * 66 - 30), f"and {len(view.items) - 6} more", "regular", 24, T.INK2)
            draw_text(d, (815, 657), view.footer or "Press SPACE to start", "bold", 30, (255, 255, 255), "mm")
            draw_text(d, (815, 714), "Stand 2 to 3 metres from the screen with room around you.", "regular", 22, T.INK2, "ms")
        pending.append(go)
        self._keys(pending, view, [("Space", "Start"), ("F", "Full screen"), ("V", "Voice " + ("on" if view.voice_on else "off")),
                                   ("Q", "Quit")])

    def _draw_summary(self, canvas, view: View, pending) -> None:
        cv2 = self.cv2
        self._header_text(pending, view)
        logo = self._big_logo(300)
        items = view.items[:6]
        cv2.circle(canvas, (484, 205), 34, T.GREEN, -1, cv2.LINE_AA)
        pts = np.array([(468, 206), (480, 219), (503, 191)], np.int32)
        cv2.polylines(canvas, [pts], False, (255, 255, 255), 8, cv2.LINE_AA)
        _rrect(cv2, canvas, 450, 624, 730, 64, 32, T.BLUE)

        def go(img, d):
            img.paste(logo, (96, 112 + 110), logo)
            draw_text(d, (540, 222), view.greeting or "Well done!", "bold", 56, T.INK)
            for i, (name, detail) in enumerate(items):
                cy = 330 + i * 60
                draw_text(d, (450, cy), name, "bold", fit_size(d, name, "bold", 470, 30, 22), T.INK)
                draw_text(d, (1180, cy), detail, "regular", 24, T.INK2, "rs")
                d.line((450, cy + 22, 1180, cy + 22), fill=T.LINE, width=2)
            draw_text(d, (815, 657), view.footer or "Press any key to finish", "bold", 30, (255, 255, 255), "mm")
        pending.append(go)
        self._keys(pending, view, [("Any key", "Finish and save")])
