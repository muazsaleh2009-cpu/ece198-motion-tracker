"""The camera screens: a View (what to show) is drawn by the Renderer (numpy + Pillow + OpenCV)."""

from .view import View

__all__ = ["View", "Renderer"]


def __getattr__(name):           # Renderer pulls in numpy / Pillow, so import it only when asked for
    if name == "Renderer":
        from .renderer import Renderer
        return Renderer
    raise AttributeError(name)
