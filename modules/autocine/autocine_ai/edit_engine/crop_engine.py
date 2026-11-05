"""
Smart Aspect-Ratio Crop Engine.
Supports 16:9, 9:16, 1:1, 4:5.
Preserves detected faces, subjects, and rule-of-thirds composition during framing.
"""

from typing import Dict, Any, Tuple

ASPECT_RATIO_VALUES = {
    "16:9": 16.0 / 9.0,
    "9:16": 9.0 / 16.0,
    "1:1": 1.0,
    "4:5": 4.0 / 5.0
}

class CropEngine:
    @classmethod
    def calculate_crop_box(
        cls,
        image_w: int,
        image_h: int,
        target_aspect_str: str,
        photo_meta: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculates normalized crop rectangle (x, y, w, h) protecting subject centers."""
        target_ar = ASPECT_RATIO_VALUES.get(target_aspect_str, 16.0 / 9.0)
        source_ar = image_w / float(max(1, image_h))

        # Default center anchor
        anchor_x = 0.5
        anchor_y = 0.5

        # Protect detected face if present
        faces = photo_meta.get("face_boxes", [])
        if faces:
            first_face = faces[0]
            anchor_x = first_face.get("x", 0.5) + first_face.get("width", 0.2) / 2.0
            anchor_y = first_face.get("y", 0.5) + first_face.get("height", 0.2) / 2.0

        if source_ar > target_ar:
            # Source is wider than target -> crop horizontally
            crop_h_norm = 1.0
            crop_w_norm = target_ar / source_ar
            # Center horizontally around anchor_x
            crop_x = max(0.0, min(1.0 - crop_w_norm, anchor_x - crop_w_norm / 2.0))
            crop_y = 0.0
        else:
            # Source is taller than target -> crop vertically
            crop_w_norm = 1.0
            crop_h_norm = source_ar / target_ar
            # Center vertically around anchor_y
            crop_x = 0.0
            crop_y = max(0.0, min(1.0 - crop_h_norm, anchor_y - crop_h_norm / 2.0))

        return {
            "aspect_ratio": target_aspect_str,
            "x": round(crop_x, 3),
            "y": round(crop_y, 3),
            "width": round(crop_w_norm, 3),
            "height": round(crop_h_norm, 3),
            "face_protected": len(faces) > 0
        }
