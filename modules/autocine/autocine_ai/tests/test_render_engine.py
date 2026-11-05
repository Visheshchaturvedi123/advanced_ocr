"""
Unit tests for Render Engine:
  - FFmpeg command generation
  - Filter graph construction
  - Output validation
"""

import unittest
from autocine_ai.render_engine.filter_graph import FilterGraphBuilder
from autocine_ai.render_engine.ffmpeg_builder import FFmpegBuilder
from autocine_ai.render_engine.output_validator import OutputValidator

class TestRenderEngine(unittest.TestCase):
    def test_filter_graph_builder(self):
        motion = {"type": "ZOOM_IN", "zoom_factor": 1.15}
        zp = FilterGraphBuilder.build_zoompan_filter(motion, duration_s=4.0, fps=30, out_w=1920, out_h=1080)
        self.assertIn("zoompan=", zp)
        self.assertIn("s=1920x1080", zp)
        self.assertIn("d=120", zp)

    def test_ffmpeg_builder_command(self):
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(b"FAKE_AUDIO")
            temp_audio = tmp.name

        try:
            clips = [
                {"source_image": "img1.jpg", "duration": 3.0, "motion": {"type": "ZOOM_IN"}},
                {"source_image": "img2.jpg", "duration": 4.0, "motion": {"type": "PAN_LEFT"}}
            ]
            cmd = FFmpegBuilder.build_render_command(
                ffmpeg_bin="/usr/bin/ffmpeg",
                clips=clips,
                audio_path=temp_audio,
                output_path="final.mp4",
                aspect_ratio="16:9",
                quality_preset="HIGH"
            )
            self.assertIn("-c:v", cmd)
            self.assertIn("libx264", cmd)
            self.assertIn("-crf", cmd)
            self.assertIn("16", cmd)
            self.assertIn("-c:a", cmd)
            self.assertIn("aac", cmd)
        finally:
            if os.path.exists(temp_audio):
                os.remove(temp_audio)

    def test_output_validator_missing_file(self):
        val = OutputValidator.validate_file("ffprobe", "/non/existent/file.mp4")
        self.assertFalse(val["valid"])

if __name__ == "__main__":
    unittest.main()
