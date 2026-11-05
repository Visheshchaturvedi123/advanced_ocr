import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface DatasetGenerationProgress {
  total: number;
  current: number;
  folder: string;
  status: 'generating' | 'completed' | 'failed';
  error?: string;
}

export async function generateTestDataset(
  targetDir: string,
  count: number = 50,
  onProgress?: (p: DatasetGenerationProgress) => void
): Promise<string> {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Pre-generate subfolders to test recursive scanning
  const subdirs = ['Nature', 'Portraits', 'Architecture', 'Graphics', 'Corrupted_Test'];
  for (const s of subdirs) {
    const subpath = path.join(targetDir, s);
    if (!fs.existsSync(subpath)) fs.mkdirSync(subpath, { recursive: true });
  }

  const presets = [
    { w: 3840, h: 2160, type: 'Nature', format: 'jpg' },
    { w: 2560, h: 1440, type: 'Portraits', format: 'jpg' },
    { w: 1920, h: 1080, type: 'Architecture', format: 'png' },
    { w: 1200, h: 800, type: 'Graphics', format: 'png' },
    { w: 4000, h: 3000, type: 'Nature', format: 'jpg' },
    { w: 2400, h: 1600, type: 'Architecture', format: 'webp' },
  ];

  for (let i = 1; i <= count; i++) {
    const preset = presets[(i - 1) % presets.length];
    const subfolder = preset.type;
    const filename = `IMG_${String(i).padStart(4, '0')}.${preset.format}`;
    const filePath = path.join(targetDir, subfolder, filename);

    if (onProgress) {
      onProgress({
        total: count,
        current: i,
        folder: targetDir,
        status: 'generating',
      });
    }

    if (fs.existsSync(filePath)) {
      continue;
    }

    // Deliberate 1 corrupted image in the corrupted folder to test resilience
    if (i === 13) {
      const corruptPath = path.join(targetDir, 'Corrupted_Test', 'CORRUPT_SAMPLE_001.jpg');
      fs.writeFileSync(corruptPath, Buffer.from('NOT_A_REAL_JPEG_HEADER_CORRUPT_BYTES_DATA'));
      continue;
    }

    // Generate real visual image with gradients, color patterns, or alpha
    const hue = (i * 37) % 360;
    const r = Math.round(128 + 127 * Math.sin((hue * Math.PI) / 180));
    const g = Math.round(128 + 127 * Math.sin(((hue + 120) * Math.PI) / 180));
    const b = Math.round(128 + 127 * Math.sin(((hue + 240) * Math.PI) / 180));

    // Create SVG pattern with geometric noise and overlay text
    const svg = `
      <svg width="${preset.w}" height="${preset.h}">
        <defs>
          <linearGradient id="grad_${i}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(${r},${g},${b});stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(${b},${r},${g});stop-opacity:1" />
          </linearGradient>
          <pattern id="pat_${i}" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="30" fill="rgba(255,255,255,0.15)" />
            <rect x="10" y="10" width="20" height="20" fill="rgba(0,0,0,0.1)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad_${i})" />
        <rect width="100%" height="100%" fill="url(#pat_${i})" />
        <circle cx="${preset.w / 2}" cy="${preset.h / 2}" r="${Math.min(preset.w, preset.h) / 3}" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="8" />
        <text x="50" y="${preset.h - 100}" font-family="Arial" font-size="48" fill="white" font-weight="bold">Local Batch Optimizer Test Sample #${i} - ${preset.w}x${preset.h}</text>
      </svg>
    `;

    let pipeline = sharp(Buffer.from(svg));

    if (preset.format === 'png') {
      await pipeline.png({ compressionLevel: 6 }).toFile(filePath);
    } else if (preset.format === 'webp') {
      await pipeline.webp({ quality: 95 }).toFile(filePath);
    } else {
      await pipeline
        .jpeg({ quality: 92 })
        .withMetadata({
          orientation: (i % 8) + 1, // simulated EXIF orientation
        })
        .toFile(filePath);
    }
  }

  if (onProgress) {
    onProgress({
      total: count,
      current: count,
      folder: targetDir,
      status: 'completed',
    });
  }

  return targetDir;
}
