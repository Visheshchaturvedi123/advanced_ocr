"""
Ken Burns Motion Engine.
Generates subtle camera movements (pan, zoom, tilt) while protecting subject & face framing.
"""

from typing import Dict, Any, List
import random

MOTION_TYPES = [
    "ZOOM_IN",
    "ZOOM_OUT",
    "PAN_LEFT",
    "PAN_RIGHT",
    "PAN_UP",
    "PAN_DOWN",
    "DIAGONAL_ZOOM"
]

class MotionEngine:
    @classmethod
    def assign_motion(
        cls,
        clip_index: int,
        photo_meta: Dict[str, Any],
        section_name: str,
        style: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculates normalized start and end viewport coordinates for Ken Burns animation."""
        faces = photo_meta.get("face_boxes", [])
        
        # Alternate motion types smoothly
        motion_type = MOTION_TYPES[clip_index % len(MOTION_TYPES)]
        
        # Intensity based on section and style
        if section_name in ("CLIMAX", "HIGH_ENERGY"):
            zoom_factor = 1.15
        elif section_name == "INTRO":
            zoom_factor = 1.06
        else:
            zoom_factor = 1.10

        # Anchor subject protection
        focus_x = 0.5
        focus_y = 0.5
        if faces:
            # Anchor around the first face
            first_face = faces[0]
            focus_x = first_face.get("x", 0.5) + first_face.get("width", 0.2) / 2.0
            focus_y = first_face.get("y", 0.5) + first_face.get("height", 0.2) / 2.0

        # Bound focus coordinates
        focus_x = max(0.2, min(0.8, focus_x))
        focus_y = max(0.2, min(0.8, focus_y))

        if motion_type == "ZOOM_IN":
            start_scale, end_scale = 1.0, zoom_factor
            start_x, start_y = 0.5, 0.5
            end_x, end_y = focus_x, focus_y
        elif motion_type == "ZOOM_OUT":
            start_scale, end_scale = zoom_factor, 1.0
            start_x, start_y = focus_x, focus_y
            end_x, end_y = 0.5, 0.5
        elif motion_type == "PAN_LEFT":
            start_scale = end_scale = 1.08
            start_x, end_x = 0.55, 0.45
            start_y = end_y = focus_y
        elif motion_type == "PAN_RIGHT":
            start_scale = end_scale = 1.08
            start_x, end_x = 0.45, 0.55
            start_y = end_y = focus_y
        elif motion_type == "PAN_UP":
            start_scale = end_scale = 1.08
            start_x = end_x = focus_x
            start_y, end_y = 0.55, 0.45
        elif motion_type == "PAN_DOWN":
            start_scale = end_scale = 1.08
            start_x = end_x = focus_x
            start_y, end_y = 0.45, 0.55
        else:  # DIAGONAL_ZOOM
            start_scale, end_scale = 1.0, zoom_factor
            start_x, end_x = 0.48, focus_x
            start_y, end_y = 0.52, focus_y

        return {
            "type": motion_type,
            "zoom_factor": zoom_factor,
            "start": {"scale": start_scale, "x": round(start_x, 3), "y": round(start_y, 3)},
            "end": {"scale": end_scale, "x": round(end_x, 3), "y": round(end_y, 3)},
            "protected_subject": len(faces) > 0
        }
