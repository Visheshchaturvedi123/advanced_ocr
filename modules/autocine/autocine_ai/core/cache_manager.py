"""
Disk-backed Analysis Cache Manager for AutoCine AI Editor.
Stores perceptual hashes, technical scores, audio structs, and proxy paths.
"""

import hashlib
import json
import os
from typing import Any, Dict, Optional

class CacheManager:
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or os.path.join(os.path.expanduser("~"), ".autocine_cache")
        self.images_cache_file = os.path.join(self.cache_dir, "image_cache.json")
        self.audio_cache_file = os.path.join(self.cache_dir, "audio_cache.json")
        self.thumbs_dir = os.path.join(self.cache_dir, "thumbnails")
        self.proxies_dir = os.path.join(self.cache_dir, "proxies")
        self._ensure_dirs()
        self._images_cache: Dict[str, Any] = self._load_json(self.images_cache_file)
        self._audio_cache: Dict[str, Any] = self._load_json(self.audio_cache_file)

    def _ensure_dirs(self) -> None:
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.thumbs_dir, exist_ok=True)
        os.makedirs(self.proxies_dir, exist_ok=True)

    def _load_json(self, path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_json(self, data: Dict[str, Any], path: str) -> None:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[CacheManager] Failed to persist cache to {path}: {e}")

    @staticmethod
    def compute_file_hash(filepath: str, chunk_size: int = 65536) -> str:
        """Fast SHA-256 computation using buffered chunk reads to prevent memory spikes."""
        if not os.path.exists(filepath):
            return ""
        hasher = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                while chunk := f.read(chunk_size):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            return ""

    def get_image_analysis(self, file_hash: str) -> Optional[Dict[str, Any]]:
        return self._images_cache.get(file_hash)

    def put_image_analysis(self, file_hash: str, analysis_data: Dict[str, Any]) -> None:
        self._images_cache[file_hash] = analysis_data
        self._save_json(self._images_cache, self.images_cache_file)

    def get_audio_analysis(self, file_hash: str) -> Optional[Dict[str, Any]]:
        return self._audio_cache.get(file_hash)

    def put_audio_analysis(self, file_hash: str, audio_data: Dict[str, Any]) -> None:
        self._audio_cache[file_hash] = audio_data
        self._save_json(self._audio_cache, self.audio_cache_file)

    def get_thumbnail_path(self, file_hash: str) -> str:
        return os.path.join(self.thumbs_dir, f"{file_hash}.jpg")

    def get_proxy_path(self, file_hash: str) -> str:
        return os.path.join(self.proxies_dir, f"{file_hash}_720p.jpg")

    def clear_cache(self) -> None:
        self._images_cache.clear()
        self._audio_cache.clear()
        self._save_json({}, self.images_cache_file)
        self._save_json({}, self.audio_cache_file)
