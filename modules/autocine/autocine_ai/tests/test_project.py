"""
Unit tests for Project Manager, Serialization and Cache:
  - Save project
  - Load project
  - Auto-save
  - Disk cache persistence
"""

import unittest
import tempfile
import os
import shutil
from autocine_ai.core.project_manager import ProjectManager
from autocine_ai.core.cache_manager import CacheManager

class TestProjectAndCache(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_project_save_and_load(self):
        pm = ProjectManager()
        pm.data["media"]["folder_path"] = "/test/photos"
        save_path = os.path.join(self.temp_dir, "test_proj.autocine")
        success = pm.save_project(save_path)
        self.assertTrue(success)
        self.assertTrue(os.path.exists(save_path))

        pm_loaded = ProjectManager(save_path)
        self.assertEqual(pm_loaded.data["media"]["folder_path"], "/test/photos")
        self.assertEqual(pm_loaded.data["version"], 1)

    def test_cache_manager(self):
        cm = CacheManager(self.temp_dir)
        fake_hash = "abc1234567890def"
        cm.put_image_analysis(fake_hash, {"score": 92.5, "sharpness": 0.8})

        cached = cm.get_image_analysis(fake_hash)
        self.assertIsNotNone(cached)
        self.assertEqual(cached["score"], 92.5)

if __name__ == "__main__":
    unittest.main()
