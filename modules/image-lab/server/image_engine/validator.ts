import fs from 'fs';
import sharp from 'sharp';
import { ValidationLevel } from '../../src/types';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  decodedWidth?: number;
  decodedHeight?: number;
  fileSizeBytes?: number;
}

export async function validateWebPFile(
  filePath: string,
  expectedWidth?: number,
  expectedHeight?: number,
  level: ValidationLevel = 'smart'
): Promise<ValidationResult> {
  if (!fs.existsSync(filePath)) {
    return { isValid: false, errorMessage: 'File does not exist on disk' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 32) {
    return { isValid: false, errorMessage: `File is too small (${stat.size} bytes), corrupted WebP` };
  }

  // Read the whole file into memory ONCE and validate from the buffer.
  // sharp must NEVER open this file by path: on Windows an open sharp/libvips
  // handle blocks the atomic rename + temp-delete that run right after
  // validation, leaving undeletable ".tmp" twins behind ("in use by Node.js").
  let data: Buffer;
  try {
    data = fs.readFileSync(filePath);
  } catch (err: any) {
    return { isValid: false, errorMessage: `Could not read file for validation: ${err?.message}` };
  }

  // 1. Check RIFF & WEBP magic header bytes
  const isRiff = data.toString('utf-8', 0, 4) === 'RIFF';
  const isWebp = data.toString('utf-8', 8, 12) === 'WEBP';
  if (!isRiff || !isWebp) {
    return { isValid: false, errorMessage: 'Invalid WebP header signature (missing RIFF/WEBP)' };
  }

  if (level === 'fast') {
    return { isValid: true, fileSizeBytes: data.length };
  }

  // 2. Smart Level: inspect sharp metadata (from buffer — no file handle)
  try {
    const meta = await sharp(data).metadata();
    if (meta.format !== 'webp') {
      return { isValid: false, errorMessage: `Decoder format mismatch: expected webp, got ${meta.format}` };
    }

    if (expectedWidth && expectedHeight) {
      if (meta.width !== expectedWidth || meta.height !== expectedHeight) {
        return {
          isValid: false,
          errorMessage: `Dimension mismatch: expected ${expectedWidth}x${expectedHeight}, got ${meta.width}x${meta.height}`,
        };
      }
    }

    // 3. Maximum Level: full raw decode to verify complete scanline integrity
    if (level === 'maximum') {
      await sharp(data).raw().toBuffer();
    }

    return {
      isValid: true,
      decodedWidth: meta.width,
      decodedHeight: meta.height,
      fileSizeBytes: data.length,
    };
  } catch (err: any) {
    return { isValid: false, errorMessage: `WebP decode test failed: ${err?.message || 'Corrupt stream'}` };
  }
}
