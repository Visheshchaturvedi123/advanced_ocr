"""
FFmpeg stdout/stderr progress parser.
Extracts current frame, fps, timecode, percentage, and estimated remaining time.
"""

import re
from typing import Dict, Any, Optional

class ProgressParser:
    TIME_REGEX = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
    FRAME_REGEX = re.compile(r"frame=\s*(\d+)")
    FPS_REGEX = re.compile(r"fps=\s*([\d\.]+)")

    @classmethod
    def parse_line(cls, line: str, total_duration: float) -> Optional[Dict[str, Any]]:
        time_match = cls.TIME_REGEX.search(line)
        if not time_match:
            return None

        hours = int(time_match.group(1))
        minutes = int(time_match.group(2))
        seconds = float(time_match.group(3))
        current_time_s = hours * 3600 + minutes * 60 + seconds

        percent = min(100.0, max(0.0, (current_time_s / max(0.1, total_duration)) * 100.0))

        fps = 0.0
        fps_match = cls.FPS_REGEX.search(line)
        if fps_match:
            try:
                fps = float(fps_match.group(1))
            except ValueError:
                pass

        frame = 0
        frame_match = cls.FRAME_REGEX.search(line)
        if frame_match:
            try:
                frame = int(frame_match.group(1))
            except ValueError:
                pass

        return {
            "current_time": round(current_time_s, 2),
            "percentage": round(percent, 1),
            "fps": fps,
            "frame": frame
        }
