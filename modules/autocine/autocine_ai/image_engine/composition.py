"""
Composition and aesthetic balance analysis.
Evaluates Rule-of-Thirds power points, center bias, and spatial mass distribution.
"""

from typing import Dict, Any

def compute_composition_metrics(image_pil) -> Dict[str, Any]:
    w, h = image_pil.size
    aspect_ratio = round(w / max(1, h), 2)
    orientation = "landscape" if w > h else ("portrait" if h > w else "square")

    # Downsample to thumbnail 9x9 grid to check mass distribution
    small = image_pil.convert("L").resize((9, 9))
    pixels = list(small.getdata())

    # Split into 3x3 zones
    zone_mass = [0.0] * 9
    for r in range(9):
        for c in range(9):
            z_row = r // 3
            z_col = c // 3
            zone_idx = z_row * 3 + z_col
            zone_mass[zone_idx] += pixels[r * 9 + c]

    total_mass = sum(zone_mass) or 1.0
    zone_ratios = [m / total_mass for m in zone_mass]

    # Center zone is index 4
    center_bias = zone_ratios[4]
    
    # Rule of thirds favors mass or contrast at intersecting regions (zones 1, 3, 5, 7 or off-center)
    off_center_energy = (zone_ratios[1] + zone_ratios[3] + zone_ratios[5] + zone_ratios[7]) / 4.0
    rule_of_thirds_score = min(1.0, off_center_energy * 3.5)

    # Horizontal balance: compare left column (0, 3, 6) vs right column (2, 5, 8)
    left_mass = zone_ratios[0] + zone_ratios[3] + zone_ratios[6]
    right_mass = zone_ratios[2] + zone_ratios[5] + zone_ratios[8]
    balance = 1.0 - min(1.0, abs(left_mass - right_mass) * 1.5)

    composite_score = round((rule_of_thirds_score * 0.5 + balance * 0.5), 3)

    return {
        "composition_score": composite_score,
        "aspect_ratio": aspect_ratio,
        "orientation": orientation,
        "center_bias": round(center_bias, 3),
        "visual_balance": round(balance, 3),
        "rule_of_thirds_approximation": round(rule_of_thirds_score, 3)
    }
