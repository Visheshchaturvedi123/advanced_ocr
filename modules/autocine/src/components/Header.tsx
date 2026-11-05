import React, { useRef } from 'react';
import { 
  Film, Sparkles, Cpu, Download, Gauge, 
  FolderOpen, FolderPlus, Music, Play, Layers, Sliders, ChevronDown
} from 'lucide-react';
import { StyleProfileName, AspectRatio, QualityPreset } from '../types';

interface HeaderProps {
  styleName: StyleProfileName;
  onStyleChange: (s: StyleProfileName) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (a: AspectRatio) => void;
  qualityPreset: QualityPreset;
  onQualityPresetChange: (q: QualityPreset) => void;
  onAutoEdit: () => void;
  onOpenExport: () => void;
  onDirectDownload?: () => void;
  onOpenBenchmark: () => void;
  onLoadSample: () => void;
  onImportFolder: (files: FileList) => void;
  isImporting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  styleName,
  onStyleChange,
  aspectRatio,
  onAspectRatioChange,
  qualityPreset,
  onQualityPresetChange,
  onAutoEdit,
  onOpenExport,
  onDirectDownload,
  onOpenBenchmark,
  onLoadSample,
  onImportFolder,
  isImporting = false
}) => {
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFolder(e.target.files);
    }
  };

  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800/80 px-3 sm:px-4 flex items-center justify-between select-none text-xs text-zinc-300 overflow-x-auto no-scrollbar gap-2 shrink-0">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-100 tracking-tight">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm">
            <Film className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            AutoCine AI Editor
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
            v1.0 Pro
          </span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Hidden Folder Picker Input */}
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderChange}
          {...{ webkitdirectory: '', directory: '' }}
          multiple
          className="hidden"
        />

        {/* Import Folder Action */}
        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={isImporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/60 text-amber-300 font-semibold transition active:scale-95 disabled:opacity-50"
          title="Import folder containing photos and music to automatically extract and analyze"
        >
          <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
          <span>{isImporting ? 'Analyzing...' : 'Import Folder'}</span>
        </button>

        {/* Sample dataset loader button */}
        <button
          onClick={onLoadSample}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition text-zinc-300"
          title="Load curated sample photo folder & soundtrack"
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden xl:inline">Alpine Odyssey</span>
        </button>
      </div>

      {/* Center Controls: Style, Aspect, Quality */}
      <div className="flex items-center gap-2">
        {/* Style Selector */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-zinc-400 text-[11px]">Style:</span>
          <select
            value={styleName}
            onChange={(e) => onStyleChange(e.target.value as StyleProfileName)}
            aria-label="Style Profile"
            className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer text-xs"
          >
            <option value="PHONK_DRIFT" className="bg-zinc-900 text-amber-300 font-bold">⚡ High Beat Phonk Edit (0.4-0.8s)</option>
            <option value="CINEMATIC" className="bg-zinc-900 text-zinc-200">Cinematic Story (3-5s)</option>
            <option value="WEDDING" className="bg-zinc-900 text-zinc-200">Romantic Wedding (4-7s)</option>
            <option value="TRAVEL" className="bg-zinc-900 text-zinc-200">Travel Adventure (2-4s)</option>
            <option value="MEMORIES" className="bg-zinc-900 text-zinc-200">Nostalgic Memories (3-6s)</option>
            <option value="BEAT" className="bg-zinc-900 text-zinc-200">Beat-Cut Sync (0.8-2s)</option>
            <option value="SOCIAL" className="bg-zinc-900 text-zinc-200">Social Reel (1.5-3s)</option>
            <option value="CORPORATE" className="bg-zinc-900 text-zinc-200">Corporate Showcase (3-5s)</option>
          </select>
        </div>

        {/* Aspect Ratio */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
          {(['16:9', '9:16', '1:1', '4:5'] as AspectRatio[]).map((ar) => (
            <button
              key={ar}
              onClick={() => onAspectRatioChange(ar)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                aspectRatio === ar
                  ? 'bg-zinc-800 text-amber-400 font-bold border border-zinc-700/80 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              {ar}
            </button>
          ))}
        </div>

        {/* Quality Preset */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1">
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400 text-[11px]">CRF:</span>
          <select
            value={qualityPreset}
            onChange={(e) => onQualityPresetChange(e.target.value as QualityPreset)}
            aria-label="Quality Preset"
            className="bg-transparent text-zinc-200 font-mono focus:outline-none cursor-pointer text-xs"
          >
            <option value="MASTER" className="bg-zinc-900 text-zinc-200">Master (CRF 14 slow)</option>
            <option value="VERY_HIGH" className="bg-zinc-900 text-zinc-200">Very High (CRF 15 med)</option>
            <option value="HIGH" className="bg-zinc-900 text-zinc-200">High (CRF 16 faster)</option>
            <option value="FAST" className="bg-zinc-900 text-zinc-200">Fast (CRF 18 veryfast)</option>
          </select>
        </div>
      </div>

      {/* Right Controls: Direct Download, Auto-Edit & Export */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Direct Download Video Button - Front & Center, highest visual hierarchy */}
        <button
          onClick={onDirectDownload || onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-black shadow-md hover:shadow-amber-500/25 transition active:scale-95 shrink-0"
          title="Directly download final video with music and effects to your PC"
        >
          <Download className="w-4 h-4 text-zinc-950" />
          <span>Download Video</span>
        </button>

        {/* Auto-Edit Action */}
        <button
          onClick={onAutoEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-semibold shadow-xs transition active:scale-95 shrink-0"
          title="Automatically apply beat-sync edit with transitions and motion"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Auto-Edit</span>
        </button>

        {/* Export Suite Modal */}
        <button
          onClick={onOpenExport}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium transition active:scale-95 shrink-0"
          title="Open advanced FFmpeg batch export suite"
        >
          <Film className="w-3.5 h-3.5 text-zinc-400" />
          <span>Export Suite</span>
        </button>

        {/* Hardware spec badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-[11px] shrink-0">
          <Cpu className="w-3.5 h-3.5" />
          <span>8 GB RAM</span>
        </div>

        {/* Benchmark Button */}
        <button
          onClick={onOpenBenchmark}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition shrink-0"
          title="Open 8 GB RAM CPU Benchmark Suite"
        >
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span>Benchmark</span>
        </button>
      </div>
    </header>
  );
};
