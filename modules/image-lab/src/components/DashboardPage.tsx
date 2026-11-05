import React, { useState, useRef } from 'react';
import {
  Zap,
  FolderOpen,
  FolderUp,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Download,
  FileArchive,
} from 'lucide-react';
import { JobReport, SystemStatus } from '../types';
import { downloadOptimizedZip } from '../utils/zipDownloader';

interface DashboardPageProps {
  onStartNewJob: () => void;
  onSelectFolder: (folder: string) => void;
  recentJobs: JobReport[];
  systemStatus: SystemStatus | null;
  onOpenReport: (report: JobReport) => void;
  onGenerateSample: (count: number) => Promise<void>;
  onImportFolderFiles?: (files: File[]) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onStartNewJob,
  onSelectFolder,
  recentJobs,
  systemStatus,
  onOpenReport,
  onGenerateSample,
  onImportFolderFiles,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sampleCount, setSampleCount] = useState(25);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const totalOptimizedImages = recentJobs.reduce((acc, j) => acc + j.processedImages + j.cachedImages, 0);
  const totalStorageSavedBytes = recentJobs.reduce((acc, j) => acc + j.storageSavedBytes, 0);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSample(sampleCount);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (onImportFolderFiles) {
      onImportFolderFiles(Array.from(e.target.files));
    }
  };

  return (
    <div id="dashboard-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Hidden input for folder pick */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderPick}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-emerald-50 via-slate-50 to-white border border-emerald-200/80 p-6 shadow-xs">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>High-Fidelity Batch WebP Engine</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Local Batch Image Optimizer
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed">
            Compress and convert tens of thousands of images into pristine WebP files with zero risk to your originals. Engineered for 8 GB RAM CPU-only systems with bounded queues, atomic writes, and automated ZIP packaging.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="btn-dash-start-optimize"
              onClick={onStartNewJob}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              New Optimization Job
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 transition-colors shadow-2xs flex items-center gap-2"
            >
              <FolderUp className="w-4 h-4 text-emerald-600" />
              Import Folder from PC
            </button>

            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 pl-2">Sample Set:</span>
              <select
                value={sampleCount}
                onChange={(e) => setSampleCount(Number(e.target.value))}
                className="bg-slate-50 text-xs text-slate-800 px-2 py-1.5 rounded-lg border border-slate-200 outline-none"
              >
                <option value={10}>10 Images</option>
                <option value={25}>25 Images</option>
                <option value={50}>50 Images</option>
                <option value={100}>100 Images</option>
              </select>
              <button
                id="btn-dash-gen-sample"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Generate Test Set</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Storage Saved</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            {formatSize(totalStorageSavedBytes)}
          </div>
          <div className="text-[11px] text-slate-400">
            Across logged batch runs
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Images Optimized</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {totalOptimizedImages.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            Processed or verified in cache
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>RAM Architecture</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            8 GB PC Mode
          </div>
          <div className="text-[11px] text-slate-400">
            Dynamic worker throttler active
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Original Safety</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            100% Safe
          </div>
          <div className="text-[11px] text-slate-400">
            Strict read-only source pipeline
          </div>
        </div>
      </div>

      {/* System Resource Card & Recent Jobs Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            System Resource Health
          </h3>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Operating System:</span>
              <span className="font-medium text-slate-800 truncate max-w-[180px]">
                {systemStatus?.osPlatform || 'Windows (Local)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">CPU Hardware:</span>
              <span className="font-medium text-slate-800">
                {systemStatus?.cpuCores || 4} Cores (CPU-Only)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Process RAM:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {systemStatus?.nodeRssMb || 120} MB
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">System Free RAM:</span>
              <span className="font-mono text-blue-700 font-semibold">
                {systemStatus?.freeRamGb || 4.2} GB / {systemStatus?.totalRamGb || 8.0} GB
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Optimal Concurrency:</span>
              <span className="font-semibold text-slate-800">
                {systemStatus?.activeWorkers || 2} Threads
              </span>
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Optimization Runs
            </h3>
            {recentJobs.length > 0 && (
              <span className="text-[11px] text-slate-500">
                {recentJobs.length} logged runs
              </span>
            )}
          </div>

          {recentJobs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
              <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">
                No previous runs recorded yet.
              </p>
              <button
                onClick={onStartNewJob}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-4"
              >
                Start your first optimization job
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentJobs.slice(0, 4).map((job) => (
                <div
                  key={job.jobId}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors"
                >
                  <div
                    className="space-y-1 cursor-pointer flex-1"
                    onClick={() => onOpenReport(job)}
                  >
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]" title={job.inputFolder}>
                        {job.inputFolder.split(/[\\/]/).pop()}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-medium border border-slate-200">
                        {job.settings.mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{job.totalImages} images</span>
                      <span>•</span>
                      <span>{job.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right space-y-0.5">
                      <div className="font-semibold text-emerald-700">
                        Saved {formatSize(job.storageSavedBytes)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {job.reductionPercent}% saved
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadOptimizedZip(job.jobId);
                      }}
                      title="Directly download ZIP to PC"
                      className="p-2 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
