"""
Face and primary subject region detector.
Uses OpenCV Haar Cascades when available, with skin-tone / centroid fallback.
"""

from typing import Dict, Any, List

def detect_faces_cv2(image_bgr) -> Dict[str, Any]:
    import cv2
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
    
    face_boxes: List[Dict[str, float]] = []
    h, w = gray.shape
    for (x, y, fw, fh) in faces:
        face_boxes.append({
            "x": round(x / w, 3),
            "y": round(y / h, 3),
            "width": round(fw / w, 3),
            "height": round(fh / h, 3)
        })

    face_count = len(faces)
    face_score = 0.85 if face_count in (1, 2) else (0.75 if face_count > 2 else 0.5)

    return {
        "face_count": face_count,
        "face_score": face_score,
        "face_boxes": face_boxes,
        "has_faces": face_count > 0
    }

def detect_faces_fallback(image_pil) -> Dict[str, Any]:
    """Lightweight skin-chroma heuristic for subject estimation when OpenCV is absent."""
    rgb = image_pil.convert("RGB").resize((64, 64))
    pixels = list(rgb.getdata())
    skin_count = 0
    for r, g, b in pixels:
        # Classical Kovac skin color model in RGB
        if r > 95 and g > 40 and b > 20 and (max(r, g, b) - min(r, g, b) > 15) and abs(r - g) > 15 and r > g and r > b:
            skin_count += 1

    ratio = skin_count / len(pixels)
    likely_faces = 1 if 0.05 < ratio < 0.35 else (2 if ratio >= 0.35 else 0)

    return {
        "face_count": likely_faces,
        "face_score": 0.7 if likely_faces > 0 else 0.5,
        "face_boxes": [{"x": 0.35, "y": 0.25, "width": 0.3, "height": 0.3}] if likely_faces > 0 else [],
        "has_faces": likely_faces > 0
    }
