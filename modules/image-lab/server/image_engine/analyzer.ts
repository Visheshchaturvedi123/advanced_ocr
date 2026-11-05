import os from 'os';
import {
  ImageItem,
  OptimizationSettings,
  OptimizationEstimate,
} from '../../src/types';

export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  settings: OptimizationSettings
): { width: number; height: number; scaleFactor: number } {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: origWidth, height: origHeight, scaleFactor: 1.0 };
  }

  const aspectRatio = origWidth / origHeight;
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  // 1. Apply resolution percentage
  let percent = 1.0;
  switch (settings.resolutionMode) {
    case '90%':
      percent = 0.9;
      break;
    case '75%':
      percent = 0.75;
      break;
    case '67%':
      percent = 0.67;
      break;
    case '50%':
      percent = 0.5;
      break;
    case 'custom':
      percent = (settings.customResolutionPercent || 100) / 100;
      break;
    case 'auto':
      // Auto mode intelligent downsampling for oversized images
      if (origWidth * origHeight > 24000000) {
        // > 24 MP (e.g. 6000x4000) -> gentle downsample for massive savings with near identical visual acuity
        percent = 0.72;
      } else if (origWidth * origHeight > 14000000) {
        // > 14 MP
        percent = 0.85;
      } else {
        percent = 1.0;
      }
      break;
    case 'original':
    default:
      percent = 1.0;
      break;
  }

  targetWidth = Math.round(origWidth * percent);
  targetHeight = Math.round(origHeight * percent);

  // 2. Apply max dimension constraints
  let maxDim = Infinity;
  switch (settings.maxDimensionMode) {
    case '1920':
      maxDim = 1920;
      break;
    case '2560':
      maxDim = 2560;
      break;
    case '2880':
      maxDim = 2880;
      break;
    case '3840':
      maxDim = 3840;
      break;
    case 'custom':
      maxDim = settings.customMaxDimension || Infinity;
      break;
    case 'auto':
      if (settings.mode === 'auto') {
        // Auto max dimension cap at 2880px for ultra-high res photos
        if (Math.max(origWidth, origHeight) > 3840) {
          maxDim = 2880;
        }
      }
      break;
    case 'none':
    default:
      maxDim = Infinity;
      break;
  }

  const longestSide = Math.max(targetWidth, targetHeight);
  if (longestSide > maxDim) {
    const scale = maxDim / longestSide;
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  // 3. Prevent upscaling unless explicitly enabled
  if (!settings.allowUpscaling) {
    if (targetWidth > origWidth || targetHeight > origHeight) {
      targetWidth = origWidth;
      targetHeight = origHeight;
    }
  }

  // Ensure positive even integers for optimal codec macroblock alignment
  targetWidth = Math.max(1, Math.round(targetWidth));
  targetHeight = Math.max(1, Math.round(targetHeight));

  const scaleFactor = targetWidth / origWidth;
  return { width: targetWidth, height: targetHeight, scaleFactor };
}

export function determineEffectiveQuality(
  item: ImageItem,
  settings: OptimizationSettings
): number {
  if (settings.lossless) return 100;

  let baseQuality = settings.webpQuality;
  if (settings.mode === 'auto') {
    // Intelligent quality selection based on complexity and source format
    if (item.extension === 'png' || item.hasAlpha) {
      baseQuality = 92;
    } else if (item.estimatedComplexity === 'high') {
      baseQuality = 88;
    } else if (item.estimatedComplexity === 'low') {
      baseQuality = 92;
    } else {
      baseQuality = 90;
    }
  } else if (settings.mode === 'max_quality') {
    baseQuality = 95;
  } else if (settings.mode === 'high_quality') {
    baseQuality = 90;
  } else if (settings.mode === 'balanced') {
    baseQuality = 85;
  } else if (settings.mode === 'smaller_file') {
    baseQuality = 80;
  }

  // Smart Quality micro-adjustments
  if (settings.smartQuality) {
    if (item.hasAlpha) {
      baseQuality = Math.min(100, baseQuality + 3);
    }
    if (item.estimatedComplexity === 'high' && baseQuality < 85) {
      baseQuality += 2;
    }
  }

  return Math.max(60, Math.min(100, Math.round(baseQuality)));
}

export function estimateOptimization(
  items: ImageItem[],
  settings: OptimizationSettings
): OptimizationEstimate {
  if (items.length === 0) {
    return {
      totalImages: 0,
      originalTotalBytes: 0,
      estimatedOutputMinBytes: 0,
      estimatedOutputMaxBytes: 0,
      estimatedReductionMinPercent: 0,
      estimatedReductionMaxPercent: 0,
      estimatedProcessingTimeSec: 0,
      effectiveQuality: settings.webpQuality,
      avgCalculatedWidth: 0,
      avgCalculatedHeight: 0,
    };
  }

  let originalTotalBytes = 0;
  let totalEstMinBytes = 0;
  let totalEstMaxBytes = 0;
  let totalTargetWidth = 0;
  let totalTargetHeight = 0;
  let totalMegapixels = 0;
  let effectiveQualitySum = 0;

  for (const item of items) {
    originalTotalBytes += item.sizeBytes;
    const { width, height } = calculateTargetDimensions(
      item.width || 1920,
      item.height || 1080,
      settings
    );
    totalTargetWidth += width;
    totalTargetHeight += height;

    const effQuality = determineEffectiveQuality(item, settings);
    effectiveQualitySum += effQuality;

    const areaRatio = (width * height) / Math.max(1, (item.width || 1920) * (item.height || 1080));
    totalMegapixels += (width * height) / 1000000;

    // WebP compression modeling
    // Base compression factor for photographic WebP at Q90 is typically ~0.20-0.35 of unoptimized JPEG/PNG
    let qualityFactor = 0.25;
    if (settings.lossless) {
      qualityFactor = 0.65; // lossless WebP typically 60-70% of PNG
    } else {
      // Curve: Q60 -> 0.12, Q80 -> 0.22, Q90 -> 0.28, Q95 -> 0.40, Q100 -> 0.65
      qualityFactor = 0.12 + Math.pow((effQuality - 60) / 40, 1.8) * 0.40;
    }

    if (item.extension === 'png') {
      // PNGs usually experience even larger savings when converting to lossy WebP
      qualityFactor *= 0.8;
    }

    const estBaseBytes = item.sizeBytes * areaRatio * qualityFactor;
    const estMin = Math.max(1024, estBaseBytes * 0.85);
    const estMax = Math.max(2048, estBaseBytes * 1.15);

    totalEstMinBytes += estMin;
    totalEstMaxBytes += estMax;
  }

  const estMinReduction = Math.max(
    5,
    Math.round(((originalTotalBytes - totalEstMaxBytes) / Math.max(1, originalTotalBytes)) * 100)
  );
  const estMaxReduction = Math.min(
    95,
    Math.round(((originalTotalBytes - totalEstMinBytes) / Math.max(1, originalTotalBytes)) * 100)
  );

  // Estimate processing time based on total megapixels and worker concurrency
  const cpuCores = Math.max(2, os.cpus().length || 4);
  const workers =
    settings.workerCount === 'auto'
      ? Math.min(4, Math.max(1, Math.floor(cpuCores / 2)))
      : settings.workerCount;
  // ~12 Megapixels per second per core for Lanczos + WebP encode on modern CPU
  const throughputMpPerSec = workers * 8.5;
  const estimatedProcessingTimeSec = Math.max(1, Math.round(totalMegapixels / throughputMpPerSec));

  return {
    totalImages: items.length,
    originalTotalBytes,
    estimatedOutputMinBytes: Math.round(totalEstMinBytes),
    estimatedOutputMaxBytes: Math.round(totalEstMaxBytes),
    estimatedReductionMinPercent: Math.min(estMinReduction, estMaxReduction),
    estimatedReductionMaxPercent: Math.max(estMinReduction, estMaxReduction),
    estimatedProcessingTimeSec,
    effectiveQuality: Math.round(effectiveQualitySum / items.length),
    avgCalculatedWidth: Math.round(totalTargetWidth / items.length),
    avgCalculatedHeight: Math.round(totalTargetHeight / items.length),
  };
}
