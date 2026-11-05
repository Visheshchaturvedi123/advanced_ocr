"""
Unit tests for Image Analysis Engine:
  - Sharpness
  - Exposure
  - Score & Ranking
  - Duplicate detection (dHash)
  - Composition & aspect ratio
"""

import unittest
from autocine_ai.image_engine.image_compat import Image

from autocine_ai.image_engine.sharpness import compute_sharpness_pure
from autocine_ai.image_engine.exposure import compute_exposure_metrics
from autocine_ai.image_engine.composition import compute_composition_metrics
from autocine_ai.image_engine.duplicate_detector import compute_dhash, hamming_distance, group_duplicates
from autocine_ai.image_engine.image_ranker import ImageRanker

class TestImageEngine(unittest.TestCase):
    def setUp(self):
        # Create a test synthetic high-contrast image
        self.img1 = Image.new("RGB", (800, 600), color=(128, 128, 128))
        # Add some edges
        for x in range(200, 400):
            for y in range(200, 400):
                self.img1.putpixel((x, y), (255, 255, 255))

        # Duplicate of img1
        self.img1_dup = self.img1.copy()

        # Completely different pattern image
        self.img2 = Image.new("RGB", (800, 600), color=(10, 10, 10))
        for x in range(0, 800, 2):
            for y in range(0, 600):
                self.img2.putpixel((x, y), (250, 0, 0))

    def test_sharpness(self):
        res = compute_sharpness_pure(self.img1)
        self.assertIn("sharpness_score", res)
        self.assertGreater(res["sharpness_score"], 0.0)
        self.assertIn("raw_variance", res)

    def test_exposure(self):
        res = compute_exposure_metrics(self.img1)
        self.assertIn("exposure_score", res)
        self.assertIn("mean_luminance", res)
        self.assertIn("dynamic_range", res)
        self.assertTrue(0.0 <= res["exposure_score"] <= 1.0)

    def test_composition(self):
        res = compute_composition_metrics(self.img1)
        self.assertEqual(res["aspect_ratio"], 1.33)
        self.assertEqual(res["orientation"], "landscape")
        self.assertIn("composition_score", res)

    def test_duplicate_detection(self):
        h1 = compute_dhash(self.img1)
        h1_dup = compute_dhash(self.img1_dup)
        h2 = compute_dhash(self.img2)

        self.assertEqual(h1, h1_dup)
        self.assertEqual(hamming_distance(h1, h1_dup), 0)
        self.assertGreater(hamming_distance(h1, h2), 0)

        # Test grouping
        mock_list = [
            {"dhash": h1},
            {"dhash": h1_dup},
            {"dhash": h2}
        ]
        clusters = group_duplicates(mock_list, distance_threshold=5)
        self.assertEqual(len(clusters), 1)
        self.assertEqual(clusters[0], [0, 1])

    def test_image_ranker(self):
        features = {
            "sharpness_score": 0.8,
            "exposure_score": 0.9,
            "composition_score": 0.85,
            "contrast_score": 0.75,
            "color_quality_score": 0.7,
            "face_score": 0.6,
            "dynamic_range": 0.8,
            "width": 1920,
            "height": 1080
        }
        score_data = ImageRanker.calculate_score(features, uniqueness_score=1.0)
        self.assertIn("final_score", score_data)
        self.assertIn("breakdown", score_data)
        self.assertTrue(0.0 <= score_data["final_score"] <= 100.0)
        # Check that breakdown contains all 8 required factors
        breakdown = score_data["breakdown"]
        self.assertIn("technical_quality", breakdown)
        self.assertIn("sharpness", breakdown)
        self.assertIn("exposure", breakdown)
        self.assertIn("composition", breakdown)
        self.assertIn("color_quality", breakdown)
        self.assertIn("subject_quality", breakdown)
        self.assertIn("resolution", breakdown)
        self.assertIn("uniqueness", breakdown)

if __name__ == "__main__":
    unittest.main()
