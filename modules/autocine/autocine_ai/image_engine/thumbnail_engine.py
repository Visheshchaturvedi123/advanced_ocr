"""
Thumbnail and Proxy generator.
Creates low-memory 256px thumbnails and 720p proxies to protect system RAM.
"""

import os
from .image_compat import Image

class ThumbnailEngine:
    @staticmethod
    def generate_thumbnail(image_path: str, output_path: str, size: int = 256) -> bool:
        try:
            with Image.open(image_path) as img:
                img = img.convert("RGB")
                img.thumbnail((size, size), Image.Resampling.LANCZOS)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                img.save(output_path, "JPEG", quality=80)
            return True
        except Exception as e:
            print(f"[ThumbnailEngine] Failed to create thumbnail for {image_path}: {e}")
            return False

    @staticmethod
    def generate_proxy_720p(image_path: str, output_path: str) -> bool:
        try:
            with Image.open(image_path) as img:
                img = img.convert("RGB")
                img.thumbnail((1280, 720), Image.Resampling.LANCZOS)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                img.save(output_path, "JPEG", quality=85)
            return True
        except Exception as e:
            print(f"[ThumbnailEngine] Failed to create 720p proxy for {image_path}: {e}")
            return False
