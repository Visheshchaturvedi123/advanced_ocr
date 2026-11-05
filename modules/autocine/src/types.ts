/**
 * AutoCine AI Editor Types
 */

export type StyleProfileName = 
  | 'CINEMATIC'
  | 'PHONK_DRIFT'
  | 'BEAT'
  | 'WEDDING'
  | 'TRAVEL'
  | 'MEMORIES'
  | 'SOCIAL'
  | 'CORPORATE';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type QualityPreset = 'MASTER' | 'VERY_HIGH' | 'HIGH' | 'FAST';

export interface PhotoAsset {
  id: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  score: number;
  breakdown: {
    sharpness: number;
    exposure: number;
    composition: number;
    color: number;
    faces: number;
    resolution: number;
    uniqueness: number;
  };
  faceCount: number;
  faceBoxes?: Array<{ x: number; y: number; width: number; height: number }>;
  shotType: 'hero_image' | 'portrait' | 'group' | 'landscape' | 'detail';
  isDuplicateOf?: string;
  dhash: string;
}

export interface AudioSection {
  section: 'INTRO' | 'BUILD' | 'CLIMAX' | 'OUTRO' | 'MAIN';
  start: number;
  end: number;
  energy: number;
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  filename: string;
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: AudioSection[];
  energyCurve: number[];
  url?: string;
  file?: File;
}

export interface TransitionDef {
  type: 
    | 'CUT' 
    | 'CROSSFADE' 
    | 'DIP TO BLACK' 
    | 'ZOOM PUNCH' 
    | 'FADE'
    // 5 New Transitions:
    | 'FLASH_IMPACT'
    | 'LIGHT_LEAK_SWIPE'
    | 'WHIP_SLIDE_LEFT'
    | 'WARP_ZOOM_SPIN'
    | 'GLITCH_DISPLACE';
  duration: number;
}

export interface MotionDef {
  type: 
    | 'ZOOM_IN' 
    | 'ZOOM_OUT' 
    | 'PAN_LEFT' 
    | 'PAN_RIGHT' 
    | 'SLOW_PUSH' 
    | 'STATIC'
    // 5 New Camera Motions:
    | 'WHIP_PAN'
    | 'VERTIGO_DOLLY'
    | 'CRANE_TILT_DOWN'
    | 'DUTCH_ANGLE_ROLL'
    | 'DYNAMIC_SPIRAL';
  zoomFactor: number;
  start: { scale: number; x: number; y: number; rotation?: number };
  end: { scale: number; x: number; y: number; rotation?: number };
}

export type EffectType = 
  | 'NONE'
  | 'CINEMATIC_WARMTH'
  | 'VINTAGE_FILM_GRAIN'
  | 'ANAMORPHIC_FLARE'
  | 'RGB_PRISM_SPLIT'
  | 'DREAMY_GLOW'
  | 'RETRO_BLEACH_BYPASS'
  | 'NOIR_MONOCHROME'
  | 'CYBER_NEON_VIBE';

export interface EffectDef {
  type: EffectType;
  intensity: number;
}

export interface TimelineClip {
  id: string;
  position: number;
  photoId: string;
  sourceImage: string;
  filename: string;
  startTime: number;
  duration: number;
  endTime: number;
  section: string;
  shotType: string;
  importanceScore: number;
  transition: TransitionDef;
  motion: MotionDef;
  effect?: EffectDef;
  crop: {
    aspectRatio: string;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    faceProtected: boolean;
  };
  beatAligned: boolean;
}

export interface ProjectState {
  name: string;
  style: StyleProfileName;
  aspectRatio: AspectRatio;
  qualityPreset: QualityPreset;
  photos: PhotoAsset[];
  audio: AudioTrack | null;
  timeline: TimelineClip[];
  duplicateClusters: string[][];
  hardwareProfile: 'LOW_MEMORY' | 'BALANCED' | 'HIGH_PERFORMANCE';
}
