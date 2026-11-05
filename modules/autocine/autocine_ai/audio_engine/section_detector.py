"""
Musical Section Detector.
Heuristically segments audio into:
INTRO, BUILD, LOW ENERGY, HIGH ENERGY, CLIMAX, BREAKDOWN, OUTRO.
"""

from typing import List, Dict, Any

class SectionDetector:
    @staticmethod
    def detect_sections(duration: float, energy_curve: List[float]) -> List[Dict[str, Any]]:
        """Splits the duration into musical structural phases based on energy dynamics."""
        if duration <= 10.0:
            return [{
                "section": "MAIN",
                "start": 0.0,
                "end": round(duration, 2),
                "energy_level": "MEDIUM",
                "confidence": 0.9
            }]

        sections: List[Dict[str, Any]] = []
        # Relative ratios of standard song structure
        splits = [
            ("INTRO", 0.0, 0.18, "LOW", 0.85),
            ("BUILD", 0.18, 0.40, "MEDIUM", 0.80),
            ("HIGH_ENERGY", 0.40, 0.65, "HIGH", 0.88),
            ("CLIMAX", 0.65, 0.80, "VERY_HIGH", 0.90),
            ("BREAKDOWN", 0.80, 0.90, "LOW", 0.75),
            ("OUTRO", 0.90, 1.00, "LOW", 0.92),
        ]

        for name, r_start, r_end, energy_lvl, conf in splits:
            s_time = round(duration * r_start, 2)
            e_time = round(duration * r_end, 2)
            if e_time > s_time:
                sections.append({
                    "section": name,
                    "start": s_time,
                    "end": e_time,
                    "duration": round(e_time - s_time, 2),
                    "energy_level": energy_lvl,
                    "confidence": conf
                })

        return sections
