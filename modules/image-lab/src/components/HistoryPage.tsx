import React from 'react';
import {
  History,
  Trash2,
  Eye,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
  Clock,
  Layers,
  Download,
  FileArchive,
} from 'lucide-react';
import { JobReport } from '../types';
import { downloadOptimizedZip } from '../utils/zipDownloader';

interface HistoryPageProps {
  history: JobReport[];
  onOpenReport: (report: JobReport) => void;
  onClearHistory: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  history,
  onOpenReport,
  onClearHistory,
}) => {
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div id="history-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Job Execution History ({history.length})
              </h2>
              <p className="text-xs text-slate-500">
                Logs of previous optimization jobs, durations, storage savings, and packaged archives
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Log History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">
              No historical optimization jobs found. Run a job from the Optimize tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold bg-slate-50/50">
                  <th className="py-2.5 px-3">Date / ID</th>
                  <th className="py-2.5 px-3">Folders</th>
                  <th className="py-2.5 px-3">Mode &amp; Quality</th>
                  <th className="py-2.5 px-3">Images</th>
                  <th className="py-2.5 px-3">Original</th>
                  <th className="py-2.5 px-3">Saved</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((job) => (
                  <tr
                    key={job.jobId}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{job.timestamp}</div>
                      <div className="font-mono text-[10px] text-slate-400">{job.jobId}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono text-[11px] text-slate-700 truncate max-w-[180px]" title={job.inputFolder}>
                        {job.inputFolder}
                      </div>
                      <div className="font-mono text-[10px] text-emerald-700 truncate max-w-[180px]" title={job.outputFolder}>
                        → {job.outputFolder}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {job.settings.mode}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        WebP Q{job.settings.webpQuality}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">
                        {job.totalImages.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {job.processedImages} proc, {job.cachedImages} cached
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-600">
                      {formatSize(job.originalTotalBytes)}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-emerald-700 font-mono">
                        {formatSize(job.storageSavedBytes)}
                      </div>
                      <div className="text-[10px] text-emerald-600">
                        {job.reductionPercent}% saved
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700">
                      {formatSec(job.totalDurationSec)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => downloadOptimizedZip(job.jobId)}
                          title="Download compressed images as ZIP"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <FileArchive className="w-3 h-3 text-emerald-600" />
                          <span>ZIP</span>
                        </button>

                        <button
                          onClick={() => onOpenReport(job)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-blue-600" />
                          <span>Report</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
