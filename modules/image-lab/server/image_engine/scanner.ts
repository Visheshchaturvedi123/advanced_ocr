import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ImageItem, FolderAnalysisSummary } from '../../src/types';

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
]);

export async function scanImageFolder(
  folderPath: string,
  recursive: boolean = true,
  maxFilesLimit: number = 25000
): Promise<{ items: ImageItem[]; summary: FolderAnalysisSummary }> {
  const startTime = Date.now();
  const items: ImageItem[] = [];
  const formatCounts: Record<string, number> = {};

  if (!fs.existsSync(folderPath)) {
    throw new Error(`Directory not found: "${folderPath}"`);
  }

  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: "${folderPath}"`);
  }

  // Recursive or flat directory collector
  function collectFiles(dir: string, baseDir: string) {
    if (items.length >= maxFilesLimit) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (items.length >= maxFilesLimit) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          collectFiles(fullPath, baseDir);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          let fileSize = 0;
          let mtime = Date.now();
          try {
            const fstat = fs.statSync(fullPath);
            fileSize = fstat.size;
            mtime = fstat.mtimeMs;
          } catch {}

          items.push({
            id: Buffer.from(relPath).toString('base64url'),
            filename: entry.name,
            relativePath: relPath,
            fullPath,
            extension: ext.replace('.', ''),
            sizeBytes: fileSize,
            width: 0,
            height: 0,
            megapixels: 0,
            colorSpace: 'srgb',
            hasAlpha: false,
            hasMetadata: false,
            estimatedComplexity: 'medium',
            mtime,
            status: 'pending',
          });

          formatCounts[ext.replace('.', '')] = (formatCounts[ext.replace('.', '')] || 0) + 1;
        }
      }
    }
  }

  collectFiles(folderPath, folderPath);

  // Analyze metadata in controlled batches to preserve memory
  let totalBytes = 0;
  let largestBytes = 0;
  let largestName = '';
  let smallestBytes = items.length > 0 ? Infinity : 0;
  let smallestName = '';
  let transparentCount = 0;
  let orientationFlaggedCount = 0;
  let minDim = Infinity;
  let minDimStr = '0x0';
  let maxDim = 0;
  let maxDimStr = '0x0';

  // Process items in chunks of 50 to avoid file descriptor starvation
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        totalBytes += item.sizeBytes;
        if (item.sizeBytes > largestBytes) {
          largestBytes = item.sizeBytes;
          largestName = item.filename;
        }
        if (item.sizeBytes > 0 && item.sizeBytes < smallestBytes) {
          smallestBytes = item.sizeBytes;
          smallestName = item.filename;
        }

        try {
          const meta = await sharp(item.fullPath, { failOn: 'none' }).metadata();
          item.width = meta.width || 0;
          item.height = meta.height || 0;
          item.megapixels = Number(((item.width * item.height) / 1000000).toFixed(2));
          item.colorSpace = meta.space || 'srgb';
          item.hasAlpha = Boolean(meta.hasAlpha);
          item.orientation = meta.orientation;
          item.hasMetadata = Boolean(meta.exif || meta.icc || meta.xmp || meta.iptc);

          if (item.hasAlpha) transparentCount++;
          if (item.orientation && item.orientation > 1) orientationFlaggedCount++;

          const pixelCount = item.width * item.height;
          if (pixelCount > 0) {
            if (pixelCount < minDim) {
              minDim = pixelCount;
              minDimStr = `${item.width}×${item.height}`;
            }
            if (pixelCount > maxDim) {
              maxDim = pixelCount;
              maxDimStr = `${item.width}×${item.height}`;
            }

            // Complexity estimation based on byte-to-pixel ratio
            const bpp = item.sizeBytes / pixelCount;
            if (bpp > 1.2) {
              item.estimatedComplexity = 'high';
            } else if (bpp < 0.3) {
              item.estimatedComplexity = 'low';
            } else {
              item.estimatedComplexity = 'medium';
            }
          }
        } catch (err: any) {
          // Corrupted or unreadable image: catch exception, record, do not fail batch!
          item.isCorrupted = true;
          item.status = 'failed';
          item.error = `Metadata extraction failed: ${err?.message || 'Corrupted file header'}`;
        }
      })
    );
  }

  if (smallestBytes === Infinity) smallestBytes = 0;

  const summary: FolderAnalysisSummary = {
    inputFolder: folderPath,
    totalImages: items.length,
    totalSizeBytes: totalBytes,
    averageSizeBytes: items.length > 0 ? Math.round(totalBytes / items.length) : 0,
    largestImageBytes: largestBytes,
    largestImageName: largestName,
    smallestImageBytes: smallestBytes,
    smallestImageName: smallestName,
    resolutionMin: minDimStr === '0x0' ? 'N/A' : minDimStr,
    resolutionMax: maxDimStr === '0x0' ? 'N/A' : maxDimStr,
    formatCounts,
    transparentCount,
    orientationFlaggedCount,
    scanDurationMs: Date.now() - startTime,
  };

  return { items, summary };
}
