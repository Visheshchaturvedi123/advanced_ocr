"""
Media Panel for AutoCine AI Editor.
Displays scanned photographs, thumbnails, technical quality badges, and duplicate clusters.
"""

from typing import List, Dict, Any

class MediaPanelController:
    def __init__(self):
        self.photos: List[Dict[str, Any]] = []
        self.duplicate_clusters: List[List[int]] = []
        self.selected_photo_id: str = ""

    def load_media(self, photos: List[Dict[str, Any]], duplicate_clusters: List[List[int]]) -> None:
        self.photos = photos
        self.duplicate_clusters = duplicate_clusters

    def filter_by_score(self, min_score: float) -> List[Dict[str, Any]]:
        return [p for p in self.photos if p.get("score", 0) >= min_score]
