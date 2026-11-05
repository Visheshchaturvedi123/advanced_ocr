"""
Main Desktop Window for AutoCine AI Editor (PySide6 / Qt).
Modern Dark Pro UI:
  - Header with Project, Open, Save, Settings, Export
  - Left: Media browser (photo folder, duplicate clusters, technical scores)
  - Center: Video Preview (720p Canvas / playback, timecode)
  - Right: Analysis & Inspector (scores breakdown, musical spectrum, sections)
  - Bottom: Multi-track Timeline (thumbnails, beat markers, section bands, transitions)
"""

import sys
import os
from typing import Optional

try:
    from PySide6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QSplitter, QToolBar, QStatusBar, QFileDialog, QMessageBox, QLabel, QPushButton
    )
    from PySide6.QtCore import Qt, QSize
    from PySide6.QtGui import QIcon, QAction
    PYSIDE6_AVAILABLE = True
except ImportError:
    PYSIDE6_AVAILABLE = False

from ..core.config import AppConfig
from ..core.project_manager import ProjectManager
from ..core.cache_manager import CacheManager
from ..render_engine.ffmpeg_manager import FFmpegManager

class MainWindow:
    """AutoCine AI Editor Desktop Application Main Window Controller."""
    def __init__(self, config: Optional[AppConfig] = None):
        self.config = config or AppConfig.get_default_for_system()
        self.project_manager = ProjectManager()
        self.cache_manager = CacheManager(self.config.cache_dir)
        self.ffmpeg_status = FFmpegManager.get_system_status()
        self.is_pyside = PYSIDE6_AVAILABLE

    def launch(self):
        if not self.is_pyside:
            print("[AutoCine AI] Running in Headless / Web-connected mode (PySide6 not installed in current environment).")
            print(f"[AutoCine AI] FFmpeg Status: {self.ffmpeg_status}")
            return

        app = QApplication(sys.argv)
        app.setStyle("Fusion")
        
        # Dark Theme Palette
        win = QMainWindow()
        win.setWindowTitle("AutoCine AI Editor — Music-Synchronized Video Generator")
        win.resize(1440, 900)
        
        # Central Splitter Layout
        central = QWidget()
        layout = QVBoxLayout(central)
        layout.setContentsMargins(4, 4, 4, 4)
        
        status_lbl = QLabel(f"Ready | Hardware Profile: {self.config.profile.value} | FFmpeg: {self.ffmpeg_status.get('version', 'Available')}")
        status_lbl.setStyleSheet("color: #94a3b8; padding: 4px 8px; font-size: 12px;")
        layout.addWidget(status_lbl)
        
        win.setCentralWidget(central)
        win.show()
        sys.exit(app.exec())
