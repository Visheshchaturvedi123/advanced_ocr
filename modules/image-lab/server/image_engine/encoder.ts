import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  ImageItem,
  OptimizationSettings,
} from '../../src/types';
import { calculateTargetDimensions, determineEffectiveQuality } from './analyzer';
import { validateWebPFile } from './validator';

export interface EncodeResult {
  success: boolean;
  outputPath: string;
  outputSizeBytes: number;
  outputWidth: number;
  outputHeight: number;
  reductionPercent: number;
  durationMs: number;
  error?: string;
}

/**
 * Windows-safe file delete with retries. On Windows, antivirus/indexer/libvips
 * often hold a brief lock on a just-written file, so a single unlinkSync
 * throws EPERM and the temp file is left behind forever. Returns true when
 * the path no longer exists.
 */
export function safeUnlinkSync(targetPath: string, retries = 6, delayMs = 250): boolean {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (!fs.existsSync(targetPath)) return true;
      fs.unlinkSync(targetPath);
      return !fs.existsSync(targetPath);
    } catch {
      if (attempt === retries) return false;
      // Non-blocking sleep that works on all platforms
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
      } catch {}
    }
  }
  return false;
}

const STALE_TMP_PATTERN = /\.tmp$/;

/**
 * Delete leftover encoder temp files (`<name>.webp.<timestamp>.<rand>.tmp`)
 * inside a directory (recursive). Used to self-heal after crashes or failed
 * deletes from previous runs.
 * - onlyWithTwin=true: delete only tmps whose final `.webp` twin exists
 *   (safe: the image already completed successfully).
 * - minAgeMs: skip files newer than this (never touch in-flight writes).
 * Returns the number of files removed.
 */
export function cleanupStaleTempFiles(
  dir: string,
  options: { onlyWithTwin?: boolean; minAgeMs?: number } = {}
): number {
  const { onlyWithTwin = false, minAgeMs = 0 } = options;
  const now = Date.now();
  let removed = 0;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += cleanupStaleTempFiles(fullPath, options);
      continue;
    }
    if (!STALE_TMP_PATTERN.test(entry.name)) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs < minAgeMs) continue; // possibly in-flight, skip

      if (onlyWithTwin) {
        // Twin = temp name minus the trailing ".<timestamp>.<rand>.tmp"
        const twinPath = fullPath.replace(/\.\d+\.[a-z0-9]+\.tmp$/, '');
        if (twinPath === fullPath || !fs.existsSync(twinPath)) continue;
      }

      if (safeUnlinkSync(fullPath, 2, 100)) removed++;
    } catch {}
  }
  return removed;
}

/**
 * Compute where an item's .webp MUST land for a given output folder + settings.
 * Shared by the encoder and the batch cache-resume path so both agree.
 */
export function getExpectedOutputPath(
  item: ImageItem,
  outputDir: string,
  settings: OptimizationSettings
): string {
  // 1. Determine relative output path based on output structure setting
  const relPath = item.relativePath || item.filename || path.basename(item.fullPath);
  const parsedPath = path.parse(relPath);
  const baseWebpName = `${parsedPath.name}.webp`;

  let relativeOutputName = '';
  if (settings.outputStructure === 'preserve') {
    relativeOutputName = path.join(parsedPath.dir, baseWebpName);
  } else if (settings.outputStructure === 'subfolder') {
    relativeOutputName = path.join(parsedPath.dir, 'webp', baseWebpName);
  } else {
    // 'flatten': handle collisions safely with unique suffixes if necessary
    relativeOutputName = baseWebpName;
  }

  return path.join(outputDir, relativeOutputName);
}

export async function encodeToWebp(
  item: ImageItem,
  outputDir: string,
  settings: OptimizationSettings
): Promise<EncodeResult> {
  const startTime = Date.now();

  const finalOutputPath = getExpectedOutputPath(item, outputDir, settings);
  const finalDir = path.dirname(finalOutputPath);
  const tempOutputPath = `${finalOutputPath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;

  // Safety check: Source must exist and have non-zero content
  if (!fs.existsSync(item.fullPath)) {
    return {
      success: false,
      outputPath: finalOutputPath,
      outputSizeBytes: 0,
      outputWidth: 0,
      outputHeight: 0,
      reductionPercent: 0,
      durationMs: Date.now() - startTime,
      error: `Source image file does not exist: "${item.fullPath}"`,
    };
  }

  try {
    const sourceStat = fs.statSync(item.fullPath);
    if (sourceStat.size === 0) {
      return {
        success: false,
        outputPath: finalOutputPath,
        outputSizeBytes: 0,
        outputWidth: 0,
        outputHeight: 0,
        reductionPercent: 0,
        durationMs: Date.now() - startTime,
        error: `Source image is empty (0 bytes)`,
      };
    }
  } catch (statErr: any) {
    return {
      success: false,
      outputPath: finalOutputPath,
      outputSizeBytes: 0,
      outputWidth: 0,
      outputHeight: 0,
      reductionPercent: 0,
      durationMs: Date.now() - startTime,
      error: `Could not inspect source file: ${statErr.message}`,
    };
  }

  // Absolute safety guarantee: Never point to the same file
  if (path.resolve(finalOutputPath) === path.resolve(item.fullPath)) {
    return {
      success: false,
      outputPath: finalOutputPath,
      outputSizeBytes: 0,
      outputWidth: 0,
      outputHeight: 0,
      reductionPercent: 0,
      durationMs: Date.now() - startTime,
      error: `Safety violation: Output path cannot be identical to source path!`,
    };
  }

  // Ensure output directory tree exists
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  try {
    // 2. Initialize sharp pipeline with failOnError: false to handle slightly damaged JPEGs
    let pipeline = sharp(item.fullPath, {
      failOn: 'none',
      limitInputPixels: 268435456, // 256 MP limit for decompression bomb defense
    });

    // Read metadata if not already available
    const metadata = await pipeline.metadata();
    const origWidth = metadata.width || item.width || 1920;
    const origHeight = metadata.height || item.height || 1080;

    // Normalizing EXIF orientation so image is right-side up
    pipeline = pipeline.rotate();

    // 3. Compute target dimensions with strict aspect ratio preservation
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      origWidth,
      origHeight,
      settings
    );

    // Lanczos3 downsampling if dimensions changed
    if (targetWidth !== origWidth || targetHeight !== origHeight) {
      pipeline = pipeline.resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill', // targetWidth and targetHeight already preserve exact aspect ratio
        withoutEnlargement: !settings.allowUpscaling,
      });
    }

    // 4. Metadata and Color Management
    if (settings.metadataPolicy === 'strip') {
      if (settings.colorManagement === 'srgb') {
        pipeline = pipeline.toColorspace('srgb');
      }
    } else {
      pipeline = pipeline.withMetadata({
        orientation: 1,
      });
    }

    // 5. WebP Encoder options
    const effectiveQuality = determineEffectiveQuality(item, settings);
    pipeline = pipeline.webp({
      quality: effectiveQuality,
      lossless: settings.lossless,
      alphaQuality: 95,
      smartSubsample: true,
      effort: 4, // optimal balance for 8GB CPU-only machine
    });

    // 6. Write to temporary file
    await pipeline.toFile(tempOutputPath);

    // 7. Atomic validation
    const validation = await validateWebPFile(
      tempOutputPath,
      targetWidth,
      targetHeight,
      settings.validationLevel
    );

    if (!validation.isValid) {
      // Clean up corrupt temporary file
      if (fs.existsSync(tempOutputPath)) {
        fs.unlinkSync(tempOutputPath);
      }
      throw new Error(`Output validation failed: ${validation.errorMessage}`);
    }

    // 8. Atomic rename to final output filename with Windows-safe fallback.
    // NOTE: on Windows renameSync frequently fails (AV/indexer brief locks),
    // so the copy fallback MUST clean up the temp afterwards or every image
    // leaves a byte-identical .tmp twin behind.
    if (fs.existsSync(finalOutputPath)) {
      safeUnlinkSync(finalOutputPath);
    }
    try {
      fs.renameSync(tempOutputPath, finalOutputPath);
    } catch (renameErr) {
      fs.copyFileSync(tempOutputPath, finalOutputPath);
    }
    // The temp file must be gone at this point (rename removes it; after a
    // copy it has to be deleted). Retry because Windows locks release slowly.
    if (fs.existsSync(tempOutputPath)) {
      if (!safeUnlinkSync(tempOutputPath)) {
        console.warn(`[encoder] Temp file left behind (auto-cleaned at job end): ${tempOutputPath}`);
      }
    }

    const outStat = fs.statSync(finalOutputPath);
    const outputSizeBytes = outStat.size;
    const durationMs = Date.now() - startTime;
    const reductionPercent = Math.max(
      0,
      Number((((item.sizeBytes - outputSizeBytes) / Math.max(1, item.sizeBytes)) * 100).toFixed(1))
    );

    return {
      success: true,
      outputPath: finalOutputPath,
      outputSizeBytes,
      outputWidth: targetWidth,
      outputHeight: targetHeight,
      reductionPercent,
      durationMs,
    };
  } catch (err: any) {
    // Always clean up temporary file if left behind (with Windows lock retries)
    safeUnlinkSync(tempOutputPath);

    return {
      success: false,
      outputPath: finalOutputPath,
      outputSizeBytes: 0,
      outputWidth: 0,
      outputHeight: 0,
      reductionPercent: 0,
      durationMs: Date.now() - startTime,
      error: err?.message || 'Unknown WebP encoding error',
    };
  }
}
