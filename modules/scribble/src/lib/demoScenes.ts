import type { AudioInput, ImageInput, PageMetadata, SubtitleCue } from './imageSketch';

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataByteCount = numSamples * blockAlign;
  const headerByteCount = 44;
  const totalByteCount = headerByteCount + dataByteCount;

  const arrayBuffer = new ArrayBuffer(totalByteCount);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, totalByteCount - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteCount, true);

  // Write samples (clamped 16-bit PCM)
  const channelData = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function createSynthesizedAudio(durationSeconds: number = 18): AudioInput {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
    sampleRate,
  });
  const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Generates melodic educational ambient chimes with camera pan sound effects at scene boundaries
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    // Ambient warm drone
    s += Math.sin(2 * Math.PI * 220 * t) * Math.exp(-(t % 6) * 0.5) * 0.035;

    // Scene 1 chime at t=0
    if (t < 2.5) {
      s += Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 1.5) * 0.12;
      s += Math.sin(2 * Math.PI * 554.37 * t) * Math.exp(-t * 1.2) * 0.08;
    }
    // Pan transition 1 at t=6 (Slide from Page 1 to Page 2)
    if (t >= 6 && t < 8.5) {
      const panT = t - 6;
      s += Math.sin(2 * Math.PI * 587.33 * panT) * Math.exp(-panT * 1.6) * 0.14;
      s += Math.sin(2 * Math.PI * 880 * panT) * Math.exp(-panT * 1.8) * 0.09;
      // Subtle paper sliding sweep
      s += (Math.random() * 2 - 1) * Math.exp(-panT * 3.5) * 0.025;
    }
    // Pan transition 2 at t=12 (Slide from Page 2 to Page 3)
    if (t >= 12 && t < 14.5) {
      const panT = t - 12;
      s += Math.sin(2 * Math.PI * 659.25 * panT) * Math.exp(-panT * 1.6) * 0.14;
      s += Math.sin(2 * Math.PI * 987.77 * panT) * Math.exp(-panT * 1.8) * 0.09;
      // Subtle paper sliding sweep
      s += (Math.random() * 2 - 1) * Math.exp(-panT * 3.5) * 0.025;
    }
    // Concluding chime at t=15
    if (t >= 15 && t < 17.5) {
      const endT = t - 15;
      s += Math.sin(2 * Math.PI * 523.25 * endT) * Math.exp(-endT * 1.4) * 0.1;
      s += Math.sin(2 * Math.PI * 659.25 * endT) * Math.exp(-endT * 1.3) * 0.08;
    }
    data[i] = s;
  }

  // Waveform visualization peaks
  const peaks: number[] = [];
  const chunkSize = Math.max(1, Math.floor(numSamples / 100));
  for (let c = 0; c < 100; c++) {
    let max = 0;
    const start = c * chunkSize;
    for (let k = 0; k < chunkSize && start + k < numSamples; k++) {
      const val = Math.abs(data[start + k] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, max * 4.5));
  }

  const wavBlob = audioBufferToWav(buffer);
  const file = new File([wavBlob], 'photosynthesis_narration.wav', { type: 'audio/wav' });
  const url = URL.createObjectURL(file);
  return { file, url, buffer, duration: durationSeconds, peaks };
}

async function renderSvgToImageInput(svgMarkup: string, filename: string): Promise<ImageInput> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fcfbf5';
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.drawImage(img, 0, 0, 1920, 1080);

    const pixels = ctx.getImageData(0, 0, 1920, 1080);
    const pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([pngBlob || blob], filename, { type: 'image/png' });
    return {
      file,
      url: URL.createObjectURL(file),
      pixels,
      originalWidth: 1920,
      originalHeight: 1080,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface MultiSceneDemoResult {
  images: ImageInput[];
  audio: AudioInput;
  pageMeta: PageMetadata[];
  cues: SubtitleCue[];
}

/**
 * Creates a 3-page educational whiteboard storyboard demonstrating the exact
 * sequential sketch-then-pan behavior (matching the Photosynthesis video reference):
 * - Page 1: Plants capture sunlight into chemical energy
 * - Page 2: Chlorophyll & inputs (H2O + CO2 -> Glucose + O2)
 * - Page 3: Fuels plant growth and releases oxygen
 */
export async function createMultiSceneDemo(): Promise<MultiSceneDemoResult> {
  // Page 1 SVG: Potted Plant + Sunlight Bolt + Botanical Leaf
  const scene1Svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#fcfbf5"/>
    <!-- Left: Potted plant -->
    <g transform="translate(180, 240)">
      <!-- Flower pot -->
      <polygon points="100,380 260,380 240,540 120,540" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <rect x="85" y="350" width="190" height="34" rx="6" fill="none" stroke="#2d3329" stroke-width="7"/>
      <!-- Main stem -->
      <path d="M180,350 Q170,220 180,120" fill="none" stroke="#2d3329" stroke-width="8" stroke-linecap="round"/>
      <!-- Leaves -->
      <path d="M175,280 Q100,260 90,200 Q140,200 176,260" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <path d="M177,220 Q240,190 270,140 Q220,150 178,205" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <path d="M180,150 Q120,110 110,60 Q160,70 180,135" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <path d="M180,120 Q230,80 240,20 Q195,40 180,110" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <text x="180" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Green Flora</text>
    </g>

    <!-- Center: Sun & Energy Bolt -->
    <g transform="translate(760, 220)">
      <!-- Sun circle & rays -->
      <circle cx="200" cy="140" r="64" fill="none" stroke="#2d3329" stroke-width="7"/>
      <line x1="200" y1="40" x2="200" y2="10" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="200" y1="240" x2="200" y2="270" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="100" y1="140" x2="70" y2="140" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="300" y1="140" x2="330" y2="140" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="130" y1="70" x2="110" y2="50" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="270" y1="70" x2="290" y2="50" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="130" y1="210" x2="110" y2="230" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="270" y1="210" x2="290" y2="230" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <!-- Energy Lightning Bolt -->
      <polygon points="210,290 170,390 220,390 180,510 240,370 195,370" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <text x="200" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Solar Energy</text>
    </g>

    <!-- Right: Detailed botanical leaf with veins -->
    <g transform="translate(1320, 220)">
      <path d="M220,520 Q120,340 140,160 Q220,80 300,160 Q320,340 220,520 Z" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <line x1="220" y1="520" x2="220" y2="110" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <!-- Lateral veins -->
      <path d="M220,440 Q180,410 160,390 M220,440 Q260,410 280,390" fill="none" stroke="#2d3329" stroke-width="5"/>
      <path d="M220,360 Q170,320 150,290 M220,360 Q270,320 290,290" fill="none" stroke="#2d3329" stroke-width="5"/>
      <path d="M220,270 Q180,240 160,210 M220,270 Q260,240 280,210" fill="none" stroke="#2d3329" stroke-width="5"/>
      <path d="M220,180 Q190,160 180,140 M220,180 Q250,160 260,140" fill="none" stroke="#2d3329" stroke-width="5"/>
      <text x="220" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Chloroplast Host</text>
    </g>
  </svg>
  `;

  // Page 2 SVG: H2O / CO2 Inputs + Chloroplast Thylakoids + Glucose / O2 Output
  const scene2Svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#fcfbf5"/>
    <!-- Left: Water Droplet & CO2 Molecule -->
    <g transform="translate(180, 240)">
      <!-- Water Droplet -->
      <path d="M140,240 C140,160 200,90 200,90 C200,90 260,160 260,240 C260,280 230,310 200,310 C170,310 140,280 140,240 Z" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <text x="200" y="245" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="34" fill="#2d3329">H₂O</text>
      <!-- CO2 gas circle -->
      <circle cx="200" cy="430" r="64" fill="none" stroke="#2d3329" stroke-width="6"/>
      <text x="200" y="442" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="32" fill="#2d3329">CO₂</text>
      <!-- Reaction Arrow -->
      <path d="M290,320 L350,320" stroke="#2d3329" stroke-width="7" stroke-linecap="round"/>
      <polygon points="350,310 375,320 350,330" fill="#2d3329"/>
      <text x="200" y="580" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Raw Inputs</text>
    </g>

    <!-- Center: Chloroplast Organelle & Thylakoid Stacks -->
    <g transform="translate(740, 220)">
      <!-- Outer organelle membrane -->
      <ellipse cx="240" cy="300" rx="200" ry="140" fill="none" stroke="#2d3329" stroke-width="8"/>
      <ellipse cx="240" cy="300" rx="180" ry="122" fill="none" stroke="#2d3329" stroke-width="4" stroke-dasharray="8 6"/>
      <!-- Thylakoid Granum 1 -->
      <ellipse cx="160" cy="270" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="160" cy="294" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="160" cy="318" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <!-- Thylakoid Granum 2 -->
      <ellipse cx="240" cy="256" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="240" cy="280" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="240" cy="304" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="240" cy="328" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <!-- Thylakoid Granum 3 -->
      <ellipse cx="320" cy="270" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="320" cy="294" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <ellipse cx="320" cy="318" rx="36" ry="12" fill="none" stroke="#2d3329" stroke-width="5"/>
      <!-- Interconnecting lamellae -->
      <line x1="196" y1="294" x2="204" y2="280" stroke="#2d3329" stroke-width="4"/>
      <line x1="276" y1="280" x2="284" y2="294" stroke="#2d3329" stroke-width="4"/>
      <text x="240" y="580" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Chloroplast Thylakoids</text>
    </g>

    <!-- Right: Glucose Molecule Hexagon & O2 Bubble -->
    <g transform="translate(1320, 220)">
      <!-- Chemical Glucose Hexagon -->
      <polygon points="220,180 290,220 290,300 220,340 150,300 150,220" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <text x="220" y="270" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="30" fill="#2d3329">C₆H₁₂O₆</text>
      <!-- Oxygen O2 Cloud / Ring -->
      <circle cx="220" cy="440" r="54" fill="none" stroke="#2d3329" stroke-width="6"/>
      <circle cx="280" cy="420" r="26" fill="none" stroke="#2d3329" stroke-width="5"/>
      <text x="220" y="452" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="34" fill="#2d3329">O₂</text>
      <text x="220" y="580" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Glucose &amp; Oxygen</text>
    </g>
  </svg>
  `;

  // Page 3 SVG: Blooming Plant + Upward Growth Arrow + Clean Atmosphere
  const scene3Svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <rect width="1920" height="1080" fill="#fcfbf5"/>
    <!-- Left: Blooming Mature Plant -->
    <g transform="translate(180, 220)">
      <polygon points="120,440 280,440 260,540 140,540" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <rect x="105" y="415" width="190" height="28" rx="6" fill="none" stroke="#2d3329" stroke-width="7"/>
      <!-- Main stalk -->
      <path d="M200,415 L200,180" stroke="#2d3329" stroke-width="8" stroke-linecap="round"/>
      <!-- Big leaves -->
      <path d="M200,340 Q110,320 90,260 Q150,260 200,315" fill="none" stroke="#2d3329" stroke-width="7"/>
      <path d="M200,300 Q290,280 310,220 Q250,220 200,275" fill="none" stroke="#2d3329" stroke-width="7"/>
      <!-- Flower Blossom at Top -->
      <circle cx="200" cy="150" r="26" fill="none" stroke="#2d3329" stroke-width="6"/>
      <circle cx="200" cy="105" r="22" fill="none" stroke="#2d3329" stroke-width="5"/>
      <circle cx="200" cy="195" r="22" fill="none" stroke="#2d3329" stroke-width="5"/>
      <circle cx="155" cy="150" r="22" fill="none" stroke="#2d3329" stroke-width="5"/>
      <circle cx="245" cy="150" r="22" fill="none" stroke="#2d3329" stroke-width="5"/>
      <text x="200" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Plant Biomass</text>
    </g>

    <!-- Center: Upward Growth Trend Arrow -->
    <g transform="translate(740, 220)">
      <!-- Axis lines -->
      <line x1="80" y1="500" x2="420" y2="500" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <line x1="80" y1="500" x2="80" y2="120" stroke="#2d3329" stroke-width="6" stroke-linecap="round"/>
      <!-- Rising trend curve -->
      <path d="M80,480 Q220,440 380,180" fill="none" stroke="#2d3329" stroke-width="9" stroke-linecap="round"/>
      <polygon points="380,150 410,180 370,205" fill="#2d3329"/>
      <!-- Starburst sparkles -->
      <path d="M300,120 L300,160 M280,140 L320,140" stroke="#2d3329" stroke-width="5" stroke-linecap="round"/>
      <path d="M160,260 L160,290 M145,275 L175,275" stroke="#2d3329" stroke-width="4" stroke-linecap="round"/>
      <text x="240" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Growth &amp; Yield</text>
    </g>

    <!-- Right: Clean Oxygen Atmosphere -->
    <g transform="translate(1320, 220)">
      <!-- Earth globe curve -->
      <path d="M60,520 Q220,420 380,520" fill="none" stroke="#2d3329" stroke-width="6"/>
      <!-- Fresh air billowing clouds -->
      <path d="M120,380 Q100,320 150,280 Q200,240 260,260 Q320,240 340,300 Q380,340 350,400 Z" fill="none" stroke="#2d3329" stroke-width="7" stroke-linejoin="round"/>
      <!-- Floating O2 Badges -->
      <circle cx="170" cy="340" r="30" fill="none" stroke="#2d3329" stroke-width="5"/>
      <text x="170" y="348" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="20" fill="#2d3329">O₂</text>
      <circle cx="280" cy="310" r="36" fill="none" stroke="#2d3329" stroke-width="5"/>
      <text x="280" y="320" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="800" font-size="24" fill="#2d3329">O₂</text>
      <!-- Air breeze swirls -->
      <path d="M110,210 Q200,160 300,190 Q340,200 350,170" fill="none" stroke="#2d3329" stroke-width="5" stroke-linecap="round"/>
      <text x="220" y="600" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="28" fill="#2d3329">Oxygen Release</text>
    </g>
  </svg>
  `;

  const [img1, img2, img3] = await Promise.all([
    renderSvgToImageInput(scene1Svg, 'photosynthesis_page1.png'),
    renderSvgToImageInput(scene2Svg, 'photosynthesis_page2.png'),
    renderSvgToImageInput(scene3Svg, 'photosynthesis_page3.png'),
  ]);

  const audio = createSynthesizedAudio(18);

  const pageMeta: PageMetadata[] = [
    {
      title: 'Photosynthesis is the process where plants',
      tag: 'Photosynthesis',
      subtitle: 'Photosynthesis is the process where plants convert sunlight into chemical energy.',
    },
    {
      title: 'Chlorophyll in the leaves captures light',
      tag: 'Photosynthesis',
      subtitle: 'Chlorophyll in the leaves captures light. Water and carbon dioxide become glucose and oxygen.',
    },
    {
      title: 'This energy fuels plant growth and',
      tag: 'Photosynthesis',
      subtitle: 'This energy fuels plant growth and releases oxygen into the air.',
    },
  ];

  const cues: SubtitleCue[] = [
    {
      start: 0,
      end: 6,
      text: 'Photosynthesis is the process where plants convert sunlight into chemical energy.',
    },
    {
      start: 6,
      end: 12,
      text: 'Chlorophyll in the leaves captures light. Water and carbon dioxide become glucose and oxygen.',
    },
    {
      start: 12,
      end: 18,
      text: 'This energy fuels plant growth and releases oxygen into the air.',
    },
  ];

  return {
    images: [img1, img2, img3],
    audio,
    pageMeta,
    cues,
  };
}
