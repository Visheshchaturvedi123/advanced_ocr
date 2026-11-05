"""
Explainable Multi-Factor Image Ranker.
Weights strictly match the specification:
  - Technical Quality: 25%
  - Sharpness: 15%
  - Exposure: 10%
  - Composition: 10%
  - Color Quality: 10%
  - Subject/Face Quality: 10%
  - Resolution: 10%
  - Uniqueness: 10%
"""

from typing import Dict, Any

class ImageRanker:
    WEIGHT_TECHNICAL = 0.25
    WEIGHT_SHARPNESS = 0.15
    WEIGHT_EXPOSURE = 0.10
    WEIGHT_COMPOSITION = 0.10
    WEIGHT_COLOR = 0.10
    WEIGHT_SUBJECT = 0.10
    WEIGHT_RESOLUTION = 0.10
    WEIGHT_UNIQUENESS = 0.10

    @classmethod
    def calculate_score(cls, features: Dict[str, Any], uniqueness_score: float = 1.0) -> Dict[str, Any]:
        sharpness_sub = float(features.get("sharpness_score", 0.5))
        exposure_sub = float(features.get("exposure_score", 0.5))
        composition_sub = float(features.get("composition_score", 0.5))
        contrast_sub = float(features.get("contrast_score", 0.5))
        color_sub = float(features.get("color_quality_score", 0.6))
        subject_sub = float(features.get("face_score", 0.5))
        
        # Technical Quality is derived from contrast + noise + dynamic range
        dynamic_range = float(features.get("dynamic_range", 0.6))
        technical_sub = (contrast_sub * 0.4 + dynamic_range * 0.4 + (1.0 - features.get("noise_level", 0.1)) * 0.2)

        # Resolution score: optimal for 1080p+ (e.g. 1920x1080 is 1.0, 4K is 1.0, <720p scales down)
        w = features.get("width", 1920)
        h = features.get("height", 1080)
        total_pixels = w * h
        resolution_sub = min(1.0, total_pixels / (1920 * 1080))

        # Uniqueness score (decreases if part of a duplicate cluster)
        uniqueness_sub = min(1.0, max(0.0, uniqueness_score))

        final_score = (
            technical_sub * cls.WEIGHT_TECHNICAL +
            sharpness_sub * cls.WEIGHT_SHARPNESS +
            exposure_sub * cls.WEIGHT_EXPOSURE +
            composition_sub * cls.WEIGHT_COMPOSITION +
            color_sub * cls.WEIGHT_COLOR +
            subject_sub * cls.WEIGHT_SUBJECT +
            resolution_sub * cls.WEIGHT_RESOLUTION +
            uniqueness_sub * cls.WEIGHT_UNIQUENESS
        )

        return {
            "final_score": round(final_score * 100.0, 1),
            "normalized_score": round(final_score, 3),
            "breakdown": {
                "technical_quality": round(technical_sub, 3),
                "sharpness": round(sharpness_sub, 3),
                "exposure": round(exposure_sub, 3),
                "composition": round(composition_sub, 3),
                "color_quality": round(color_sub, 3),
                "subject_quality": round(subject_sub, 3),
                "resolution": round(resolution_sub, 3),
                "uniqueness": round(uniqueness_sub, 3)
            }
        }
