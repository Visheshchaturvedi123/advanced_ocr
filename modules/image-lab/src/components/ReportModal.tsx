import React from 'react';
import {
  CheckCircle2,
  Download,
  X,
  HardDrive,
  Clock,
  Zap,
  Layers,
  AlertTriangle,
  FolderCheck,
  FileArchive,
} from 'lucide-react';
import { JobReport } from '../types';
import { downloadOptimizedZip } from '../utils/zipDownloader';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: JobReport | null;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  if (!isOpen || !report) return null;

  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${formatGb(bytes)} GB`;
    }
    return `${formatMb(bytes)} MB`;
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Optimization_Report_${report.jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Job ID', report.jobId],
      ['Date', report.timestamp],
      ['Input Folder', report.inputFolder],
      ['Output Folder', report.outputFolder],
      ['Optimization Mode', report.settings.mode],
      ['WebP Quality', report.settings.webpQuality],
      ['Total Images', report.totalImages],
      ['Successfully Processed', report.processedImages],
      ['Cached Reused', report.cachedImages],
      ['Skipped Duplicates', report.skippedDuplicates],
      ['Failed Images', report.failedImages],
      ['Original Total Size (Bytes)', report.originalTotalBytes],
      ['Output Total Size (Bytes)', report.outputTotalBytes],
      ['Storage Saved (Bytes)', report.storageSavedBytes],
      ['Reduction Percent', `${report.reductionPercent}%`],
      ['Total Processing Time (Seconds)', report.totalDurationSec],
      ['Average Speed (Images/Sec)', report.avgSpeedImagesPerSec],
      ['Peak RAM (MB)', report.peakMemoryMb],
      ['Average Output Dimensions', report.avgOutputDimensions],
    ];

    const csvContent = rows
      .map((e) => `"${e[0]}","${String(e[1]).replace(/"/g, '""')}"`)
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Optimization_Report_${report.jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="final-report-modal"
        className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Batch Optimization Completed
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Job ID: {report.jobId} • {report.timestamp}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1">
              <span className="text-emerald-700 text-[11px] font-medium">Storage Saved</span>
              <div className="text-xl font-bold text-emerald-900 font-mono">
                {formatSize(report.storageSavedBytes)}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold">
                {report.reductionPercent}% reduction
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <span className="text-slate-500 text-[11px] font-medium">Original Dataset</span>
              <div className="text-lg font-bold text-slate-800 font-mono">
                {formatSize(report.originalTotalBytes)}
              </div>
              <div className="text-[10px] text-slate-400">
                {report.totalImages} images
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <span className="text-slate-500 text-[11px] font-medium">Optimized WebP</span>
              <div className="text-lg font-bold text-blue-700 font-mono">
                {formatSize(report.outputTotalBytes)}
              </div>
              <div className="text-[10px] text-blue-600">
                {report.processedImages} converted
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
              <span className="text-slate-500 text-[11px] font-medium">Duration</span>
              <div className="text-lg font-bold text-slate-800 font-mono">
                {formatDuration(report.totalDurationSec)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {report.avgSpeedImagesPerSec} img/sec
              </div>
            </div>
          </div>

          {/* Directory Details */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 font-medium">Source Folder (Untouched):</span>
              <span className="font-mono text-slate-700 truncate max-w-sm" title={report.inputFolder}>
                {report.inputFolder}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 font-medium">WebP Output Folder:</span>
              <span className="font-mono text-emerald-700 truncate max-w-sm" title={report.outputFolder}>
                {report.outputFolder}
              </span>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Execution Breakdown
            </h4>

            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Newly Encoded WebP:</span>
                <span className="font-semibold text-slate-900">{report.processedImages}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Cached Items Reused:</span>
                <span className="font-semibold text-amber-700">{report.cachedImages}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Skipped Exact Duplicates:</span>
                <span className="font-semibold text-slate-700">{report.skippedDuplicates}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Optimization Mode:</span>
                <span className="font-semibold text-slate-900 capitalize">{report.settings.mode.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">WebP Quality Setting:</span>
                <span className="font-semibold text-emerald-700">{report.settings.webpQuality}%</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Average Output Dimensions:</span>
                <span className="font-semibold text-slate-900">{report.avgOutputDimensions}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Failed / Corrupted:</span>
                <span className={`font-semibold ${report.failedImages > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {report.failedImages}
                </span>
              </div>
            </div>
          </div>

          {/* Failures List (if any) */}
          {report.failedDetails && report.failedDetails.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Failed Files Log ({report.failedDetails.length})</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Batch processing finished all other images safely without breaking.
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px]">
                {report.failedDetails.map((f, i) => (
                  <div key={i} className="p-1.5 bg-white rounded border border-rose-200 flex justify-between">
                    <span className="text-slate-700 truncate max-w-[280px]">{f.filename}</span>
                    <span className="text-rose-600 truncate max-w-[200px]">{f.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadOptimizedZip(report.jobId)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <FileArchive className="w-3.5 h-3.5" />
              Download All as ZIP
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
