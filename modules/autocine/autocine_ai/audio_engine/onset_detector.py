"""
Onset and transient detector for rhythm and musical transitions.
"""

from typing import List

class OnsetDetector:
    @staticmethod
    def detect_onsets_from_energy(energy_curve: List[float], sample_rate_hz: float = 20.0, threshold_multiplier: float = 1.4) -> List[float]:
        """Detects sudden spikes in signal energy (onsets / transients)."""
        if len(energy_curve) < 3:
            return []
        
        onsets: List[float] = []
        for i in range(1, len(energy_curve) - 1):
            prev_e = energy_curve[i - 1]
            curr_e = energy_curve[i]
            next_e = energy_curve[i + 1]
            
            # Local peak condition
            if curr_e > prev_e and curr_e >= next_e:
                if curr_e > (prev_e * threshold_multiplier) and curr_e > 0.15:
                    timestamp = round(i / sample_rate_hz, 3)
                    onsets.append(timestamp)

        return onsets
