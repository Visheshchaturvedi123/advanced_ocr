"""
Transition Engine.
Assigns transitions intelligently (CUT, CROSSFADE, FADE, DIP TO BLACK, DIP TO WHITE, SLIDE, SUBTLE ZOOM).
Avoids repetitive transitions between every photograph.
"""

from typing import Dict, Any

class TransitionEngine:
    @staticmethod
    def select_transition(
        clip_index: int,
        section_name: str,
        style: Dict[str, Any],
        is_downbeat: bool
    ) -> Dict[str, Any]:
        """Chooses an optimal transition between adjacent clips."""
        preferred = style.get("preferred_transitions", ["CROSSFADE", "CUT"])
        base_duration = style.get("transition_duration", 0.6)

        # Intro and Outro favor fade or dip to black
        if section_name == "OUTRO":
            return {"type": "DIP TO BLACK", "duration": 1.2}
        if clip_index == 0:
            return {"type": "FADE", "duration": 0.8}

        # Climax or High Energy favors hard cuts or rapid zooms
        if section_name in ("CLIMAX", "HIGH_ENERGY"):
            if is_downbeat and "SUBTLE ZOOM" in preferred:
                return {"type": "SUBTLE ZOOM", "duration": 0.25}
            return {"type": "CUT", "duration": 0.0}

        # Breakdown favors dips
        if section_name == "BREAKDOWN":
            return {"type": "DIP TO BLACK", "duration": 0.8}

        # Alternating selection
        t_type = preferred[clip_index % len(preferred)]
        t_dur = 0.0 if t_type == "CUT" else base_duration

        return {
            "type": t_type,
            "duration": t_dur
        }
