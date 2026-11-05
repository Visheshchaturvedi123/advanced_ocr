import React from 'react';
import { Layers, ShieldCheck, Cpu, HardDrive, Minus, Square, X } from 'lucide-react';
import { SystemStatus } from '../types';

interface TitleBarProps {
  systemStatus: SystemStatus | null;
}

export const TitleBar: React.FC<TitleBarProps> = ({ systemStatus }) => {
  return (
    <header
      id="app-title-bar"
      className="h-9 bg-white border-b border-slate-200 flex items-center justify-between px-3 select-none text-xs text-slate-600 z-50 shrink-0 shadow-xs"
    >
      {/* App brand and desktop title */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold tracking-wide text-slate-900 text-xs">
          BATCH IMAGE OPTIMIZER
        </span>
        <span className="text-slate-500 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium">
          v1.0.0
        </span>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Originals Safe (Read-Only)</span>
        </div>
      </div>

      {/* System Resource Metrics */}
      <div className="flex items-center gap-3">
        {systemStatus && (
          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <Cpu className="w-3 h-3 text-blue-600" />
              <span>{systemStatus.cpuCores} Cores</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              <HardDrive className="w-3 h-3 text-emerald-600" />
              <span>RAM: {systemStatus.nodeRssMb} MB</span>
              <span className="text-slate-400">/ {systemStatus.totalRamGb} GB</span>
            </div>
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium">
              <span>8 GB RAM Mode Active</span>
            </div>
          </div>
        )}

        {/* Window Controls */}
        <div className="flex items-center gap-1 pl-2">
          <button
            id="btn-window-minimize"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            id="btn-window-maximize"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            title="Maximize"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            id="btn-window-close"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
