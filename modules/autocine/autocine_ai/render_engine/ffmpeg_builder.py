"""
FFmpeg Command Builder.
Assembles complete CLI commands matching exact quality presets and multi-input filter complex.
"""

import os
from typing import List, Dict, Any, Tuple
from .filter_graph import FilterGraphBuilder

CRF_PRESETS = {
    "MASTER": {"crf": "14", "preset": "slow"},
    "VERY_HIGH": {"crf": "15", "preset": "medium"},
    "HIGH": {"crf": "16", "preset": "faster"},
    "FAST": {"crf": "18", "preset": "veryfast"}
}

RESOLUTION_MAP = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350)
}

class FFmpegBuilder:
    @classmethod
    def build_render_command(
        cls,
        ffmpeg_bin: str,
        clips: List[Dict[str, Any]],
        audio_path: str,
        output_path: str,
        aspect_ratio: str = "16:9",
        quality_preset: str = "HIGH",
        fps: int = 30,
        threads: int = 0
    ) -> List[str]:
        """Assembles CLI invocation arguments for FFmpeg."""
        out_w, out_h = RESOLUTION_MAP.get(aspect_ratio, (1920, 1080))
        q_settings = CRF_PRESETS.get(quality_preset, CRF_PRESETS["HIGH"])
        total_duration = sum(c.get("duration", 3.0) for c in clips)

        cmd = [ffmpeg_bin, "-y"]

        # Add image inputs
        for clip in clips:
            img_path = clip.get("source_image", "")
            # -loop 1 with -t duration
            cmd.extend(["-loop", "1", "-t", str(clip.get("duration", 3.0)), "-i", img_path])

        # Add audio input if exists
        has_audio = audio_path and os.path.exists(audio_path)
        if has_audio:
            cmd.extend(["-i", audio_path])

        # Build filter complex
        filter_complex = FilterGraphBuilder.build_timeline_filter_complex(
            clips, out_w=out_w, out_h=out_h, fps=fps
        )
        cmd.extend(["-filter_complex", filter_complex])

        # Map video
        cmd.extend(["-map", "[vout]"])

        # Map audio if provided, else generate silent audio or omit
        if has_audio:
            audio_idx = len(clips)
            cmd.extend(["-map", f"{audio_idx}:a", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest"])
        else:
            cmd.extend(["-an"])

        # Video encoding settings
        cmd.extend([
            "-c:v", "libx264",
            "-crf", q_settings["crf"],
            "-preset", q_settings["preset"],
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-t", str(round(total_duration, 2))
        ])

        if threads > 0:
            cmd.extend(["-threads", str(threads)])

        cmd.append(output_path)
        return cmd
