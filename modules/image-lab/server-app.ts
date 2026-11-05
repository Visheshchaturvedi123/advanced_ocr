import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import sharp from 'sharp';
import { scanImageFolder } from './server/image_engine/scanner';
import { estimateOptimization, calculateTargetDimensions, determineEffectiveQuality } from './server/image_engine/analyzer';
import { encodeToWebp, cleanupStaleTempFiles } from './server/image_engine/encoder';
import { getOrCreateThumbnail, getThumbnailCacheStats, clearThumbnailCache } from './server/image_engine/thumbnail';
import { batchProcessor } from './server/processing/batch_processor';
import { memoryManager } from './server/processing/memory_manager';
import { cacheManager } from './server/cache/cache_manager';
import { historyManager } from './server/storage/history_manager';
import { checkDiskAndSafety, getQuickFolderList } from './server/storage/disk_manager';
import { generateTestDataset } from './server/sample_dataset';
import { runBenchmark } from './server/benchmark/benchmark_runner';
import { streamFolderAsZip } from './server/storage/zip_service';
import { OptimizationSettings, ImageItem } from './src/types';

// Limit Sharp internal C++ memory cache to keep 8GB RAM bounded.
// files: 0 is REQUIRED on Windows: cached open descriptors lock freshly
// written files and block their rename/delete ("in use by Node.js").
sharp.cache({ files: 0, memory: 150, items: 100 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 100 },
});

export async function createImageLabApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Pre-seed a default sample dataset on first start if none exists
  const defaultSampleDir = path.resolve(process.cwd(), 'sample_photos');
  if (!fs.existsSync(defaultSampleDir)) {
    try {
      generateTestDataset(defaultSampleDir, 16);
    } catch {}
  }

  // 1. Health and System Status
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Local Batch Image Optimizer' });
  });

  app.get('/api/system/status', (req, res) => {
    const mem = memoryManager.getMemoryStats();
    res.json({
      osPlatform: `${os.type()} ${os.release()} (${os.arch()})`,
      cpuModel: os.cpus()[0]?.model || 'Standard CPU',
      cpuCores: os.cpus().length || 4,
      totalRamGb: mem.systemTotalGb,
      freeRamGb: mem.systemFreeGb,
      nodeRssMb: mem.rssMb,
      peakMemoryMb: mem.peakMb,
      is8GbModeActive: true,
      activeWorkers: memoryManager.getRecommendedWorkers('auto'),
      isMemoryPressure: mem.isPressure,
    });
  });

  // 2. Folder list / safety check
  app.get('/api/folders/presets', (req, res) => {
    res.json({ presets: getQuickFolderList() });
  });

  app.post('/api/folders/check-safety', (req, res) => {
    const { sourceDir, outputDir } = req.body;
    const result = checkDiskAndSafety(sourceDir || '', outputDir || '');
    res.json(result);
  });

  // 3. Folder Scanner
  app.post('/api/folders/scan', async (req, res) => {
    try {
      const { folderPath, recursive = true } = req.body;
      if (!folderPath) {
        return res.status(400).json({ error: 'folderPath is required' });
      }
      const targetDir = path.resolve(folderPath);
      const result = await scanImageFolder(targetDir, recursive);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Folder scan failed' });
    }
  });

  // 4. Sample Test Dataset Generator
  app.post('/api/folders/generate-sample', async (req, res) => {
    try {
      const { targetDir, count = 25 } = req.body;
      const resolvedDir = targetDir
        ? path.resolve(targetDir)
        : path.resolve(process.cwd(), 'sample_photos');

      await generateTestDataset(resolvedDir, Math.min(200, Math.max(5, count)));
      const result = await scanImageFolder(resolvedDir, true);
      res.json({ success: true, folder: resolvedDir, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate dataset' });
    }
  });

  // 5. Optimization Estimate
  app.post('/api/optimize/estimate', (req, res) => {
    try {
      const { items, settings } = req.body;
      if (!items || !settings) {
        return res.status(400).json({ error: 'items and settings are required' });
      }
      const estimate = estimateOptimization(items, settings);
      res.json(estimate);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Estimation failed' });
    }
  });

  // 6. Interactive Preview: encodes 1 sample image to WebP and returns preview data URLs
  app.post('/api/optimize/preview', async (req, res) => {
    try {
      const { item, settings }: { item: ImageItem; settings: OptimizationSettings } = req.body;
      if (!item || !item.fullPath) {
        return res.status(400).json({ error: 'Valid image item required' });
      }

      if (!fs.existsSync(item.fullPath)) {
        return res.status(404).json({ error: 'Image file not found on disk' });
      }

      // Encode preview to temporary preview cache
      const previewDir = path.resolve(process.cwd(), '.cache', 'preview');
      if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
      // Opportunistically clear old preview temp leftovers (never fresh files)
      try {
        cleanupStaleTempFiles(previewDir, { minAgeMs: 5 * 60 * 1000 });
      } catch {}

      const encodeResult = await encodeToWebp(item, previewDir, settings);
      if (!encodeResult.success) {
        return res.status(500).json({ error: encodeResult.error || 'Preview encoding failed' });
      }

      // Read buffers as base64 for direct browser rendering
      const origBuffer = fs.readFileSync(item.fullPath);
      const mimeType = item.extension === 'png' ? 'image/png' : 'image/jpeg';
      const origDataUrl = `data:${mimeType};base64,${origBuffer.toString('base64')}`;

      const webpBuffer = fs.readFileSync(encodeResult.outputPath);
      const webpDataUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

      res.json({
        original: {
          filename: item.filename,
          width: item.width,
          height: item.height,
          sizeBytes: item.sizeBytes,
          format: item.extension.toUpperCase(),
          url: origDataUrl,
        },
        optimized: {
          width: encodeResult.outputWidth,
          height: encodeResult.outputHeight,
          sizeBytes: encodeResult.outputSizeBytes,
          format: 'WEBP',
          quality: determineEffectiveQuality(item, settings),
          reductionPercent: encodeResult.reductionPercent,
          url: webpDataUrl,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Preview generation failed' });
    }
  });

  // 7. Thumbnail endpoint
  app.get('/api/thumbnail', async (req, res) => {
    try {
      const imagePath = req.query.path as string;
      const size = parseInt(req.query.size as string) === 512 ? 512 : 256;
      if (!imagePath || !fs.existsSync(imagePath)) {
        return res.status(404).send('Not found');
      }
      const thumbPath = await getOrCreateThumbnail(imagePath, size);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(thumbPath).pipe(res);
    } catch (err: any) {
      res.status(500).send('Error generating thumbnail');
    }
  });

  // 8. Batch Optimization Controls
  app.post('/api/optimize/start', async (req, res) => {
    try {
      const { inputFolder, outputFolder, items, settings } = req.body;
      if (!inputFolder || !outputFolder || !items || !settings) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Safety validation
      const safety = checkDiskAndSafety(inputFolder, outputFolder);
      if (!safety.isSafe) {
        return res.status(400).json({ error: safety.warningMessage });
      }

      // Asynchronously trigger batch processing
      batchProcessor
        .startOptimization(inputFolder, outputFolder, items, settings)
        .catch((err) => console.error('Batch execution error:', err));

      res.json({ success: true, message: 'Optimization started' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to start optimization' });
    }
  });

  app.get('/api/optimize/progress', (req, res) => {
    const progress = batchProcessor.getProgress();
    const completedReport = batchProcessor.getCompletedReport();
    res.json({ progress, completedReport });
  });

  app.post('/api/optimize/pause', (req, res) => {
    const ok = batchProcessor.pause();
    res.json({ success: ok });
  });

  app.post('/api/optimize/resume', (req, res) => {
    const ok = batchProcessor.resume();
    res.json({ success: ok });
  });

  app.post('/api/optimize/cancel', (req, res) => {
    const ok = batchProcessor.cancel();
    res.json({ success: ok });
  });

  // Download ZIP of compressed images for a specific job
  app.get('/api/optimize/download-zip/:jobId', (req, res) => {
    try {
      const jobId = req.params.jobId;
      let report = historyManager.getReport(jobId);
      if (!report && batchProcessor.getCompletedReport()?.jobId === jobId) {
        report = batchProcessor.getCompletedReport();
      }
      let targetFolder = report ? report.outputFolder : './optimized_webp';

      if (!fs.existsSync(path.resolve(targetFolder))) {
        // Fallback check in current output directory
        targetFolder = './optimized_webp';
      }

      if (!fs.existsSync(path.resolve(targetFolder))) {
        return res.status(404).json({ error: 'Optimized images output folder not found' });
      }

      const zipFilename = `optimized_webp_${jobId}.zip`;
      streamFolderAsZip(targetFolder, zipFilename, res);
    } catch (err: any) {
      console.error('ZIP download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to stream ZIP' });
      }
    }
  });

  // Download ZIP from current/specified output directory
  app.get('/api/optimize/download-zip-current', (req, res) => {
    try {
      const targetFolder = (req.query.folder as string) || './optimized_webp';
      if (!fs.existsSync(path.resolve(targetFolder))) {
        return res.status(404).json({ error: 'Output folder not found' });
      }
      const zipFilename = `optimized_webp_collection_${Date.now()}.zip`;
      streamFolderAsZip(targetFolder, zipFilename, res);
    } catch (err: any) {
      console.error('ZIP current download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Failed to stream ZIP' });
      }
    }
  });

  // Upload a batch of images from a folder selected on user's PC
  app.post('/api/folders/upload-batch', upload.array('files'), async (req, res) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'No files provided in batch' });
      }

      const folderName = (req.body.folderName as string) || 'Imported_Folder';
      // Sanitize folder name
      const cleanFolderName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Imported_Folder';
      const baseImportDir = path.resolve(process.cwd(), 'imported_photos', cleanFolderName);

      let paths: string[] = [];
      try {
        if (req.body.paths) {
          paths = typeof req.body.paths === 'string' ? JSON.parse(req.body.paths) : req.body.paths;
        }
      } catch {}

      let savedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let relPath = paths[i] || file.originalname;

        // Clean relative path to avoid directory traversal
        relPath = relPath.replace(/^(\.\.[\/\\])+/, '');
        const targetFilePath = path.join(baseImportDir, relPath);
        const targetDir = path.dirname(targetFilePath);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetFilePath, file.buffer);
        savedCount++;
      }

      res.json({
        success: true,
        savedCount,
        folderPath: `./imported_photos/${cleanFolderName}`,
      });
    } catch (err: any) {
      console.error('Batch upload error:', err);
      res.status(500).json({ error: err?.message || 'Failed to upload batch' });
    }
  });

  // 9. History and Reports
  app.get('/api/history', (req, res) => {
    res.json({ history: historyManager.getHistory() });
  });

  app.get('/api/history/:jobId', (req, res) => {
    const report = historyManager.getReport(req.params.jobId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  });

  app.delete('/api/history', (req, res) => {
    historyManager.clearHistory();
    res.json({ success: true });
  });

  // 10. Cache Management
  app.get('/api/cache/stats', (req, res) => {
    const thumbStats = getThumbnailCacheStats();
    const stats = cacheManager.getStats(thumbStats);
    res.json(stats);
  });

  app.post('/api/cache/clear-all', (req, res) => {
    cacheManager.clearAllCache();
    res.json({ success: true });
  });

  app.post('/api/cache/clear-unused', (req, res) => {
    const removed = cacheManager.clearUnusedRecords();
    res.json({ success: true, removedCount: removed });
  });

  app.post('/api/cache/clear-thumbnails', (req, res) => {
    clearThumbnailCache();
    res.json({ success: true });
  });

  // 11. Benchmark Runner
  app.post('/api/benchmark/run', async (req, res) => {
    try {
      const { count = 100, settings } = req.body;
      const defaultSettings: OptimizationSettings = settings || {
        mode: 'high_quality',
        resolutionMode: '75%',
        maxDimensionMode: '2880',
        webpQuality: 90,
        lossless: false,
        smartQuality: true,
        validationLevel: 'smart',
        metadataPolicy: 'preserve_useful',
        colorManagement: 'preserve_icc',
        workerCount: 'auto',
        memoryMode: '8gb',
        outputStructure: 'preserve',
        duplicateHandling: 'skip',
        allowUpscaling: false,
        recursiveScan: true,
      };

      const result = await runBenchmark(count, defaultSettings);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Benchmark execution failed' });
    }
  });

  return app;
}
