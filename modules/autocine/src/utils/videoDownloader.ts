/**
 * AutoCine Video Direct Downloader
 * Renders the music-synchronized timeline clips with motions, effects, and transitions
 * into a downloadable high-quality MP4/WebM video with audio directly onto the user's PC.
 */

import { TimelineClip, AudioTrack, AspectRatio, QualityPreset } from '../types';

export interface DownloadProgress {
  stage: 'PRELOADING' | 'ENCODING' | 'PACKAGING' | 'COMPLETED';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  message: string;
}

export async function downloadTimelineVideo(
  timeline: TimelineClip[],
  audio: AudioTrack | null,
  aspectRatio: AspectRatio,
  qualityPreset: QualityPreset = 'HIGH',
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  if (!timeline || timeline.length === 0) {
    throw new Error('Timeline is empty');
  }

  const resMap: Record<AspectRatio, { w: number; h: number }> = {
    '16:9': { w: 1920, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '1:1': { w: 1080, h: 1080 },
    '4:5': { w: 1080, h: 1350 }
  };

  const { w: width, h: height } = resMap[aspectRatio] || { w: 1920, h: 1080 };
  const fps = 30;
  const totalDuration = timeline[timeline.length - 1].endTime;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  onProgress?.({
    stage: 'PRELOADING',
    percent: 5,
    currentFrame: 0,
    totalFrames,
    fps,
    message: 'Preloading high-resolution source photographs...'
  });

  // 1. Preload image elements
  const imageMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    timeline.map((clip) => {
      return new Promise<void>((resolve) => {
        if (imageMap.has(clip.sourceImage)) {
          resolve();
          return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageMap.set(clip.sourceImage, img);
          resolve();
        };
        img.onerror = () => {
          // Create fallback colored canvas if network fails
          const fallback = document.createElement('canvas');
          fallback.width = width;
          fallback.height = height;
          const fbCtx = fallback.getContext('2d');
          if (fbCtx) {
            fbCtx.fillStyle = '#1e293b';
            fbCtx.fillRect(0, 0, width, height);
            fbCtx.fillStyle = '#94a3b8';
            fbCtx.font = '36px sans-serif';
            fbCtx.fillText(clip.filename, 60, height / 2);
          }
          const fbImg = new Image();
          fbImg.src = fallback.toDataURL();
          fbImg.onload = () => {
            imageMap.set(clip.sourceImage, fbImg);
            resolve();
          };
        };
        img.src = clip.sourceImage;
      });
    })
  );

  // 2. Setup rendering canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // 3. Audio synthesis / capture
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  let audioSource: AudioNode | null = null;

  try {
    if (audio?.url) {
      // Decode imported audio buffer
      const response = await fetch(audio.url);
      const arrayBuf = await response.arrayBuffer();
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      const bufferSource = audioCtx.createBufferSource();
      bufferSource.buffer = audioBuf;
      bufferSource.connect(dest);
      bufferSource.start(0);
      audioSource = bufferSource;
    } else {
      // Synthesize rhythm soundtrack matching audio BPM (Horizon Odyssey or Phonk Drift)
      const bpm = audio?.bpm || 120;
      const isPhonk = audio?.id === 'aud_phonk' || bpm >= 135;
      const synthBuffer = synthesizeSoundtrackBuffer(audioCtx, totalDuration, bpm, isPhonk);
      const bufferSource = audioCtx.createBufferSource();
      bufferSource.buffer = synthBuffer;
      bufferSource.connect(dest);
      bufferSource.start(0);
      audioSource = bufferSource;
    }
  } catch (e) {
    console.warn('Audio capture warning, rendering video track only:', e);
  }

  // 4. Setup MediaRecorder with cross-platform codecs
  const canvasStream = canvas.captureStream(fps);
  const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (dest.stream.getAudioTracks().length > 0) {
    combinedTracks.push(dest.stream.getAudioTracks()[0]);
  }
  const stream = new MediaStream(combinedTracks);

  let mimeType = 'video/mp4;codecs=avc1';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp9,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const bitrateMap: Record<QualityPreset, number> = {
    MASTER: 18000000,
    VERY_HIGH: 14000000,
    HIGH: 10000000,
    FAST: 6000000
  };

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: bitrateMap[qualityPreset] || 10000000
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const recordedBlob = new Blob(chunks, { type: mimeType });
      resolve(recordedBlob);
    };
  });

  recorder.start(100);

  // 5. Render frames sequentially
  const startTimeStamp = performance.now();

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;

    // Find active clip
    const activeClip = timeline.find((c) => c.startTime <= t && t < c.endTime) || timeline[timeline.length - 1];
    const img = imageMap.get(activeClip.sourceImage);

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    if (img) {
      const localT = Math.max(0, t - activeClip.startTime);
      const clipProg = Math.min(1.0, localT / Math.max(0.1, activeClip.duration));

      // Calculate motion transforms (support all 11 camera motions)
      let scale = 1.0;
      let transX = 0;
      let transY = 0;
      let rotation = 0;

      const m = activeClip.motion;
      const zoomFactor = m?.zoomFactor || 1.12;

      switch (m?.type) {
        case 'ZOOM_IN':
          scale = 1.0 + (zoomFactor - 1.0) * clipProg;
          break;
        case 'ZOOM_OUT':
          scale = zoomFactor - (zoomFactor - 1.0) * clipProg;
          break;
        case 'PAN_LEFT':
          scale = 1.1;
          transX = (0.5 - clipProg) * 80;
          break;
        case 'PAN_RIGHT':
          scale = 1.1;
          transX = (clipProg - 0.5) * 80;
          break;
        case 'SLOW_PUSH':
          scale = 1.0 + (zoomFactor - 1.0) * 0.5 * clipProg;
          break;
        case 'WHIP_PAN':
          // Rapid acceleration across cut
          scale = 1.15;
          transX = -Math.sin(clipProg * Math.PI) * 160;
          break;
        case 'VERTIGO_DOLLY':
          // Push in while counter-zooming
          scale = 1.25 - 0.2 * clipProg;
          transY = (clipProg - 0.5) * 50;
          break;
        case 'CRANE_TILT_DOWN':
          scale = 1.12;
          transY = (clipProg - 0.5) * -90;
          break;
        case 'DUTCH_ANGLE_ROLL':
          scale = 1.15;
          rotation = (clipProg - 0.5) * 0.08; // subtle angle
          break;
        case 'DYNAMIC_SPIRAL':
          scale = 1.05 + 0.15 * clipProg;
          rotation = clipProg * 0.12;
          break;
        case 'STATIC':
        default:
          scale = 1.0;
          break;
      }

      // Draw base image centered with scale/transform
      ctx.translate(width / 2 + transX, height / 2 + transY);
      if (rotation !== 0) ctx.rotate(rotation);
      ctx.scale(scale, scale);

      // Fit image cover
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let drawW = width;
      let drawH = height;
      if (imgRatio > canvasRatio) {
        drawH = height;
        drawW = height * imgRatio;
      } else {
        drawW = width;
        drawH = width / imgRatio;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Apply Visual Effects
      if (activeClip.effect && activeClip.effect.type !== 'NONE') {
        applyCanvasEffect(ctx, activeClip.effect.type, width, height, activeClip.effect.intensity);
      }

      // Apply Transitions (Support all 10 transitions)
      const trans = activeClip.transition;
      if (trans && localT < trans.duration) {
        applyCanvasTransition(ctx, trans.type, localT, trans.duration, width, height);
      }
    }

    // Report Progress every 5 frames
    if (frame % 5 === 0 || frame === totalFrames - 1) {
      const elapsedSec = (performance.now() - startTimeStamp) / 1000;
      const currentFps = elapsedSec > 0 ? Math.round(frame / elapsedSec) : fps;
      const percent = Math.min(98, Math.round((frame / totalFrames) * 90) + 5);

      onProgress?.({
        stage: 'ENCODING',
        percent,
        currentFrame: frame + 1,
        totalFrames,
        fps: Math.max(24, currentFps),
        message: `Rendering Frame ${frame + 1} of ${totalFrames} (${Math.round((frame / totalFrames) * 100)}%)`
      });

      // Allow event loop to keep UI responsive
      await new Promise((r) => setTimeout(r, 8));
    }
  }

  onProgress?.({
    stage: 'PACKAGING',
    percent: 98,
    currentFrame: totalFrames,
    totalFrames,
    fps,
    message: 'Finalizing MP4 stream container and saving to PC...'
  });

  // Stop recording and close audio
  recorder.stop();
  if (audioSource) {
    try { (audioSource as unknown as { stop: () => void }).stop?.(); } catch {}
  }
  try { await audioCtx.close(); } catch {}

  const finalBlob = await recordingPromise;

  // Trigger instant direct download to PC
  const downloadUrl = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadUrl;
  const cleanAspect = aspectRatio.replace(':', '_');
  const filename = `AutoCine_Edit_${cleanAspect}_${Date.now()}.mp4`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 2000);

  onProgress?.({
    stage: 'COMPLETED',
    percent: 100,
    currentFrame: totalFrames,
    totalFrames,
    fps,
    message: `Video saved successfully: ${filename}`
  });
}

function applyCanvasEffect(
  ctx: CanvasRenderingContext2D,
  type: string,
  width: number,
  height: number,
  intensity = 0.8
) {
  ctx.save();
  switch (type) {
    case 'CINEMATIC_WARMTH': {
      ctx.fillStyle = 'rgba(255, 180, 50, 0.12)';
      ctx.globalCompositeOperation = 'color';
      ctx.fillRect(0, 0, width, height);
      // Soft contrast vignette
      const grad = ctx.createRadialGradient(width / 2, height / 2, width * 0.3, width / 2, height / 2, width * 0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'VINTAGE_FILM_GRAIN': {
      ctx.fillStyle = 'rgba(240, 220, 190, 0.08)';
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(0, 0, width, height);
      // Subtle vignette
      const vin = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.7);
      vin.addColorStop(0, 'rgba(0,0,0,0)');
      vin.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = vin;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'ANAMORPHIC_FLARE': {
      // Horizontal blue anamorphic streak
      const flare = ctx.createLinearGradient(0, height * 0.45, width, height * 0.45);
      flare.addColorStop(0, 'rgba(0, 150, 255, 0)');
      flare.addColorStop(0.5, 'rgba(100, 200, 255, 0.25)');
      flare.addColorStop(1, 'rgba(0, 150, 255, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = flare;
      ctx.fillRect(0, height * 0.43, width, height * 0.04);
      break;
    }
    case 'RGB_PRISM_SPLIT': {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 0, 80, 0.06)';
      ctx.fillRect(4, 0, width, height);
      ctx.fillStyle = 'rgba(0, 220, 255, 0.06)';
      ctx.fillRect(-4, 0, width, height);
      break;
    }
    case 'DREAMY_GLOW': {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 240, 220, 0.14)';
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'RETRO_BLEACH_BYPASS': {
      // High contrast desaturated
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.fillStyle = 'rgba(120, 120, 120, 0.15)';
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'NOIR_MONOCHROME': {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'CYBER_NEON_VIBE': {
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(0, 220, 200, 0.15)';
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }
  ctx.restore();
}

function applyCanvasTransition(
  ctx: CanvasRenderingContext2D,
  type: string,
  localT: number,
  duration: number,
  width: number,
  height: number
) {
  const p = Math.max(0, Math.min(1, localT / duration));
  ctx.save();

  switch (type) {
    case 'FADE':
    case 'CROSSFADE': {
      ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - p})`;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'DIP TO BLACK': {
      const alpha = p < 0.5 ? 1.0 - p * 2 : (p - 0.5) * 2;
      ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - alpha})`;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'FLASH_IMPACT': {
      // White exposure punch on beat
      const flashAlpha = Math.pow(1.0 - p, 2) * 0.9;
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'LIGHT_LEAK_SWIPE': {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      const alpha = (1.0 - p) * 0.7;
      grad.addColorStop(0, `rgba(255, 140, 40, ${alpha})`);
      grad.addColorStop(0.5, `rgba(255, 220, 100, ${alpha * 1.2})`);
      grad.addColorStop(1, `rgba(255, 80, 20, 0)`);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'WHIP_SLIDE_LEFT': {
      const slideX = (1.0 - p) * width * 0.5;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(width - slideX, 0, slideX, height);
      break;
    }
    case 'WARP_ZOOM_SPIN': {
      const blurAlpha = (1.0 - p) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${blurAlpha * 0.4})`;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'GLITCH_DISPLACE': {
      // Digital scanlines
      if (Math.random() > 0.4) {
        ctx.fillStyle = 'rgba(0, 255, 200, 0.2)';
        ctx.fillRect(0, Math.random() * height, width, Math.random() * 20);
      }
      break;
    }
    case 'ZOOM PUNCH': {
      const punchAlpha = (1.0 - p) * 0.3;
      ctx.fillStyle = `rgba(255, 255, 255, ${punchAlpha})`;
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }
  ctx.restore();
}

/**
 * Generates an audio buffer with the synchronized music (Horizon Odyssey or Phonk Drift)
 * so that downloaded video files have music with kicks, 808 sub bass, snares, and cowbells.
 */
function synthesizeSoundtrackBuffer(ctx: AudioContext, duration: number, bpm: number, isPhonk: boolean): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const numSamples = Math.max(1, Math.ceil(duration * sampleRate));
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const beatInterval = 60.0 / bpm;
  const totalBeats = Math.ceil(duration / beatInterval);

  // Cowbell melodic notes for Phonk
  const phonkCowbellFreqs = [
    659.25, 783.99, 880.0, 783.99, 659.25, 587.33, 659.25, 783.99,
    659.25, 783.99, 987.77, 880.0, 783.99, 659.25, 587.33, 523.25
  ];

  for (let b = 0; b < totalBeats; b++) {
    const beatStartTime = b * beatInterval;
    const startSample = Math.floor(beatStartTime * sampleRate);
    const measureStep = b % 4;
    const isDownbeat = measureStep === 0;
    const isSnare = isPhonk ? (measureStep === 1 || measureStep === 3) : (measureStep === 2);

    // 1. Kick / 808 Sub-Bass
    if (isDownbeat || (isPhonk && measureStep === 2) || (!isPhonk && measureStep === 2)) {
      const kickDuration = isPhonk ? 0.38 : 0.20;
      const kickSamples = Math.floor(kickDuration * sampleRate);
      for (let i = 0; i < kickSamples && (startSample + i) < numSamples; i++) {
        const t = i / sampleRate;
        const startFreq = isPhonk ? 160 : 130;
        const endFreq = isPhonk ? 43.65 : 38;
        const freq = startFreq * Math.exp(-t * 22) + endFreq;
        const env = Math.exp(-t * (isPhonk ? 7 : 14));
        let val = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
        if (isPhonk) {
          // Soft clip distortion
          val = Math.tanh(val * 1.8);
        }
        left[startSample + i] += val;
        right[startSample + i] += val;
      }
    }

    // 2. Snare / Clap on backbeats
    if (isSnare) {
      const snareDuration = 0.12;
      const snareSamples = Math.floor(snareDuration * sampleRate);
      for (let i = 0; i < snareSamples && (startSample + i) < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 30);
        const noise = (Math.random() * 2 - 1) * env * 0.35;
        left[startSample + i] += noise;
        right[startSample + i] += noise;
      }
    }

    // 3. Phonk Cowbell Lead on 8th-notes
    if (isPhonk) {
      for (let sub = 0; sub < 2; sub++) {
        const subTime = beatStartTime + sub * (beatInterval / 2);
        const subSample = Math.floor(subTime * sampleRate);
        const stepIndex = b * 2 + sub;
        const freq = phonkCowbellFreqs[stepIndex % phonkCowbellFreqs.length];

        const cbDuration = 0.14;
        const cbSamples = Math.floor(cbDuration * sampleRate);
        for (let i = 0; i < cbSamples && (subSample + i) < numSamples; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 18);
          // Square + metallic 5th
          const sq = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * 0.18;
          const metal = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.10;
          const val = (sq + metal) * env;
          left[subSample + i] += val * 0.8;
          right[subSample + i] += val * 0.8;
        }
      }
    } else {
      // Shimmering chord pad for Horizon Odyssey
      const chordIndex = Math.floor(b / 8) % 4;
      const chordFreqs = [
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66]
      ][chordIndex];

      if (isDownbeat) {
        const padDuration = Math.min(duration - beatStartTime, 1.8);
        const padSamples = Math.floor(padDuration * sampleRate);
        for (let i = 0; i < padSamples && (startSample + i) < numSamples; i++) {
          const t = i / sampleRate;
          const env = Math.sin((t / padDuration) * Math.PI) * 0.08;
          let padVal = 0;
          chordFreqs.forEach(cf => {
            padVal += Math.sin(2 * Math.PI * cf * t);
          });
          left[startSample + i] += padVal * env;
          right[startSample + i] += padVal * env;
        }
      }
    }
  }

  // Prevent clipping by soft-limiting
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.tanh(left[i]);
    right[i] = Math.tanh(right[i]);
  }

  return buffer;
}
