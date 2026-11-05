"""
AutoCine AI Editor Application Entry Point.
Launches PySide6 Desktop GUI or executes CLI pipeline commands.
"""

import sys
import os
import argparse

from autocine_ai.core.config import AppConfig
from autocine_ai.ui.main_window import MainWindow
from autocine_ai.render_engine.ffmpeg_manager import FFmpegManager

def main():
    parser = argparse.ArgumentParser(description="AutoCine AI Editor — Music-Synchronized Video Editor")
    parser.add_argument("--cli", action="store_true", help="Run in headless CLI mode")
    parser.add_argument("--photos", type=str, help="Path to photo folder")
    parser.add_argument("--music", type=str, help="Path to music file")
    parser.add_argument("--output", type=str, default="output.mp4", help="Output MP4 file path")
    parser.add_argument("--style", type=str, default="CINEMATIC", help="Editing style profile")
    args = parser.parse_args()

    config = AppConfig.get_default_for_system()
    status = FFmpegManager.get_system_status()

    if args.cli:
        print("[AutoCine AI] Headless CLI Mode Active")
        print(f"System Cores: {os.cpu_count()} | Profile: {config.profile.value}")
        print(f"FFmpeg Status: {status}")
        return

    # Start desktop UI
    window = MainWindow(config)
    window.launch()

if __name__ == "__main__":
    main()
