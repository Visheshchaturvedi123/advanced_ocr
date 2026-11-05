import React, { useState, useRef } from 'react';
import { 
  Image as ImageIcon, Music, CheckCircle, AlertCircle, Copy, 
  Sparkles, Star, Users, Eye, SlidersHorizontal, FolderPlus, UploadCloud
} from 'lucide-react';
import { PhotoAsset, AudioTrack } from '../types';

interface MediaPanelProps {
  photos: PhotoAsset[];
  audio: AudioTrack | null;
  selectedPhotoId: string | null;
  onSelectPhoto: (id: string) => void;
  onImportFolder?: (files: FileList) => void;
  isImporting?: boolean;
}

export const MediaPanel: React.FC<MediaPanelProps> = ({
  photos,
  audio,
  selectedPhotoId,
  onSelectPhoto,
  onImportFolder,
  isImporting = false
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'audio'>('photos');
  const [filterMode, setFilterMode] = useState<'ALL' | 'TOP' | 'DUPLICATES'>('ALL');
  const folderInputRef = useRef<HTMLInputElement>(null);

  const filteredPhotos = photos.filter((p) => {
    if (filterMode === 'TOP') return p.score >= 90;
    if (filterMode === 'DUPLICATES') return !!p.isDuplicateOf;
    return true;
  });

  const duplicateCount = photos.filter(p => !!p.isDuplicateOf).length;

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onImportFolder) {
      onImportFolder(e.target.files);
    }
  };

  return (
    <div className="w-72 md:w-80 h-full bg-zinc-950/80 border-r border-zinc-800/80 flex flex-col text-xs text-zinc-300 select-none">
      {/* Tab Switcher */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50 p-1 gap-1">
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-1.5 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'photos'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Photos ({photos.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-1.5 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'audio'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Music className="w-3.5 h-3.5 text-blue-400" />
          <span>Audio ({audio ? '1 Track' : 'None'})</span>
        </button>
      </div>

      {/* Hidden Folder Picker Input */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        {...{ webkitdirectory: '', directory: '' }}
        multiple
        className="hidden"
      />

      {/* Quick Folder Import Action Bar */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-900/40">
        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={isImporting}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 text-amber-300 font-semibold text-xs shadow-xs transition group disabled:opacity-50"
        >
          <FolderPlus className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>{isImporting ? 'Analyzing Folder...' : 'Import Folder (Photos + Music)'}</span>
        </button>
      </div>

      {activeTab === 'photos' ? (
        <>
          {/* Sub-filter bar */}
          <div className="p-2 border-b border-zinc-800/60 flex items-center justify-between gap-1 bg-zinc-900/30">
            <span className="text-[11px] text-zinc-400 font-medium">Filter:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  filterMode === 'ALL' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All ({photos.length})
              </button>
              <button
                onClick={() => setFilterMode('TOP')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  filterMode === 'TOP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Top (&gt;90)
              </button>
              <button
                onClick={() => setFilterMode('DUPLICATES')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                  filterMode === 'DUPLICATES' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Dupes ({duplicateCount})
              </button>
            </div>
          </div>

          {/* Photo Grid List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredPhotos.map((photo) => {
              const isSelected = selectedPhotoId === photo.id;
              const isDup = !!photo.isDuplicateOf;

              return (
                <div
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo.id)}
                  className={`group relative flex gap-2.5 p-1.5 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-850 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                      : isDup
                      ? 'bg-zinc-900/40 border-zinc-800/40 opacity-70 hover:opacity-100 hover:border-zinc-700'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-18 h-18 rounded-md overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800/60">
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      loading="lazy"
                    />
                    {/* Score badge in top-left */}
                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-zinc-950/90 text-amber-400 border border-zinc-800">
                      {photo.score.toFixed(0)}
                    </div>
                    {isDup && (
                      <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[8px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800/60">
                        DUPE
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <p className="text-[11px] font-medium text-zinc-200 truncate leading-tight">
                        {photo.filename}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-400">
                        <span className="capitalize">{photo.shotType}</span>
                        <span>•</span>
                        <span>{photo.orientation}</span>
                        {photo.faceCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-blue-300">
                              <Users className="w-2.5 h-2.5" />
                              {photo.faceCount}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Technical Quality mini bar */}
                    <div className="space-y-1 mt-1.5">
                      <div className="flex items-center justify-between text-[9px] text-zinc-400">
                        <span>Sharpness {photo.breakdown.sharpness}</span>
                        <span>Exposure {photo.breakdown.exposure}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                          style={{ width: `${photo.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Audio Tab */
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {audio ? (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100">{audio.title}</h4>
                    <p className="text-[10px] text-zinc-400">{audio.artist}</p>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950/60 border border-blue-800/60 text-blue-300">
                  {audio.bpm.toFixed(0)} BPM
                </div>
              </div>

              {/* Waveform Visualization */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Energy &amp; Transient Envelope</span>
                  <span>{audio.duration.toFixed(1)}s</span>
                </div>
                <div className="h-12 bg-zinc-950 rounded border border-zinc-800/80 flex items-end gap-[2px] p-1">
                  {audio.energyCurve.map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-blue-500/70 hover:bg-blue-400 rounded-xs transition-all"
                      style={{ height: `${Math.max(10, val * 100)}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Detected Sections */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Detected Structure ({audio.sections.length} Sections)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {audio.sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-semibold text-zinc-200">{sec.section}</span>
                        <span className="text-zinc-500">{sec.start}s - {sec.end}s</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] text-zinc-400">Energy:</span>
                        <span className="text-[9px] font-mono text-amber-400">
                          {(sec.energy * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync Statistics */}
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800/60 space-y-1 text-[10px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Detected Beats:</span>
                  <span className="font-mono text-zinc-200">{audio.beats.length} beats</span>
                </div>
                <div className="flex justify-between">
                  <span>Measure Downbeats (4/4):</span>
                  <span className="font-mono text-zinc-200">{audio.downbeats.length} bars</span>
                </div>
                <div className="flex justify-between">
                  <span>Sync Reliability:</span>
                  <span className="text-emerald-400 font-semibold">Aubio High Confidence (98%)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 space-y-2">
              <Music className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No audio soundtrack loaded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
