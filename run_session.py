#!/usr/bin/env python3
"""Shortcut for `python -m tracker` (kept so the documented command still works)."""

import sys

from tracker.cli import main

if __name__ == "__main__":
    sys.exit(main())
