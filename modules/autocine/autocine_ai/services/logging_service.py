"""
Diagnostic Logging Service.
Records media scanning, analysis exceptions, and FFmpeg filter commands.
"""

import logging
import os
import sys

def setup_logger(log_file: str = "autocine.log") -> logging.Logger:
    logger = logging.getLogger("AutoCine")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s")
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(formatter)
        logger.addHandler(sh)
        try:
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fh.setFormatter(formatter)
            logger.addHandler(fh)
        except Exception:
            pass
    return logger

log = setup_logger()
