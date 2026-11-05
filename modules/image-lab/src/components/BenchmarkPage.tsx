import React, { useState } from 'react';
import {
  Gauge,
  Play,
  Download,
  HardDrive,
  Cpu,
  Clock,
  Zap,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  Database,
} from 'lucide-react';
import { hubFetch } from '../utils/hubApi';

interface BenchmarkResult {
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
}

export const BenchmarkPage: React.FC = () => {
  const [targetCount, setTargetCount] = useState<number>(100);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusLog, setStatusLog] = useState<string>('Ready to run benchmark');
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setStatusLog(`Initializing benchmark test with ${targetCount} synthetic images...`);
    try {
      const res = await hubFetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: targetCount }),
      });
      if (!res.ok) {
        throw new Error(`Benchmark failed: ${await res.text()}`);
      }
      const data: BenchmarkResult = await res.json();
      setResult(data);
      setStatusLog(`Benchmark completed successfully for ${targetCount} images!`);
    } catch (err: any) {
      setStatusLog(`Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCsv = () => {
    if (!result) return;
    const rows = [
      ['Metric', 'Value'],
      ['Dataset Images', result.datasetSize],
      ['Throughput (Images/Sec)', result.imagesPerSec],
      ['Total Time (Seconds)', result.processingTimeSec],
      ['Storage Saved (MB)', (result.storageSavedBytes / (1024 * 1024)).toFixed(2)],
      ['Reduction Percent', `${result.reductionPercent}%`],
      ['Peak Memory (MB)', result.peakRamMb],
      ['Average Memory (MB)', result.averageRamMb],
      ['Cache Hit Rate', `${result.cacheHitRatePercent}%`],
      ['Failures', result.failures],
      ['CPU Hardware', result.cpuModel],
      ['CPU Cores', result.cpuCores],
      ['Timestamp', result.timestamp],
    ];

    const csv = rows.map((r) => `"${r[0]}","${r[1]}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Optimizer_Benchmark_${result.datasetSize}_imgs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div id="benchmark-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Benchmark Setup Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Stress Test &amp; Performance Benchmark
              </h2>
              <p className="text-xs text-slate-500">
                Benchmark real-world throughput, 8 GB RAM stability, and WebP encoding speeds on this PC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              disabled={isRunning}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value={50}>50 Images (Fast Smoke Test)</option>
              <option value={100}>100 Images (Standard Bench)</option>
              <option value={500}>500 Images (Medium Batch)</option>
              <option value={1000}>1,000 Images (Full Scale)</option>
              <option value={5000}>5,000 Images (Stress Test)</option>
            </select>

            <button
              id="btn-run-benchmark"
              disabled={isRunning}
              onClick={handleRunBenchmark}
              className="px-4 py-2 rounded-lg font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
            >
              {isRunning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isRunning ? 'Running Benchmark...' : 'Run Benchmark'}</span>
            </button>
          </div>
        </div>

        {/* Live Status Log */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {statusLog}
          </span>
          <span className="text-[10px] text-slate-500">8 GB Mode Concurrency</span>
        </div>
      </div>

      {/* Benchmark Results Display */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                Benchmark Results: {result.datasetSize.toLocaleString()} Images
              </h3>
              <p className="text-xs text-slate-500">
                Executed on {new Date(result.timestamp).toLocaleTimeString()} • {result.cpuModel}
              </p>
            </div>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Throughput</span>
              <div className="text-xl font-bold text-blue-700 font-mono">
                {result.imagesPerSec} img/s
              </div>
              <div className="text-[10px] text-slate-500">
                {result.processingTimeSec}s total duration
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-emerald-700">Storage Saved</span>
              <div className="text-xl font-bold text-emerald-900 font-mono">
                {formatSize(result.storageSavedBytes)}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium">
                {result.reductionPercent}% reduction
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Peak Memory</span>
              <div className="text-xl font-bold text-indigo-700 font-mono">
                {result.peakRamMb} MB
              </div>
              <div className="text-[10px] text-slate-500">
                Avg {result.averageRamMb} MB (Strictly Bounded)
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500">Cache Hit Rate</span>
              <div className="text-xl font-bold text-amber-700 font-mono">
                {result.cacheHitRatePercent}%
              </div>
              <div className="text-[10px] text-slate-500">
                {result.failures} failures
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
