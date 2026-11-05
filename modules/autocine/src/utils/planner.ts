import { 
  PhotoAsset, AudioTrack, TimelineClip, StyleProfileName, 
  AspectRatio, MotionDef, TransitionDef, EffectDef, EffectType 
} from '../types';

export function generateAutoEditTimeline(
  photos: PhotoAsset[],
  audio: AudioTrack | null,
  styleName: StyleProfileName,
  aspectRatio: AspectRatio
): TimelineClip[] {
  if (!photos.length) return [];

  // Filter out exact low-score duplicates unless needed
  const uniquePhotos = photos.filter(p => !p.isDuplicateOf || p.score > 90);
  const totalDuration = audio ? audio.duration : 30.0;
  const beats = audio ? audio.beats : Array.from({ length: 60 }, (_, i) => i * 0.5);
  const sections = audio?.sections || [
    { section: 'INTRO', start: 0, end: totalDuration * 0.2, energy: 0.3 },
    { section: 'MAIN', start: totalDuration * 0.2, end: totalDuration * 0.8, energy: 0.7 },
    { section: 'OUTRO', start: totalDuration * 0.8, end: totalDuration, energy: 0.2 }
  ];

  // Clip duration bounds by style
  let minDur = 2.0;
  let maxDur = 4.5;
  if (styleName === 'PHONK_DRIFT') { minDur = 0.42; maxDur = 0.85; }
  else if (styleName === 'BEAT') { minDur = 0.5; maxDur = 2.0; }
  else if (styleName === 'MEMORIES') { minDur = 3.0; maxDur = 6.0; }
  else if (styleName === 'TRAVEL') { minDur = 1.5; maxDur = 3.5; }
  else if (styleName === 'WEDDING') { minDur = 3.5; maxDur = 6.5; }

  const avgDur = (minDur + maxDur) / 2;
  const targetCount = styleName === 'PHONK_DRIFT'
    ? Math.max(12, Math.round(totalDuration / 0.85))
    : Math.max(3, Math.min(uniquePhotos.length, Math.round(totalDuration / avgDur)));

  // Pick top photos and order them for variety
  const sorted = [...uniquePhotos].sort((a, b) => b.score - a.score);
  const selectedPool = sorted.length > 0 ? sorted : photos;
  const selected = selectedPool.slice(0, Math.min(selectedPool.length, targetCount));

  // Re-order for visual rhythm: Alternate landscape and portrait, distribute faces
  const orderedBase: PhotoAsset[] = [];
  const faces = selected.filter(p => p.faceCount > 0);
  const landscapes = selected.filter(p => p.faceCount === 0);

  let fIdx = 0, lIdx = 0;
  for (let i = 0; i < selected.length; i++) {
    if (i % 2 === 0 && lIdx < landscapes.length) {
      orderedBase.push(landscapes[lIdx++]);
    } else if (fIdx < faces.length) {
      orderedBase.push(faces[fIdx++]);
    } else if (lIdx < landscapes.length) {
      orderedBase.push(landscapes[lIdx++]);
    } else if (fIdx < faces.length) {
      orderedBase.push(faces[fIdx++]);
    }
  }

  // Fallback if empty
  if (!orderedBase.length) orderedBase.push(...selectedPool);

  // For high beat phonk, cycle through photos to populate rapid beat-synced cuts
  const ordered: PhotoAsset[] = [];
  for (let i = 0; i < targetCount; i++) {
    ordered.push(orderedBase[i % orderedBase.length]);
  }

  // Divide duration evenly to beat boundaries
  const clips: TimelineClip[] = [];
  const clipDur = totalDuration / ordered.length;

  // Complete palette of 11 camera motions (6 original + 5 new)
  const motionTypes: MotionDef['type'][] = [
    'ZOOM_IN',
    'WHIP_PAN',
    'VERTIGO_DOLLY',
    'PAN_RIGHT',
    'DUTCH_ANGLE_ROLL',
    'ZOOM_OUT',
    'CRANE_TILT_DOWN',
    'DYNAMIC_SPIRAL',
    'PAN_LEFT',
    'SLOW_PUSH'
  ];

  // Complete palette of transitions (5 original + 5 new)
  const dynamicTransitions: TransitionDef['type'][] = [
    'FLASH_IMPACT',
    'LIGHT_LEAK_SWIPE',
    'WHIP_SLIDE_LEFT',
    'WARP_ZOOM_SPIN',
    'GLITCH_DISPLACE',
    'CROSSFADE',
    'ZOOM PUNCH'
  ];

  // Curate visual effects by style profile
  const styleEffectMap: Record<StyleProfileName, EffectType[]> = {
    PHONK_DRIFT: ['RGB_PRISM_SPLIT', 'CYBER_NEON_VIBE', 'RETRO_BLEACH_BYPASS', 'ANAMORPHIC_FLARE'],
    CINEMATIC: ['CINEMATIC_WARMTH', 'ANAMORPHIC_FLARE', 'DREAMY_GLOW'],
    WEDDING: ['DREAMY_GLOW', 'CINEMATIC_WARMTH', 'NONE'],
    TRAVEL: ['CINEMATIC_WARMTH', 'VINTAGE_FILM_GRAIN', 'LIGHT_LEAK_SWIPE' as unknown as EffectType],
    MEMORIES: ['VINTAGE_FILM_GRAIN', 'RETRO_BLEACH_BYPASS', 'DREAMY_GLOW'],
    BEAT: ['RGB_PRISM_SPLIT', 'CYBER_NEON_VIBE', 'ANAMORPHIC_FLARE'],
    SOCIAL: ['CYBER_NEON_VIBE', 'RGB_PRISM_SPLIT', 'CINEMATIC_WARMTH'],
    CORPORATE: ['NONE', 'CINEMATIC_WARMTH', 'NONE']
  };

  const currentEffects = styleEffectMap[styleName] || ['CINEMATIC_WARMTH', 'ANAMORPHIC_FLARE'];

  for (let i = 0; i < ordered.length; i++) {
    const photo = ordered[i];
    const rawStart = i * clipDur;
    const rawEnd = (i + 1) * clipDur;

    // Snap to closest beat
    const startBeat = beats.reduce((prev, curr) => 
      Math.abs(curr - rawStart) < Math.abs(prev - rawStart) ? curr : prev, rawStart
    );
    const endBeat = (i === ordered.length - 1) 
      ? totalDuration 
      : beats.reduce((prev, curr) => 
          Math.abs(curr - rawEnd) < Math.abs(prev - rawEnd) ? curr : prev, rawEnd
        );

    const actualStart = i === 0 ? 0 : startBeat;
    const actualEnd = Math.max(actualStart + 0.35, endBeat);
    const duration = +(actualEnd - actualStart).toFixed(2);

    // Find section
    const midT = actualStart + duration / 2;
    const currentSection = sections.find(s => s.start <= midT && midT <= s.end)?.section || 'MAIN';

    // Transition assignment: heavy, fast-paced energetic cuts on beat for Phonk
    let trans: TransitionDef = { type: 'CUT', duration: 0 };
    if (i === 0) {
      trans = { type: 'FADE', duration: 0.6 };
    } else if (i === ordered.length - 1) {
      trans = { type: 'DIP TO BLACK', duration: 0.8 };
    } else if (styleName === 'PHONK_DRIFT') {
      // Rapid energetic cuts with flash, glitch, warp and whip punches
      const phonkTrans: TransitionDef['type'][] = [
        'FLASH_IMPACT', 
        'GLITCH_DISPLACE', 
        'WARP_ZOOM_SPIN', 
        'WHIP_SLIDE_LEFT', 
        'ZOOM PUNCH'
      ];
      trans = { type: phonkTrans[i % phonkTrans.length], duration: 0.22 };
    } else if (styleName === 'BEAT') {
      const beatTrans: TransitionDef['type'][] = ['FLASH_IMPACT', 'WARP_ZOOM_SPIN', 'GLITCH_DISPLACE', 'ZOOM PUNCH', 'WHIP_SLIDE_LEFT'];
      trans = { type: beatTrans[i % beatTrans.length], duration: 0.35 };
    } else if (styleName === 'TRAVEL' || styleName === 'MEMORIES') {
      const warmTrans: TransitionDef['type'][] = ['LIGHT_LEAK_SWIPE', 'CROSSFADE', 'WHIP_SLIDE_LEFT', 'CROSSFADE'];
      trans = { type: warmTrans[i % warmTrans.length], duration: 0.6 };
    } else {
      trans = { type: dynamicTransitions[i % dynamicTransitions.length], duration: 0.5 };
    }

    // Motion: Ken Burns with 11 camera moves
    const phonkMotions: MotionDef['type'][] = [
      'DUTCH_ANGLE_ROLL', 
      'WHIP_PAN', 
      'DYNAMIC_SPIRAL', 
      'VERTIGO_DOLLY', 
      'ZOOM_IN'
    ];
    const mType = styleName === 'PHONK_DRIFT' 
      ? phonkMotions[i % phonkMotions.length] 
      : motionTypes[i % motionTypes.length];
    const zoomFactor = styleName === 'PHONK_DRIFT' ? 1.35 : (styleName === 'BEAT' ? 1.25 : 1.12);

    const motion: MotionDef = {
      type: mType,
      zoomFactor,
      start: { scale: 1.0, x: 0.5, y: 0.5, rotation: 0 },
      end: { scale: zoomFactor, x: 0.5, y: 0.5, rotation: 0 }
    };

    if (mType === 'ZOOM_OUT') {
      motion.start = { scale: zoomFactor, x: 0.5, y: 0.5 };
      motion.end = { scale: 1.0, x: 0.5, y: 0.5 };
    } else if (mType === 'PAN_LEFT') {
      motion.start = { scale: 1.08, x: 0.6, y: 0.5 };
      motion.end = { scale: 1.08, x: 0.4, y: 0.5 };
    } else if (mType === 'PAN_RIGHT') {
      motion.start = { scale: 1.08, x: 0.4, y: 0.5 };
      motion.end = { scale: 1.08, x: 0.6, y: 0.5 };
    } else if (mType === 'WHIP_PAN') {
      motion.start = { scale: 1.20, x: 0.75, y: 0.5 };
      motion.end = { scale: 1.20, x: 0.25, y: 0.5 };
    } else if (mType === 'VERTIGO_DOLLY') {
      motion.start = { scale: 1.30, x: 0.5, y: 0.45 };
      motion.end = { scale: 1.05, x: 0.5, y: 0.55 };
    } else if (mType === 'CRANE_TILT_DOWN') {
      motion.start = { scale: 1.12, x: 0.5, y: 0.35 };
      motion.end = { scale: 1.12, x: 0.5, y: 0.65 };
    } else if (mType === 'DUTCH_ANGLE_ROLL') {
      const rot = styleName === 'PHONK_DRIFT' ? 6 : 3;
      motion.start = { scale: 1.18, x: 0.5, y: 0.5, rotation: -rot };
      motion.end = { scale: 1.18, x: 0.5, y: 0.5, rotation: rot };
    } else if (mType === 'DYNAMIC_SPIRAL') {
      const rot = styleName === 'PHONK_DRIFT' ? 10 : 5;
      motion.start = { scale: 1.05, x: 0.5, y: 0.5, rotation: 0 };
      motion.end = { scale: 1.25, x: 0.5, y: 0.5, rotation: rot };
    }

    // Effect definition
    const effType = currentEffects[i % currentEffects.length];
    const effect: EffectDef = {
      type: effType || 'CINEMATIC_WARMTH',
      intensity: 0.8
    };

    clips.push({
      id: `clip_${i + 1}`,
      position: i,
      photoId: photo.id,
      sourceImage: photo.url,
      filename: photo.filename,
      startTime: +actualStart.toFixed(2),
      duration,
      endTime: +actualEnd.toFixed(2),
      section: currentSection,
      shotType: photo.shotType,
      importanceScore: photo.score,
      transition: trans,
      motion,
      effect,
      crop: {
        aspectRatio,
        cropX: 0,
        cropY: 0,
        cropW: 1920,
        cropH: 1080,
        faceProtected: (photo.faceCount || 0) > 0
      },
      beatAligned: true
    });
  }

  return clips;
}
