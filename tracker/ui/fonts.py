"""Poppins loading and text helpers (Pillow). Fonts ship with the package, so the screen looks the same everywhere."""

from functools import lru_cache
from typing import List, Tuple

from PIL import ImageFont

from .theme import ASSETS, FONT_FILES


@lru_cache(maxsize=256)
def font(weight: str, size: int):
    path = ASSETS / "fonts" / FONT_FILES[weight]
    try:
        return ImageFont.truetype(str(path), int(size))
    except OSError:                      # the font files are missing: Pillow's built-in font still draws something
        return ImageFont.load_default()


def text_width(draw, text: str, weight: str, size: int) -> float:
    return draw.textlength(text, font=font(weight, size))


def fit_size(draw, text: str, weight: str, max_width: float, size_max: int, size_min: int = 18) -> int:
    """Largest font size (between the limits) at which `text` fits in `max_width`."""
    size = size_max
    while size > size_min and text_width(draw, text, weight, size) > max_width:
        size -= 2
    return size


def wrap(draw, text: str, weight: str, size: int, max_width: float) -> List[str]:
    """Greedy word wrap."""
    lines, line = [], ""
    for word in text.split():
        trial = word if not line else f"{line} {word}"
        if text_width(draw, trial, weight, size) <= max_width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_text(draw, xy: Tuple[float, float], text: str, weight: str, size: int, fill, anchor: str = "ls") -> None:
    """Baseline-anchored by default ('ls' = left, baseline), so rows of different sizes line up."""
    draw.text(xy, text, font=font(weight, size), fill=fill, anchor=anchor)


def draw_wrapped(draw, x: float, baseline: float, text: str, weight: str, size: int, fill,
                 max_width: float, line_height: float, max_lines: int = 3) -> float:
    """Draw wrapped text; returns the baseline of the last line. Shrinks the text if it would need too many lines."""
    s = size
    lines = wrap(draw, text, weight, s, max_width)
    while len(lines) > max_lines and s > 18:
        s -= 2
        lines = wrap(draw, text, weight, s, max_width)
        line_height = line_height * s / (s + 2)
    for i, line in enumerate(lines[:max_lines]):
        draw_text(draw, (x, baseline + i * line_height), line, weight, s, fill)
    return baseline + (min(len(lines), max_lines) - 1) * line_height
