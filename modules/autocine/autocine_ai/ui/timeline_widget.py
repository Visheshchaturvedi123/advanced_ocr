"""
Timeline Widget Controller for AutoCine AI Editor.
"""

from typing import List, Dict, Any, Optional

class TimelineWidgetController:
    def __init__(self):
        self.zoom_level: float = 1.0
        self.selected_clip_id: Optional[str] = None

    def zoom_in(self) -> float:
        self.zoom_level = min(5.0, self.zoom_level * 1.25)
        return self.zoom_level

    def zoom_out(self) -> float:
        self.zoom_level = max(0.2, self.zoom_level / 1.25)
        return self.zoom_level
