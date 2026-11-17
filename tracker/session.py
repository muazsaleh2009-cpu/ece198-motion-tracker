"""SessionRecorder: collects blocks into one session.json the website can import."""

import json
import os
import re
import uuid
from datetime import datetime
from typing import List, Optional

from . import SCHEMA_VERSION, __version__


class SessionRecorder:
    def __init__(self, patient_id: Optional[str] = None, plan_id: Optional[str] = None,
                 started_at: Optional[datetime] = None, camera_index: Optional[int] = None,
                 frame_size: Optional[tuple] = None, pose_model: str = "mediapipe-pose-landmarker"):
        self.started_at = started_at or datetime.now().astimezone()
        self.patient_id = patient_id
        self.plan_id = plan_id
        self.session_id = f"{self.started_at.strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:6]}"
        self.device = {
            "tracker": "therapypal-tracker",
            "tracker_version": __version__,
            "pose_model": pose_model,
            "camera_index": camera_index,
            "frame_size": list(frame_size) if frame_size else None,
        }
        self.blocks: List[dict] = []
        self.ended_at: Optional[datetime] = None

    def add_block(self, block: dict) -> None:
        self.blocks.append(block)

    def to_dict(self) -> dict:
        ended = self.ended_at or datetime.now().astimezone()
        return {
            "schema_version": SCHEMA_VERSION,
            "session_id": self.session_id,
            "patient_id": self.patient_id,
            "plan_id": self.plan_id,
            "started_at": self.started_at.isoformat(timespec="seconds"),
            "ended_at": ended.isoformat(timespec="seconds"),
            "duration_s": round((ended - self.started_at).total_seconds(), 1),
            "device": self.device,
            "blocks": self.blocks,
        }

    def save(self, directory: str) -> str:
        """Write the session atomically and return the file path."""
        os.makedirs(directory, exist_ok=True)
        who = re.sub(r"[^A-Za-z0-9_-]+", "", self.patient_id or "patient") or "patient"
        name = f"session_{self.started_at.strftime('%Y-%m-%d_%H%M%S')}_{who}.json"
        path = os.path.join(directory, name)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
        return path
