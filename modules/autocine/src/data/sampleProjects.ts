import { PhotoAsset, AudioTrack, ProjectState } from '../types';

export const SAMPLE_PHOTOS: PhotoAsset[] = [
  {
    id: 'p01',
    filename: 'DSC_0821_Summit_Peak.jpg',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    width: 4240,
    height: 2832,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 94.2,
    breakdown: {
      sharpness: 95,
      exposure: 92,
      composition: 96,
      color: 94,
      faces: 0,
      resolution: 98,
      uniqueness: 90
    },
    faceCount: 0,
    shotType: 'landscape',
    dhash: '003c7e7e7e7e3c00'
  },
  {
    id: 'p02',
    filename: 'DSC_0822_Summit_Peak_Alt.jpg',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
    width: 4240,
    height: 2832,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 87.5,
    breakdown: {
      sharpness: 86,
      exposure: 88,
      composition: 90,
      color: 91,
      faces: 0,
      resolution: 98,
      uniqueness: 72
    },
    faceCount: 0,
    shotType: 'landscape',
    isDuplicateOf: 'p01',
    dhash: '003c7e7e7e7e3c02'
  },
  {
    id: 'p03',
    filename: 'DSC_0845_Alpinist_Portrait.jpg',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80',
    width: 3200,
    height: 4800,
    aspectRatio: 0.67,
    orientation: 'portrait',
    score: 91.8,
    breakdown: {
      sharpness: 93,
      exposure: 90,
      composition: 94,
      color: 89,
      faces: 95,
      resolution: 95,
      uniqueness: 92
    },
    faceCount: 1,
    faceBoxes: [{ x: 0.35, y: 0.22, width: 0.3, height: 0.3 }],
    shotType: 'portrait',
    dhash: '183c3c7e7e3c3c18'
  },
  {
    id: 'p04',
    filename: 'DSC_0890_Glacier_Creek.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80',
    width: 4000,
    height: 2667,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 89.4,
    breakdown: {
      sharpness: 88,
      exposure: 91,
      composition: 92,
      color: 93,
      faces: 0,
      resolution: 96,
      uniqueness: 85
    },
    faceCount: 0,
    shotType: 'landscape',
    dhash: '0f1f3f7e7e3f1f0f'
  },
  {
    id: 'p05',
    filename: 'DSC_0912_Campfire_Gathering.jpg',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80',
    width: 3840,
    height: 2560,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 93.0,
    breakdown: {
      sharpness: 90,
      exposure: 92,
      composition: 95,
      color: 94,
      faces: 96,
      resolution: 94,
      uniqueness: 91
    },
    faceCount: 3,
    faceBoxes: [
      { x: 0.25, y: 0.35, width: 0.15, height: 0.15 },
      { x: 0.48, y: 0.32, width: 0.16, height: 0.16 },
      { x: 0.70, y: 0.36, width: 0.15, height: 0.15 }
    ],
    shotType: 'group',
    dhash: '3c3c7e7eff7e3c3c'
  },
  {
    id: 'p06',
    filename: 'DSC_0955_Trail_Gear_Detail.jpg',
    url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&q=80',
    width: 3600,
    height: 2400,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 84.1,
    breakdown: {
      sharpness: 89,
      exposure: 82,
      composition: 86,
      color: 85,
      faces: 0,
      resolution: 92,
      uniqueness: 83
    },
    faceCount: 0,
    shotType: 'detail',
    dhash: '7e3c180000183c7e'
  },
  {
    id: 'p07',
    filename: 'DSC_0990_Golden_Hour_Ridge.jpg',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
    width: 4000,
    height: 2667,
    aspectRatio: 1.5,
    orientation: 'landscape',
    score: 96.8,
    breakdown: {
      sharpness: 97,
      exposure: 95,
      composition: 98,
      color: 99,
      faces: 0,
      resolution: 96,
      uniqueness: 95
    },
    faceCount: 0,
    shotType: 'hero_image',
    dhash: 'ff7e3c18183c7eff'
  },
  {
    id: 'p08',
    filename: 'DSC_1002_Sunset_Silhouettes.jpg',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80',
    width: 3000,
    height: 4000,
    aspectRatio: 0.75,
    orientation: 'portrait',
    score: 88.0,
    breakdown: {
      sharpness: 87,
      exposure: 86,
      composition: 92,
      color: 90,
      faces: 89,
      resolution: 94,
      uniqueness: 86
    },
    faceCount: 1,
    shotType: 'portrait',
    dhash: '3c18007e7e00183c'
  }
];

export const SAMPLE_AUDIO: AudioTrack = {
  id: 'aud_01',
  title: 'Horizon Odyssey',
  artist: 'CineAcoustic Ensemble',
  filename: 'horizon_odyssey_120bpm.mp3',
  duration: 32.0,
  bpm: 120.0,
  beats: Array.from({ length: 64 }, (_, i) => +(i * 0.5).toFixed(2)),
  downbeats: Array.from({ length: 16 }, (_, i) => +(i * 2.0).toFixed(2)),
  sections: [
    { section: 'INTRO', start: 0.0, end: 6.0, energy: 0.25 },
    { section: 'BUILD', start: 6.0, end: 14.0, energy: 0.58 },
    { section: 'CLIMAX', start: 14.0, end: 26.0, energy: 0.92 },
    { section: 'OUTRO', start: 26.0, end: 32.0, energy: 0.35 }
  ],
  energyCurve: [
    0.15, 0.20, 0.25, 0.30, 0.35, 0.40,
    0.48, 0.55, 0.60, 0.68, 0.72, 0.75, 0.80, 0.82,
    0.92, 0.95, 0.98, 0.94, 0.96, 0.91, 0.89, 0.88, 0.85, 0.82, 0.80, 0.75,
    0.60, 0.50, 0.40, 0.30, 0.20, 0.10
  ]
};

export const PHONK_AUDIO: AudioTrack = {
  id: 'aud_phonk',
  title: 'Ta-Ta-Ge Drift Phonk (High Beat)',
  artist: 'AutoCine Phonk Labs',
  filename: 'ta_ta_ge_phonk_142bpm.mp3',
  duration: 32.0,
  bpm: 142.0,
  // 142 BPM = ~0.4225 seconds per beat
  beats: Array.from({ length: 76 }, (_, i) => +(i * (60 / 142)).toFixed(2)),
  downbeats: Array.from({ length: 38 }, (_, i) => +(i * (120 / 142)).toFixed(2)),
  sections: [
    { section: 'INTRO', start: 0.0, end: 4.2, energy: 0.45 },
    { section: 'BUILD', start: 4.2, end: 8.5, energy: 0.75 },
    { section: 'CLIMAX', start: 8.5, end: 27.0, energy: 0.99 },
    { section: 'OUTRO', start: 27.0, end: 32.0, energy: 0.40 }
  ],
  energyCurve: [
    0.35, 0.45, 0.55, 0.65, 0.78, 0.85, 0.92, 0.98,
    0.99, 1.00, 0.99, 1.00, 0.98, 0.99, 1.00, 0.98,
    0.99, 1.00, 0.98, 0.99, 0.97, 0.98, 0.99, 0.96,
    0.92, 0.88, 0.70, 0.55, 0.45, 0.35, 0.25, 0.15
  ]
};
