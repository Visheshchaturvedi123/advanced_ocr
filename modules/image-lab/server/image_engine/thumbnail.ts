import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const THUMBNAIL_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'thumbnails');

if (!fs.existsSync(THUMBNAIL_CACHE_DIR)) {
  fs.mkdirSync(THUMBNAIL_CACHE_DIR, { recursive: true });
}

export async function getOrCreateThumbnail(
  imagePath: string,
  size: 256 | 512 = 256
): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  const stat = fs.statSync(imagePath);
  const cacheKey = crypto
    .createHash('md5')
    .update(`${imagePath}-${stat.mtimeMs}-${stat.size}-${size}`)
    .digest('hex');

  const thumbPath = path.join(THUMBNAIL_CACHE_DIR, `${cacheKey}.webp`);

  if (fs.existsSync(thumbPath)) {
    return thumbPath;
  }

  // Generate thumbnail with Sharp
  await sharp(imagePath, { failOn: 'none' })
    .rotate()
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toFile(thumbPath);

  return thumbPath;
}

export function getThumbnailCacheStats(): { count: number; totalSizeBytes: number } {
  let count = 0;
  let totalSizeBytes = 0;
  try {
    const files = fs.readdirSync(THUMBNAIL_CACHE_DIR);
    count = files.length;
    for (const f of files) {
      try {
        const s = fs.statSync(path.join(THUMBNAIL_CACHE_DIR, f));
        totalSizeBytes += s.size;
      } catch {}
    }
  } catch {}
  return { count, totalSizeBytes };
}

export function clearThumbnailCache(): void {
  try {
    const files = fs.readdirSync(THUMBNAIL_CACHE_DIR);
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(THUMBNAIL_CACHE_DIR, f));
      } catch {}
    }
  } catch {}
}
