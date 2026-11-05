"""
Preview and Playback Controller for AutoCine AI Editor.
"""

from typing import Optional, Dict, Any

class PreviewPanelController:
    def __init__(self):
        self.is_playing: bool = False
        self.current_time_s: float = 0.0
        self.active_frame_state: Optional[Dict[str, Any]] = None

    def seek(self, time_s: float) -> None:
        self.current_time_s = max(0.0, time_s)

    def toggle_play(self) -> bool:
        self.is_playing = not self.is_playing
        return self.is_playing
