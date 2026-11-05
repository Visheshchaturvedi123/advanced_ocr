import os from 'os';
import sharp from 'sharp';
import { MemoryMode } from '../../src/types';

export class MemoryManager {
  private mode: MemoryMode = '8gb';
  private peakMemoryBytes: number = 0;
  private lastAdjustmentTime: number = 0;
  private hysteresisCooldownMs: number = 5000;

  constructor(mode: MemoryMode = '8gb') {
    this.mode = mode;
    // Configure Sharp cache to be tightly bounded for 8GB PC.
    // files: 0 — never keep file descriptors open (Windows file locks).
    sharp.cache({
      memory: 128, // Max 128 MB cache in Sharp libvips
      files: 0,
      items: 100,
    });
    sharp.simd(true);
  }

  public setMode(mode: MemoryMode) {
    this.mode = mode;
  }

  public getMemoryStats() {
    const mem = process.memoryUsage();
    if (mem.rss > this.peakMemoryBytes) {
      this.peakMemoryBytes = mem.rss;
    }
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      peakMb: Math.round(this.peakMemoryBytes / (1024 * 1024)),
      systemTotalGb: Number((totalMem / (1024 * 1024 * 1024)).toFixed(1)),
      systemFreeGb: Number((freeMem / (1024 * 1024 * 1024)).toFixed(1)),
      isPressure: this.checkMemoryPressure(freeMem, mem.rss),
    };
  }

  public checkMemoryPressure(freeMem: number, rssBytes: number): boolean {
    const freeGb = freeMem / (1024 * 1024 * 1024);
    const rssGb = rssBytes / (1024 * 1024 * 1024);

    if (this.mode === '8gb') {
      // Conservative: flag pressure if system free RAM < 1.0 GB or Node RSS > 1.8 GB
      return freeGb < 1.0 || rssGb > 1.8;
    } else if (this.mode === 'conservative') {
      return freeGb < 1.5 || rssGb > 1.2;
    } else {
      // standard
      return freeGb < 0.6 || rssGb > 2.5;
    }
  }

  public getRecommendedWorkers(configured: number | 'auto'): number {
    const totalCores = os.cpus().length || 4;
    let base = 2;

    if (configured === 'auto') {
      if (this.mode === '8gb') {
        // Ideal for 8GB PC without choking desktop UI
        base = Math.min(2, Math.max(1, Math.floor(totalCores / 2)));
      } else if (this.mode === 'conservative') {
        base = 1;
      } else {
        base = Math.min(4, Math.max(2, Math.floor(totalCores * 0.75)));
      }
    } else {
      base = configured;
    }

    const stats = this.getMemoryStats();
    if (stats.isPressure) {
      const now = Date.now();
      if (now - this.lastAdjustmentTime > this.hysteresisCooldownMs) {
        this.lastAdjustmentTime = now;
        // Reduce concurrency to 1 during pressure
        return 1;
      }
    }

    return Math.max(1, Math.min(4, base));
  }

  public clearBuffers(): void {
    sharp.cache(false);
    sharp.cache({ memory: 128, files: 0, items: 100 });
    if (global.gc) {
      try {
        global.gc();
      } catch {}
    }
  }
}

export const memoryManager = new MemoryManager('8gb');
