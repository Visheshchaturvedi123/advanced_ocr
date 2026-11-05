"""
Recursive Media Scanner for AutoCine AI Editor.
Extracts file metadata without holding full image bitmaps in memory.
"""

import os
from typing import List, Dict, Any, Optional

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac"}

class MediaScanner:
    @staticmethod
    def is_image(filepath: str) -> bool:
        ext = os.path.splitext(filepath)[1].lower()
        return ext in SUPPORTED_IMAGE_EXTENSIONS

    @staticmethod
    def is_audio(filepath: str) -> bool:
        ext = os.path.splitext(filepath)[1].lower()
        return ext in SUPPORTED_AUDIO_EXTENSIONS

    @classmethod
    def scan_folder(cls, folder_path: str, recursive: bool = True) -> Dict[str, List[Dict[str, Any]]]:
        images: List[Dict[str, Any]] = []
        audios: List[Dict[str, Any]] = []

        if not os.path.exists(folder_path):
            return {"images": images, "audios": audios}

        walker = os.walk(folder_path) if recursive else [(folder_path, [], os.listdir(folder_path))]

        for root, _, files in walker:
            for filename in sorted(files):
                full_path = os.path.join(root, filename)
                try:
                    stats = os.stat(full_path)
                    size_bytes = stats.st_size
                    mtime = stats.st_mtime
                except OSError:
                    continue

                if cls.is_image(full_path):
                    images.append({
                        "file_path": full_path,
                        "filename": filename,
                        "file_size": size_bytes,
                        "mtime": mtime,
                        "type": "image",
                        "status": "unprocessed"
                    })
                elif cls.is_audio(full_path):
                    audios.append({
                        "file_path": full_path,
                        "filename": filename,
                        "file_size": size_bytes,
                        "mtime": mtime,
                        "type": "audio",
                        "status": "unprocessed"
                    })

        return {"images": images, "audios": audios}
