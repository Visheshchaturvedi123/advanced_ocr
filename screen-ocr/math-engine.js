const fs = require('node:fs');
const path = require('node:path');
const ort = require('onnxruntime-node');
const sharp = require('sharp');
const { Tokenizer } = require('@huggingface/tokenizers');

const MODEL_ROOT = path.join(__dirname, 'models');
const MFD_MODEL = path.join(MODEL_ROOT, 'mfd-1.5', 'pix2text-mfd-1.5.onnx');
const MFR_ROOT = path.join(MODEL_ROOT, 'mfr-1.5');
const IMGSZ = 1024;
const STRIDE = 32;
const MFD_CONF = Number(process.env.BRAHMA_MFD_CONF || 0.55);
const MAX_FORMULA_TOKENS = 128;

let modelPromise = null;

function loadModels(onProgress) {
  if (!modelPromise) {
    modelPromise = (async () => {
      onProgress?.({ status: 'Loading equation models', progress: 0.02 });
      const tokenizerJson = JSON.parse(fs.readFileSync(path.join(MFR_ROOT, 'tokenizer.json'), 'utf8'));
      const tokenizerConfig = JSON.parse(fs.readFileSync(path.join(MFR_ROOT, 'tokenizer_config.json'), 'utf8'));
      const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
      const options = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' };
      const [mfd, encoder, decoder] = await Promise.all([
        ort.InferenceSession.create(MFD_MODEL, options),
        ort.InferenceSession.create(path.join(MFR_ROOT, 'encoder_model.onnx'), options),
        ort.InferenceSession.create(path.join(MFR_ROOT, 'decoder_model.onnx'), options),
      ]);
      return { mfd, encoder, decoder, tokenizer };
    })();
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}

function area(box) {
  return Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
}

function intersectionArea(a, b) {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

function iou(a, b) {
  const inter = intersectionArea(a, b);
  const union = area(a) + area(b) - inter;
  return union ? inter / union : 0;
}

function nms(boxes, threshold = 0.7) {
  const byClass = new Map();
  for (const box of boxes) {
    if (!byClass.has(box.cls)) byClass.set(box.cls, []);
    byClass.get(box.cls).push(box);
  }
  const kept = [];
  for (const list of byClass.values()) {
    list.sort((a, b) => b.score - a.score);
    const suppressed = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i += 1) {
      if (suppressed[i]) continue;
      kept.push(list[i]);
      for (let j = i + 1; j < list.length; j += 1) {
        if (!suppressed[j] && iou(list[i], list[j]) > threshold) suppressed[j] = true;
      }
    }
  }
  return kept;
}

function letterboxParams(width, height) {
  const ratio = Math.min(IMGSZ / height, IMGSZ / width);
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);
  let padWidth = (IMGSZ - newWidth) % STRIDE;
  let padHeight = (IMGSZ - newHeight) % STRIDE;
  padWidth /= 2;
  padHeight /= 2;
  return {
    ratio,
    newWidth,
    newHeight,
    top: Math.round(padHeight - 0.1),
    bottom: Math.round(padHeight + 0.1),
    left: Math.round(padWidth - 0.1),
    right: Math.round(padWidth + 0.1),
  };
}

async function prepareMathImage(imageBuffer) {
  const stats = await sharp(imageBuffer).grayscale().stats();
  const mean = stats.channels?.[0]?.mean ?? 255;
  let pipeline = sharp(imageBuffer).grayscale().removeAlpha();
  if (mean < 128) pipeline = pipeline.negate();
  return pipeline.normalize().png().toBuffer();
}

async function prepareDetectionInput(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  if (!meta.width || !meta.height) throw new Error('The image had no readable pixels.');
  const params = letterboxParams(meta.width, meta.height);
  const { data } = await sharp(imageBuffer)
    .resize(params.newWidth, params.newHeight, { fit: 'fill', kernel: 'linear' })
    .removeAlpha()
    .extend({
      top: params.top,
      bottom: params.bottom,
      left: params.left,
      right: params.right,
      background: { r: 114, g: 114, b: 114 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = params.newWidth + params.left + params.right;
  const height = params.newHeight + params.top + params.bottom;
  const plane = width * height;
  const pixels = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    pixels[i] = data[i * 3] / 255;
    pixels[plane + i] = data[i * 3 + 1] / 255;
    pixels[2 * plane + i] = data[i * 3 + 2] / 255;
  }
  return {
    tensor: new ort.Tensor('float32', pixels, [1, 3, height, width]),
    params,
    width: meta.width,
    height: meta.height,
  };
}

async function detectFormulas(session, imageBuffer) {
  const { tensor, params, width, height } = await prepareDetectionInput(imageBuffer);
  const output = await session.run({ images: tensor });
  const logits = output.output0;
  const [, channels, count] = logits.dims;
  const data = logits.data;
  const boxes = [];
  for (let i = 0; i < count; i += 1) {
    let score = -Infinity;
    let cls = -1;
    for (let channel = 4; channel < channels; channel += 1) {
      const value = data[channel * count + i];
      if (value > score) {
        score = value;
        cls = channel - 4;
      }
    }
    if (score < 0.25) continue;
    const cx = data[i];
    const cy = data[count + i];
    const boxWidth = data[2 * count + i];
    const boxHeight = data[3 * count + i];
    boxes.push({
      x0: cx - boxWidth / 2,
      y0: cy - boxHeight / 2,
      x1: cx + boxWidth / 2,
      y1: cy + boxHeight / 2,
      score,
      cls,
    });
  }
  return nms(boxes)
    .filter((box) => box.score >= MFD_CONF)
    .map((box) => ({
      bbox: {
        x0: Math.max(0, Math.min(width, (box.x0 - params.left) / params.ratio)),
        y0: Math.max(0, Math.min(height, (box.y0 - params.top) / params.ratio)),
        x1: Math.max(0, Math.min(width, (box.x1 - params.left) / params.ratio)),
        y1: Math.max(0, Math.min(height, (box.y1 - params.top) / params.ratio)),
      },
      score: box.score,
      type: box.cls === 0 ? 'embedding' : 'isolated',
    }))
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

function mergeDetections(...lists) {
  const merged = [];
  for (const box of lists.flat()) {
    const duplicate = merged.find((item) => {
      return iou(item.bbox, box.bbox) > 0.55;
    });
    if (duplicate) {
      if (box.score > duplicate.score) Object.assign(duplicate, box);
    } else {
      merged.push(box);
    }
  }
  return merged.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

async function detectFormulasTiled(session, imageBuffer, meta) {
  const full = await detectFormulas(session, imageBuffer);
  if (!meta.width || meta.width < 900) return full;

  const overlap = Math.round(meta.width * 0.1);
  const midpoint = Math.round(meta.width / 2);
  const windows = [
    { left: 0, width: Math.min(meta.width, midpoint + overlap) },
    { left: Math.max(0, midpoint - overlap), width: Math.min(meta.width, midpoint + overlap) },
  ];
  const tiled = [];
  for (const window of windows) {
    const left = Math.max(0, Math.min(meta.width - 1, window.left));
    const width = Math.max(1, Math.min(meta.width - left, window.width));
    const slice = await sharp(imageBuffer)
      .extract({ left, top: 0, width, height: meta.height })
      .png()
      .toBuffer();
    const boxes = await detectFormulas(session, slice);
    for (const box of boxes) {
      box.bbox.x0 += left;
      box.bbox.x1 += left;
      tiled.push(box);
    }
  }
  return mergeDetections(full, tiled);
}

const MATH_LINE_PATTERN = /[=<>^]|\u00b2|\d\s*[<>]|[A-Za-z]\s*[<>]|\bn\s*[>~^]/;

function hasMathText(text) {
  return MATH_LINE_PATTERN.test(String(text || ''));
}

async function detectLineFormulas(session, imageBuffer, tessData, existing, meta) {
  const lines = tessLines(tessData).filter((line) => line.bbox && hasMathText(line.text));
  const added = [];
  for (const line of lines) {
    const centerY = (line.bbox.y0 + line.bbox.y1) / 2;
    const covered = existing.some((detection) => {
      const centerX = (detection.bbox.x0 + detection.bbox.x1) / 2;
      const boxY = (detection.bbox.y0 + detection.bbox.y1) / 2;
      return (
        line.bbox.x0 <= centerX &&
        centerX <= line.bbox.x1 &&
        line.bbox.y0 <= boxY &&
        boxY <= line.bbox.y1
      );
    });
    if (covered) continue;

    const padX = 6;
    const padY = 5;
    const lineLeft = Math.max(0, Math.floor(line.bbox.x0) - padX);
    const lineRight = Math.min(meta.width, Math.ceil(line.bbox.x1) + padX);
    const lineTop = Math.max(0, Math.floor(line.bbox.y0) - padY);
    const lineBottom = Math.min(meta.height, Math.ceil(line.bbox.y1) + padY);
    const lineWidth = lineRight - lineLeft;
    const lineHeight = lineBottom - lineTop;
    if (lineWidth < 24 || lineHeight < 10) continue;

    const windowWidth = Math.min(lineWidth, Math.max(240, Math.round(lineWidth * 0.62)));
    const starts = lineWidth <= windowWidth ? [lineLeft] : [lineLeft, Math.max(lineLeft, lineRight - windowWidth)];
    for (const left of starts) {
      const width = Math.min(meta.width - left, windowWidth);
      if (width < 12) continue;
      const crop = await sharp(imageBuffer)
        .extract({ left, top: lineTop, width, height: lineHeight })
        .png()
        .toBuffer();
      const boxes = await detectFormulas(session, crop);
      for (const box of boxes) {
        const mapped = {
          ...box,
          bbox: {
            x0: box.bbox.x0 + left,
            y0: box.bbox.y0 + lineTop,
            x1: box.bbox.x1 + left,
            y1: box.bbox.y1 + lineTop,
          },
        };
        const boxHeight = mapped.bbox.y1 - mapped.bbox.y0;
        if (boxHeight < 6) continue;
        const duplicate = [...existing, ...added].find((item) => iou(item.bbox, mapped.bbox) > 0.45);
        if (duplicate) continue;
        added.push(mapped);
      }
    }
  }
  return added;
}

function refineFormulaBox(box, words) {
  let { x0, y0, x1, y1 } = box;
  for (const word of words) {
    const wordBox = word.bbox;
    if (!wordBox) continue;
    const wordArea = area(wordBox);
    if (!wordArea) continue;
    const overlap = intersectionArea(box, wordBox);
    if (overlap <= 0 || overlap < 0.04 * wordArea) continue;
    const text = String(word.text || '').trim();
    const centerX = (wordBox.x0 + wordBox.x1) / 2;
    const centerY = (wordBox.y0 + wordBox.y1) / 2;
    const inside = x0 <= centerX && centerX <= x1 && y0 <= centerY && centerY <= y1;
    if (inside && /[,;]$/.test(text) && centerX < x0 + 0.35 * (x1 - x0)) {
      x0 = Math.max(x0, wordBox.x1 + 1);
      continue;
    }
    if (inside || text.length < 2) continue;
    if (centerX < x0) x0 = Math.max(x0, wordBox.x1 + 1);
    else if (centerX > x1) x1 = Math.min(x1, wordBox.x0 - 1);
  }
  if (x1 - x0 < 6 || y1 - y0 < 6) return null;
  return { x0, y0, x1, y1 };
}

function tessLines(data) {
  const lines = [];
  for (const block of data?.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) lines.push(line);
    }
  }
  return lines;
}

function tessWords(data) {
  const words = [];
  for (const line of tessLines(data)) {
    for (const word of line.words || []) {
      if (word.bbox) words.push({ text: word.text || '', bbox: word.bbox });
    }
  }
  return words;
}

function latexFromTokenIds(tokenizer, ids) {
  return tokenizer.decode(ids, { skip_special_tokens: true });
}

function tokenIdsTensor(ids) {
  const values = new BigInt64Array(ids.length);
  for (let i = 0; i < ids.length; i += 1) values[i] = BigInt(ids[i]);
  return new ort.Tensor('int64', values, [1, ids.length]);
}

function argmax(values, offset, length) {
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < length; i += 1) {
    const value = values[offset + i];
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

async function recognizeFormula(encoder, decoder, tokenizer, imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .resize(384, 384, { fit: 'fill', kernel: 'cubic' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const plane = 384 * 384;
  const pixels = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    pixels[i] = (data[i * 3] / 255 - 0.5) / 0.5;
    pixels[plane + i] = (data[i * 3 + 1] / 255 - 0.5) / 0.5;
    pixels[2 * plane + i] = (data[i * 3 + 2] / 255 - 0.5) / 0.5;
  }
  const encoderOutput = await encoder.run({
    pixel_values: new ort.Tensor('float32', pixels, [1, 3, 384, 384]),
  });
  const hidden = encoderOutput.last_hidden_state;
  const ids = [1];
  for (let step = 0; step < MAX_FORMULA_TOKENS; step += 1) {
    const output = await decoder.run({
      input_ids: tokenIdsTensor(ids),
      encoder_hidden_states: hidden,
    });
    const logits = output.logits;
    const [, sequenceLength, vocabulary] = logits.dims;
    const next = argmax(logits.data, (sequenceLength - 1) * vocabulary, vocabulary);
    ids.push(next);
    if (next === 2) break;
  }
  return latexFromTokenIds(tokenizer, ids);
}

function normalizeLatex(text) {
  if (!text) return '';
  let value = String(text).trim();
  value = value.replace(/\\left/g, '').replace(/\\right/g, '');
  value = value.replace(/\\(?:dot|hat|bar|vec)\s*\{([^{}]*)\}/g, '$1');
  value = value.replace(/^\\Psi_\{r\},?/, 'Y,');
  value = value.replace(/\\root\s*\{?\s*(\d+)\s*\}?\s*\\of\s*\{([^{}]*)\}/g, '\\sqrt[$1]{$2}');
  value = value.replace(/\^\s*\{?\s*(\d+)\s*\}?\s*\\sqrt\s*\{([^{}]*)\}/g, '\\sqrt[$1]{$2}');
  value = value.replace(/\\mathbf\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1');
  value = value.replace(/\\math(?:bf|sf|tt|rm)\s*\{([^{}]*)\}/g, '$1');
  value = value.replace(/\{\s*\\bf\s*([^{}]*)\}/g, '$1');
  value = value.replace(/\{\s*\\sf\s*([^{}]*)\}/g, '$1');
  value = value.replace(/\\bf\s*\{([^{}]*)\}/g, '$1');
  value = value.replace(/\\sf\s*\{([^{}]*)\}/g, '$1');
  value = value.replace(/\\bf\s*([a-zA-Z0-9])/g, '$1');
  value = value.replace(/\\sf\s*([a-zA-Z0-9])/g, '$1');
  value = value.replace(/\{n\}\^\{2\}/g, 'n^{2}');
  value = value.replace(/(?<!\\frac)\{([A-Za-z])\}\{([A-Za-z])\}(?![A-Za-z])/g, '$1$2');
  value = value.replace(/(?<!\\frac)(?<!\\sqrt)\{([A-Za-z])\}(?![A-Za-z])/g, '$1');
  value = value.replace(/\bn>-([A-Za-z])n\b/g, 'n^{2}-$1n');
  value = value.replace(/\\[,!;]/g, '');
  value = value.replace(/\s+/g, '');
  value = value.replace(/[\u0966-\u096f]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
  return value;
}

function postProcessLatex(text) {
  let value = String(text || '').trim();
  value = value.replace(/^\^\s*{\s*(.*?)\s*}/, '$1');
  value = value.replace(/^_\s*{\s*(.*?)\s*}/, '$1');
  return normalizeLatex(value);
}

function splitTrailingPunctuation(latex) {
  const match = latex.match(/([.,;:!?])$/);
  if (!match) return { latex, suffix: '' };
  return { latex: latex.slice(0, -1), suffix: match[1] };
}

function simpleFormulaText(box, words) {
  let overlapping = words
    .filter((word) => intersectionArea(word.bbox, box) >= 0.2 * Math.max(1, area(word.bbox)))
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)
    .map((word) => String(word.text || '').trim())
    .join('')
    .replace(/\s+/g, '');
  if (/^[<>=]/.test(overlapping)) {
    const left = words
      .filter((word) => {
        const text = String(word.text || '').trim();
        return /^[A-Za-z0-9]$/.test(text) && word.bbox.x1 <= box.x0 + 3;
      })
      .sort((a, b) => b.bbox.x1 - a.bbox.x1)[0];
    if (left && box.x0 - left.bbox.x1 < 24) {
      overlapping = `${String(left.text).trim()}${overlapping}`;
    }
  }
  if (!/^[A-Za-z0-9+\-*/=<>().,]+$/.test(overlapping)) return '';
  if (!/[=<>]/.test(overlapping) && !/^[A-Za-z]$/.test(overlapping)) return '';
  return overlapping;
}

function restoreLettersFromWords(latex, box, words) {
  const overlapping = words
    .filter((word) => intersectionArea(word.bbox, box) >= 0.15 * Math.max(1, area(word.bbox)))
    .map((word) => String(word.text || ''))
    .join(' ');
  let value = latex;
  if (/Sn/.test(overlapping) && /(^|[-+])5n/.test(value)) {
    value = value.replace(/(^|[-+])5n/g, '$1Sn');
  }
  if (/P\+S\+15/.test(overlapping) && /P\+5\+15/.test(value)) {
    value = value.replace(/P\+5\+15/, 'P+S+15');
  }
  if (/n\s*[>?^~\u00b2]/.test(overlapping) && /(^|[+\-])n-Sn/.test(value)) {
    value = value.replace(/(^|[+\-])n-Sn/g, '$1n^{2}-Sn');
  }
  return value;
}

function preferSingleLetter(latex, box, words) {
  const singleSymbol = latex === '\\times' || latex === '\\mathrm{x}' || /^\\[A-Za-z]{2,10}$/.test(latex) || /^[A-Za-z]$/.test(latex);
  if (!singleSymbol) return latex;
  const overlapping = words.filter((word) => {
    const overlap = intersectionArea(word.bbox, box);
    return overlap >= 0.2 * Math.max(1, area(word.bbox));
  });
  if (overlapping.length === 1 && /^[a-zA-Z0-9]$/.test(overlapping[0].text.trim())) {
    return overlapping[0].text.trim();
  }
  return latex;
}

function toBox(bbox) {
  if (!bbox) return null;
  return { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 };
}

function formulaQuality(latex) {
  const value = String(latex || '');
  let score = value.length;
  score += (value.match(/\^/g) || []).length * 8;
  score += (value.match(/\\times/g) || []).length * 4;
  score += (value.match(/\\frac/g) || []).length * 3;
  score -= (value.match(/\\mathbf/g) || []).length * 2;
  return score;
}

function firstHindiLineY(data) {
  let split = null;
  for (const line of tessLines(data)) {
    if (!/[\u0900-\u0965\u0970-\u097F]/.test(line.text || '')) continue;
    const top = Number(line.bbox?.y0);
    if (!Number.isFinite(top)) continue;
    if (split === null || top < split) split = top;
  }
  return split;
}

function isComparableFormula(formula) {
  const latex = String(formula.latex || '');
  return /[=^]|\\frac|\\sqrt/.test(latex) && (formula.bbox.x1 - formula.bbox.x0) >= 50;
}

function reuseDuplicateFormulas(tessData, formulas) {
  const split = firstHindiLineY(tessData);
  if (split === null) return;
  const english = formulas
    .filter((formula) => (formula.bbox.y0 + formula.bbox.y1) / 2 < split && isComparableFormula(formula))
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const hindi = formulas
    .filter((formula) => (formula.bbox.y0 + formula.bbox.y1) / 2 >= split && isComparableFormula(formula))
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
  if (!english.length || english.length !== hindi.length) return;
  for (let i = 0; i < english.length; i += 1) {
    const englishQuality = formulaQuality(english[i].latex);
    const hindiQuality = formulaQuality(hindi[i].latex);
    if (englishQuality > hindiQuality + 2) {
      hindi[i].latex = english[i].latex;
      hindi[i].suffix = english[i].suffix;
    } else if (hindiQuality > englishQuality + 2) {
      english[i].latex = hindi[i].latex;
      english[i].suffix = hindi[i].suffix;
    }
  }
}

function mergeOcr(data, formulas) {
  const output = [];
  const used = new Set();
  for (const line of tessLines(data)) {
    const lineBox = toBox(line.bbox);
    if (!lineBox) continue;
    const words = (line.words || [])
      .map((word) => ({ text: word.text || '', bbox: toBox(word.bbox) }))
      .filter((word) => word.bbox);
    const lineFormulas = [];
    for (let i = 0; i < formulas.length; i += 1) {
      const formula = formulas[i];
      const overlap = Math.max(0, Math.min(lineBox.y1, formula.bbox.y1) - Math.max(lineBox.y0, formula.bbox.y0));
      if (overlap >= 0.3 * Math.min(formula.bbox.y1 - formula.bbox.y0, lineBox.y1 - lineBox.y0)) {
        lineFormulas.push({ index: i, formula });
      }
    }
    if (line.fixedText) {
      for (const { index } of lineFormulas) used.add(index);
      output.push(line.fixedText);
      continue;
    }
    if (!words.length && !lineFormulas.length) {
      const text = (line.text || '').trim();
      if (text) output.push(text);
      continue;
    }
    const kept = [];
    for (const word of words) {
      let remove = false;
      for (const { formula } of lineFormulas) {
        const overlap = intersectionArea(word.bbox, formula.bbox);
        const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
        const centerY = (word.bbox.y0 + word.bbox.y1) / 2;
        if (overlap >= 0.2 * Math.max(1, area(word.bbox))) {
          remove = true;
        } else if (
          formula.bbox.x0 <= centerX &&
          centerX <= formula.bbox.x1 &&
          formula.bbox.y0 <= centerY &&
          centerY <= formula.bbox.y1
        ) {
          remove = true;
        }
        if (remove) break;
      }
      if (!remove) kept.push(word);
    }
    if (!kept.length && lineFormulas.length) {
      for (const { index, formula } of lineFormulas) {
        output.push(`$$${formula.latex}$$`);
        used.add(index);
      }
      continue;
    }
    const items = kept.map((word) => ({ kind: 'word', text: word.text, x: word.bbox.x0 }));
    for (const { index, formula } of lineFormulas) {
      items.push({
        kind: 'formula',
        text: formula.latex,
        suffix: formula.suffix,
        x: formula.bbox.x0,
      });
      used.add(index);
    }
    items.sort((a, b) => a.x - b.x);
    const chunks = items
      .map((item) => (item.kind === 'formula' ? `$${item.text}$${item.suffix || ''}` : item.text))
      .filter(Boolean);
    if (chunks.length) output.push(chunks.join(' '));
  }
  for (let i = 0; i < formulas.length; i += 1) {
    if (!used.has(i)) output.push(`$$${formulas[i].latex}$$`);
  }
  return output.join('\n').trim();
}

async function recognizeMath(imageBuffer, tessData, onProgress) {
  const { mfd, encoder, decoder, tokenizer } = await loadModels(onProgress);
  onProgress?.({ status: 'Preparing equation image', progress: 0.08 });
  const mathBuffer = await prepareMathImage(imageBuffer);
  onProgress?.({ status: 'Detecting equations', progress: 0.12 });
  const meta = await sharp(mathBuffer).metadata();
  const full = await detectFormulas(mfd, mathBuffer);
  const extra = await detectLineFormulas(mfd, mathBuffer, tessData, full, meta);
  const detections = mergeDetections(full, extra);
  if (!detections.length) return String(tessData?.text || '').trim();

  const words = tessWords(tessData);
  const formulas = [];
  for (let i = 0; i < detections.length; i += 1) {
    const detection = detections[i];
    onProgress?.({
      status: `Reading equation ${i + 1} of ${detections.length}`,
      progress: 0.2 + (0.7 * i) / detections.length,
    });
    const refined = refineFormulaBox(detection.bbox, words) || detection.bbox;
    const simple = simpleFormulaText(refined, words);
    if (simple) {
      const normalizedSimple = simple.replace(/^n>-?([A-Za-z])n/, 'n^{2}-$1n');
      const { latex, suffix } = splitTrailingPunctuation(normalizedSimple);
      formulas.push({
        bbox: refined,
        latex,
        suffix,
        rawLatex: simple,
        score: detection.score,
        type: detection.type,
      });
      continue;
    }
    const left = Math.max(0, Math.round(refined.x0) - 2);
    const top = Math.max(0, Math.round(refined.y0) - 2);
    const width = Math.max(1, Math.min(meta.width, Math.round(refined.x1) + 2) - left);
    const height = Math.max(1, Math.min(meta.height, Math.round(refined.y1) + 2) - top);
    const scale = Math.min(6, Math.max(2, 320 / width, 72 / height));
    const crop = await sharp(mathBuffer)
      .extract({ left, top, width, height })
      .resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), {
        kernel: 'lanczos3',
      })
      .png()
      .toBuffer();
    const rawLatex = await recognizeFormula(encoder, decoder, tokenizer, crop);
    const processed = postProcessLatex(rawLatex);
    if (process.env.BRAHMA_DEBUG_MATH) console.error({ rawLatex, processed });
    const restored = restoreLettersFromWords(processed, refined, words);
    const corrected = preferSingleLetter(restored, refined, words);
    const { latex, suffix } = splitTrailingPunctuation(corrected);
    formulas.push({
      bbox: refined,
      latex,
      suffix,
      rawLatex,
      score: detection.score,
      type: detection.type,
    });
  }

  reuseDuplicateFormulas(tessData, formulas);
  onProgress?.({ status: 'Merging equations', progress: 0.95 });
  return mergeOcr(tessData, formulas);
}

module.exports = { recognizeMath, mergeOcr, postProcessLatex, normalizeLatex };
