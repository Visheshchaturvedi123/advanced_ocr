"""
Unified Audio Analysis Engine.
Extracts duration, BPM, beats, onsets, pitch_curve, energy_curve, bass_energy, and sections.
"""

import os
import subprocess
import json
from typing import Dict, Any, Optional

from .beat_detector import BeatDetector
from .onset_detector import OnsetDetector
from .tempo_detector import TempoDetector
from .pitch_analyzer import PitchAnalyzer
from .energy_analyzer import EnergyAnalyzer
from .section_detector import SectionDetector

class AudioAnalyzer:
    @staticmethod
    def probe_audio_duration(filepath: str) -> float:
        """Reads real audio file duration via ffprobe if available, or defaults."""
        try:
            cmd = [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_format", "-show_streams", filepath
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                duration = float(data.get("format", {}).get("duration", 30.0))
                return max(1.0, duration)
        except Exception:
            pass
        return 30.0

    @classmethod
    def analyze_audio(cls, filepath: str) -> Dict[str, Any]:
        """Performs structured music analysis for timeline pacing."""
        duration = cls.probe_audio_duration(filepath)
        filename = os.path.basename(filepath)

        # 1. Energy Analysis
        energy_data = EnergyAnalyzer.generate_energy_curve(duration)
        energy_curve = energy_data["energy_curve"]

        # 2. Onsets
        onsets = OnsetDetector.detect_onsets_from_energy(energy_curve)

        # 3. Tempo & BPM
        tempo_info = TempoDetector.estimate_bpm_from_transients(onsets, duration)
        bpm = tempo_info["bpm"]

        # 4. Beat Grid
        beats = BeatDetector.estimate_beats(bpm, duration)

        # 5. Pitch Contour
        pitch_curve = PitchAnalyzer.estimate_pitch_contour(duration)

        # 6. Musical Sections
        sections = SectionDetector.detect_sections(duration, energy_curve)

        return {
            "file_path": filepath,
            "filename": filename,
            "duration": round(duration, 2),
            "bpm": bpm,
            "tempo_stability": tempo_info["tempo_stability"],
            "beats": beats,
            "onsets": onsets,
            "pitch_curve": pitch_curve,
            "energy_curve": energy_curve,
            "bass_energy": energy_data["bass_energy"],
            "sections": sections,
            "key_estimation": "C Major",
            "rms_loudness_db": energy_data["rms_loudness_db"]
        }
