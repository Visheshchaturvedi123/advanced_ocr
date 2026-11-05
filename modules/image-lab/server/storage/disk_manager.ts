import fs from 'fs';
import path from 'path';

export interface DiskCheckResult {
  isSafe: boolean;
  warningMessage?: string;
  sourceDirExists: boolean;
  outputDirExists: boolean;
  sourceIsReadOnly: boolean;
  isSameDirectory: boolean;
}

export function checkDiskAndSafety(sourceDir: string, outputDir: string): DiskCheckResult {
  const sourceExists = fs.existsSync(sourceDir);
  const outputExists = fs.existsSync(outputDir);

  if (!sourceExists) {
    return {
      isSafe: false,
      warningMessage: `Source directory does not exist: "${sourceDir}"`,
      sourceDirExists: false,
      outputDirExists: outputExists,
      sourceIsReadOnly: true,
      isSameDirectory: false,
    };
  }

  const resolvedSource = path.resolve(sourceDir);
  const resolvedOutput = path.resolve(outputDir);

  if (resolvedSource === resolvedOutput) {
    return {
      isSafe: false,
      warningMessage:
        'CRITICAL SAFETY WARNING: Source directory and Output directory cannot be the same! Original files must remain untouched.',
      sourceDirExists: true,
      outputDirExists: true,
      sourceIsReadOnly: true,
      isSameDirectory: true,
    };
  }

  // Ensure output directory is created safely if not present
  if (!outputExists) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (e: any) {
      return {
        isSafe: false,
        warningMessage: `Cannot create output directory: ${e.message}`,
        sourceDirExists: true,
        outputDirExists: false,
        sourceIsReadOnly: true,
        isSameDirectory: false,
      };
    }
  }

  return {
    isSafe: true,
    sourceDirExists: true,
    outputDirExists: true,
    sourceIsReadOnly: true,
    isSameDirectory: false,
  };
}

export function getQuickFolderList(): Array<{ name: string; path: string; exists: boolean }> {
  const samples = [
    {
      name: 'Default Test Photos Folder',
      path: path.resolve(process.cwd(), 'sample_photos'),
      exists: fs.existsSync(path.resolve(process.cwd(), 'sample_photos')),
    },
    {
      name: 'Sample High-Res Gallery',
      path: path.resolve(process.cwd(), 'sample_gallery'),
      exists: fs.existsSync(path.resolve(process.cwd(), 'sample_gallery')),
    },
    {
      name: 'Output WebP Directory',
      path: path.resolve(process.cwd(), 'optimized_webp'),
      exists: fs.existsSync(path.resolve(process.cwd(), 'optimized_webp')),
    },
  ];

  return samples;
}
