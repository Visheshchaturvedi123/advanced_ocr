"""
Unified Image Analyzer.
Runs sequential / chunked image evaluation without keeping full bitmaps in RAM.
"""

import os
from typing import Dict, Any, Optional
from .image_compat import Image

from .sharpness import compute_sharpness_pure, compute_sharpness_cv2
from .exposure import compute_exposure_metrics
from .composition import compute_composition_metrics
from .face_analysis import detect_faces_fallback, detect_faces_cv2
from .duplicate_detector import compute_dhash
from .image_ranker import ImageRanker

try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

class ImageAnalyzer:
    @classmethod
    def analyze_file(cls, filepath: str) -> Optional[Dict[str, Any]]:
        """Analyzes a single image safely, returning full explainable metrics."""
        if not os.path.exists(filepath):
            return None

        try:
            file_stats = os.stat(filepath)
            file_size = file_stats.st_size
            filename = os.path.basename(filepath)

            with Image.open(filepath) as pil_img:
                width, height = pil_img.size
                format_name = pil_img.format or os.path.splitext(filepath)[1].upper().replace(".", "")

                # Downsample copy to max 1024px to bound working memory on 8 GB systems
                working_img = pil_img.copy()
                if max(width, height) > 1024:
                    working_img.thumbnail((1024, 1024), Image.Resampling.BILINEAR)

                # 1. Sharpness & Blur
                if HAS_OPENCV:
                    try:
                        import numpy as np
                        cv_img = cv2.cvtColor(np.array(working_img.convert("RGB")), cv2.COLOR_RGB2BGR)
                        sharpness_data = compute_sharpness_cv2(cv_img)
                        face_data = detect_faces_cv2(cv_img)
                    except Exception:
                        sharpness_data = compute_sharpness_pure(working_img)
                        face_data = detect_faces_fallback(working_img)
                else:
                    sharpness_data = compute_sharpness_pure(working_img)
                    face_data = detect_faces_fallback(working_img)

                # 2. Exposure & Contrast
                exposure_data = compute_exposure_metrics(working_img)

                # 3. Composition
                composition_data = compute_composition_metrics(working_img)

                # 4. Color Quality (saturation & balance)
                hsv = working_img.convert("HSV")
                s_channel = hsv.split()[1]
                avg_sat = sum(s_channel.getdata()) / (s_channel.size[0] * s_channel.size[1] * 255.0)
                color_quality_score = min(1.0, max(0.2, avg_sat * 1.6))

                # 5. Perceptual dHash
                dhash_val = compute_dhash(working_img)

                # Clean working copy explicitly
                del working_img

            # Consolidate raw feature dict
            features: Dict[str, Any] = {
                "filepath": filepath,
                "filename": filename,
                "file_size": file_size,
                "width": width,
                "height": height,
                "format": format_name,
                "aspect_ratio": composition_data["aspect_ratio"],
                "orientation": composition_data["orientation"],
                "dhash": dhash_val,
                "color_quality_score": round(color_quality_score, 3),
                "noise_level": 0.05,
                **sharpness_data,
                **exposure_data,
                **composition_data,
                **face_data
            }

            # 6. Ranker calculation
            scoring = ImageRanker.calculate_score(features, uniqueness_score=1.0)
            features["score"] = scoring["final_score"]
            features["score_breakdown"] = scoring["breakdown"]

            return features

        except Exception as err:
            print(f"[ImageAnalyzer] Skipping corrupt or unsupported file {filepath}: {err}")
            return None
