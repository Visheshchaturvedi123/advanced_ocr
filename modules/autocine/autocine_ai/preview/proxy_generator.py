"""
Fast Preview Proxy Generator.
Downscales high-resolution photos to 720p proxies on-demand to protect 8 GB RAM systems.
"""

import os
from typing import Dict, Any, List
from ..image_engine.image_compat import Image

class ProxyGenerator:
    @staticmethod
    def generate_all_proxies(
        clips: List[Dict[str, Any]],
        proxy_dir: str,
        target_resolution: int = 720
    ) -> Dict[str, str]:
        """Generates 720p JPEG proxies for all clips in the timeline."""
        os.makedirs(proxy_dir, exist_ok=True)
        proxy_map = {}

        for clip in clips:
            src = clip.get("source_image", "")
            if not src or not os.path.exists(src):
                continue
            base = os.path.splitext(os.path.basename(src))[0]
            out_path = os.path.join(proxy_dir, f"proxy_{base}_{target_resolution}p.jpg")

            if not os.path.exists(out_path):
                try:
                    with Image.open(src) as img:
                        img = img.convert("RGB")
                        # 1280x720 bounding box
                        img.thumbnail((1280, target_resolution), Image.Resampling.BILINEAR)
                        img.save(out_path, "JPEG", quality=82)
                except Exception as e:
                    print(f"[ProxyGenerator] Error creating proxy for {src}: {e}")
                    out_path = src

            proxy_map[src] = out_path

        return proxy_map
