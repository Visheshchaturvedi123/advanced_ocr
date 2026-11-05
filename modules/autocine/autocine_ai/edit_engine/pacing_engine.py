"""
Section-Aware Pacing Engine.
Adapts visual pacing to music:
  - INTRO: longer photographs, soft transitions, subtle motion
  - BUILD: medium pacing, increasing motion
  - HIGH ENERGY: shorter durations, strong beat alignment
  - CLIMAX: best photographs, higher pacing, rapid rhythm
  - OUTRO: longer final image, slow movement, fade
"""

from typing import List, Dict, Any

class PacingEngine:
    @staticmethod
    def get_section_pacing_factor(section_name: str) -> float:
        """Multiplier for photo duration based on musical section."""
        mapping = {
            "INTRO": 1.4,
            "BUILD": 1.0,
            "LOW_ENERGY": 1.3,
            "HIGH_ENERGY": 0.65,
            "CLIMAX": 0.50,
            "BREAKDOWN": 1.2,
            "OUTRO": 1.6
        }
        return mapping.get(section_name, 1.0)
