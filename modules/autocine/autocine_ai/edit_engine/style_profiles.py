"""
Style Profiles for AutoCine AI Editor.
Preconfigured editing aesthetics controlling timing, transitions, and pacing.
"""

from typing import Dict, Any

STYLE_PROFILES: Dict[str, Dict[str, Any]] = {
    "CINEMATIC": {
        "name": "CINEMATIC",
        "description": "Slow, deliberate pacing with subtle pans, slow zoom-ins, and soft crossfades on musical bars.",
        "min_duration": 3.0,
        "max_duration": 6.0,
        "preferred_transitions": ["CROSSFADE", "FADE", "CUT"],
        "transition_duration": 0.8,
        "motion_intensity": "SUBTLE",
        "beat_strategy": "BAR_LEVEL",  # 4 beats
        "diversity_weight": 0.85
    },
    "WEDDING": {
        "name": "WEDDING",
        "description": "Romantic, graceful rhythm with gentle zooms, soft glows, and downbeat crossfades.",
        "min_duration": 3.5,
        "max_duration": 5.5,
        "preferred_transitions": ["CROSSFADE", "DIP TO WHITE"],
        "transition_duration": 1.0,
        "motion_intensity": "GENTLE",
        "beat_strategy": "DOWNBEAT_PRIORITY",
        "diversity_weight": 0.80
    },
    "TRAVEL": {
        "name": "TRAVEL",
        "description": "Dynamic medium pacing with slide transitions and directional pans mimicking movement.",
        "min_duration": 2.0,
        "max_duration": 4.0,
        "preferred_transitions": ["CROSSFADE", "SLIDE", "CUT"],
        "transition_duration": 0.5,
        "motion_intensity": "MODERATE",
        "beat_strategy": "DOUBLE_BEAT",
        "diversity_weight": 0.90
    },
    "MEMORIES": {
        "name": "MEMORIES",
        "description": "Nostalgic, warm flow emphasizing portraits, details, and subtle fade to black.",
        "min_duration": 3.0,
        "max_duration": 5.0,
        "preferred_transitions": ["CROSSFADE", "DIP TO BLACK", "FADE"],
        "transition_duration": 0.9,
        "motion_intensity": "SUBTLE",
        "beat_strategy": "BAR_LEVEL",
        "diversity_weight": 0.75
    },
    "BEAT": {
        "name": "BEAT",
        "description": "Fast-paced rhythm tightly locked to drums and high energy musical beats.",
        "min_duration": 1.0,
        "max_duration": 2.5,
        "preferred_transitions": ["CUT", "SUBTLE ZOOM"],
        "transition_duration": 0.2,
        "motion_intensity": "DYNAMIC",
        "beat_strategy": "SINGLE_BEAT",
        "diversity_weight": 0.70
    },
    "SOCIAL": {
        "name": "SOCIAL",
        "description": "Snappy, attention-grabbing cuts optimized for vertical formats and short attention spans.",
        "min_duration": 1.5,
        "max_duration": 3.0,
        "preferred_transitions": ["CUT", "SLIDE", "CROSSFADE"],
        "transition_duration": 0.35,
        "motion_intensity": "DYNAMIC",
        "beat_strategy": "HALF_BEAT",
        "diversity_weight": 0.80
    },
    "CORPORATE": {
        "name": "CORPORATE",
        "description": "Clean, polished sequence with steady pans and minimal distraction.",
        "min_duration": 3.0,
        "max_duration": 5.0,
        "preferred_transitions": ["CUT", "CROSSFADE"],
        "transition_duration": 0.5,
        "motion_intensity": "MINIMAL",
        "beat_strategy": "BAR_LEVEL",
        "diversity_weight": 0.80
    }
}
