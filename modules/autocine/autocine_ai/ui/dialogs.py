"""
Dialogs for Settings, Export, and Benchmark Execution.
"""

from typing import Dict, Any

class DialogsController:
    @staticmethod
    def get_export_settings_defaults() -> Dict[str, Any]:
        return {
            "resolution": "1920x1080",
            "aspect_ratio": "16:9",
            "fps": 30,
            "quality_preset": "HIGH",
            "codec": "libx264",
            "audio_bitrate": "320k"
        }
