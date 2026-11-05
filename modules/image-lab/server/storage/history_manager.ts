import fs from 'fs';
import path from 'path';
import { JobReport } from '../../src/types';

const HISTORY_FILE = path.resolve(process.cwd(), '.cache', 'job_history.json');

class HistoryManager {
  private history: JobReport[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
        this.history = JSON.parse(raw);
      }
    } catch {
      this.history = [];
    }
  }

  public saveReport(report: JobReport) {
    this.history.unshift(report);
    // Keep max 50 historical runs
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
    try {
      const dir = path.dirname(HISTORY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save history report:', e);
    }
  }

  public getHistory(): JobReport[] {
    return this.history;
  }

  public getReport(jobId: string): JobReport | null {
    return this.history.find((r) => r.jobId === jobId) || null;
  }

  public clearHistory(): void {
    this.history = [];
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        fs.unlinkSync(HISTORY_FILE);
      }
    } catch {}
  }
}

export const historyManager = new HistoryManager();
