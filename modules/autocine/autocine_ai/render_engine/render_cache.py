"""
Render Segment Cache Manager.
Caches rendered intermediate assets keyed by source hash, timeline params, resolution, and effects.
"""

import hashlib
import json
import os
from typing import Optional, Dict, Any

class RenderCache:
    def __init__(self, cache_dir: str):
        self.cache_dir = os.path.join(cache_dir, "render_segments")
        os.makedirs(self.cache_dir, exist_ok=True)

    @staticmethod
    def compute_cache_key(clip: Dict[str, Any], resolution: str, fps: int, preset: str) -> str:
        payload = {
            "source": clip.get("source_image", ""),
            "duration": clip.get("duration", 0),
            "motion": clip.get("motion", {}),
            "crop": clip.get("crop", {}),
            "transition": clip.get("transition", {}),
            "resolution": resolution,
            "fps": fps,
            "preset": preset
        }
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def get_cached_segment(self, cache_key: str) -> Optional[str]:
        path = os.path.join(self.cache_dir, f"{cache_key}.mp4")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            return path
        return None
