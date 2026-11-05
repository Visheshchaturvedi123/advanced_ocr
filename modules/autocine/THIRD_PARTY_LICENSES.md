# AutoCine AI Editor — Third-Party Licenses & Compliance

AutoCine AI Editor utilizes external open-source software and libraries as technical references and direct dependencies. This document lists the licensing terms and compliance strategy.

---

## 1. Direct Dependencies

| Library / Tool | Primary Function | License | Distribution Note |
|---|---|---|---|
| **Python** (3.10+) | Programming Language Runtime | PSF License | Permissive |
| **PySide6 / Qt** | Desktop GUI Framework | LGPLv3 | Dynamically imported. Users may replace with compatible Qt builds. |
| **FFmpeg & FFprobe** | Video/Audio encoding, filtering & inspection | LGPLv2.1+ / GPLv3 | Called as external command-line sub-processes. Binaries are not statically linked. |
| **OpenCV (opencv-python)** | Image feature extraction, Laplacian sharpness, color spaces | Apache 2.0 | Permissive |
| **Pillow (PIL)** | Image I/O, format conversion, EXIF decoding | HPND / PIL Software License | Permissive |
| **NumPy** | Array manipulation, mathematical operations | BSD 3-Clause | Permissive |
| **SciPy** | Signal processing, peak detection, filter bands | BSD 3-Clause | Permissive |
| **aubio** | Onset detection, beat tracking, pitch analysis | GPLv3 | Permissive/GPL |
| **imagehash** | Perceptual hashing (dHash, aHash, pHash) | BSD 2-Clause | Permissive |
| **PySceneDetect** | Reference for adaptive thresholding concepts | BSD 3-Clause | Reference only / optional |
| **React / TypeScript / Vite** | Web Preview & Full-Stack UI Layer | MIT | Permissive |
| **Lucide React** | Desktop & Media Icons | ISC | Permissive |

---

## 2. Reference Projects (Concepts Only)

The following repositories were reviewed strictly as technical references for algorithms and architectural concepts. No proprietary source code was blindly copied:

1. **Auto-Editor (WyattBlue/auto-editor)** — Reference for automated editorial thresholds and FFmpeg pipeline structuring.
2. **PySceneDetect (Breakthrough/PySceneDetect)** — Reference for adaptive edge & color thresholding.
3. **aubio (aubio/aubio)** — Reference for C-level audio feature extraction and onset detection.
4. **photo-quality-analyzer (prasadabhishek/photo-quality-analyzer)** — Reference for multi-factor technical scoring metrics.
5. **PyAV (PyAV-Org/PyAV)** — Reference for FFmpeg container introspection.
6. **Remotion (remotion-dev/remotion)** — Reference for declarative timeline models.
7. **FFmpeg (FFmpeg/FFmpeg)** — Core final rendering engine.

---

## 3. Commercial & Redistribution Compliance

- **No Static Linking of GPL/LGPL Components**: FFmpeg is invoked via process execution (`subprocess.Popen`), preserving the clean separation mandated by LGPL/GPL.
- **Source Code Availability**: AutoCine AI Editor's custom modules are distributed cleanly with clear dependency declarations.
- **Hardware Optimization Notice**: In compliance with our design goals, heavy neural networks (e.g. PyTorch, YOLOv8) are omitted from the default package to ensure guaranteed performance on 8 GB RAM machines.
