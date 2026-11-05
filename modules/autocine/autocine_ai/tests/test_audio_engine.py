"""
Unit tests for Audio Analysis Engine:
  - BPM estimation
  - Beat timestamps
  - Onsets
  - Duration
  - Section boundaries
"""

import unittest
from autocine_ai.audio_engine.beat_detector import BeatDetector
from autocine_ai.audio_engine.onset_detector import OnsetDetector
from autocine_ai.audio_engine.tempo_detector import TempoDetector
from autocine_ai.audio_engine.energy_analyzer import EnergyAnalyzer
from autocine_ai.audio_engine.section_detector import SectionDetector

class TestAudioEngine(unittest.TestCase):
    def test_beat_detector(self):
        bpm = 120.0  # 0.5s per beat
        duration = 10.0
        beats = BeatDetector.estimate_beats(bpm, duration, first_beat_offset=0.0)
        self.assertEqual(len(beats), 20)
        self.assertEqual(beats[0], 0.0)
        self.assertEqual(beats[1], 0.5)

        downbeats = BeatDetector.filter_downbeats(beats, time_signature=4)
        self.assertEqual(len(downbeats), 5)
        self.assertEqual(downbeats[0], 0.0)
        self.assertEqual(downbeats[1], 2.0)

    def test_onset_detector(self):
        # Synthetic energy curve with sharp spikes
        energy = [0.1, 0.1, 0.9, 0.2, 0.1, 0.1, 0.85, 0.1]
        onsets = OnsetDetector.detect_onsets_from_energy(energy, sample_rate_hz=2.0)
        self.assertGreater(len(onsets), 0)

    def test_tempo_detector(self):
        onsets = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        res = TempoDetector.estimate_bpm_from_transients(onsets, duration=3.0)
        self.assertEqual(res["bpm"], 120.0)
        self.assertGreater(res["tempo_stability"], 0.7)

    def test_section_detector(self):
        energy_data = EnergyAnalyzer.generate_energy_curve(60.0)
        sections = SectionDetector.detect_sections(60.0, energy_data["energy_curve"])
        self.assertGreaterEqual(len(sections), 4)
        section_names = [s["section"] for s in sections]
        self.assertIn("INTRO", section_names)
        self.assertIn("CLIMAX", section_names)
        self.assertIn("OUTRO", section_names)

if __name__ == "__main__":
    unittest.main()
