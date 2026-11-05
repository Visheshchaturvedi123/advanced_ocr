# AutoCine AI Editor — Architecture & Engineering Specification

**Target Platform:** Windows 10/11 (x64)  
**Target Hardware Baseline:** 8 GB RAM, Multi-Core CPU only (No dedicated GPU required), SSD preferred  
**Primary Mission:** Drop a folder of photographs + a music track → Produce a professional, music-synchronized, high-quality video rendered via FFmpeg.

---

## 1. System Philosophy & High-Level Architecture

AutoCine AI Editor is designed around a strictly decoupled pipeline:
```
[ MEDIA INGESTION ]
       │
       ▼
[ ANALYSIS ENGINE ] ──────────────► [ ANALYSIS CACHE (SQLite / JSON) ]
       │                                     ▲
       ▼                                     │ (Re-use on file hash match)
[ EDIT INTELLIGENCE ENGINE ]                 │
       │
       ▼
[ TIMELINE / EDIT DECISION LIST (EDL) ]
       │
       ├──────────────────────────────┬──────────────────────────────┐
       ▼                              ▼                              ▼
[ PREVIEW ENGINE ]           [ PROJECT MANAGER ]           [ FFMPEG RENDER ENGINE ]
  (720p Proxies,               (JSON Portable                (H.264 / AAC, CPU-tuned
   Real-Time Canvas)            Project State)                Filter Graphs)
                                                                     │
                                                                     ▼
                                                           [ OUTPUT VALIDATION ]
                                                             (ffprobe verification)
```

### Core Design Rules
1. **Analyze Once, Cache Forever**: Every source photo and audio track is fingerprinted by a cryptographic hash (SHA-256 / fast xxHash). Analysis results, perceptual hashes, and thumbnails are stored in disk cache.
2. **Never Hold High-Res Images in RAM**: Loading 500 uncompressed 24MP images requires ~36 GB of RAM. The 8 GB system would crash immediately. All image analysis processes images sequentially or in streaming chunks (downsampled to ~1024px for metrics, and 256px for thumbnails).
3. **Chunked Audio Processing**: Audio signals are read in fixed sample frames (e.g. 512 or 1024 samples) via aubio/SciPy rather than loading full multi-channel 32-bit float tracks repeatedly.
4. **Deterministic Edit Decision List (EDL)**: The Edit Decision Engine consumes normalized analysis structs and produces a pure, serializable EDL JSON containing clip start times, durations, Ken Burns motion vectors, transitions, and crop coordinates.
5. **FFmpeg Does the Heavy Lifting**: Python/UI does not render final video frames pixel-by-pixel. Instead, it constructs an optimal FFmpeg filter graph (`zoompan`, `xfade`, `scale`, `concat`, `pad`) executing in a single native process.

---

## 2. Component Responsibilities

| Component | Responsibility | Memory Boundary |
|---|---|---|
| `core/media_scanner.py` | Recursive scan of image/audio files, fast file metadata extraction (EXIF, format, dimensions). | O(1) per file, never opens full bitmap. |
| `core/cache_manager.py` | Disk-backed cache for image scores, audio structs, and proxy paths. | SQLite or lightweight JSON with in-memory LRU. |
| `image_engine/sharpness.py` | Modified Laplacian variance and high-frequency edge energy. | 1024px max dimension working copy. |
| `image_engine/exposure.py` | Luminance histogram, under/over-exposure clipping, dynamic range estimate. | Gray-scale 8-bit array. |
| `image_engine/composition.py` | Rule-of-thirds focal mass, visual balance, edge distribution. | Low-res edge map. |
| `image_engine/face_analysis.py` | Classical Haar Cascade / LBP face detector (no heavy neural nets needed for base). | Grayscale scaled input. |
| `image_engine/duplicate_detector.py` | Perceptual 64-bit dHash + Hamming distance clustering. | 8-byte hash per photo. |
| `image_engine/image_ranker.py` | Explainable weighted technical score (25% quality, 15% sharpness, 10% exposure, 10% composition, 10% color, 10% faces, 10% resolution, 10% uniqueness). | Pure numeric scoring. |
| `audio_engine/audio_analyzer.py` | Orchestrates aubio/SciPy chunked analysis. | Streaming chunks (512-hop). |
| `audio_engine/beat_detector.py` | BPM detection, beat timestamps, downbeat grid alignment. | Vector of float timestamps. |
| `audio_engine/energy_analyzer.py` | RMS loudness curve, spectral centroid, low/mid/high frequency energy. | Downsampled energy curve (20-50 Hz). |
| `audio_engine/section_detector.py` | Heuristic segmentation (Intro, Build, High Energy, Climax, Breakdown, Outro). | Segment list with confidence. |
| `edit_engine/sequence_optimizer.py` | Diversity-aware sequencer (shot variety: wide, portrait, detail, group, location). | Combinatorial graph search. |
| `edit_engine/pacing_engine.py` | Section-aware pacing (Intro = long, High Energy = short beats, Climax = rapid). | EDL generation. |
| `edit_engine/motion_engine.py` | Ken Burns motion parameter generator (pan, zoom, tilt) respecting face bounding boxes. | Linear motion structs. |
| `edit_engine/crop_engine.py` | Smart crop (16:9, 9:16, 1:1, 4:5) protecting detected subjects/faces. | Normalized rects. |
| `timeline/models.py` | Typed dataclasses representing Clip, Track, Transition, Marker, Section. | Small memory footprint. |
| `preview/preview_engine.py` | 720p proxy generation and real-time canvas preview. | Single active proxy frame in RAM. |
| `render_engine/ffmpeg_builder.py` | Generates complex FFmpeg filter graphs (`zoompan`, `xfade`, `apad`). | String builder. |
| `render_engine/renderer.py` | Executes FFmpeg subprocess with stdout progress tracking. | Zero Python frame buffer overhead. |
| `render_engine/output_validator.py` | Runs `ffprobe` to verify file size, duration, codecs, audio sync. | JSON probe verification. |

---

## 3. Data Flow

```
1. Scan Folder ──────────► [Media Items (path, size, mtime)]
                                │
2. File Hash Check ──────► [Cache Hit?] ─── YES ──► [Load Cached Analysis]
                                │ NO
                                ▼
                       [Downsample to 1024px]
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
     [Technical Quality]    [Composition]     [Perceptual dHash]
     (Sharpness, Exposure,  (Focal balance,   (Near-duplicate
      Color, Dynamic Range)  Face detection)   cluster group)
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
                     [Composite Image Score]
                                │
3. Audio Ingestion ──────► [Chunked FFT & aubio]
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
       [BPM & Beats]      [Onset Curves]      [Energy & Spectrum]
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
                     [Musical Sections & Grid]
                                │
4. Edit Intelligence ────► [Sequence Optimizer & Diversity Matcher]
                                │
5. Style Engine ─────────► [Pacing, Motions, Transitions applied to EDL]
                                │
6. Output ───────────────► [Preview Proxy Player] OR [FFmpeg Master Render]
```

---

## 4. Memory Strategy (Targeting 8 GB RAM)

1. **Working Set Cap**: The application caps its internal memory footprint to < 800 MB at all times.
2. **Analysis Downsampling**: Raw 24MP-48MP images are decoded through streaming decoders and immediately resized to a maximum bounding box of 1024x1024 for feature extraction, and 256x256 for thumbnails.
3. **Explicit Garbage Collection**: Image buffers in Python/OpenCV are deleted immediately after feature extraction to prevent memory fragmentation.
4. **Thumbnail Cache on Disk**: All generated thumbnails are stored in `.autocine_cache/thumbs/` as JPEG files (quality 80), keeping heap size minimal.
5. **Worker Thread Limiting**:
   - `LOW MEMORY (8 GB default)`: Maximum 2 concurrent worker threads for analysis, batch size = 5 photos.
   - `BALANCED`: 4 worker threads.
   - `HIGH PERFORMANCE`: `min(8, CPU_CORES)`.

---

## 5. Threading & Concurrency Strategy

- **UI Thread Safety**: The PySide6 / React UI thread is never blocked by file I/O, image processing, or FFmpeg child processes.
- **Worker Pool**: Operations use a managed Job Manager (`QThreadPool` in desktop / worker queue in backend) with progress signals (`progress_percent`, `status_text`, `eta_seconds`, `cancel_requested`).
- **Cancellation**: Every worker checks a thread-safe `is_cancelled` token between image batches and audio frames, permitting instant abort without leaving orphan processes.

---

## 6. FFmpeg Strategy

- **Single Execution Pipeline**: Rather than spinning up intermediate video encoders for every photograph, AutoCine AI creates an integrated filter graph:
  - Input images are supplied as looped inputs with `zoompan` filters generating Ken Burns subtle motion at target resolution.
  - Successive clips are linked via `xfade` (transitions: fade, wipeleft, wiperight, slideup, slidedown, circlecrop) or hard cuts.
  - Audio is trimmed and mixed with `-c:a aac -b:a 320k -ar 48000`.
- **CPU Tuning for 8 GB PC**:
  - Codec: `libx264`
  - Presets: `faster` (default), `medium` (high quality), `slow` (master).
  - Threads: `-threads 0` or restricted to `CPU_CORES - 1` to ensure the operating system stays responsive.
  - Options: `+faststart` for immediate playback.

---

## 7. Licensing Strategy & Dependency Analysis

See `THIRD_PARTY_LICENSES.md` for full breakdown.
- **PySide6**: LGPLv3 (Dynamic linking complies with open-source desktop deployment).
- **FFmpeg / FFprobe**: LGPLv2.1+ (used as external CLI subprocess binaries).
- **OpenCV / NumPy / SciPy / Pillow**: BSD/MIT/Apache permissive licenses.
- **aubio**: GPLv3 (compiled audio analysis library).
- **AutoCine AI Codebase**: Clean-room implementation inspired by concepts in Auto-Editor and PySceneDetect, with 100% original code tailored for automated photo slideshow montage production.
