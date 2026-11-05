import { readFile } from 'node:fs/promises';
import path from 'node:path';
import engine from '../ocr-engine.js';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run test:ocr -- path\\to\\image.png');
  process.exit(1);
}

const extension = path.extname(input).slice(1).toLowerCase();
const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension || 'png'}`;
const buffer = await readFile(input);
const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

let lastPercent = -1;
const text = await engine.recognizeImage(dataUrl, 'eng', ({ status, progress }) => {
  const percent = Math.round(progress * 100);
  if (percent >= lastPercent + 10) {
    lastPercent = percent;
    console.log(`${status} ${percent}%`);
  }
});

console.log('--- OCR TEXT ---');
console.log(text);
console.log('----------------');
if (!/BRAHMA SCREEN OCR/i.test(text)) {
  console.error('Expected text was not recognized.');
  process.exit(1);
}
console.log('Screen OCR engine test passed.');
