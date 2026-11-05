"""
FFmpeg Filter Graph Builder.
Generates zoompan Ken Burns expressions, scaling, padding, and crossfade graph syntax.
"""

from typing import List, Dict, Any

class FilterGraphBuilder:
    @staticmethod
    def build_zoompan_filter(
        motion: Dict[str, Any],
        duration_s: float,
        fps: int = 30,
        out_w: int = 1920,
        out_h: int = 1080
    ) -> str:
        """
        Creates an FFmpeg zoompan filter string for smooth camera motion.
        """
        total_frames = max(1, int(duration_s * fps))
        m_type = motion.get("type", "ZOOM_IN")
        z_factor = motion.get("zoom_factor", 1.12)

        if m_type == "ZOOM_IN":
            z_expr = f"min(zoom+0.0015,{z_factor})"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif m_type == "ZOOM_OUT":
            z_expr = f"if(lte(on,-1),{z_factor},max(1.0,zoom-0.0015))"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif m_type == "PAN_LEFT":
            z_expr = "1.08"
            x_expr = f"max(0,(1-on/{total_frames})*(iw-iw/zoom))"
            y_expr = "ih/2-(ih/zoom/2)"
        elif m_type == "PAN_RIGHT":
            z_expr = "1.08"
            x_expr = f"min(iw-iw/zoom,(on/{total_frames})*(iw-iw/zoom))"
            y_expr = "ih/2-(ih/zoom/2)"
        else:
            z_expr = f"min(zoom+0.001,{z_factor})"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = "ih/2-(ih/zoom/2)"

        return f"zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}':d={total_frames}:s={out_w}x{out_h}:fps={fps}"

    @classmethod
    def build_timeline_filter_complex(
        cls,
        clips: List[Dict[str, Any]],
        out_w: int = 1920,
        out_h: int = 1080,
        fps: int = 30
    ) -> str:
        """
        Builds a complete multi-input filter_complex chaining all photo clips.
        """
        filter_parts = []
        n_clips = len(clips)

        for i, clip in enumerate(clips):
            dur = clip.get("duration", 3.0)
            motion = clip.get("motion", {})
            zp = cls.build_zoompan_filter(motion, dur, fps, out_w, out_h)
            # Scale and set sar to 1/1 to prevent distortion
            part = f"[{i}:v]scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},{zp},setsar=1[v{i}]"
            filter_parts.append(part)

        # Concat all streams sequentially
        concat_inputs = "".join([f"[v{i}]" for i in range(n_clips)])
        concat_filter = f"{concat_inputs}concat=n={n_clips}:v=1:a=0[vout]"
        filter_parts.append(concat_filter)

        return ";".join(filter_parts)
