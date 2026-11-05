"""
Perceptual Hash and Near-Duplicate Grouping Engine.
Uses 64-bit difference hash (dHash) for O(1) comparison and Hamming distance clustering.
"""

from typing import List, Dict, Any, Tuple

def compute_dhash(image_pil) -> str:
    """Computes a 64-bit difference hash (dHash) comparing adjacent pixel gradient."""
    # Resize to 9x8 grayscale
    resized = image_pil.convert("L").resize((9, 8))
    pixels = list(resized.getdata())
    
    diff_bits = []
    for row in range(8):
        row_offset = row * 9
        for col in range(8):
            pixel_left = pixels[row_offset + col]
            pixel_right = pixels[row_offset + col + 1]
            diff_bits.append("1" if pixel_left > pixel_right else "0")

    bit_string = "".join(diff_bits)
    # Convert 64 bits to 16-hex-character string
    hex_hash = f"{int(bit_string, 2):016x}"
    return hex_hash

def hamming_distance(hash1: str, hash2: str) -> int:
    """Calculates bitwise difference between two 16-hex character hashes."""
    if not hash1 or not hash2 or len(hash1) != len(hash2):
        return 64
    val1 = int(hash1, 16)
    val2 = int(hash2, 16)
    xor_val = val1 ^ val2
    return bin(xor_val).count("1")

def group_duplicates(images_analysis: List[Dict[str, Any]], distance_threshold: int = 10) -> List[List[int]]:
    """Groups image indices into duplicate clusters where pairwise Hamming distance <= threshold."""
    n = len(images_analysis)
    visited = set()
    clusters: List[List[int]] = []

    for i in range(n):
        if i in visited:
            continue
        cluster = [i]
        visited.add(i)
        hash_i = images_analysis[i].get("dhash", "")
        if not hash_i:
            continue

        for j in range(i + 1, n):
            if j in visited:
                continue
            hash_j = images_analysis[j].get("dhash", "")
            dist = hamming_distance(hash_i, hash_j)
            if dist <= distance_threshold:
                cluster.append(j)
                visited.add(j)

        if len(cluster) > 1:
            clusters.append(cluster)

    return clusters
