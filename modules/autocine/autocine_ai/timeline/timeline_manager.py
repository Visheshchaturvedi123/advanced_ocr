"""
Timeline State Manager.
Provides mutation methods for clip reordering, duration trimming, and transitions.
"""

from typing import List, Dict, Any, Optional

class TimelineManager:
    def __init__(self, clips: Optional[List[Dict[str, Any]]] = None):
        self.clips: List[Dict[str, Any]] = clips or []

    def set_clips(self, clips: List[Dict[str, Any]]) -> None:
        self.clips = clips
        self._recalc_timestamps()

    def remove_clip(self, clip_id: str) -> None:
        self.clips = [c for c in self.clips if c.get("id") != clip_id]
        self._recalc_timestamps()

    def move_clip(self, from_idx: int, to_idx: int) -> None:
        if 0 <= from_idx < len(self.clips) and 0 <= to_idx < len(self.clips):
            item = self.clips.pop(from_idx)
            self.clips.insert(to_idx, item)
            self._recalc_timestamps()

    def update_clip_duration(self, clip_id: str, new_duration: float) -> None:
        for c in self.clips:
            if c.get("id") == clip_id:
                c["duration"] = max(0.2, round(new_duration, 2))
                break
        self._recalc_timestamps()

    def _recalc_timestamps(self) -> None:
        current_time = 0.0
        for i, c in enumerate(self.clips):
            c["position"] = i
            c["start_time"] = round(current_time, 2)
            c["end_time"] = round(current_time + c["duration"], 2)
            current_time += c["duration"]

    @property
    def total_duration(self) -> float:
        return sum(c.get("duration", 0.0) for c in self.clips)
