"""
Configuration and hardware profile management for AutoCine AI Editor.
Tuned for 8 GB RAM CPU-only baseline.
"""

from dataclasses import dataclass, asdict
from enum import Enum
import os
import multiprocessing

class HardwareProfile(str, Enum):
    LOW_MEMORY = "LOW_MEMORY"      # 8 GB RAM target (default)
    BALANCED = "BALANCED"          # 16 GB RAM
    HIGH_PERF = "HIGH_PERF"        # 32+ GB RAM / Workstations

class AspectRatio(str, Enum):
    RATIO_16_9 = "16:9"
    RATIO_9_16 = "9:16"
    RATIO_1_1 = "1:1"
    RATIO_4_5 = "4:5"

class RenderQuality(str, Enum):
    MASTER = "MASTER"          # CRF 14, preset slow
    VERY_HIGH = "VERY_HIGH"    # CRF 15, preset medium
    HIGH = "HIGH"              # CRF 16, preset faster (Default)
    FAST = "FAST"              # CRF 18, preset veryfast

@dataclass
class AppConfig:
    profile: HardwareProfile = HardwareProfile.LOW_MEMORY
    aspect_ratio: AspectRatio = AspectRatio.RATIO_16_9
    render_quality: RenderQuality = RenderQuality.HIGH
    fps: int = 30
    preview_resolution: int = 720
    cache_dir: str = os.path.join(os.path.expanduser("~"), ".autocine_cache")
    ffmpeg_path: str = ""
    ffprobe_path: str = ""
    max_analysis_workers: int = 2
    analysis_batch_size: int = 5
    thumbnail_size: int = 256
    proxy_resolution: int = 720
    ffmpeg_threads: int = max(1, multiprocessing.cpu_count() - 1)
    
    @classmethod
    def get_default_for_system(cls) -> "AppConfig":
        cores = multiprocessing.cpu_count()
        # Default to LOW_MEMORY for 8 GB compliance
        workers = 2 if cores <= 4 else min(4, cores - 1)
        return cls(
            profile=HardwareProfile.LOW_MEMORY,
            max_analysis_workers=workers,
            analysis_batch_size=5,
            ffmpeg_threads=max(1, cores - 1)
        )

    def to_dict(self):
        return asdict(self)
