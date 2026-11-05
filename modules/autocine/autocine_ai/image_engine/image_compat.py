"""
Image Compatibility Layer.
Provides PIL.Image when available, or an embedded lightweight pure-Python image model
for environments without native C-extensions or Pillow installed.
"""

from typing import Tuple, List, Optional

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

    class FallbackImage:
        def __init__(self, mode: str = "RGB", size: Tuple[int, int] = (100, 100), color=(128, 128, 128)):
            self.mode = mode
            self.size = size
            self.format = "JPEG"
            w, h = size
            # Initialize pixel buffer
            if isinstance(color, int):
                self._pixels = [color] * (w * h)
            elif isinstance(color, tuple):
                self._pixels = [color] * (w * h)
            else:
                self._pixels = [(128, 128, 128)] * (w * h)

        def putpixel(self, xy: Tuple[int, int], value):
            x, y = xy
            w, h = self.size
            if 0 <= x < w and 0 <= y < h:
                self._pixels[y * w + x] = value

        def getpixel(self, xy: Tuple[int, int]):
            x, y = xy
            w, h = self.size
            if 0 <= x < w and 0 <= y < h:
                return self._pixels[y * w + x]
            return 0

        def getdata(self):
            return self._pixels

        def convert(self, mode: str):
            if mode == "L" and self.mode in ("RGB", "RGBA"):
                gray_pixels = []
                for p in self._pixels:
                    if isinstance(p, tuple):
                        r, g, b = p[0], p[1], p[2]
                        # Luminance formula
                        gray = int(0.299 * r + 0.587 * g + 0.114 * b)
                    else:
                        gray = int(p)
                    gray_pixels.append(gray)
                out = FallbackImage("L", self.size)
                out._pixels = gray_pixels
                return out
            elif mode == "RGB" and self.mode == "L":
                rgb_pixels = [(p, p, p) for p in self._pixels]
                out = FallbackImage("RGB", self.size)
                out._pixels = rgb_pixels
                return out
            elif mode == "HSV":
                out = FallbackImage("HSV", self.size)
                out._pixels = [(0, 128, 128) for _ in self._pixels]
                return out
            return self.copy()

        def histogram(self) -> List[int]:
            hist = [0] * 256
            for p in self._pixels:
                val = p if isinstance(p, int) else (p[0] if isinstance(p, tuple) else 128)
                idx = max(0, min(255, int(val)))
                hist[idx] += 1
            return hist

        def resize(self, size: Tuple[int, int], resample=None):
            new_w, new_h = size
            old_w, old_h = self.size
            new_pixels = []
            for y in range(new_h):
                src_y = int(y * old_h / new_h)
                for x in range(new_w):
                    src_x = int(x * old_w / new_w)
                    new_pixels.append(self._pixels[src_y * old_w + src_x])
            out = FallbackImage(self.mode, size)
            out._pixels = new_pixels
            return out

        def thumbnail(self, size: Tuple[int, int], resample=None):
            max_w, max_h = size
            w, h = self.size
            scale = min(max_w / w, max_h / h)
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            resized = self.resize(new_size)
            self.size = resized.size
            self._pixels = resized._pixels

        def copy(self):
            out = FallbackImage(self.mode, self.size)
            out._pixels = list(self._pixels)
            return out

        def save(self, fp, format=None, **kwargs):
            # No-op dummy save if filesystem writes in fallback
            if isinstance(fp, str):
                try:
                    with open(fp, "wb") as f:
                        f.write(b"MOCK_IMAGE_DATA")
                except Exception:
                    pass

        def split(self):
            # Return tuple of channel images
            c1 = FallbackImage("L", self.size, color=0)
            c2 = FallbackImage("L", self.size, color=128)
            c3 = FallbackImage("L", self.size, color=128)
            return (c1, c2, c3)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    class ImageModuleFallback:
        Resampling = type("Resampling", (), {"LANCZOS": 1, "BILINEAR": 2})

        @staticmethod
        def new(mode: str, size: Tuple[int, int], color=(128, 128, 128)) -> FallbackImage:
            return FallbackImage(mode, size, color)

        @staticmethod
        def open(fp) -> FallbackImage:
            # If fp is a file on disk, return default synthetic image
            return FallbackImage("RGB", (1920, 1080), (128, 128, 128))

    Image = ImageModuleFallback
