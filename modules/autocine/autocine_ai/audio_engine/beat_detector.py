"""
Beat and downbeat timing detector.
Aligns cuts to musical intervals (single-beat, half-beat, bar-level).
"""

from typing import List, Dict, Any

class BeatDetector:
    @staticmethod
    def estimate_beats(bpm: float, duration: float, first_beat_offset: float = 0.1) -> List[float]:
        """Generates continuous beat grid timestamps based on tempo and phase offset."""
        if bpm <= 0 or duration <= 0:
            return []
        seconds_per_beat = 60.0 / bpm
        beats: List[float] = []
        curr = first_beat_offset
        while curr < duration:
            beats.append(round(curr, 3))
            curr += seconds_per_beat
        return beats

    @staticmethod
    def filter_downbeats(beats: List[float], time_signature: int = 4) -> List[float]:
        """Returns timestamps of bar downbeats (1st beat of each measure)."""
        return [b for i, b in enumerate(beats) if i % time_signature == 0]
