"""
Unit tests for Edit Engine:
  - Duration calculation
  - Beat alignment
  - Photo sequence diversity
  - Transition selection logic
  - Style profiles
"""

import unittest
from autocine_ai.edit_engine.style_profiles import STYLE_PROFILES
from autocine_ai.edit_engine.sequence_optimizer import SequenceOptimizer
from autocine_ai.edit_engine.transition_engine import TransitionEngine
from autocine_ai.edit_engine.crop_engine import CropEngine
from autocine_ai.edit_engine.motion_engine import MotionEngine
from autocine_ai.edit_engine.edit_planner import EditPlanner

class TestEditEngine(unittest.TestCase):
    def setUp(self):
        self.mock_photos = [
            {"filepath": "p1.jpg", "filename": "p1.jpg", "score": 95, "face_count": 0, "aspect_ratio": 1.6, "orientation": "landscape"},
            {"filepath": "p2.jpg", "filename": "p2.jpg", "score": 88, "face_count": 1, "aspect_ratio": 0.7, "orientation": "portrait"},
            {"filepath": "p3.jpg", "filename": "p3.jpg", "score": 84, "face_count": 4, "aspect_ratio": 1.5, "orientation": "landscape"},
            {"filepath": "p4.jpg", "filename": "p4.jpg", "score": 82, "face_count": 0, "center_bias": 0.35, "aspect_ratio": 1.0, "orientation": "square"},
            {"filepath": "p5.jpg", "filename": "p5.jpg", "score": 79, "face_count": 0, "aspect_ratio": 1.7, "orientation": "landscape"},
        ]
        self.mock_music = {
            "duration": 20.0,
            "bpm": 120.0,
            "beats": [float(i * 0.5) for i in range(40)],
            "sections": [
                {"section": "INTRO", "start": 0.0, "end": 5.0},
                {"section": "CLIMAX", "start": 5.0, "end": 15.0},
                {"section": "OUTRO", "start": 15.0, "end": 20.0}
            ]
        }

    def test_style_profiles(self):
        for name in ["CINEMATIC", "WEDDING", "TRAVEL", "MEMORIES", "BEAT", "SOCIAL", "CORPORATE"]:
            self.assertIn(name, STYLE_PROFILES)
            p = STYLE_PROFILES[name]
            self.assertGreater(p["max_duration"], p["min_duration"])

    def test_sequence_optimizer_diversity(self):
        optimized = SequenceOptimizer.optimize_sequence(
            photos=self.mock_photos,
            duplicate_clusters=[],
            target_count=4,
            style_name="CINEMATIC"
        )
        self.assertEqual(len(optimized), 4)
        shot_types = [p["shot_type"] for p in optimized]
        # Verify shot diversity (not all shots are identical)
        self.assertGreater(len(set(shot_types)), 1)

    def test_transition_logic(self):
        style = STYLE_PROFILES["CINEMATIC"]
        # Intro/first clip
        t1 = TransitionEngine.select_transition(0, "INTRO", style, False)
        self.assertEqual(t1["type"], "FADE")
        # Outro clip
        t_outro = TransitionEngine.select_transition(5, "OUTRO", style, False)
        self.assertEqual(t_outro["type"], "DIP TO BLACK")

    def test_crop_engine_aspects(self):
        meta = {"face_boxes": [{"x": 0.6, "y": 0.3, "width": 0.2, "height": 0.2}]}
        crop_16_9 = CropEngine.calculate_crop_box(3000, 2000, "16:9", meta)
        self.assertEqual(crop_16_9["aspect_ratio"], "16:9")
        self.assertTrue(crop_16_9["face_protected"])

    def test_edit_planner_edl(self):
        edl = EditPlanner.create_edit_decision_list(
            photos=self.mock_photos,
            music_analysis=self.mock_music,
            duplicate_clusters=[],
            style_name="CINEMATIC",
            aspect_ratio="16:9",
            target_duration=20.0
        )
        self.assertGreater(len(edl), 2)
        first = edl[0]
        self.assertIn("source_image", first)
        self.assertIn("duration", first)
        self.assertIn("transition", first)
        self.assertIn("motion", first)
        self.assertIn("crop", first)
        self.assertIn("section", first)

if __name__ == "__main__":
    unittest.main()
