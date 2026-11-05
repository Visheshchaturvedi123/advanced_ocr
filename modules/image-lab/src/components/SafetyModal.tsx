import React from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { OptimizationSettings, OptimizationEstimate } from '../types';

interface SafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  inputFolder: string;
  outputFolder: string;
  totalImages: number;
  settings: OptimizationSettings;
  estimate: OptimizationEstimate | null;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  inputFolder,
  outputFolder,
  totalImages,
  settings,
  estimate,
}) => {
  if (!isOpen) return null;

  const formatGb = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  const estMinStr = estimate
    ? estimate.estimatedOutputMinBytes > 1024 * 1024 * 1024
      ? `${formatGb(estimate.estimatedOutputMinBytes)} GB`
      : `${formatMb(estimate.estimatedOutputMinBytes)} MB`
    : 'Calculating...';

  const estMaxStr = estimate
    ? estimate.estimatedOutputMaxBytes > 1024 * 1024 * 1024
      ? `${formatGb(estimate.estimatedOutputMaxBytes)} GB`
      : `${formatMb(estimate.estimatedOutputMaxBytes)} MB`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="safety-confirmation-modal"
        className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Optimization Safety Confirmation
              </h3>
              <p className="text-[11px] text-slate-500">
                Confirm target directories and parameters before batch launch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Key Parameters Table */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500">
                Source Folder (Read-Only)
              </span>
              <span className="font-mono text-xs text-slate-800 truncate bg-white px-2 py-1 rounded-md border border-slate-200">
                {inputFolder}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-semibold text-emerald-700 flex items-center gap-1">
                Output Folder <ArrowRight className="w-3 h-3" />
              </span>
              <span className="font-mono text-xs text-emerald-800 truncate bg-white px-2 py-1 rounded-md border border-emerald-200">
                {outputFolder}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-500 text-[11px]">Images:</span>
                <span className="ml-1 font-semibold text-slate-900">
                  {totalImages.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Mode:</span>
                <span className="ml-1 font-semibold text-slate-900 capitalize">
                  {settings.mode.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Resolution:</span>
                <span className="ml-1 font-semibold text-slate-900">
                  {settings.resolutionMode}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">WebP Quality:</span>
                <span className="ml-1 font-semibold text-emerald-700">
                  {settings.webpQuality}%
                </span>
              </div>
            </div>

            {estimate && (
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Estimated Output:</span>
                <span className="font-semibold text-blue-700">
                  {estMinStr} {estMaxStr ? `– ${estMaxStr}` : ''} ({estimate.estimatedReductionMinPercent}–{estimate.estimatedReductionMaxPercent}% reduction)
                </span>
              </div>
            )}
          </div>

          {/* Absolute Safety Guarantee Banner */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900 text-xs">
                ORIGINAL FILES WILL REMAIN UNTOUCHED
              </p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                The optimizer treats your source directory strictly as read-only. No original images will ever be moved, renamed, altered, or overwritten. Every optimized file is encoded to a separate WebP copy.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            id="btn-safety-cancel"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            id="btn-safety-start"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Start Optimization
          </button>
        </div>
      </div>
    </div>
  );
};
