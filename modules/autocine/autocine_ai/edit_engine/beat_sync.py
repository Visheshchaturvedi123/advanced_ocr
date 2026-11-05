"""
Beat Grouping and Synchronization.
Aligns cut points strictly to musical beats and downbeat boundaries.
"""

from typing import List

class BeatSync:
    @staticmethod
    def snap_to_nearest_beat(time_s: float, beats: List[float]) -> float:
        """Snaps a calculated duration or cut point to the closest musical beat."""
        if not beats:
            return round(time_s, 2)
        closest = min(beats, key=lambda b: abs(b - time_s))
        return round(closest, 2)

    @staticmethod
    def partition_timeline_by_beats(
        total_duration: float,
        beats: List[float],
        desired_clip_count: int,
        strategy: str = "BAR_LEVEL"
    ) -> List[float]:
        """Calculates beat-synchronized cut timestamps across timeline."""
        if not beats or desired_clip_count <= 1:
            step = total_duration / max(1, desired_clip_count)
            return [round(i * step, 2) for i in range(desired_clip_count + 1)]

        # If beats exist, group by strategy
        stride = 4 if strategy == "BAR_LEVEL" else (2 if strategy == "DOUBLE_BEAT" else 1)
        sub_beats = beats[::stride]
        
        # Select target points evenly from sub_beats
        if len(sub_beats) > desired_clip_count:
            step = len(sub_beats) / float(desired_clip_count)
            cuts = [0.0] + [sub_beats[int(i * step)] for i in range(1, desired_clip_count)] + [total_duration]
            return sorted(list(set(cuts)))
        else:
            return [0.0] + sub_beats + [total_duration]
