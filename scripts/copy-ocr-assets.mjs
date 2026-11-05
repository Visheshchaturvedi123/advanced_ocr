import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const target = path.join(root, 'public', 'ocr');
const langTarget = path.join(target, 'lang');
fs.mkdirSync(langTarget, { recursive: true });

const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm', 'tesseract-core-relaxedsimd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
  ['node_modules/@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz', 'lang/hin.traineddata.gz'],
];

for (const [source, name] of files) {
  const from = path.join(root, source);
  const to = path.join(target, name);
  if (!fs.existsSync(from)) {
    console.warn(`[ocr] missing ${source}`);
    continue;
  }
  fs.copyFileSync(from, to);
  console.log(`[ocr] ${name} ${fs.statSync(to).size} bytes`);
}
