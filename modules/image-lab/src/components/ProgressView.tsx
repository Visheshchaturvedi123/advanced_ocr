import React from 'react';
import {
  Pause,
  Play,
  StopCircle,
  Activity,
  HardDrive,
  Clock,
  Gauge,
  CheckCircle2,
  Database,
  Copy,
  AlertCircle,
  ShieldCheck,
  Download,
  FileArchive,
} from 'lucide-react';
import { JobProgress } from '../types';
import { downloadOptimizedZip } from '../utils/zipDownloader';

interface ProgressViewProps {
  progress: JobProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  progress,
  onPause,
  onResume,
  onCancel,
}) => {
  const isPaused = progress.status === 'paused';
  const isRunning = progress.status === 'running';
  const isCompleted = progress.status === 'completed';

  const formatSec = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const completedCount =
    progress.processed + progress.cached + progress.skipped + progress.failed;

  return (
    <div
      id="batch-progress-monitor"
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in"
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : isPaused
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isCompleted ? 'bg-emerald-600' : isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
              }`} />
              {isCompleted ? 'OPTIMIZATION COMPLETE' : isPaused ? 'OPTIMIZATION PAUSED' : 'OPTIMIZING BATCH'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Job: {progress.jobId}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{completedCount.toLocaleString()} / {progress.total.toLocaleString()}</span>
            <span className="text-sm font-semibold text-emerald-700">
              ({progress.percent}%)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isCompleted && (
            <button
              onClick={() => downloadOptimizedZip(progress.jobId)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-2"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download ZIP to PC</span>
            </button>
          )}

          {isRunning && (
            <button
              id="btn-pause-optimization"
              onClick={onPause}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 transition-colors flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5 text-amber-600" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              id="btn-resume-optimization"
              onClick={onResume}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              Resume
            </button>
          )}

          {!isCompleted && (
            <button
              id="btn-cancel-optimization"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
            >
              <StopCircle className="w-3.5 h-3.5 text-rose-600" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPaused ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="truncate max-w-md">
            Current: {progress.currentFile || 'Pipeline complete'}
          </span>
          <span className="font-semibold text-slate-700">{progress.percent}%</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Gauge className="w-3.5 h-3.5 text-blue-600" />
            <span>Speed</span>
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {progress.speedImagesPerSec} <span className="text-xs font-normal text-slate-500">img/sec</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>ETA</span>
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {formatSec(progress.etaSeconds)}
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
            <span>Memory (RSS)</span>
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {progress.memoryUsageMb} MB
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Activity className="w-3.5 h-3.5 text-amber-600" />
            <span>Active Workers</span>
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {progress.activeWorkers} <span className="text-xs font-normal text-slate-500">threads</span>
          </div>
        </div>
      </div>

      {/* Real Counter Breakdown Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
          <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Processed
          </span>
          <span className="font-semibold text-slate-900">{progress.processed}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
          <span className="flex items-center gap-1.5 text-amber-800 font-medium">
            <Database className="w-3.5 h-3.5 text-amber-600" />
            Cached
          </span>
          <span className="font-semibold text-slate-900">{progress.cached}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            Skipped
          </span>
          <span className="font-semibold text-slate-900">{progress.skipped}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/60 border border-rose-200/60">
          <span className="flex items-center gap-1.5 text-rose-800 font-medium">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Failed
          </span>
          <span className="font-semibold text-slate-900">{progress.failed}</span>
        </div>
      </div>

      {/* Storage Saved Live Ticker */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-950">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">Storage Saved:</span>
          <span className="font-bold text-slate-900">{formatSize(progress.savingsBytes)}</span>
          <span className="text-emerald-700 font-semibold">({progress.reductionPercent}% reduction)</span>
        </div>
        <span className="text-[11px] text-slate-500">
          Elapsed: {formatSec(progress.elapsedSeconds)}
        </span>
      </div>
    </div>
  );
};
