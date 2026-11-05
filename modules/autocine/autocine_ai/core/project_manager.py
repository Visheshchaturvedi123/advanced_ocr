"""
Project Manager for AutoCine AI Editor.
Handles JSON serialization, schema versioning, and auto-save.
"""

import json
import os
import time
from typing import Any, Dict, Optional

PROJECT_SCHEMA_VERSION = 1

class ProjectManager:
    def __init__(self, project_path: Optional[str] = None):
        self.project_path = project_path
        self.last_saved_time = 0.0
        self.data: Dict[str, Any] = self._create_empty_project()
        if project_path and os.path.exists(project_path):
            self.load_project(project_path)

    def _create_empty_project(self) -> Dict[str, Any]:
        return {
            "version": PROJECT_SCHEMA_VERSION,
            "created_at": time.time(),
            "updated_at": time.time(),
            "media": {
                "folder_path": "",
                "photos": []
            },
            "audio": {
                "file_path": "",
                "analysis": None
            },
            "analysis": {
                "analyzed_count": 0,
                "duplicates_detected": 0
            },
            "timeline": [],
            "style": {
                "name": "CINEMATIC",
                "aspect_ratio": "16:9",
                "pacing": "MEDIUM",
                "transitions_enabled": True
            },
            "output": {
                "quality": "HIGH",
                "fps": 30,
                "target_path": ""
            }
        }

    def new_project(self) -> None:
        self.data = self._create_empty_project()
        self.project_path = None

    def load_project(self, filepath: str) -> bool:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if loaded.get("version") == PROJECT_SCHEMA_VERSION:
                    self.data = loaded
                    self.project_path = filepath
                    return True
        except Exception as e:
            print(f"[ProjectManager] Error loading project from {filepath}: {e}")
        return False

    def save_project(self, filepath: Optional[str] = None) -> bool:
        target = filepath or self.project_path
        if not target:
            return False
        try:
            self.data["updated_at"] = time.time()
            with open(target, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2)
            self.project_path = target
            self.last_saved_time = time.time()
            return True
        except Exception as e:
            print(f"[ProjectManager] Error saving project to {target}: {e}")
            return False

    def auto_save(self) -> bool:
        if self.project_path:
            auto_path = self.project_path + ".autosave"
            return self.save_project(auto_path)
        return False
