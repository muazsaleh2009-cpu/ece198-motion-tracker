#!/usr/bin/env python3
"""Write the exercise catalog the website uses, so the two can never disagree.

    python tools/export_catalog.py ../web/src/data/exerciseCatalog.json
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tracker import SCHEMA_VERSION  # noqa: E402
from tracker.exercises import catalog  # noqa: E402


def main(argv=None) -> int:
    out = (argv or sys.argv[1:] or ["exercise_catalog.json"])[0]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"schema_version": SCHEMA_VERSION, "exercises": catalog()}, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(catalog())} exercises to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
