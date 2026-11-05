import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { recognizeImageDetailed, recognizeMixedDetailed, polishText } from '../ocr-engine.js';
import { recognizeMath } from '../math-engine.js';

const input = process.argv[2];
const language = process.argv[3] || 'eng+hin';
if (!input) {
  console.error('Usage: npm run test:math -- path\\to\\image.png [eng|hin|eng+hin]');
  process.exit(1);
}

const extension = path.extname(input).slice(1).toLowerCase();
const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension || 'png'}`;
const buffer = await readFile(input);
const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

const detailed =
  language === 'eng+hin'
    ? await recognizeMixedDetailed(dataUrl, ({ status, progress }) => {
        const percent = Math.round((progress || 0) * 100);
        if (percent % 20 === 0) console.log(`${status} ${percent}%`);
      })
    : await recognizeImageDetailed(
        dataUrl,
        language,
        ({ status, progress }) => {
          const percent = Math.round((progress || 0) * 100);
          if (percent % 20 === 0) console.log(`${status} ${percent}%`);
        },
        true,
      );

console.log('--- TEXT ---');
console.log(detailed.text);
console.log('--- MATH ---');
const text = await recognizeMath(buffer, detailed.data, ({ status, progress }) => {
  console.log(`${status} ${Math.round((progress || 0) * 100)}%`);
});
console.log(polishText(text));
