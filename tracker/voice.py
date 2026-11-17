"""Optional spoken prompts. Off unless asked for (--voice, or the V key in the window).

Uses the macOS `say` command, so it needs no extra install. On other systems it falls back to `espeak`
if that is installed, otherwise it stays silent. The coach decides WHAT to say (tracker/coach.py); this
only decides when it is worth saying: never the same sentence twice in a row, never overlapping speech
(the newest message wins), and never when it is turned off.
"""

import shutil
import subprocess
import sys
import time
from typing import Callable, List, Optional

REPEAT_AFTER_S = 4.0         # the same sentence is not repeated sooner than this


def _default_command(rate: int) -> Optional[List[str]]:
    if sys.platform == "darwin" and shutil.which("say"):
        return ["say", "-r", str(rate)]
    if shutil.which("espeak"):
        return ["espeak", "-s", str(rate)]
    return None


class Voice:
    def __init__(self, enabled: bool = False, rate: int = 175, command: Optional[List[str]] = None,
                 popen: Callable = subprocess.Popen, clock: Callable[[], float] = time.monotonic):
        self.command = command if command is not None else _default_command(rate)
        self.enabled = bool(enabled) and self.command is not None
        self.unavailable = self.command is None
        self._popen, self._clock = popen, clock
        self._proc = None
        self._last: Optional[str] = None
        self._spoken_at = -1e9

    def toggle(self) -> bool:
        """Turn the voice on or off. Returns the new state (stays off if this computer has no speech command)."""
        self.enabled = (not self.enabled) and not self.unavailable
        if not self.enabled:
            self.stop()
        return self.enabled

    def say(self, text: Optional[str]) -> None:
        """Offer the current message. Call it every frame: it only speaks when the sentence changes."""
        previous, self._last = self._last, text
        if not text or text == previous or not self.enabled:
            return
        now = self._clock()
        if now - self._spoken_at < REPEAT_AFTER_S and text == getattr(self, "_last_spoken", None):
            return
        self.stop()
        try:
            self._proc = self._popen(self.command + [text], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            self.enabled, self.unavailable = False, True
            return
        self._last_spoken, self._spoken_at = text, now

    def stop(self) -> None:
        proc, self._proc = self._proc, None
        if proc is not None and proc.poll() is None:
            proc.terminate()
