import React from 'react';
import {
  Settings,
  Cpu,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  FolderTree,
  ShieldCheck,
  RotateCcw,
  FileArchive,
} from 'lucide-react';
import { OptimizationSettings } from '../types';

interface SettingsPageProps {
  settings: OptimizationSettings;
  setSettings: React.Dispatch<React.SetStateAction<OptimizationSettings>>;
  onResetDefaults: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  setSettings,
  onResetDefaults,
}) => {
  return (
    <div id="settings-view" className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Application Preferences &amp; Engine Settings
              </h2>
              <p className="text-xs text-slate-500">
                Configure concurrency, memory management, ZIP downloads, and metadata preservation policies
              </p>
            </div>
          </div>

          <button
            onClick={onResetDefaults}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            Reset to Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Section: Concurrency & Hardware */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Processing &amp; Workers
            </h3>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Worker Thread Concurrency</label>
              <select
                value={settings.workerCount}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    workerCount: e.target.value === 'auto' ? 'auto' : Number(e.target.value),
                  }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="auto">Auto (Dynamically governed for 8GB PC)</option>
                <option value={1}>1 Worker (Lowest Memory / Background)</option>
                <option value={2}>2 Workers (Recommended Default)</option>
                <option value={3}>3 Workers (Moderate Concurrency)</option>
                <option value={4}>4 Workers (Maximum Throughput)</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Auto mode dynamically throttles threads if system memory pressure is detected.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Memory Management Profile</label>
              <select
                value={settings.memoryMode}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, memoryMode: e.target.value as any }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="8gb">8 GB RAM PC Mode (Tightly Bounded Buffers)</option>
                <option value="conservative">Conservative (Ultra-Low Footprint)</option>
                <option value="standard">Standard (Higher Memory Budget)</option>
              </select>
            </div>
          </div>

          {/* Section: ZIP & Export Automation */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileArchive className="w-4 h-4 text-emerald-600" />
              ZIP Packaging &amp; Download
            </h3>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoDownloadZip !== false}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, autoDownloadZip: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-medium text-slate-800">Auto-Download ZIP to PC</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    When batch optimization finishes, immediately package all compressed WebP images into a single ZIP file and trigger download.
                  </p>
                </div>
              </label>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <span className="font-medium text-slate-700">Non-Breaking Streaming Pipeline</span>
                <p className="text-[11px] text-slate-500">
                  Archives are streamed directly using Node.js pipe streams. If any individual image is corrupted, the pipeline catches it, logs it, and safely packages the rest.
                </p>
              </div>
            </div>
          </div>

          {/* Section: Output Organization */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-amber-600" />
              Output File Structure
            </h3>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Directory Hierarchy</label>
              <select
                value={settings.outputStructure}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, outputStructure: e.target.value as any }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="preserve">Preserve Source Directory Tree</option>
                <option value="flatten">Flatten All WebP into Output Folder</option>
                <option value="subfolder">Create /webp Subfolder In-Place</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Duplicate File Policy</label>
              <select
                value={settings.duplicateHandling}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, duplicateHandling: e.target.value as any }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="skip">Skip Exact Duplicate Images (SHA-256 Check)</option>
                <option value="process_all">Process Every File Individually</option>
              </select>
            </div>
          </div>

          {/* Section: Metadata & Color */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Metadata &amp; Verification
            </h3>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Metadata Handling</label>
              <select
                value={settings.metadataPolicy}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, metadataPolicy: e.target.value as any }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="preserve_useful">Preserve Useful (EXIF &amp; ICC Profile)</option>
                <option value="strip">Strip All (Smallest File Size)</option>
                <option value="exif_only">Preserve Camera EXIF Only</option>
              </select>
              <p className="text-[11px] text-slate-500">
                Original source image metadata is never altered under any circumstances.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-700 font-medium">Output Verification Level</label>
              <select
                value={settings.validationLevel}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, validationLevel: e.target.value as any }))
                }
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="smart">Smart (Header check + Dimension verification)</option>
                <option value="fast">Fast (Header bytes &amp; non-zero check)</option>
                <option value="maximum">Maximum (Full Raw pixel decode verification)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
