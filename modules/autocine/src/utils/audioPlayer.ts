/**
 * AutoCine Synchronized Audio Engine.
 * Supports both real imported audio files (via HTML5 Audio / Blob URL)
 * and a high-fidelity Web Audio synthesized soundtrack for preloaded projects.
 */

import { AudioTrack } from '../types';

class SynchronizedAudioEngine {
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isSynthesizing = false;
  private isPlaying = false;
  private isMuted = false;
  private currentTrack: AudioTrack | null = null;
  private synthInterval: number | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Initialized lazily on first user interaction
  }

  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
      this.masterGain.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  public setTrack(track: AudioTrack | null) {
    this.stop();
    this.currentTrack = track;

    if (track?.url) {
      if (!this.audioElement) {
        this.audioElement = new Audio();
        this.audioElement.preload = 'auto';
      }
      this.audioElement.src = track.url;
      this.audioElement.muted = this.isMuted;
    } else {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
      }
    }
  }

  public play(fromTime: number = 0, isMuted: boolean = false) {
    this.isMuted = isMuted;
    this.isPlaying = true;

    // Handle imported audio with URL
    if (this.currentTrack?.url && this.audioElement) {
      this.audioElement.muted = isMuted;
      if (Math.abs(this.audioElement.currentTime - fromTime) > 0.3) {
        this.audioElement.currentTime = fromTime;
      }
      this.audioElement.play().catch(() => {
        // Fallback or autoplay policy catch
      });
      return;
    }

    // Handle synthesized cinematic audio for preloaded track
    const ctx = this.initAudioContext();
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(isMuted ? 0 : 0.45, ctx.currentTime);
    }

    this.startSynthesizer(fromTime);
  }

  public pause() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.stopSynthesizer();
  }

  public stop() {
    this.pause();
  }

  public seek(toTime: number) {
    if (this.currentTrack?.url && this.audioElement) {
      this.audioElement.currentTime = toTime;
    }
    if (this.isPlaying && !this.currentTrack?.url) {
      this.stopSynthesizer();
      this.startSynthesizer(toTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.audioElement) {
      this.audioElement.muted = muted;
    }
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.45, this.audioContext.currentTime);
    }
  }

  // --- Real-Time Synthesizer for Horizon Odyssey Soundtrack ---
  private startSynthesizer(startOffsetSeconds: number) {
    this.stopSynthesizer();
    if (!this.audioContext || !this.masterGain) return;

    this.isSynthesizing = true;
    const bpm = this.currentTrack?.bpm || 120.0;
    const beatInterval = 60.0 / bpm; // 0.5s at 120 BPM
    const ctx = this.audioContext;

    let currentPlayTime = startOffsetSeconds;
    let nextNoteTime = ctx.currentTime;

    // Play an immediate sound so user hears audio without lag
    this.playBeatHit(ctx.currentTime, currentPlayTime, bpm);

    const scheduleLoop = () => {
      if (!this.isSynthesizing || !this.isPlaying) return;

      while (nextNoteTime < ctx.currentTime + 0.25) {
        this.playBeatHit(nextNoteTime, currentPlayTime, bpm);
        currentPlayTime += beatInterval;
        nextNoteTime += beatInterval;
      }

      this.synthInterval = window.setTimeout(scheduleLoop, 40);
    };

    scheduleLoop();
  }

  private stopSynthesizer() {
    this.isSynthesizing = false;
    if (this.synthInterval !== null) {
      clearTimeout(this.synthInterval);
      this.synthInterval = null;
    }
  }

  /**
   * Generates a warm cinematic beat:
   * - Punchy acoustic/electronic kick on beats
   * - Crisp snare/rim on backbeats
   * - Shimmering acoustic guitar / synth pad chords
   * - Deep melodic bassline
   */
  private playBeatHit(time: number, timelineSeconds: number, bpm: number) {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;

    const isPhonk = this.currentTrack?.id === 'aud_phonk' || bpm >= 135;

    if (isPhonk) {
      this.playPhonkBeatHit(time, timelineSeconds, bpm);
      return;
    }

    const beatIndex = Math.floor((timelineSeconds * bpm) / 60.0);
    const measureStep = beatIndex % 4; // 0, 1, 2, 3 in 4/4
    const isDownbeat = measureStep === 0;
    const isSnare = measureStep === 2;

    // 1. Kick Drum (on beats 0 and 2, or every beat in climax)
    const isClimax = timelineSeconds >= 14 && timelineSeconds < 26;
    if (isDownbeat || isClimax || measureStep === 2) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();

      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(isDownbeat ? 140 : 110, time);
      kickOsc.frequency.exponentialRampToValueAtTime(36, time + 0.12);

      kickGain.gain.setValueAtTime(isDownbeat ? 0.8 : 0.5, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);

      kickOsc.start(time);
      kickOsc.stop(time + 0.18);
    }

    // 2. Snare / Clack on beats 2 & 4
    if (isSnare || (isClimax && (measureStep === 1 || measureStep === 3))) {
      // Noise burst for snare
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const snareFilter = ctx.createBiquadFilter();
      snareFilter.type = 'highpass';
      snareFilter.frequency.value = 1000;

      const snareGain = ctx.createGain();
      snareGain.gain.setValueAtTime(0.3, time);
      snareGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

      whiteNoise.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(this.masterGain);

      whiteNoise.start(time);
      whiteNoise.stop(time + 0.08);
    }

    // 3. Hi-Hat click on 8th notes
    const hatOsc = ctx.createOscillator();
    const hatGain = ctx.createGain();
    hatOsc.type = 'square';
    hatOsc.frequency.setValueAtTime(8000, time);
    hatGain.gain.setValueAtTime(0.08, time);
    hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    hatOsc.connect(hatGain);
    hatGain.connect(this.masterGain);
    hatOsc.start(time);
    hatOsc.stop(time + 0.03);

    // 4. Melodic Bass & Pad Chord (A Minor -> F -> C -> G progression)
    // Chord changes every 2 bars (8 beats = 4 seconds)
    const chordIndex = Math.floor(beatIndex / 8) % 4;
    const bassNotes = [55.0, 43.65, 65.41, 48.99]; // A1, F1, C2, G1
    const padNotes = [
      [220.0, 261.63, 329.63], // Am (A3, C4, E4)
      [174.61, 220.0, 261.63], // F (F3, A3, C4)
      [261.63, 329.63, 392.0],  // C (C4, E4, G4)
      [196.0, 246.94, 293.66]  // G (G3, B3, D4)
    ];

    if (isDownbeat) {
      // Bass Note
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassNotes[chordIndex], time);
      bassGain.gain.setValueAtTime(0.4, time);
      bassGain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);
      bassOsc.connect(bassGain);
      bassGain.connect(this.masterGain);
      bassOsc.start(time);
      bassOsc.stop(time + 0.85);

      // Pad Chords
      padNotes[chordIndex].forEach((freq) => {
        const padOsc = ctx.createOscillator();
        const padGain = ctx.createGain();
        padOsc.type = 'sine';
        padOsc.frequency.setValueAtTime(freq, time);
        padGain.gain.setValueAtTime(0.06, time);
        padGain.gain.linearRampToValueAtTime(0.12, time + 0.2);
        padGain.gain.exponentialRampToValueAtTime(0.001, time + 1.8);
        padOsc.connect(padGain);
        padGain.connect(this.masterGain);
        padOsc.start(time);
        padOsc.stop(time + 1.9);
      });
    }
  }

  /**
   * Generates a high-octane Phonk beat (142 BPM):
   * - Punchy 808 Sub-Bass glide with heavy saturation
   * - Memphis/Brazilian Phonk cowbell lead riff (E5, G5, A5, B5)
   * - Rapid trap snare / claps
   * - Rolling hi-hats with syncopated triplets
   * - Percussive vocal chop ("ta-ta-ge") accents
   */
  private playPhonkBeatHit(time: number, timelineSeconds: number, bpm: number) {
    if (!this.audioContext || !this.masterGain) return;
    const ctx = this.audioContext;

    const beatInterval = 60.0 / bpm; // ~0.422s
    const step = Math.floor(timelineSeconds / (beatInterval / 2)); // 8th note steps
    const beatIndex = Math.floor(timelineSeconds / beatInterval);
    const measureStep = beatIndex % 4; // 0, 1, 2, 3
    const isDownbeat = measureStep === 0;
    const isSnare = measureStep === 1 || measureStep === 3; // Fast trap backbeat

    // 1. Heavy 808 Sub Bass & Distorted Kick
    if (isDownbeat || measureStep === 2 || (timelineSeconds >= 8.5 && measureStep === 0)) {
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const subDrive = ctx.createWaveShaper();

      // Simple saturation curve
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = Math.tanh(x * 2.2);
      }
      subDrive.curve = curve;

      subOsc.type = 'sine';
      // 808 Pitch slide
      const baseFreq = (measureStep === 0) ? 43.65 : 41.2; // F1 / E1
      subOsc.frequency.setValueAtTime(160, time);
      subOsc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.08);

      subGain.gain.setValueAtTime(0.85, time);
      subGain.gain.exponentialRampToValueAtTime(0.01, time + 0.38);

      subOsc.connect(subDrive);
      subDrive.connect(subGain);
      subGain.connect(this.masterGain);

      subOsc.start(time);
      subOsc.stop(time + 0.40);
    }

    // 2. High-Frequency Phonk Cowbell Lead Melody
    // 16-step iconic Brazilian/Memphis phonk motif
    const cowbellMelody = [
      659.25, 783.99, 880.0, 783.99, 659.25, 587.33, 659.25, 783.99,
      659.25, 783.99, 987.77, 880.0, 783.99, 659.25, 587.33, 523.25
    ];
    const cowbellFreq = cowbellMelody[step % cowbellMelody.length];

    if (cowbellFreq > 0) {
      const cowOsc1 = ctx.createOscillator();
      const cowOsc2 = ctx.createOscillator();
      const cowFilter = ctx.createBiquadFilter();
      const cowGain = ctx.createGain();

      cowOsc1.type = 'square';
      cowOsc1.frequency.setValueAtTime(cowbellFreq, time);

      cowOsc2.type = 'sawtooth';
      cowOsc2.frequency.setValueAtTime(cowbellFreq * 1.5, time); // 5th harmonic for metallic clank

      cowFilter.type = 'bandpass';
      cowFilter.frequency.value = 1400;
      cowFilter.Q.value = 4.0;

      cowGain.gain.setValueAtTime(0.35, time);
      cowGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

      cowOsc1.connect(cowFilter);
      cowOsc2.connect(cowFilter);
      cowFilter.connect(cowGain);
      cowGain.connect(this.masterGain);

      cowOsc1.start(time);
      cowOsc2.start(time);
      cowOsc1.stop(time + 0.16);
      cowOsc2.stop(time + 0.16);
    }

    // 3. Crisp Snare / Trap Clap
    if (isSnare) {
      const bufferSize = ctx.sampleRate * 0.09;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const snareFilt = ctx.createBiquadFilter();
      snareFilt.type = 'highpass';
      snareFilt.frequency.value = 1500;

      const snareEnv = ctx.createGain();
      snareEnv.gain.setValueAtTime(0.45, time);
      snareEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

      noise.connect(snareFilt);
      snareFilt.connect(snareEnv);
      snareEnv.connect(this.masterGain);

      noise.start(time);
      noise.stop(time + 0.12);
    }

    // 4. Rolling Trap Hi-Hats
    const hatOsc = ctx.createOscillator();
    const hatGain = ctx.createGain();
    hatOsc.type = 'square';
    hatOsc.frequency.setValueAtTime(10000, time);
    hatGain.gain.setValueAtTime(0.12, time);
    hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    hatOsc.connect(hatGain);
    hatGain.connect(this.masterGain);
    hatOsc.start(time);
    hatOsc.stop(time + 0.025);

    // 5. Vocal chop simulation ("ta-ta-ge") resonant formant pulse
    if (step % 4 === 1 || step % 4 === 3) {
      const vocOsc = ctx.createOscillator();
      const vocFilter = ctx.createBiquadFilter();
      const vocGain = ctx.createGain();

      vocOsc.type = 'sawtooth';
      vocOsc.frequency.setValueAtTime(196, time); // G3 vocal chop tone

      vocFilter.type = 'bandpass';
      vocFilter.frequency.setValueAtTime(850, time);
      vocFilter.Q.value = 6.0;

      vocGain.gain.setValueAtTime(0.15, time);
      vocGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      vocOsc.connect(vocFilter);
      vocFilter.connect(vocGain);
      vocGain.connect(this.masterGain);

      vocOsc.start(time);
      vocOsc.stop(time + 0.08);
    }
  }
}

export const audioPlayer = new SynchronizedAudioEngine();
