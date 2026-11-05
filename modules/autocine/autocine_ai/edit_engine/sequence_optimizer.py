"""
Diversity-Aware Sequence Optimizer.
Selects and orders photographs balancing technical quality, shot type variety,
composition contrast, and avoids duplicate/monotonous sequences.
"""

from typing import List, Dict, Any, Optional
import random

SHOT_CADENCE = [
    "wide_shot",
    "portrait",
    "detail",
    "group",
    "location",
    "close_up",
    "hero_image",
    "environmental"
]

class SequenceOptimizer:
    @staticmethod
    def classify_shot_type(photo: Dict[str, Any]) -> str:
        """Heuristically tags photo shot type based on faces, composition, and dimensions."""
        faces = photo.get("face_count", 0)
        aspect = photo.get("aspect_ratio", 1.5)
        orient = photo.get("orientation", "landscape")
        center_bias = photo.get("center_bias", 0.15)
        score = photo.get("score", 70.0)

        if score >= 90.0:
            return "hero_image"
        if faces == 1:
            return "portrait" if orient == "portrait" else "close_up"
        elif faces > 1:
            return "group"
        elif center_bias > 0.25:
            return "detail"
        elif orient == "landscape" and aspect >= 1.6:
            return "wide_shot"
        elif orient == "landscape":
            return "location"
        else:
            return "environmental"

    @classmethod
    def optimize_sequence(
        cls,
        photos: List[Dict[str, Any]],
        duplicate_clusters: List[List[int]],
        target_count: int,
        style_name: str = "CINEMATIC"
    ) -> List[Dict[str, Any]]:
        """
        Selects target_count photos avoiding duplicate clusters and alternating shot types.
        """
        if not photos:
            return []

        # 1. Filter out duplicates: from each duplicate cluster, keep only the highest-scoring photo
        excluded_indices = set()
        for cluster in duplicate_clusters:
            if not cluster:
                continue
            # Find best photo in cluster
            best_idx = max(cluster, key=lambda idx: photos[idx].get("score", 0))
            for idx in cluster:
                if idx != best_idx:
                    excluded_indices.add(idx)

        eligible = [
            {**p, "_orig_index": i, "shot_type": cls.classify_shot_type(p)}
            for i, p in enumerate(photos)
            if i not in excluded_indices
        ]

        if not eligible:
            eligible = [{**p, "_orig_index": i, "shot_type": cls.classify_shot_type(p)} for i, p in enumerate(photos)]

        # 2. Sort eligible by overall score descending
        eligible.sort(key=lambda p: p.get("score", 0), reverse=True)

        # 3. Form pool of top candidates (e.g. 2.5x target count) to pick from
        pool_size = min(len(eligible), max(target_count * 2, 10))
        pool = eligible[:pool_size]

        # 4. Sequencer greedy selection following SHOT_CADENCE
        selected: List[Dict[str, Any]] = []
        used_ids = set()

        for step in range(min(target_count, len(pool))):
            target_shot = SHOT_CADENCE[step % len(SHOT_CADENCE)]
            
            # Look for an unused candidate matching target shot type
            match = None
            for cand in pool:
                if cand["_orig_index"] in used_ids:
                    continue
                if cand["shot_type"] == target_shot:
                    match = cand
                    break

            # Fallback: take highest-scoring unused candidate with different orientation/shot than previous
            if not match:
                last_shot = selected[-1]["shot_type"] if selected else ""
                for cand in pool:
                    if cand["_orig_index"] in used_ids:
                        continue
                    if cand["shot_type"] != last_shot:
                        match = cand
                        break

            # Ultimate fallback
            if not match:
                for cand in pool:
                    if cand["_orig_index"] not in used_ids:
                        match = cand
                        break

            if match:
                selected.append(match)
                used_ids.add(match["_orig_index"])

        return selected
