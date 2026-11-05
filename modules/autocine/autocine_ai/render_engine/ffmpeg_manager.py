"""
FFmpeg & FFprobe Discovery and Capability Manager.
Detects installed binaries, versions, supported codecs and hardware encoders.
"""

import subprocess
import shutil
import os
import re
from typing import Dict, Any, Optional

class FFmpegManager:
    @staticmethod
    def find_executable(name: str, custom_path: Optional[str] = None) -> Optional[str]:
        if custom_path and os.path.exists(custom_path):
            return custom_path
        # System PATH lookup
        found = shutil.which(name)
        if found:
            return found
        # Common Windows installation directories
        common_win_paths = [
            r"C:\ffmpeg\bin",
            r"C:\Program Files\ffmpeg\bin",
            r"C:\Program Files (x86)\ffmpeg\bin",
            os.path.expanduser(r"~\ffmpeg\bin"),
            r"/usr/bin",
            r"/usr/local/bin"
        ]
        for p in common_win_paths:
            exe = os.path.join(p, f"{name}.exe" if os.name == "nt" else name)
            if os.path.exists(exe):
                return exe
        return None

    @classmethod
    def get_system_status(cls, custom_ffmpeg: Optional[str] = None, custom_ffprobe: Optional[str] = None) -> Dict[str, Any]:
        ffmpeg_bin = cls.find_executable("ffmpeg", custom_ffmpeg)
        ffprobe_bin = cls.find_executable("ffprobe", custom_ffprobe)

        status = {
            "ffmpeg_available": ffmpeg_bin is not None,
            "ffmpeg_path": ffmpeg_bin or "",
            "ffprobe_available": ffprobe_bin is not None,
            "ffprobe_path": ffprobe_bin or "",
            "version": "Unknown",
            "has_libx264": False,
            "has_aac": False
        }

        if ffmpeg_bin:
            try:
                res = subprocess.run([ffmpeg_bin, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                first_line = res.stdout.splitlines()[0] if res.stdout else ""
                match = re.search(r"ffmpeg version\s+([^\s]+)", first_line)
                if match:
                    status["version"] = match.group(1)
            except Exception:
                pass

            try:
                codecs_res = subprocess.run([ffmpeg_bin, "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                encoders_text = codecs_res.stdout or ""
                status["has_libx264"] = "libx264" in encoders_text
                status["has_aac"] = "aac" in encoders_text
            except Exception:
                pass

        return status
