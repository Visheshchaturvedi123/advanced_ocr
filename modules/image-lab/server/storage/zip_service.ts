import * as _archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

/**
 * Creates an archiver instance compatible across archiver v7 (function) and v8+ (ZipArchive class)
 */
function createZipArchive(options: any = {}) {
  const mod: any = _archiver;
  if (mod.ZipArchive) {
    return new mod.ZipArchive(options);
  }
  if (mod.default?.ZipArchive) {
    return new mod.default.ZipArchive(options);
  }
  if (typeof mod === 'function') {
    return mod('zip', options);
  }
  if (typeof mod.default === 'function') {
    return mod.default('zip', options);
  }
  throw new Error('Could not instantiate ZIP archive provider');
}

interface FileEntry {
  fullPath: string;
  relativePath: string;
  size: number;
}

/**
 * Recursively scans a directory for image files, ignoring temporary .tmp and system files
 */
function collectExportableFiles(dir: string, baseRelative: string = ''): FileEntry[] {
  const results: FileEntry[] = [];
  if (!fs.existsSync(dir)) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = baseRelative ? path.join(baseRelative, entry.name) : entry.name;

      if (entry.isDirectory()) {
        results.push(...collectExportableFiles(full, rel));
      } else if (entry.isFile()) {
        // Skip .tmp files or non-image artifacts
        if (entry.name.endsWith('.tmp') || entry.name.startsWith('.')) continue;
        try {
          const stat = fs.statSync(full);
          if (stat.size > 0) {
            results.push({ fullPath: full, relativePath: rel, size: stat.size });
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return results;
}

/**
 * Streams all optimized files from an output folder directly as a ZIP archive to the HTTP response.
 * Uses lightweight compression (level 4) to ensure high speed and minimal CPU/RAM usage on 8GB machines.
 */
export function streamFolderAsZip(
  folderPath: string,
  zipFilename: string,
  res: Response
): void {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: `Output folder does not exist: "${folderPath}"` });
    return;
  }

  // Pre-collect files to ensure we have content before opening the HTTP stream
  const files = collectExportableFiles(resolved);

  if (files.length === 0) {
    res.status(404).json({
      error: `No optimized images found in folder: "${folderPath}". Please ensure the optimization batch has completed.`,
    });
    return;
  }

  const cleanFilename = path.basename(zipFilename);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
  );
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let archive: any;
  try {
    archive = createZipArchive({
      zlib: { level: 4 }, // Optimal speed/memory balance for WebP images
    });
  } catch (err: any) {
    console.error('Failed to create zip archive instance:', err);
    res.status(500).json({ error: 'Archive initialization failed' });
    return;
  }

  archive.on('warning', (err: any) => {
    console.warn('Archiver non-fatal warning:', err?.message);
  });

  archive.on('error', (err: any) => {
    console.error('Archiver fatal stream error:', err?.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'ZIP generation failed' });
    } else {
      res.end();
    }
  });

  // Handle client disconnection / abort
  res.on('close', () => {
    if (!res.writableEnded) {
      try {
        archive.abort();
      } catch {}
    }
  });

  // Pipe directly to Express HTTP response stream
  archive.pipe(res);

  // Append all valid files
  for (const file of files) {
    archive.file(file.fullPath, { name: file.relativePath });
  }

  archive.finalize().catch((err: any) => {
    console.error('Archive finalize error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'ZIP finalization failed' });
    } else {
      res.end();
    }
  });
}
