import React from 'react';
import { 
  Sliders, Activity, Cpu, ShieldCheck, CheckCircle2, 
  Sparkles, Camera, Users, Clock, Move, Layers, Wand2
} from 'lucide-react';
import { PhotoAsset, TimelineClip, MotionDef, TransitionDef, EffectType } from '../types';

interface InspectorProps {
  selectedPhoto: PhotoAsset | null;
  selectedClip: TimelineClip | null;
  onUpdateClipMotion?: (motionType: MotionDef['type']) => void;
  onUpdateClipTransition?: (transType: TransitionDef['type']) => void;
  onUpdateClipEffect?: (effectType: EffectType, intensity?: number) => void;
  onUpdateClipDuration?: (dur: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedPhoto,
  selectedClip,
  onUpdateClipMotion,
  onUpdateClipTransition,
  onUpdateClipEffect,
  onUpdateClipDuration
}) => {
  return (
    <div className="w-72 md:w-80 h-full bg-zinc-950/90 border-l border-zinc-800/80 flex flex-col text-xs text-zinc-300 select-none overflow-y-auto p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>Intelligence &amp; Inspector</span>
        </div>
        {selectedPhoto && (
          <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded text-[11px]">
            {selectedPhoto.score.toFixed(1)} / 100
          </span>
        )}
      </div>

      {/* Selected Clip Adjustments */}
      {selectedClip ? (
        <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 flex items-center gap-1">
              <Camera className="w-3 h-3 text-amber-400" />
              <span>Clip Properties</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {selectedClip.id}
            </span>
          </div>

          {/* Duration slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Duration:</span>
              <span className="font-mono text-zinc-200">{selectedClip.duration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8.0"
              step="0.1"
              value={selectedClip.duration}
              onChange={(e) => onUpdateClipDuration && onUpdateClipDuration(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
          </div>

          {/* Motion Selector - All 11 Camera Moves */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-medium flex items-center justify-between">
              <span>Camera Motion:</span>
              <span className="text-[9px] text-amber-400 font-mono">11 Moves</span>
            </label>
            <select
              value={selectedClip.motion?.type || 'ZOOM_IN'}
              onChange={(e) => onUpdateClipMotion && onUpdateClipMotion(e.target.value as MotionDef['type'])}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
            >
              {/* Original 6 Motions */}
              <optgroup label="Standard Moves">
                <option value="ZOOM_IN">Smooth Zoom In (1.0x → 1.12x)</option>
                <option value="ZOOM_OUT">Smooth Zoom Out (1.12x → 1.0x)</option>
                <option value="PAN_LEFT">Horizontal Pan Left</option>
                <option value="PAN_RIGHT">Horizontal Pan Right</option>
                <option value="SLOW_PUSH">Slow Push In</option>
                <option value="STATIC">Static (No Motion)</option>
              </optgroup>
              {/* 5 New Engaging Camera Moves */}
              <optgroup label="Cinematic &amp; Dynamic (New)">
                <option value="WHIP_PAN">★ Whip Pan (High-speed snap)</option>
                <option value="VERTIGO_DOLLY">★ Vertigo Dolly (Counter-zoom push)</option>
                <option value="CRANE_TILT_DOWN">★ Crane Tilt Down (Sky descent)</option>
                <option value="DUTCH_ANGLE_ROLL">★ Dutch Angle Roll (Horizon tilt)</option>
                <option value="DYNAMIC_SPIRAL">★ Dynamic Spiral (Zoom &amp; twist)</option>
              </optgroup>
            </select>
          </div>

          {/* Visual Effects Selector */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-medium flex items-center justify-between">
              <span>Visual Effect:</span>
              <span className="text-[9px] text-emerald-400 font-mono">Engaging FX</span>
            </label>
            <select
              value={selectedClip.effect?.type || 'NONE'}
              onChange={(e) => onUpdateClipEffect && onUpdateClipEffect(e.target.value as EffectType)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
            >
              <option value="NONE">None (Clean Original)</option>
              <option value="CINEMATIC_WARMTH">Cinematic Warmth &amp; Soft Vignette</option>
              <option value="VINTAGE_FILM_GRAIN">Vintage Film Grain &amp; Tone</option>
              <option value="ANAMORPHIC_FLARE">Anamorphic Blue Streak Flare</option>
              <option value="RGB_PRISM_SPLIT">RGB Chromatic Prism Split</option>
              <option value="DREAMY_GLOW">Ethereal Dream Glow / Halation</option>
              <option value="RETRO_BLEACH_BYPASS">Retro Bleach Bypass (Silver look)</option>
              <option value="NOIR_MONOCHROME">Noir Contrast Monochrome</option>
              <option value="CYBER_NEON_VIBE">Cyber Neon Teal &amp; Purple</option>
            </select>
          </div>

          {/* Transition Selector - All 10 Transitions */}
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-medium flex items-center justify-between">
              <span>Transition To Next:</span>
              <span className="text-[9px] text-blue-400 font-mono">10 Cuts</span>
            </label>
            <select
              value={selectedClip.transition?.type || 'CUT'}
              onChange={(e) => onUpdateClipTransition && onUpdateClipTransition(e.target.value as TransitionDef['type'])}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
            >
              {/* Original 5 Transitions */}
              <optgroup label="Standard Transitions">
                <option value="CUT">Hard Cut (0.0s)</option>
                <option value="CROSSFADE">Crossfade (0.6s)</option>
                <option value="DIP TO BLACK">Dip to Black (1.0s)</option>
                <option value="ZOOM PUNCH">Zoom Punch (0.3s)</option>
                <option value="FADE">Fade (0.8s)</option>
              </optgroup>
              {/* 5 New Transitions */}
              <optgroup label="Dynamic Energy (New)">
                <option value="FLASH_IMPACT">★ Flash Impact (Beat whiteout)</option>
                <option value="LIGHT_LEAK_SWIPE">★ Light Leak Swipe (Optical glow)</option>
                <option value="WHIP_SLIDE_LEFT">★ Whip Slide Left (Kinetic push)</option>
                <option value="WARP_ZOOM_SPIN">★ Warp Zoom Spin (Radial blur)</option>
                <option value="GLITCH_DISPLACE">★ Glitch Displace (Chromatic pop)</option>
              </optgroup>
            </select>
          </div>
        </div>
      ) : null}

      {/* Granular Quality Breakdown */}
      {selectedPhoto ? (
        <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
          <span className="font-semibold text-zinc-200 text-[11px] block">
            Technical Quality Analysis
          </span>

          <div className="space-y-1.5 text-[11px]">
            {/* Sharpness */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-zinc-400">
                <span>Laplacian Sharpness</span>
                <span className="font-mono text-zinc-200">{selectedPhoto.breakdown.sharpness}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${selectedPhoto.breakdown.sharpness}%` }} />
              </div>
            </div>

            {/* Exposure */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-zinc-400">
                <span>Dynamic Exposure</span>
                <span className="font-mono text-zinc-200">{selectedPhoto.breakdown.exposure}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${selectedPhoto.breakdown.exposure}%` }} />
              </div>
            </div>

            {/* Composition */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-zinc-400">
                <span>Rule of Thirds</span>
                <span className="font-mono text-zinc-200">{selectedPhoto.breakdown.composition}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${selectedPhoto.breakdown.composition}%` }} />
              </div>
            </div>

            {/* Color Quality */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-zinc-400">
                <span>Color &amp; Saturation</span>
                <span className="font-mono text-zinc-200">{selectedPhoto.breakdown.color}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${selectedPhoto.breakdown.color}%` }} />
              </div>
            </div>

            {/* Uniqueness */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-zinc-400">
                <span>dHash Uniqueness</span>
                <span className="font-mono text-zinc-200">{selectedPhoto.breakdown.uniqueness}%</span>
              </div>
              <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${selectedPhoto.breakdown.uniqueness}%` }} />
              </div>
            </div>
          </div>

          {/* Photo Specs */}
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-1.5 text-[10px] text-zinc-400">
            <div>
              <span className="block text-zinc-500">Dimensions</span>
              <span className="font-mono text-zinc-300">{selectedPhoto.width} x {selectedPhoto.height}</span>
            </div>
            <div>
              <span className="block text-zinc-500">Aspect Ratio</span>
              <span className="font-mono text-zinc-300">{selectedPhoto.aspectRatio.toFixed(2)} ({selectedPhoto.orientation})</span>
            </div>
            <div>
              <span className="block text-zinc-500">Detected Faces</span>
              <span className="font-mono text-zinc-300">{selectedPhoto.faceCount} subject{selectedPhoto.faceCount === 1 ? '' : 's'}</span>
            </div>
            <div>
              <span className="block text-zinc-500">Shot Classifier</span>
              <span className="capitalize text-amber-400">{selectedPhoto.shotType}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Hardware & Low-Memory Engine Safeguard */}
      <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>8 GB RAM Engine Safeguard</span>
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="space-y-1 text-[10px] text-zinc-400">
          <div className="flex justify-between">
            <span>Hardware Profile:</span>
            <span className="font-mono text-zinc-200 font-semibold">LOW_MEMORY</span>
          </div>
          <div className="flex justify-between">
            <span>Memory Working Set:</span>
            <span className="font-mono text-emerald-400 font-semibold">12.4 MB / 750 MB Cap</span>
          </div>
          <div className="flex justify-between">
            <span>FFmpeg Render Threads:</span>
            <span className="font-mono text-zinc-200">2 Cores (CPU Only)</span>
          </div>
          <div className="flex justify-between">
            <span>Disk Cache Mode:</span>
            <span className="font-mono text-zinc-200">Enabled (Thumbnails &amp; Hashes)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
