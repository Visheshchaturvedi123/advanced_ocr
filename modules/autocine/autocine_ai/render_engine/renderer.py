"""
FFmpeg Subprocess Renderer.
Executes rendering with real-time progress callbacks and cancellation checks.
"""

import subprocess
import os
import signal
from typing import List, Dict, Any, Callable, Optional

from .ffmpeg_builder import FFmpegBuilder
from .progress_parser import ProgressParser
from .output_validator import OutputValidator

class FFmpegRenderer:
    def __init__(self, ffmpeg_bin: str, ffprobe_bin: str):
        self.ffmpeg_bin = ffmpeg_bin
        self.ffprobe_bin = ffprobe_bin
        self.process: Optional[subprocess.Popen] = None
        self.is_cancelled = False

    def cancel(self) -> None:
        self.is_cancelled = True
        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
            except Exception:
                pass

    def render(
        self,
        clips: List[Dict[str, Any]],
        audio_path: str,
        output_path: str,
        aspect_ratio: str = "16:9",
        quality_preset: str = "HIGH",
        fps: int = 30,
        threads: int = 0,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        self.is_cancelled = False
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        total_duration = sum(c.get("duration", 3.0) for c in clips)

        cmd = FFmpegBuilder.build_render_command(
            ffmpeg_bin=self.ffmpeg_bin,
            clips=clips,
            audio_path=audio_path,
            output_path=output_path,
            aspect_ratio=aspect_ratio,
            quality_preset=quality_preset,
            fps=fps,
            threads=threads
        )

        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )

            for line in self.process.stdout:
                if self.is_cancelled:
                    self.process.kill()
                    return {"success": False, "error": "Render cancelled by user"}

                progress = ProgressParser.parse_line(line, total_duration)
                if progress and on_progress:
                    on_progress(progress)

            self.process.wait()

            if self.process.returncode != 0:
                return {
                    "success": False,
                    "error": f"FFmpeg exited with non-zero code {self.process.returncode}"
                }

            # Run Output Validation
            validation = OutputValidator.validate_file(self.ffprobe_bin, output_path)
            return {
                "success": validation.get("valid", False),
                "validation": validation,
                "output_path": output_path
            }

        except Exception as e:
            return {"success": False, "error": str(e)}
