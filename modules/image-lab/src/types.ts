export type OptimizationMode =
  | 'auto'
  | 'max_quality'
  | 'high_quality'
  | 'balanced'
  | 'smaller_file'
  | 'custom';

export type ResolutionMode =
  | 'auto'
  | 'original'
  | '90%'
  | '75%'
  | '67%'
  | '50%'
  | 'custom';

export type MaxDimensionMode =
  | 'auto'
  | '1920'
  | '2560'
  | '2880'
  | '3840'
  | 'custom'
  | 'none';

export type MetadataPolicy = 'preserve_useful' | 'strip' | 'exif_only';
export type ColorProfilePolicy = 'srgb' | 'preserve_icc';
export type ValidationLevel = 'fast' | 'smart' | 'maximum';
export type OutputStructure = 'preserve' | 'flatten' | 'subfolder';
export type DuplicateHandling = 'skip' | 'process_all';
export type MemoryMode = '8gb' | 'standard' | 'conservative';

export interface OptimizationSettings {
  mode: OptimizationMode;
  resolutionMode: ResolutionMode;
  customResolutionPercent?: number;
  maxDimensionMode: MaxDimensionMode;
  customMaxDimension?: number;
  webpQuality: number; // 60-100
  lossless: boolean;
  smartQuality: boolean;
  validationLevel: ValidationLevel;
  metadataPolicy: MetadataPolicy;
  colorManagement: ColorProfilePolicy;
  workerCount: number | 'auto'; // 'auto' or 1, 2, 3, 4
  memoryMode: MemoryMode;
  outputStructure: OutputStructure;
  duplicateHandling: DuplicateHandling;
  allowUpscaling: boolean;
  recursiveScan: boolean;
  autoDownloadZip?: boolean;
}

export interface ImageItem {
  id: string;
  filename: string;
  relativePath: string;
  fullPath: string;
  extension: string;
  sizeBytes: number;
  width: number;
  height: number;
  megapixels: number;
  colorSpace: string;
  hasAlpha: boolean;
  orientation?: number;
  hasMetadata: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
  mtime: number;
  status: 'pending' | 'processing' | 'completed' | 'cached' | 'skipped' | 'failed';
  error?: string;
  outputSizeBytes?: number;
  outputWidth?: number;
  outputHeight?: number;
  reductionPercent?: number;
  durationMs?: number;
  isCorrupted?: boolean;
}

export interface FolderAnalysisSummary {
  inputFolder: string;
  totalImages: number;
  totalSizeBytes: number;
  averageSizeBytes: number;
  largestImageBytes: number;
  largestImageName: string;
  smallestImageBytes: number;
  smallestImageName: string;
  resolutionMin: string;
  resolutionMax: string;
  formatCounts: Record<string, number>;
  transparentCount: number;
  orientationFlaggedCount: number;
  scanDurationMs: number;
}

export interface OptimizationEstimate {
  totalImages: number;
  originalTotalBytes: number;
  estimatedOutputMinBytes: number;
  estimatedOutputMaxBytes: number;
  estimatedReductionMinPercent: number;
  estimatedReductionMaxPercent: number;
  estimatedProcessingTimeSec: number;
  effectiveQuality: number;
  avgCalculatedWidth: number;
  avgCalculatedHeight: number;
}

export interface JobProgress {
  jobId: string;
  status: 'idle' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed';
  total: number;
  processed: number;
  cached: number;
  skipped: number;
  failed: number;
  currentFile: string;
  percent: number;
  speedImagesPerSec: number;
  etaSeconds: number;
  memoryUsageMb: number;
  peakMemoryUsageMb: number;
  activeWorkers: number;
  originalProcessedBytes: number;
  outputProcessedBytes: number;
  savingsBytes: number;
  reductionPercent: number;
  elapsedSeconds: number;
  startTime: number;
  error?: string;
}

export interface JobReport {
  jobId: string;
  timestamp: string;
  inputFolder: string;
  outputFolder: string;
  settings: OptimizationSettings;
  totalImages: number;
  processedImages: number;
  cachedImages: number;
  skippedDuplicates: number;
  failedImages: number;
  originalTotalBytes: number;
  outputTotalBytes: number;
  storageSavedBytes: number;
  reductionPercent: number;
  totalDurationSec: number;
  avgSpeedImagesPerSec: number;
  peakMemoryMb: number;
  avgMemoryMb: number;
  avgOutputDimensions: string;
  failedDetails: Array<{ filename: string; path: string; error: string }>;
}

export interface CacheStats {
  totalRecords: number;
  totalOptimizedBytes: number;
  totalThumbnails: number;
  thumbnailSizeBytes: number;
  cacheDbSizeBytes: number;
}

export interface SystemStatus {
  osPlatform: string;
  cpuCores: number;
  totalRamGb: number;
  freeRamGb: number;
  nodeRssMb: number;
  is8GbModeActive: boolean;
  activeWorkers: number;
}

export interface PreviewComparison {
  original: {
    filename: string;
    width: number;
    height: number;
    sizeBytes: number;
    format: string;
    url: string;
  };
  optimized: {
    width: number;
    height: number;
    sizeBytes: number;
    format: string;
    quality: number;
    reductionPercent: number;
    url: string;
  };
}
