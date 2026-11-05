import fs from 'fs';
import path from 'path';
import {
  ImageItem,
  OptimizationSettings,
  JobProgress,
  JobReport,
} from '../../src/types';
import { encodeToWebp, cleanupStaleTempFiles, getExpectedOutputPath } from '../image_engine/encoder';
import { cacheManager, CacheRecord } from '../cache/cache_manager';
import { memoryManager } from './memory_manager';
import { historyManager } from '../storage/history_manager';

export class BatchProcessor {
  private activeJobId: string | null = null;
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private progress: JobProgress | null = null;
  private progressListeners: Array<(p: JobProgress) => void> = [];
  private completedReport: JobReport | null = null;

  public onProgress(listener: (p: JobProgress) => void) {
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (p: JobProgress) => void) {
    this.progressListeners = this.progressListeners.filter((l) => l !== listener);
  }

  private notify() {
    if (!this.progress) return;
    for (const listener of this.progressListeners) {
      try {
        listener({ ...this.progress });
      } catch {}
    }
  }

  public getProgress(): JobProgress | null {
    return this.progress ? { ...this.progress } : null;
  }

  public getCompletedReport(): JobReport | null {
    return this.completedReport;
  }

  public pause(): boolean {
    if (this.progress && this.progress.status === 'running') {
      this.isPaused = true;
      this.progress.status = 'paused';
      this.notify();
      return true;
    }
    return false;
  }

  public resume(): boolean {
    if (this.progress && this.progress.status === 'paused') {
      this.isPaused = false;
      this.progress.status = 'running';
      this.notify();
      return true;
    }
    return false;
  }

  public cancel(): boolean {
    if (this.progress && (this.progress.status === 'running' || this.progress.status === 'paused')) {
      this.isCancelled = true;
      this.progress.status = 'cancelled';
      this.notify();
      return true;
    }
    return false;
  }

  public async startOptimization(
    inputFolder: string,
    outputFolder: string,
    items: ImageItem[],
    settings: OptimizationSettings
  ): Promise<JobReport> {
    if (this.progress && this.progress.status === 'running') {
      throw new Error('Another optimization job is already in progress');
    }

    const jobId = `job_${Date.now()}`;
    this.activeJobId = jobId;
    this.isPaused = false;
    this.isCancelled = false;
    this.completedReport = null;

    memoryManager.setMode(settings.memoryMode);

    // Self-heal: remove temp leftovers from a previous crashed/interrupted job.
    // OnlyWithTwin + 5-min age = never touch in-flight writes, only garbage
    // whose final .webp already exists.
    try {
      const swept = cleanupStaleTempFiles(path.resolve(outputFolder), {
        onlyWithTwin: true,
        minAgeMs: 5 * 60 * 1000,
      });
      if (swept > 0) console.log(`[batch ${jobId}] cleaned ${swept} stale temp file(s) from previous run`);
    } catch {}

    // Prepare progress tracking
    const startTime = Date.now();
    this.progress = {
      jobId,
      status: 'running',
      total: items.length,
      processed: 0,
      cached: 0,
      skipped: 0,
      failed: 0,
      currentFile: '',
      percent: 0,
      speedImagesPerSec: 0,
      etaSeconds: 0,
      memoryUsageMb: memoryManager.getMemoryStats().rssMb,
      peakMemoryUsageMb: memoryManager.getMemoryStats().peakMb,
      activeWorkers: memoryManager.getRecommendedWorkers(settings.workerCount),
      originalProcessedBytes: 0,
      outputProcessedBytes: 0,
      savingsBytes: 0,
      reductionPercent: 0,
      elapsedSeconds: 0,
      startTime,
    };
    this.notify();

    const settingsHash = cacheManager.computeSettingsHash(settings);
    const failedDetails: Array<{ filename: string; path: string; error: string }> = [];
    const seenContentHashes = new Set<string>();

    // Speed calculation window: store timestamps of completed images
    const completionTimes: number[] = [];
    let totalOutputWidth = 0;
    let totalOutputHeight = 0;
    let validOutputCount = 0;

    let currentIndex = 0;
    const totalItems = items.length;

    // Worker pool loop
    const workerLoop = async () => {
      while (currentIndex < totalItems && !this.isCancelled) {
        // Handle Pause state
        while (this.isPaused && !this.isCancelled) {
          await new Promise((r) => setTimeout(r, 200));
        }

        if (this.isCancelled) break;

        const idx = currentIndex++;
        if (idx >= totalItems) break;

        const item = items[idx];
        if (!this.progress) break;

        this.progress.currentFile = item.filename;
        this.notify();

        // 1. Skip corrupted from scan
        if (item.isCorrupted) {
          this.progress.failed++;
          failedDetails.push({
            filename: item.filename,
            path: item.fullPath,
            error: item.error || 'Corrupted file during initial scan',
          });
          this.updateMetrics(completionTimes, startTime);
          continue;
        }

        // 2. Duplicate Detection
        if (settings.duplicateHandling === 'skip') {
          const hash = cacheManager.computeFileContentHash(item.fullPath);
          if (hash && seenContentHashes.has(hash)) {
            this.progress.skipped++;
            this.updateMetrics(completionTimes, startTime);
            continue;
          }
          if (hash) seenContentHashes.add(hash);
        }

        // 3. Cache & Resume Check.
        // A cache record only proves the file exists at its OLD location.
        // The user may pick a different output folder per run, so make sure
        // the file also exists in THIS job's output folder (copy it over).
        // Only if that fails do we fall through to a full re-encode.
        const sourceFingerprint = cacheManager.computeSourceFingerprint(
          item.fullPath,
          item.sizeBytes,
          item.mtime
        );
        const cached = cacheManager.getValidCache(sourceFingerprint, settingsHash);

        let servedFromCache = false;
        if (cached) {
          try {
            const expectedPath = getExpectedOutputPath(item, outputFolder, settings);
            if (path.resolve(expectedPath) === path.resolve(cached.outputPath)) {
              servedFromCache = true;
            } else {
              const expectedDir = path.dirname(expectedPath);
              if (!fs.existsSync(expectedDir)) fs.mkdirSync(expectedDir, { recursive: true });
              if (!fs.existsSync(expectedPath)) {
                fs.copyFileSync(cached.outputPath, expectedPath);
              }
              servedFromCache = fs.existsSync(expectedPath);
              if (servedFromCache) {
                // Point the record at the new location for future runs
                cacheManager.setCache({ ...cached, outputPath: expectedPath, timestamp: Date.now() });
              }
            }
          } catch {
            servedFromCache = false;
          }
        }

        if (servedFromCache && cached) {
          this.progress.cached++;
          this.progress.originalProcessedBytes += cached.sourceSizeBytes;
          this.progress.outputProcessedBytes += cached.outputSizeBytes;
          totalOutputWidth += cached.outputWidth || 0;
          totalOutputHeight += cached.outputHeight || 0;
          validOutputCount++;

          this.updateMetrics(completionTimes, startTime);
          continue;
        }

        // 4. Real WebP Encoding
        try {
          const result = await encodeToWebp(item, outputFolder, settings);

          if (result.success) {
            this.progress.processed++;
            this.progress.originalProcessedBytes += item.sizeBytes;
            this.progress.outputProcessedBytes += result.outputSizeBytes;
            totalOutputWidth += result.outputWidth;
            totalOutputHeight += result.outputHeight;
            validOutputCount++;

            // Store in persistent cache
            cacheManager.setCache({
              sourcePath: item.fullPath,
              sourceFingerprint,
              sourceMtime: item.mtime,
              sourceSizeBytes: item.sizeBytes,
              optimizerVersion: '1.0.0',
              settingsHash,
              outputPath: result.outputPath,
              outputSizeBytes: result.outputSizeBytes,
              outputWidth: result.outputWidth,
              outputHeight: result.outputHeight,
              reductionPercent: result.reductionPercent,
              status: 'completed',
              timestamp: Date.now(),
            });
          } else {
            this.progress.failed++;
            failedDetails.push({
              filename: item.filename,
              path: item.fullPath,
              error: result.error || 'WebP encode returned failure',
            });
          }
        } catch (err: any) {
          this.progress.failed++;
          failedDetails.push({
            filename: item.filename,
            path: item.fullPath,
            error: err?.message || 'Unexpected worker exception',
          });
        }

        completionTimes.push(Date.now());
        this.updateMetrics(completionTimes, startTime);

        // Memory cleanup every 100 images
        if (idx % 100 === 0) {
          memoryManager.clearBuffers();
        }
      }
    };

    // Determine dynamic worker count
    const targetWorkers = memoryManager.getRecommendedWorkers(settings.workerCount);
    this.progress.activeWorkers = targetWorkers;

    // Launch worker pool
    const workers = Array.from({ length: targetWorkers }, () => workerLoop());
    await Promise.all(workers);

    // Final sweep: all workers are done, so any *.tmp left in the output
    // folder is garbage by definition (failed deletes, copy-fallback twins).
    try {
      const swept = cleanupStaleTempFiles(path.resolve(outputFolder), { minAgeMs: 0 });
      if (swept > 0) console.log(`[batch ${jobId}] cleaned ${swept} leftover temp file(s) at job end`);
    } catch {}

    // Finalize
    cacheManager.flushToDisk();
    const finalElapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const memStats = memoryManager.getMemoryStats();

    const originalTotalBytes = this.progress.originalProcessedBytes;
    const outputTotalBytes = this.progress.outputProcessedBytes;
    const storageSavedBytes = Math.max(0, originalTotalBytes - outputTotalBytes);
    const reductionPercent =
      originalTotalBytes > 0
        ? Number(((storageSavedBytes / originalTotalBytes) * 100).toFixed(1))
        : 0;

    const avgDimStr =
      validOutputCount > 0
        ? `${Math.round(totalOutputWidth / validOutputCount)}×${Math.round(totalOutputHeight / validOutputCount)}`
        : 'N/A';

    const report: JobReport = {
      jobId,
      timestamp: new Date().toLocaleString(),
      inputFolder,
      outputFolder,
      settings,
      totalImages: items.length,
      processedImages: this.progress.processed,
      cachedImages: this.progress.cached,
      skippedDuplicates: this.progress.skipped,
      failedImages: this.progress.failed,
      originalTotalBytes,
      outputTotalBytes,
      storageSavedBytes,
      reductionPercent,
      totalDurationSec: finalElapsedSec,
      avgSpeedImagesPerSec: Number(
        ((this.progress.processed + this.progress.cached) / finalElapsedSec).toFixed(1)
      ),
      peakMemoryMb: memStats.peakMb,
      avgMemoryMb: memStats.rssMb,
      avgOutputDimensions: avgDimStr,
      failedDetails,
    };

    if (this.isCancelled) {
      this.progress.status = 'cancelled';
    } else {
      this.progress.status = 'completed';
      this.progress.percent = 100;
      this.progress.etaSeconds = 0;
      this.completedReport = report;
      historyManager.saveReport(report);
    }

    this.notify();
    return report;
  }

  private updateMetrics(completionTimes: number[], startTime: number) {
    if (!this.progress) return;
    const now = Date.now();
    const doneCount =
      this.progress.processed +
      this.progress.cached +
      this.progress.skipped +
      this.progress.failed;

    this.progress.percent = Number(((doneCount / Math.max(1, this.progress.total)) * 100).toFixed(1));
    this.progress.elapsedSeconds = Math.round((now - startTime) / 1000);

    // Keep moving window of last 20 completions for accurate real-time speed
    const windowCutoff = now - 5000;
    while (completionTimes.length > 0 && completionTimes[0] < windowCutoff) {
      completionTimes.shift();
    }

    const windowSpeed = completionTimes.length > 0 ? (completionTimes.length / 5) : 0;
    const overallSpeed = this.progress.elapsedSeconds > 0 ? (doneCount / this.progress.elapsedSeconds) : 0;
    this.progress.speedImagesPerSec = Number((windowSpeed > 0 ? windowSpeed : overallSpeed).toFixed(1));

    const remaining = Math.max(0, this.progress.total - doneCount);
    const speed = this.progress.speedImagesPerSec;
    this.progress.etaSeconds = speed > 0.1 ? Math.round(remaining / speed) : 0;

    const mem = memoryManager.getMemoryStats();
    this.progress.memoryUsageMb = mem.rssMb;
    this.progress.peakMemoryUsageMb = mem.peakMb;

    this.progress.savingsBytes = Math.max(
      0,
      this.progress.originalProcessedBytes - this.progress.outputProcessedBytes
    );
    this.progress.reductionPercent =
      this.progress.originalProcessedBytes > 0
        ? Number(
            ((this.progress.savingsBytes / this.progress.originalProcessedBytes) * 100).toFixed(1)
          )
        : 0;

    this.notify();
  }
}

export const batchProcessor = new BatchProcessor();
