"""Colours, sizes and fonts of the camera screens. Colours are sampled from the TherapyPal logo."""

from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
FONT_FILES = {"regular": "Poppins-Regular.ttf", "medium": "Poppins-Medium.ttf", "bold": "Poppins-Bold.ttf"}

W, H = 1280, 800                      # the screen is drawn on this canvas; the window scales it

# --- palette (RGB) -----------------------------------------------------------------
BG = (238, 244, 240)                  # soft sage paper
CARD = (255, 255, 255)
LINE = (214, 226, 219)
INK = (19, 50, 66)                    # deep teal-navy: all main text
INK2 = (84, 108, 119)                 # secondary text (contrast 5.4 on white)
BLUE = (21, 111, 177)                 # logo blue
GREEN = (79, 157, 99)                 # logo green
GREEN_DK = (30, 110, 60)              # green text on tinted backgrounds
TEAL = (28, 131, 162)                 # logo teal
BRASS = (214, 150, 24)                # the target marker, same as the website dial
RED = (192, 57, 70)
CAMERA_BG = (16, 38, 48)
TRACK = (221, 231, 225)
BAND = (178, 209, 232)

# tone -> (tint behind the coach message, strong colour for its text and accent bar)
TONES = {
    "go": ((222, 236, 248), (14, 90, 150)),
    "good": ((222, 241, 228), GREEN_DK),
    "warn": ((253, 235, 211), (160, 82, 0)),
    "rest": ((220, 240, 244), (16, 102, 128)),
    "neutral": ((236, 241, 244), INK),
}

RADIUS = 22
