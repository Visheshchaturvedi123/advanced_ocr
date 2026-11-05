"""
BPM and Tempo stability detector.
"""

from typing import Dict, Any

class TempoDetector:
    @staticmethod
    def estimate_bpm_from_transients(onsets: list, duration: float) -> Dict[str, Any]:
        """Estimates BPM from inter-onset intervals (IOI)."""
        if len(onsets) < 4:
            return {"bpm": 120.0, "confidence": 0.5, "tempo_stability": 0.8}

        intervals = [onsets[i] - onsets[i - 1] for i in range(1, len(onsets))]
        # Filter plausible beat intervals (0.3s -> 200 BPM, 1.2s -> 50 BPM)
        valid = [dt for dt in intervals if 0.28 <= dt <= 1.25]
        if not valid:
            return {"bpm": 120.0, "confidence": 0.5, "tempo_stability": 0.75}

        median_dt = sorted(valid)[len(valid) // 2]
        raw_bpm = 60.0 / median_dt

        # Normalize to standard dance/pop/cinematic range 75 - 150 BPM
        while raw_bpm < 75.0:
            raw_bpm *= 2.0
        while raw_bpm > 155.0:
            raw_bpm /= 2.0

        bpm = round(raw_bpm, 1)
        variance = sum((dt - median_dt) ** 2 for dt in valid) / len(valid)
        stability = round(max(0.4, min(1.0, 1.0 - variance * 8.0)), 2)

        return {
            "bpm": bpm,
            "confidence": 0.85,
            "tempo_stability": stability
        }
