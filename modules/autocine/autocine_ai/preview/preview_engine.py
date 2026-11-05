"""
Real-time Preview Engine.
Calculates playhead clip position, Ken Burns interpolation, and transition opacity at time t.
"""

from typing import List, Dict, Any, Optional

class PreviewEngine:
    @staticmethod
    def get_frame_state_at_time(
        timeline_clips: List[Dict[str, Any]],
        current_time_s: float
    ) -> Optional[Dict[str, Any]]:
        """Finds active clip and calculates interpolation progress [0.0 - 1.0]."""
        if not timeline_clips:
            return None

        for idx, clip in enumerate(timeline_clips):
            start = clip.get("start_time", 0.0)
            end = clip.get("end_time", start + clip.get("duration", 3.0))

            if start <= current_time_s < end:
                duration = max(0.1, end - start)
                local_t = current_time_s - start
                progress = min(1.0, max(0.0, local_t / duration))

                # Interpolate Ken Burns
                motion = clip.get("motion", {})
                m_start = motion.get("start", {"scale": 1.0, "x": 0.5, "y": 0.5})
                m_end = motion.get("end", {"scale": 1.1, "x": 0.5, "y": 0.5})

                curr_scale = m_start["scale"] + (m_end["scale"] - m_start["scale"]) * progress
                curr_x = m_start["x"] + (m_end["x"] - m_start["x"]) * progress
                curr_y = m_start["y"] + (m_end["y"] - m_start["y"]) * progress

                # Transition blend state
                trans = clip.get("transition", {})
                trans_dur = trans.get("duration", 0.0)
                in_transition = local_t < trans_dur
                trans_progress = (local_t / trans_dur) if in_transition and trans_dur > 0 else 1.0

                return {
                    "clip_index": idx,
                    "clip_id": clip.get("id"),
                    "source_image": clip.get("source_image"),
                    "filename": clip.get("filename"),
                    "section": clip.get("section"),
                    "shot_type": clip.get("shot_type"),
                    "progress": round(progress, 3),
                    "camera": {
                        "scale": round(curr_scale, 4),
                        "center_x": round(curr_x, 4),
                        "center_y": round(curr_y, 4)
                    },
                    "transition": {
                        "type": trans.get("type", "CUT"),
                        "active": in_transition,
                        "progress": round(trans_progress, 3)
                    }
                }

        return None
