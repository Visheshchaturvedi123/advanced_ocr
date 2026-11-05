import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  FolderUp,
  Search,
  Zap,
  Eye,
  ShieldCheck,
  Sliders,
  Maximize2,
  HardDrive,
  Clock,
  Layers,
  ChevronDown,
  RefreshCw,
  FolderCheck,
  Download,
  UploadCloud,
  FileArchive,
} from 'lucide-react';
import {
  OptimizationSettings,
  FolderAnalysisSummary,
  OptimizationEstimate,
  ImageItem,
  OptimizationMode,
  ResolutionMode,
  MaxDimensionMode,
} from '../types';
import { extractFilesFromDataTransfer } from '../utils/fileExtractor';

interface OptimizePageProps {
  inputFolder: string;
  setInputFolder: (f: string) => void;
  outputFolder: string;
  setOutputFolder: (f: string) => void;
  settings: OptimizationSettings;
  setSettings: React.Dispatch<React.SetStateAction<OptimizationSettings>>;
  summary: FolderAnalysisSummary | null;
  items: ImageItem[];
  estimate: OptimizationEstimate | null;
  isScanning: boolean;
  onScanFolder: () => void;
  onOpenPreview: () => void;
  onRequestStart: () => void;
  isProcessing: boolean;
  onImportFolderFiles?: (files: File[]) => void;
  onDownloadZip?: () => void;
  hasOutput?: boolean;
}

export const OptimizePage: React.FC<OptimizePageProps> = ({
  inputFolder,
  setInputFolder,
  outputFolder,
  setOutputFolder,
  settings,
  setSettings,
  summary,
  items,
  estimate,
  isScanning,
  onScanFolder,
  onOpenPreview,
  onRequestStart,
  isProcessing,
  onImportFolderFiles,
  onDownloadZip,
  hasOutput = false,
}) => {
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleModeChange = (mode: OptimizationMode) => {
    let quality = 90;
    if (mode === 'max_quality') quality = 95;
    else if (mode === 'high_quality') quality = 90;
    else if (mode === 'balanced') quality = 85;
    else if (mode === 'smaller_file') quality = 80;

    setSettings((prev) => ({
      ...prev,
      mode,
      webpQuality: quality,
    }));
  };

  const handleFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (onImportFolderFiles) {
      onImportFolderFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!onImportFolderFiles) return;

    if (e.dataTransfer.items) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) {
        onImportFolderFiles(files);
      }
    } else if (e.dataTransfer.files) {
      onImportFolderFiles(Array.from(e.dataTransfer.files));
    }
  };

  const estMinStr = estimate ? formatSize(estimate.estimatedOutputMinBytes) : '--';
  const estMaxStr = estimate ? formatSize(estimate.estimatedOutputMaxBytes) : '--';

  return (
    <div id="optimize-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Hidden input for selecting a whole folder from user's PC */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderPick}
        // @ts-ignore - webkitdirectory is standard in Chromium, Firefox & Safari
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/* Folder Selection & Scanner Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-emerald-600" />
              1. Select Image Directories
            </h2>
            <p className="text-xs text-slate-500">
              Import any folder from your computer. Originals are strictly read-only and never modified.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Import Folder from PC</span>
            </button>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={settings.recursiveScan}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, recursiveScan: e.target.checked }))
                }
                className="accent-emerald-600 rounded"
              />
              <span>Include Subfolders</span>
            </label>
          </div>
        </div>

        {/* Drag and drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => folderInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800'
              : 'border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-slate-50 text-slate-600'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5 py-1">
            <UploadCloud className={`w-7 h-7 ${isDragging ? 'text-emerald-600 animate-bounce' : 'text-slate-400'}`} />
            <p className="text-xs font-medium text-slate-700">
              <span className="font-semibold text-emerald-600">Click to import a folder</span> or drag and drop a folder here
            </p>
            <p className="text-[11px] text-slate-400">
              Supports JPEG, PNG, WebP, TIFF, BMP, and AVIF. Subfolder hierarchy is fully preserved.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Input Folder */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Source Folder (Read-Only)</span>
              <span className="text-[10px] text-emerald-600 font-medium">Input Directory</span>
            </label>
            <div className="flex gap-2">
              <input
                id="input-source-folder"
                type="text"
                value={inputFolder}
                onChange={(e) => setInputFolder(e.target.value)}
                placeholder="e.g. ./sample_photos or ./imported_photos"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                id="btn-scan-folder"
                disabled={isScanning || !inputFolder}
                onClick={onScanFolder}
                className="px-4 py-2 rounded-lg font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 shadow-2xs"
              >
                {isScanning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Scan</span>
              </button>
            </div>
          </div>

          {/* Output Folder */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Output Folder (Destination)</span>
              <span className="text-[10px] text-blue-600 font-medium">WebP Output Target</span>
            </label>
            <input
              id="input-output-folder"
              type="text"
              value={outputFolder}
              onChange={(e) => setOutputFolder(e.target.value)}
              placeholder="e.g. ./optimized_webp"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Folder Summary (if scanned) */}
        {summary && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FolderCheck className="w-4 h-4 text-emerald-600" />
                Discovered Image Collection Summary
              </span>
              <span className="text-[11px] text-slate-500">
                Scanned in {summary.scanDurationMs}ms
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px]">Total Images</span>
                <div className="text-base font-bold text-slate-900">
                  {summary.totalImages.toLocaleString()}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px]">Total Dataset Size</span>
                <div className="text-base font-bold text-emerald-700">
                  {formatSize(summary.totalSizeBytes)}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px]">Average File Size</span>
                <div className="text-base font-bold text-slate-800">
                  {formatSize(summary.averageSizeBytes)}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px]">Resolution Range</span>
                <div
                  className="text-base font-bold text-blue-700 truncate"
                  title={`${summary.resolutionMin} – ${summary.resolutionMax}`}
                >
                  {summary.resolutionMin} – {summary.resolutionMax}
                </div>
              </div>
            </div>

            {/* Format breakdown tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="text-slate-500">Detected Formats:</span>
              {Object.entries(summary.formatCounts).map(([fmt, cnt]) => (
                <span
                  key={fmt}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-slate-700 text-[10px]"
                >
                  {fmt.toUpperCase()}: {cnt}
                </span>
              ))}
              {summary.transparentCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px]">
                  Alpha/Transparent: {summary.transparentCount}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Optimization Mode & Controls Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              2. Optimization Settings
            </h2>
            <p className="text-xs text-slate-500">
              Balanced encoding for maximum visual quality per byte.
            </p>
          </div>

          <button
            id="btn-toggle-advanced"
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <span>{isAdvancedMode ? 'Simple Mode' : 'Advanced Mode'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isAdvancedMode ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Preset Modes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Optimization Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {[
              { id: 'auto', label: 'Auto / Rec.', sub: 'Smart analysis' },
              { id: 'max_quality', label: 'Max Quality', sub: 'WebP Q95' },
              { id: 'high_quality', label: 'High Quality', sub: 'WebP Q90' },
              { id: 'balanced', label: 'Balanced', sub: 'WebP Q85' },
              { id: 'smaller_file', label: 'Smaller File', sub: 'WebP Q80' },
              { id: 'custom', label: 'Custom', sub: 'Manual control' },
            ].map((m) => {
              const selected = settings.mode === m.id;
              return (
                <button
                  key={m.id}
                  id={`btn-mode-${m.id}`}
                  onClick={() => handleModeChange(m.id as OptimizationMode)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-xs">{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resolution Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Target Resolution
            </label>
            <span className="text-[11px] text-emerald-600 font-medium">
              Aspect Ratio Strictly Preserved (No Distortion)
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs">
            {[
              { id: 'original', label: '100% (Original)' },
              { id: '75%', label: '75% Scale' },
              { id: '50%', label: '50% Scale' },
              { id: '40%', label: '40% Scale' },
              { id: '25%', label: '25% Scale' },
              { id: '1080p', label: 'Full HD 1080p' },
              { id: '4k', label: '4K UHD' },
            ].map((r) => {
              const selected = settings.resolutionMode === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, resolutionMode: r.id as ResolutionMode }))
                  }
                  className={`py-2 px-2.5 rounded-lg border text-center transition-colors text-xs ${
                    selected
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Section (Toggled) */}
        {isAdvancedMode && (
          <div className="space-y-4 pt-3 border-t border-slate-100 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quality Slider */}
              <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">WebP Quality Factor</span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {settings.lossless ? 'Lossless (100%)' : `${settings.webpQuality}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  disabled={settings.lossless}
                  value={settings.webpQuality}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, webpQuality: Number(e.target.value) }))
                  }
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>60% (High Compression)</span>
                  <span>85% (Optimal)</span>
                  <span>100% (Near Master)</span>
                </div>
              </div>

              {/* Max Dimension Cap */}
              <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700">Max Dimension Constraint</span>
                <select
                  value={settings.maxDimensionMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxDimensionMode: e.target.value as MaxDimensionMode,
                    }))
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none"
                >
                  <option value="none">None (Preserve full dimension)</option>
                  <option value="4096">Cap at 4096px (Ultra High Res)</option>
                  <option value="2048">Cap at 2048px (Web 2K Standard)</option>
                  <option value="1920">Cap at 1920px (Full HD Display)</option>
                  <option value="1280">Cap at 1280px (Mobile / Tablet)</option>
                </select>
              </div>
            </div>

            {/* Checkboxes Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lossless}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, lossless: e.target.checked }))
                  }
                  className="accent-emerald-600 rounded"
                />
                <span className="text-slate-700 font-medium">Lossless WebP (Pixel Exact)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smartQuality}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, smartQuality: e.target.checked }))
                  }
                  className="accent-emerald-600 rounded"
                />
                <span className="text-slate-700 font-medium">Perceptual Quality Tuning</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoDownloadZip ?? true}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, autoDownloadZip: e.target.checked }))
                  }
                  className="accent-emerald-600 rounded"
                />
                <span className="text-slate-700 font-medium">Auto-Download ZIP to PC</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Estimation & Launch Deck */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              3. Optimization Estimate &amp; Execution
            </h3>
            <p className="text-xs text-slate-500">
              Projections are calculated from actual image dimensions and sample encoding models.
            </p>
          </div>
        </div>

        {/* Projections Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Source Size</span>
            <div className="text-base font-bold text-slate-900">
              {summary ? formatSize(summary.totalSizeBytes) : '--'}
            </div>
            <div className="text-[10px] text-slate-400">
              {items.length.toLocaleString()} images
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Estimated WebP Output</span>
            <div className="text-base font-bold text-blue-700">
              {estMinStr} – {estMaxStr}
            </div>
            <div className="text-[10px] text-blue-600 font-medium">
              Calculated estimate
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Estimated Reduction</span>
            <div className="text-base font-bold text-emerald-700">
              {estimate
                ? `${estimate.estimatedReductionMinPercent}–${estimate.estimatedReductionMaxPercent}%`
                : '--'}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">
              Projected space savings
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-500 text-[11px]">Est. Processing Time</span>
            <div className="text-base font-bold text-indigo-700">
              {estimate
                ? estimate.estimatedProcessingTimeSec > 60
                  ? `~${Math.round(estimate.estimatedProcessingTimeSec / 60)} min`
                  : `~${estimate.estimatedProcessingTimeSec} sec`
                : '--'}
            </div>
            <div className="text-[10px] text-slate-400">
              Multi-core CPU throughput
            </div>
          </div>
        </div>

        {/* Safety Guarantee Banner */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              ORIGINAL FILES WILL REMAIN UNTOUCHED (Read-Only)
            </span>
            <span className="hidden md:inline text-emerald-700 text-[11px]">
              — Output is written to {outputFolder}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          {hasOutput && onDownloadZip && (
            <button
              id="btn-download-zip-pc"
              onClick={onDownloadZip}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors flex items-center justify-center gap-2 shadow-2xs"
            >
              <FileArchive className="w-4 h-4 text-emerald-600" />
              <span>Download ZIP to PC</span>
            </button>
          )}

          <button
            id="btn-open-preview"
            disabled={items.length === 0 || isProcessing}
            onClick={onOpenPreview}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            Preview Quality Sample
          </button>

          <button
            id="btn-start-optimization"
            disabled={items.length === 0 || isProcessing}
            onClick={onRequestStart}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-current" />
            Start Batch Optimization
          </button>
        </div>
      </div>
    </div>
  );
};
