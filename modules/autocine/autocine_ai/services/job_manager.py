"""
Asynchronous Job and Worker Coordinator.
Provides thread-pool execution, progress tracking, and cancellation hooks.
"""

import threading
import queue
import time
from typing import Callable, Any, Optional, Dict

class JobManager:
    def __init__(self, max_workers: int = 2):
        self.max_workers = max_workers
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def start_job(self, job_id: str, target: Callable, args: tuple = (), kwargs: dict = {}) -> threading.Thread:
        with self._lock:
            self.active_jobs[job_id] = {
                "id": job_id,
                "status": "RUNNING",
                "progress": 0.0,
                "message": "Starting...",
                "cancelled": False,
                "start_time": time.time()
            }

        def runner():
            try:
                target(*args, **kwargs)
                with self._lock:
                    if job_id in self.active_jobs:
                        self.active_jobs[job_id]["status"] = "COMPLETED"
                        self.active_jobs[job_id]["progress"] = 100.0
            except Exception as e:
                with self._lock:
                    if job_id in self.active_jobs:
                        self.active_jobs[job_id]["status"] = "FAILED"
                        self.active_jobs[job_id]["error"] = str(e)

        t = threading.Thread(target=runner, daemon=True)
        t.start()
        return t

    def cancel_job(self, job_id: str) -> None:
        with self._lock:
            if job_id in self.active_jobs:
                self.active_jobs[job_id]["cancelled"] = True
                self.active_jobs[job_id]["status"] = "CANCELLED"

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.active_jobs.get(job_id)
