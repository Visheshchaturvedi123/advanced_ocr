import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { OptimizationSettings, CacheStats } from '../../src/types';

export interface CacheRecord {
  sourcePath: string;
  sourceFingerprint: string;
  sourceMtime: number;
  sourceSizeBytes: number;
  optimizerVersion: string;
  settingsHash: string;
  outputPath: string;
  outputSizeBytes: number;
  outputWidth: number;
  outputHeight: number;
  reductionPercent: number;
  status: 'completed';
  timestamp: number;
}

const OPTIMIZER_VERSION = '1.0.0';
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'optimizer_cache.json');

class CacheManager {
  private records: Map<string, CacheRecord> = new Map();
  private dirty: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.sourceFingerprint && item.settingsHash) {
              const key = this.generateCacheKey(item.sourceFingerprint, item.settingsHash);
              this.records.set(key, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not load existing cache, starting fresh:', e);
      this.records.clear();
    }
  }

  private generateCacheKey(sourceFingerprint: string, settingsHash: string): string {
    return `${sourceFingerprint}_${settingsHash}`;
  }

  public computeSettingsHash(settings: OptimizationSettings): string {
    const relevant = {
      mode: settings.mode,
      resolutionMode: settings.resolutionMode,
      customResolutionPercent: settings.customResolutionPercent,
      maxDimensionMode: settings.maxDimensionMode,
      customMaxDimension: settings.customMaxDimension,
      webpQuality: settings.webpQuality,
      lossless: settings.lossless,
      smartQuality: settings.smartQuality,
      metadataPolicy: settings.metadataPolicy,
      colorManagement: settings.colorManagement,
      allowUpscaling: settings.allowUpscaling,
    };
    return crypto.createHash('md5').update(JSON.stringify(relevant)).digest('hex').slice(0, 16);
  }

  public computeSourceFingerprint(fullPath: string, sizeBytes: number, mtimeMs: number): string {
    return crypto
      .createHash('sha256')
      .update(`${fullPath}_${sizeBytes}_${mtimeMs}`)
      .digest('hex')
      .slice(0, 24);
  }

  public computeFileContentHash(filePath: string): string {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch {
      return '';
    }
  }

  public getValidCache(
    sourceFingerprint: string,
    settingsHash: string
  ): CacheRecord | null {
    const key = this.generateCacheKey(sourceFingerprint, settingsHash);
    const record = this.records.get(key);
    if (!record) return null;

    // Verify output file still actually exists on disk and is non-empty
    if (!fs.existsSync(record.outputPath)) {
      this.records.delete(key);
      this.dirty = true;
      return null;
    }

    try {
      const stat = fs.statSync(record.outputPath);
      if (stat.size !== record.outputSizeBytes) {
        this.records.delete(key);
        this.dirty = true;
        return null;
      }
    } catch {
      this.records.delete(key);
      this.dirty = true;
      return null;
    }

    return record;
  }

  public setCache(record: CacheRecord): void {
    const key = this.generateCacheKey(record.sourceFingerprint, record.settingsHash);
    this.records.set(key, record);
    this.dirty = true;
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.flushToDisk();
      this.saveTimer = null;
    }, 1000);
  }

  public flushToDisk(): void {
    if (!this.dirty) return;
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const data = Array.from(this.records.values());
      const tempPath = `${CACHE_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, CACHE_FILE);
      this.dirty = false;
    } catch (err) {
      console.error('Failed to flush cache to disk:', err);
    }
  }

  public getStats(thumbnailStats: { count: number; totalSizeBytes: number }): CacheStats {
    let totalOptimizedBytes = 0;
    for (const r of this.records.values()) {
      totalOptimizedBytes += r.outputSizeBytes;
    }

    let cacheDbSizeBytes = 0;
    try {
      if (fs.existsSync(CACHE_FILE)) {
        cacheDbSizeBytes = fs.statSync(CACHE_FILE).size;
      }
    } catch {}

    return {
      totalRecords: this.records.size,
      totalOptimizedBytes,
      totalThumbnails: thumbnailStats.count,
      thumbnailSizeBytes: thumbnailStats.totalSizeBytes,
      cacheDbSizeBytes,
    };
  }

  public clearAllCache(): void {
    this.records.clear();
    this.dirty = true;
    this.flushToDisk();
  }

  public clearUnusedRecords(): number {
    let removed = 0;
    for (const [key, record] of this.records.entries()) {
      if (!fs.existsSync(record.outputPath) || !fs.existsSync(record.sourcePath)) {
        this.records.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.dirty = true;
      this.flushToDisk();
    }
    return removed;
  }
}

export const cacheManager = new CacheManager();
