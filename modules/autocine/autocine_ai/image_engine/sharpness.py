"""
Sharpness and blur metric estimation.
Computes Laplacian edge variance and gradient energy.
Includes fallback implementation if OpenCV is not installed.
"""

from typing import Dict, Any

def compute_sharpness_cv2(image_bgr) -> Dict[str, float]:
    import cv2
    import numpy as np
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = float(laplacian.var())
    
    # Normalize variance to a 0.0 - 1.0 score (typical photographic variance ranges from 20 to 1000+)
    norm_score = min(1.0, max(0.0, variance / 600.0))
    is_blurry = variance < 80.0
    return {
        "sharpness_score": round(norm_score, 3),
        "raw_variance": round(variance, 2),
        "is_blurry": is_blurry
    }

def compute_sharpness_pure(image_pil) -> Dict[str, float]:
    """Pure Pillow fallback: calculates standard deviation of adjacent pixel differences."""
    gray = image_pil.convert("L")
    w, h = gray.size
    # Downsample to maximum 512px for rapid pure Python edge estimate
    if max(w, h) > 512:
        gray.thumbnail((512, 512))
        w, h = gray.size
    
    pixels = list(gray.getdata())
    diffs = []
    # Horizontal difference across sampled rows
    for y in range(0, h, 2):
        row_offset = y * w
        for x in range(w - 1):
            p1 = pixels[row_offset + x]
            p2 = pixels[row_offset + x + 1]
            diffs.append(abs(p1 - p2))

    # Vertical difference across sampled columns
    for y in range(h - 1):
        row_offset1 = y * w
        row_offset2 = (y + 1) * w
        for x in range(0, w, 2):
            p1 = pixels[row_offset1 + x]
            p2 = pixels[row_offset2 + x]
            diffs.append(abs(p1 - p2))

    if not diffs:
        return {"sharpness_score": 0.5, "raw_variance": 50.0, "is_blurry": False}

    mean_diff = sum(diffs) / len(diffs)
    variance = sum((d - mean_diff) ** 2 for d in diffs) / len(diffs)
    norm_score = min(1.0, max(0.0, variance / 300.0))
    return {
        "sharpness_score": round(norm_score, 3),
        "raw_variance": round(variance, 2),
        "is_blurry": variance < 30.0
    }
