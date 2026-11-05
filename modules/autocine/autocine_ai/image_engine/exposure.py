"""
Exposure and dynamic range analysis.
Calculates luminance histogram, shadow clipping, highlight clipping, and contrast.
"""

from typing import Dict, Any

def compute_exposure_metrics(image_pil) -> Dict[str, Any]:
    gray = image_pil.convert("L")
    hist = gray.histogram()
    total_pixels = sum(hist)
    if total_pixels == 0:
        return {
            "exposure_score": 0.5,
            "mean_luminance": 128.0,
            "underexposed_ratio": 0.0,
            "overexposed_ratio": 0.0,
            "contrast_score": 0.5,
            "dynamic_range": 0.5
        }

    # Shadow pixels (< 15) and Highlight pixels (> 240)
    shadow_pixels = sum(hist[:15])
    highlight_pixels = sum(hist[240:])
    underexposed_ratio = shadow_pixels / total_pixels
    overexposed_ratio = highlight_pixels / total_pixels

    # Mean luminance
    weighted_sum = sum(i * count for i, count in enumerate(hist))
    mean_luminance = weighted_sum / total_pixels

    # Midtones centering penalty (optimal around 110-145)
    center_dist = abs(mean_luminance - 128.0) / 128.0
    exposure_score = max(0.0, 1.0 - (center_dist * 0.7 + (underexposed_ratio + overexposed_ratio) * 1.2))

    # Dynamic range: range between 5th percentile and 95th percentile
    cum = 0
    p05, p95 = 0, 255
    for i, count in enumerate(hist):
        cum += count
        if p05 == 0 and cum >= total_pixels * 0.05:
            p05 = i
        if cum >= total_pixels * 0.95:
            p95 = i
            break
    dynamic_range = min(1.0, (p95 - p05) / 200.0)

    # Contrast score
    contrast_score = min(1.0, (p95 - p05) / 220.0)

    return {
        "exposure_score": round(exposure_score, 3),
        "mean_luminance": round(mean_luminance, 1),
        "underexposed_ratio": round(underexposed_ratio, 3),
        "overexposed_ratio": round(overexposed_ratio, 3),
        "contrast_score": round(contrast_score, 3),
        "dynamic_range": round(dynamic_range, 3)
    }
