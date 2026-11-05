"""
System Hardware Profiler & Memory Safeguard.
Detects available RAM, logical CPU cores, and enforces low-memory limits for 8 GB systems.
"""

import os
import psutil
import multiprocessing
from typing import Dict, Any

class HardwareManager:
    @staticmethod
    def get_hardware_info() -> Dict[str, Any]:
        cpu_cores = multiprocessing.cpu_count()
        total_ram_gb = 8.0
        avail_ram_gb = 4.0

        try:
            import psutil
            mem = psutil.virtual_memory()
            total_ram_gb = round(mem.total / (1024 ** 3), 1)
            avail_ram_gb = round(mem.available / (1024 ** 3), 1)
        except Exception:
            # Fallback estimation
            pass

        # Recommended profile
        if total_ram_gb <= 8.5:
            profile = "LOW_MEMORY"
            max_workers = 2
            batch_size = 5
        elif total_ram_gb <= 16.5:
            profile = "BALANCED"
            max_workers = 4
            batch_size = 10
        else:
            profile = "HIGH_PERFORMANCE"
            max_workers = min(8, cpu_cores)
            batch_size = 20

        return {
            "cpu_cores": cpu_cores,
            "total_ram_gb": total_ram_gb,
            "avail_ram_gb": avail_ram_gb,
            "recommended_profile": profile,
            "recommended_workers": max_workers,
            "recommended_batch_size": batch_size
        }
