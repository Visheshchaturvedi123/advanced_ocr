"""
Timeline Data Models for AutoCine AI Editor.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Transition:
    type: str = "CUT"
    duration: float = 0.0

@dataclass
class MotionVector:
    type: str = "ZOOM_IN"
    zoom_factor: float = 1.1
    start: Dict[str, float] = field(default_factory=lambda: {"scale": 1.0, "x": 0.5, "y": 0.5})
    end: Dict[str, float] = field(default_factory=lambda: {"scale": 1.1, "x": 0.5, "y": 0.5})

@dataclass
class TimelineClip:
    id: str
    source_path: str
    filename: str
    start_time: float
    duration: float
    section: str
    shot_type: str
    score: float
    transition: Transition
    motion: MotionVector
    crop: Dict[str, Any]

@dataclass
class TimelineState:
    clips: List[TimelineClip] = field(default_factory=list)
    total_duration: float = 0.0
    audio_path: str = ""
    aspect_ratio: str = "16:9"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
