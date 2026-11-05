"""
Central Edit Planner.
Produces a deterministic Edit Decision List (EDL) synchronized to musical sections and beats.
"""

from typing import List, Dict, Any

from .style_profiles import STYLE_PROFILES
from .sequence_optimizer import SequenceOptimizer
from .pacing_engine import PacingEngine
from .beat_sync import BeatSync
from .motion_engine import MotionEngine
from .crop_engine import CropEngine
from .transition_engine import TransitionEngine

class EditPlanner:
    @classmethod
    def create_edit_decision_list(
        cls,
        photos: List[Dict[str, Any]],
        music_analysis: Dict[str, Any],
        duplicate_clusters: List[List[int]],
        style_name: str = "CINEMATIC",
        aspect_ratio: str = "16:9",
        target_duration: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Compiles fully synchronized Edit Decision List."""
        if not photos:
            return []

        style = STYLE_PROFILES.get(style_name, STYLE_PROFILES["CINEMATIC"])
        total_duration = target_duration if target_duration > 0 else float(music_analysis.get("duration", 30.0))
        beats = music_analysis.get("beats", [])
        sections = music_analysis.get("sections", [])

        # Estimate needed clip count
        avg_clip_len = (style["min_duration"] + style["max_duration"]) / 2.0
        target_clip_count = max(3, int(total_duration / avg_clip_len))

        # 1. Optimize photo sequence for diversity & quality
        ordered_photos = SequenceOptimizer.optimize_sequence(
            photos, duplicate_clusters, target_clip_count, style_name
        )

        # 2. Partition timeline cuts aligned to musical beats
        actual_clip_count = len(ordered_photos)
        cut_points = BeatSync.partition_timeline_by_beats(
            total_duration, beats, actual_clip_count, style.get("beat_strategy", "BAR_LEVEL")
        )

        timeline_items: List[Dict[str, Any]] = []

        for i, photo in enumerate(ordered_photos):
            start_t = cut_points[i] if i < len(cut_points) else 0.0
            end_t = cut_points[i + 1] if (i + 1) < len(cut_points) else total_duration
            duration = max(0.5, round(end_t - start_t, 2))

            # Determine musical section at this timestamp
            mid_t = start_t + duration / 2.0
            current_section = "MAIN"
            for sec in sections:
                if sec["start"] <= mid_t <= sec["end"]:
                    current_section = sec["section"]
                    break

            # Motion & Framing
            motion = MotionEngine.assign_motion(i, photo, current_section, style)
            crop = CropEngine.calculate_crop_box(
                photo.get("width", 1920), photo.get("height", 1080), aspect_ratio, photo
            )

            # Transition
            is_downbeat = i % 4 == 0
            transition = TransitionEngine.select_transition(i, current_section, style, is_downbeat)

            item = {
                "id": f"clip_{i+1:03d}",
                "position": i,
                "source_image": photo.get("filepath", ""),
                "filename": photo.get("filename", ""),
                "start_time": round(start_t, 2),
                "duration": duration,
                "end_time": round(start_t + duration, 2),
                "section": current_section,
                "shot_type": photo.get("shot_type", "hero_image"),
                "importance_score": photo.get("score", 75.0),
                "transition": transition,
                "motion": motion,
                "crop": crop,
                "beat_aligned": len(beats) > 0
            }
            timeline_items.append(item)

        return timeline_items
