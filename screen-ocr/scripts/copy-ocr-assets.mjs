import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const source = path.join(repoRoot, 'public', 'ocr');
const destination = path.join(appRoot, 'ocr');
const sentinel = path.join(destination, 'worker.min.js');

if (existsSync(sentinel)) {
  console.log('Screen OCR assets already present.');
  process.exit(0);
}

if (!existsSync(source)) {
  console.warn('Brahma OCR assets were not found at public/ocr.');
  console.warn('Place the worker, WASM cores, and lang folder in screen-ocr/ocr.');
  process.exit(0);
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
console.log('Copied Brahma OCR assets to screen-ocr/ocr.');
