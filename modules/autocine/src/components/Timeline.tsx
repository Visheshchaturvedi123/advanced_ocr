import React, { useRef, useState } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize2, Music, Scissors, 
  Layers, Volume2, Sparkles, ChevronRight, Download
} from 'lucide-react';
import { TimelineClip, AudioTrack } from '../types';

interface TimelineProps {
  timeline: TimelineClip[];
  audio: AudioTrack | null;
  currentTime: number;
  onTimeChange: (time: number) => void;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onDirectDownload?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  timeline,
  audio,
  currentTime,
  onTimeChange,
  selectedClipId,
  onSelectClip,
  onDirectDownload
}) => {
  const [zoom, setZoom] = useState(1.0); // 1.0 = ~24px per second
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalDuration = timeline.length > 0 
    ? timeline[timeline.length - 1].endTime 
    : (audio ? audio.duration : 30.0);

  const pxPerSecond = 24 * zoom;
  const timelineWidth = Math.max(800, totalDuration * pxPerSecond);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging && e.buttons !== 1) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const newTime = Math.min(totalDuration, Math.max(0, clickX / pxPerSecond));
    onTimeChange(newTime);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Section background color mapping
  const sectionColors: Record<string, string> = {
    INTRO: 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300',
    BUILD: 'bg-sky-950/60 border-sky-800/60 text-sky-300',
    CLIMAX: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
    OUTRO: 'bg-purple-950/60 border-purple-800/60 text-purple-300',
    MAIN: 'bg-blue-950/60 border-blue-800/60 text-blue-300'
  };

  return (
    <div className="h-56 bg-zinc-950 border-t border-zinc-800/80 flex flex-col text-xs text-zinc-300 select-none">
      {/* Timeline Controls Header */}
      <div className="h-8 border-b border-zinc-800/80 px-3 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="font-semibold text-zinc-200">Timeline</span>
          <span>•</span>
          <span>{timeline.length} Clips</span>
          <span>•</span>
          <span>{totalDuration.toFixed(1)}s Total</span>
        </div>

        {/* Zoom & Navigation buttons + Quick Download */}
        <div className="flex items-center gap-2">
          {onDirectDownload && (
            <button
              onClick={onDirectDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hover:text-amber-200 font-semibold text-[11px] transition active:scale-95 shrink-0"
              title="Download final video directly to PC"
            >
              <Download className="w-3 h-3 text-amber-400" />
              <span>Download Video</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] text-zinc-400 px-1">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(3.0, zoom + 0.25))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Scrollable Canvas Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 overflow-x-auto overflow-y-hidden relative cursor-crosshair bg-zinc-950/90"
      >
        <div
          style={{ width: `${timelineWidth}px` }}
          className="h-full flex flex-col relative"
        >
          {/* 1. Time Ruler */}
          <div className="h-5 border-b border-zinc-800/80 bg-zinc-900/30 relative flex items-center">
            {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, sec) => {
              if (sec % 2 !== 0 && zoom < 1.0) return null;
              return (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSecond}px` }}
                  className="absolute top-0 bottom-0 flex flex-col justify-between"
                >
                  <span className="text-[9px] font-mono text-zinc-500 pl-1">
                    {sec}s
                  </span>
                  <div className="w-[1px] h-1.5 bg-zinc-700" />
                </div>
              );
            })}
          </div>

          {/* 2. Musical Section Bands Track */}
          <div className="h-6 border-b border-zinc-850 bg-zinc-950 relative">
            {audio?.sections.map((sec, idx) => {
              const left = sec.start * pxPerSecond;
              const width = (sec.end - sec.start) * pxPerSecond;
              const colorClass = sectionColors[sec.section] || sectionColors['MAIN'];

              return (
                <div
                  key={idx}
                  style={{ left: `${left}px`, width: `${width}px` }}
                  className={`absolute top-0 bottom-0 border-r text-[9px] font-semibold px-2 flex items-center justify-between truncate ${colorClass}`}
                >
                  <span>{sec.section}</span>
                  <span className="font-mono text-[8px] opacity-75">
                    {sec.start.toFixed(1)}s - {sec.end.toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* 3. Musical Beat Ticks Track */}
          <div className="h-4 border-b border-zinc-900 bg-zinc-950/80 relative">
            {audio?.beats.map((beat, idx) => {
              const isDownbeat = audio.downbeats.some(d => Math.abs(d - beat) < 0.05);
              return (
                <div
                  key={idx}
                  style={{ left: `${beat * pxPerSecond}px` }}
                  className={`absolute top-0 bottom-0 w-[1px] ${
                    isDownbeat ? 'bg-amber-400/80 w-[2px]' : 'bg-zinc-700/50'
                  }`}
                  title={`Beat ${idx + 1} at ${beat.toFixed(2)}s`}
                />
              );
            })}
          </div>

          {/* 4. Video Clips Track */}
          <div className="h-20 border-b border-zinc-800 bg-zinc-900/40 relative p-1 flex items-center">
            {timeline.map((clip) => {
              const left = clip.startTime * pxPerSecond;
              const width = Math.max(36, clip.duration * pxPerSecond);
              const isSelected = selectedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip.id);
                  }}
                  style={{ left: `${left}px`, width: `${width}px` }}
                  className={`absolute top-1 bottom-1 rounded-md overflow-hidden border flex flex-col justify-between group transition cursor-pointer shadow-xs ${
                    isSelected
                      ? 'border-amber-400 bg-zinc-800 ring-2 ring-amber-500/50 z-10'
                      : 'border-zinc-700/80 bg-zinc-850 hover:border-zinc-500'
                  }`}
                >
                  {/* Clip Header with Thumbnail */}
                  <div className="flex-1 flex items-center overflow-hidden relative">
                    <img
                      src={clip.sourceImage}
                      alt={clip.filename}
                      className="w-14 h-full object-cover shrink-0 border-r border-zinc-800 opacity-90 group-hover:opacity-100"
                    />
                    <div className="p-1 min-w-0 flex-1">
                      <p className="text-[10px] font-medium text-zinc-100 truncate">
                        {clip.filename}
                      </p>
                      <div className="flex items-center gap-1 text-[9px] text-zinc-400">
                        <span className="capitalize">{clip.shotType}</span>
                        <span>•</span>
                        <span className="font-mono">{clip.duration.toFixed(1)}s</span>
                      </div>
                    </div>
                  </div>

                  {/* Clip Footer: Transition & Motion Badge */}
                  <div className="h-4 bg-zinc-950/80 border-t border-zinc-800 px-1.5 flex items-center justify-between text-[8px] text-zinc-400">
                    <span className="truncate">{clip.motion?.type}</span>
                    <span className="text-amber-400 font-mono">{clip.transition?.type}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5. Audio Waveform Track */}
          <div className="h-10 bg-zinc-950 border-b border-zinc-800/80 relative flex items-center px-1">
            <div className="absolute left-2 top-1 text-[9px] text-blue-400/80 flex items-center gap-1 z-10">
              <Music className="w-2.5 h-2.5" />
              <span>{audio ? `${audio.title} (${audio.bpm.toFixed(0)} BPM)` : 'No Audio'}</span>
            </div>
            {/* Render waveform bars */}
            {audio && (
              <div className="w-full h-full flex items-center gap-[2px] pt-3">
                {audio.energyCurve.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-blue-500/40 rounded-xs"
                    style={{ height: `${Math.max(15, val * 100)}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Red Scrub Playhead Cursor */}
          <div
            style={{ left: `${currentTime * pxPerSecond}px` }}
            className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none"
          >
            {/* Playhead Handle */}
            <div className="w-3 h-3 bg-rose-500 -ml-1.5 rotate-45 rounded-xs shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
};
