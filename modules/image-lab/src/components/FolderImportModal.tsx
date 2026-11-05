import React from 'react';
import { FolderUp, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';

interface FolderImportModalProps {
  isOpen: boolean;
  folderName: string;
  processedCount: number;
  totalCount: number;
  isCompleted: boolean;
  error?: string | null;
  onClose: () => void;
}

export const FolderImportModal: React.FC<FolderImportModalProps> = ({
  isOpen,
  folderName,
  processedCount,
  totalCount,
  isCompleted,
  error,
  onClose,
}) => {
  if (!isOpen) return null;

  const percent = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <FolderUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isCompleted ? 'Folder Imported Successfully' : 'Importing Images from Folder'}
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">
                {folderName || 'Selected Folder'}
              </p>
            </div>
          </div>
          {isCompleted && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status display */}
        {error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Import Interrupted</div>
              <p className="text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 flex items-center gap-1.5">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                )}
                <span>
                  {isCompleted
                    ? `Imported all ${totalCount} images`
                    : `Uploading ${processedCount} of ${totalCount} images (${percent}%)`}
                </span>
              </span>
              <span className="font-semibold text-slate-700">{percent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Subfolder structures and hierarchies are preserved. Originals on your PC remain untouched.
            </p>
          </div>
        )}

        {/* Footer */}
        {isCompleted && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs transition-colors"
            >
              Start Optimizing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
