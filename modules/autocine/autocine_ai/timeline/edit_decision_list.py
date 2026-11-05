"""
Edit Decision List (EDL) Serializer and CMX3600 text exporter.
"""

from typing import List, Dict, Any
import json

class EDLSerializer:
    @staticmethod
    def to_json(edl_items: List[Dict[str, Any]]) -> str:
        return json.dumps(edl_items, indent=2)

    @staticmethod
    def to_cmx3600(edl_items: List[Dict[str, Any]], fps: int = 30) -> str:
        """Converts timeline items into standard CMX 3600 EDL plain text format."""
        lines = [
            "TITLE: AUTOCINE_AI_EDIT",
            "FCM: NON-DROP FRAME",
            ""
        ]

        def to_tc(seconds: float) -> str:
            total_frames = int(seconds * fps)
            f = total_frames % fps
            s = (total_frames // fps) % 60
            m = (total_frames // (fps * 60)) % 60
            h = total_frames // (fps * 3600)
            return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"

        for idx, item in enumerate(edl_items):
            event_num = f"{idx + 1:03d}"
            reel = "AX"
            track = "V"
            t_type = item.get("transition", {}).get("type", "CUT")
            edit_type = "C" if t_type == "CUT" else "D"
            trans_dur = int(item.get("transition", {}).get("duration", 0.0) * fps)
            edit_desc = f"{edit_type}        " if edit_type == "C" else f"D    {trans_dur:03d} "

            src_in = "00:00:00:00"
            src_out = to_tc(item.get("duration", 3.0))
            rec_in = to_tc(item.get("start_time", 0.0))
            rec_out = to_tc(item.get("start_time", 0.0) + item.get("duration", 3.0))

            lines.append(f"{event_num}  {reel}      {track}     {edit_desc}{src_in} {src_out} {rec_in} {rec_out}")
            lines.append(f"* FROM CLIP NAME: {item.get('filename', 'untitled')}")
            lines.append(f"* SHOT TYPE: {item.get('shot_type', 'image')}")
            lines.append(f"* SECTION: {item.get('section', 'MAIN')}")
            lines.append("")

        return "\n".join(lines)
