import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Maximize, Eye, Music, Disc, Sparkles, Sliders, Download
} from 'lucide-react';
import { TimelineClip, AspectRatio, AudioTrack, StyleProfileName } from '../types';
import { audioPlayer } from '../utils/audioPlayer';

interface PreviewPlayerProps {
  timeline: TimelineClip[];
  audio: AudioTrack | null;
  aspectRatio: AspectRatio;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onTogglePlay: () => void;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onDirectDownload?: () => void;
  styleName?: StyleProfileName;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  timeline,
  audio,
  aspectRatio,
  currentTime,
  isPlaying,
  onTimeChange,
  onTogglePlay,
  selectedClipId,
  onSelectClip,
  onDirectDownload,
  styleName
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync audio track with audio engine
  useEffect(() => {
    audioPlayer.setTrack(audio);
  }, [audio]);

  // Sync playback state and time
  useEffect(() => {
    if (isPlaying) {
      audioPlayer.play(currentTime, isMuted);
    } else {
      audioPlayer.pause();
    }
  }, [isPlaying]);

  // Sync mute
  useEffect(() => {
    audioPlayer.setMuted(isMuted);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioPlayer.stop();
    };
  }, []);

  const totalDuration = timeline.length > 0 
    ? timeline[timeline.length - 1].endTime 
    : (audio ? audio.duration : 30.0);

  // Find active clip at currentTime
  const activeClipIndex = timeline.findIndex(
    c => c.startTime <= currentTime && currentTime < c.endTime
  );
  const activeClip = activeClipIndex !== -1 ? timeline[activeClipIndex] : timeline[0];

  // Calculate Ken Burns progress inside the active clip
  let kenBurnsScale = 1.0;
  let kenBurnsX = 0;
  let kenBurnsY = 0;
  let kenBurnsRotate = 0;
  let inTransition = false;
  let transOpacity = 1.0;
  let isBeatNow = false;
  let flashWhite = 0;
  let lightLeak = 0;
  let glitchOffset = 0;

  if (activeClip) {
    const localT = Math.max(0, currentTime - activeClip.startTime);
    const clipProg = Math.min(1.0, localT / Math.max(0.1, activeClip.duration));

    const motion = activeClip.motion;
    const zoomFactor = motion?.zoomFactor || 1.12;

    switch (motion?.type) {
      case 'ZOOM_IN':
        kenBurnsScale = 1.0 + (zoomFactor - 1.0) * clipProg;
        break;
      case 'ZOOM_OUT':
        kenBurnsScale = zoomFactor - (zoomFactor - 1.0) * clipProg;
        break;
      case 'PAN_LEFT':
        kenBurnsScale = 1.1;
        kenBurnsX = (0.5 - clipProg) * 45;
        break;
      case 'PAN_RIGHT':
        kenBurnsScale = 1.1;
        kenBurnsX = (clipProg - 0.5) * 45;
        break;
      case 'SLOW_PUSH':
        kenBurnsScale = 1.0 + (zoomFactor - 1.0) * 0.5 * clipProg;
        break;
      case 'WHIP_PAN':
        kenBurnsScale = 1.15;
        kenBurnsX = -Math.sin(clipProg * Math.PI) * 65;
        break;
      case 'VERTIGO_DOLLY':
        kenBurnsScale = 1.25 - 0.2 * clipProg;
        kenBurnsY = (clipProg - 0.5) * 25;
        break;
      case 'CRANE_TILT_DOWN':
        kenBurnsScale = 1.12;
        kenBurnsY = (clipProg - 0.5) * -35;
        break;
      case 'DUTCH_ANGLE_ROLL':
        kenBurnsScale = 1.14;
        kenBurnsRotate = (clipProg - 0.5) * 4;
        break;
      case 'DYNAMIC_SPIRAL':
        kenBurnsScale = 1.05 + 0.15 * clipProg;
        kenBurnsRotate = clipProg * 6;
        break;
      case 'STATIC':
      default:
        kenBurnsScale = 1.0;
        break;
    }

    // Transition effects
    const transDur = activeClip.transition?.duration || 0;
    if (localT < transDur && transDur > 0) {
      inTransition = true;
      const p = localT / transDur;

      switch (activeClip.transition.type) {
        case 'FADE':
        case 'CROSSFADE':
          transOpacity = p;
          break;
        case 'DIP TO BLACK':
          transOpacity = p < 0.5 ? 1.0 - p * 2 : (p - 0.5) * 2;
          break;
        case 'FLASH_IMPACT':
          flashWhite = Math.pow(1.0 - p, 2) * 0.95;
          break;
        case 'LIGHT_LEAK_SWIPE':
          lightLeak = (1.0 - p) * 0.9;
          break;
        case 'WHIP_SLIDE_LEFT':
          kenBurnsX += (1.0 - p) * 120;
          break;
        case 'WARP_ZOOM_SPIN':
          kenBurnsScale += (1.0 - p) * 0.4;
          kenBurnsRotate += (1.0 - p) * 12;
          break;
        case 'GLITCH_DISPLACE':
          glitchOffset = (1.0 - p) * 15;
          break;
        case 'ZOOM PUNCH':
          kenBurnsScale += (1.0 - p) * 0.2;
          break;
      }
    }

    // Beat flash pulse
    if (audio?.beats) {
      isBeatNow = audio.beats.some(b => Math.abs(b - currentTime) < 0.08);
    }
  }

  // Calculate CSS Filter for active effect
  let filterStyle = 'none';
  const effType = activeClip?.effect?.type;
  switch (effType) {
    case 'CINEMATIC_WARMTH':
      filterStyle = 'contrast(106%) sepia(22%) saturate(118%)';
      break;
    case 'VINTAGE_FILM_GRAIN':
      filterStyle = 'sepia(35%) contrast(115%) brightness(95%)';
      break;
    case 'ANAMORPHIC_FLARE':
      filterStyle = 'contrast(108%) saturate(115%)';
      break;
    case 'RGB_PRISM_SPLIT':
      filterStyle = 'saturate(130%) contrast(110%)';
      break;
    case 'DREAMY_GLOW':
      filterStyle = 'brightness(108%) contrast(98%) saturate(110%)';
      break;
    case 'RETRO_BLEACH_BYPASS':
      filterStyle = 'contrast(135%) saturate(50%) brightness(105%)';
      break;
    case 'NOIR_MONOCHROME':
      filterStyle = 'grayscale(100%) contrast(140%) brightness(96%)';
      break;
    case 'CYBER_NEON_VIBE':
      filterStyle = 'hue-rotate(185deg) saturate(145%) contrast(115%)';
      break;
  }

  // Format timecode HH:MM:SS:FF
  const formatTimecode = (seconds: number) => {
    const fps = 30;
    const totalFrames = Math.floor(seconds * fps);
    const f = totalFrames % fps;
    const s = Math.floor(seconds) % 60;
    const m = Math.floor(seconds / 60) % 60;
    const h = Math.floor(seconds / 3600);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  // Step 1 frame
  const handleStepFrame = (forward: boolean) => {
    const delta = 1.0 / 30.0;
    const nextTime = Math.min(totalDuration, Math.max(0, currentTime + (forward ? delta : -delta)));
    audioPlayer.seek(nextTime);
    onTimeChange(nextTime);
  };

  const handleTimeJump = (time: number) => {
    audioPlayer.seek(time);
    onTimeChange(time);
  };

  // Aspect ratio classes
  const aspectClass = {
    '16:9': 'aspect-[16/9] max-w-4xl',
    '9:16': 'aspect-[9/16] max-h-[580px]',
    '1:1': 'aspect-square max-h-[560px]',
    '4:5': 'aspect-[4/5] max-h-[580px]'
  }[aspectRatio] || 'aspect-[16/9] max-w-4xl';

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 items-center justify-between p-3 select-none overflow-hidden relative">
      {/* Top HUD Bar */}
      <div className="w-full flex items-center justify-between px-3 py-1 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-200 font-semibold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-zinc-500">/</span>
          <span className="font-mono text-zinc-400">{formatTimecode(totalDuration)}</span>

          {/* Active section tag */}
          {activeClip && (
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-amber-400 border border-amber-500/30">
              {activeClip.section}
            </span>
          )}

          {/* Beat Indicator pulse */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
            isBeatNow ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60' : 'bg-zinc-900 text-zinc-500'
          }`}>
            <Disc className={`w-3 h-3 ${isBeatNow ? 'animate-spin text-amber-400' : ''}`} />
            <span>BEAT SYNC</span>
          </div>
        </div>

        {/* View options & Direct Download */}
        <div className="flex items-center gap-2">
          {onDirectDownload && (
            <button
              onClick={onDirectDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
              title="Download final video with music directly to PC"
            >
              <Download className="w-3.5 h-3.5 text-zinc-950" />
              <span>Download Video</span>
            </button>
          )}

          <button
            onClick={() => setShowSafeAreas(!showSafeAreas)}
            className={`px-2 py-0.5 rounded text-[10px] border transition ${
              showSafeAreas
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300'
            }`}
            title="Toggle Safe Area Overlay (93% action, 90% title)"
          >
            Safe Area
          </button>
          <span className="text-zinc-500 text-[11px] font-mono">720p Proxy</span>
        </div>
      </div>

      {/* Main Video Canvas Screen */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0 relative my-1">
        <div
          ref={containerRef}
          className={`relative w-full ${aspectClass} rounded-lg overflow-hidden bg-black shadow-2xl border border-zinc-800/90 flex items-center justify-center`}
        >
          {activeClip ? (
            <div className="relative w-full h-full overflow-hidden">
              <img
                src={activeClip.sourceImage}
                alt={activeClip.filename}
                className="w-full h-full object-cover transition-transform duration-75 ease-linear will-change-transform"
                style={{
                  transform: `scale(${kenBurnsScale * ((styleName === 'PHONK_DRIFT' && isBeatNow) ? 1.05 : 1.0)}) translate(${kenBurnsX}px, ${kenBurnsY}px) rotate(${kenBurnsRotate}deg)`,
                  opacity: transOpacity,
                  filter: filterStyle
                }}
              />

              {/* White Flash Transition & Phonk Beat Strobe Overlay */}
              {(flashWhite > 0 || (styleName === 'PHONK_DRIFT' && isBeatNow)) && (
                <div 
                  className="absolute inset-0 pointer-events-none bg-white transition-opacity duration-75"
                  style={{ opacity: flashWhite > 0 ? flashWhite : 0.35 }}
                />
              )}

              {/* Light Leak Transition Overlay */}
              {lightLeak > 0 && (
                <div 
                  className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-amber-500/70 via-rose-500/50 to-transparent mix-blend-screen transition-opacity"
                  style={{ opacity: lightLeak }}
                />
              )}

              {/* Anamorphic Flare Streak Effect */}
              {activeClip.effect?.type === 'ANAMORPHIC_FLARE' && (
                <div className="absolute inset-x-0 top-[45%] h-2.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-xs mix-blend-screen pointer-events-none" />
              )}

              {/* Cinematic Vignette */}
              {(activeClip.effect?.type === 'CINEMATIC_WARMTH' || activeClip.effect?.type === 'VINTAGE_FILM_GRAIN' || activeClip.effect?.type === 'NOIR_MONOCHROME') && (
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
              )}

              {/* Retro Film / Glitch Scanlines */}
              {(glitchOffset > 0 || activeClip.effect?.type === 'RGB_PRISM_SPLIT' || activeClip.effect?.type === 'CYBER_NEON_VIBE') && (
                <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,255,200,0.06)_4px)] mix-blend-screen" />
              )}

              {/* Safe Area Guides Overlay */}
              {showSafeAreas && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Action Safe (93%) */}
                  <div className="absolute inset-[3.5%] border border-cyan-400/40 border-dashed rounded-xs" />
                  {/* Title Safe (90%) */}
                  <div className="absolute inset-[5%] border border-amber-400/40 border-dashed rounded-xs" />
                  {/* Center Crosshair */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
                    <div className="w-full h-[1px] bg-white/40 absolute top-1/2" />
                    <div className="h-full w-[1px] bg-white/40 absolute left-1/2" />
                  </div>
                </div>
              )}

              {/* Shot info overlay in bottom-left */}
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/75 backdrop-blur-xs border border-white/10 text-[10px] space-y-0.5">
                <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>{activeClip.filename}</span>
                  <span className="px-1 rounded bg-zinc-800 text-amber-400 text-[9px] font-mono">
                    {activeClip.importanceScore.toFixed(0)} pts
                  </span>
                </div>
                <div className="text-zinc-400 flex items-center gap-1.5 flex-wrap">
                  <span>Motion: {activeClip.motion?.type}</span>
                  <span>•</span>
                  <span>Trans: {activeClip.transition?.type}</span>
                  {activeClip.effect && activeClip.effect.type !== 'NONE' && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">FX: {activeClip.effect.type}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-zinc-500 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs">No media on timeline. Click Auto-Edit to populate.</p>
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls & Transport Bar */}
      <div className="w-full max-w-2xl bg-zinc-900/70 border border-zinc-800/80 rounded-xl px-4 py-2 flex items-center justify-between gap-4 shadow-md backdrop-blur-xs">
        <div className="flex items-center gap-2">
          {/* Skip to start */}
          <button
            onClick={() => handleTimeJump(0)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Rewind to start"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Step 1 frame back */}
          <button
            onClick={() => handleStepFrame(false)}
            className="px-1.5 py-1 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Step backward 1 frame"
          >
            -1F
          </button>

          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shadow-md transition active:scale-95"
            title={isPlaying ? 'Pause' : 'Play Audio & Video'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Step 1 frame forward */}
          <button
            onClick={() => handleStepFrame(true)}
            className="px-1.5 py-1 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Step forward 1 frame"
          >
            +1F
          </button>

          {/* Skip to end */}
          <button
            onClick={() => handleTimeJump(totalDuration)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Fast forward to end"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Mute, Sound Output status & Direct Download */}
        <div className="flex items-center gap-2">
          {audio && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${isPlaying && !isMuted ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="truncate max-w-[120px]">{audio.title}</span>
            </div>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1.5 rounded-lg transition ${
              isMuted ? 'bg-rose-950/50 text-rose-400 border border-rose-800/60' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {onDirectDownload && (
            <button
              onClick={onDirectDownload}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
              title="Download video to PC"
            >
              <Download className="w-3.5 h-3.5 text-zinc-950" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
