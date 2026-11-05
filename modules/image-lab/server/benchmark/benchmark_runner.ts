import fs from 'fs';
import path from 'path';
import os from 'os';
import { OptimizationSettings, JobReport } from '../../src/types';
import { generateTestDataset } from '../sample_dataset';
import { scanImageFolder } from '../image_engine/scanner';
import { batchProcessor } from '../processing/batch_processor';

export interface BenchmarkResult {
  datasetSize: number;
  inputSizeBytes: number;
  outputSizeBytes: number;
  storageSavedBytes: number;
  reductionPercent: number;
  processingTimeSec: number;
  imagesPerSec: number;
  averageRamMb: number;
  peakRamMb: number;
  cpuModel: string;
  cpuCores: number;
  cacheHitRatePercent: number;
  failures: number;
  timestamp: string;
  settings: OptimizationSettings;
}

export async function runBenchmark(
  count: number = 100,
  settings: OptimizationSettings,
  onStatus?: (status: string) => void
): Promise<BenchmarkResult> {
  const benchmarkDir = path.resolve(process.cwd(), '.cache', 'benchmarks', `bench_${count}`);
  const outputDir = path.resolve(process.cwd(), '.cache', 'benchmarks', `bench_${count}_out`);

  if (!fs.existsSync(benchmarkDir)) {
    fs.mkdirSync(benchmarkDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  onStatus?.(`Preparing ${count} test images for benchmark...`);
  await generateTestDataset(benchmarkDir, Math.min(count, 500)); // Cap generated physical files to 500 for fast bench test if count is large

  onStatus?.(`Scanning dataset...`);
  const { items } = await scanImageFolder(benchmarkDir, true);

  // If user requested 1000 or 5000, we duplicate the item list reference up to the requested count to simulate large dataset queue
  const targetItems = [...items];
  while (targetItems.length < count) {
    for (const item of items) {
      if (targetItems.length >= count) break;
      targetItems.push({
        ...item,
        id: `${item.id}_rep_${targetItems.length}`,
        relativePath: `bench_dup_${targetItems.length}_${item.filename}`,
      });
    }
  }

  onStatus?.(`Executing benchmark with ${targetItems.length} items...`);
  const report: JobReport = await batchProcessor.startOptimization(
    benchmarkDir,
    outputDir,
    targetItems,
    settings
  );

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Standard x86_64 CPU';
  const cpuCores = cpus.length || 4;

  const cacheHitRate =
    targetItems.length > 0
      ? Number(((report.cachedImages / targetItems.length) * 100).toFixed(1))
      : 0;

  return {
    datasetSize: targetItems.length,
    inputSizeBytes: report.originalTotalBytes,
    outputSizeBytes: report.outputTotalBytes,
    storageSavedBytes: report.storageSavedBytes,
    reductionPercent: report.reductionPercent,
    processingTimeSec: report.totalDurationSec,
    imagesPerSec: report.avgSpeedImagesPerSec,
    averageRamMb: report.avgMemoryMb,
    peakRamMb: report.peakMemoryMb,
    cpuModel,
    cpuCores,
    cacheHitRatePercent: cacheHitRate,
    failures: report.failedImages,
    timestamp: new Date().toISOString(),
    settings,
  };
}
