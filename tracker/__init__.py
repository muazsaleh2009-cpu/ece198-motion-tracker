"""TherapyPal motion tracker: camera -> joint angles -> reps -> session JSON."""

__version__ = "1.1.0"

# Version of the plan.json / session.json formats (see docs/DATA_CONTRACT.md).
# MAJOR: a change the website would have to adapt to.  MINOR: a new optional field (old readers still work).
# 1.1 added the optional block field "patient_report" (pain and effort check-in).
SCHEMA_VERSION = "1.1"
