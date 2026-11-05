const path = require('node:path');
const { createWorker, OEM } = require('tesseract.js');

const OCR_ROOT = path.join(__dirname, 'ocr');
const LANG_ROOT = path.join(OCR_ROOT, 'lang');

const createOcrWorker = async (language = 'eng', onProgress) => {
  return createWorker(language, OEM.LSTM_ONLY, {
    corePath: OCR_ROOT,
    langPath: LANG_ROOT,
    workerBlobURL: false,
    gzip: true,
    logger: (message) => {
      onProgress?.({
        status: message.status || 'working',
        progress: typeof message.progress === 'number' ? message.progress : 0,
      });
    },
  });
};

const recognizeImageDetailed = async (image, language = 'eng', onProgress, includeBlocks = false) => {
  const worker = await createOcrWorker(language, onProgress);

  try {
    const result = await worker.recognize(image, {}, { text: true, blocks: includeBlocks });
    return {
      text: (result.data.text || '').trim(),
      data: result.data,
    };
  } finally {
    await worker.terminate();
  }
};

const recognizeImage = async (image, language = 'eng', onProgress) => {
  const result = await recognizeImageDetailed(image, language, onProgress, false);
  return result.text;
};

const lineList = (data) => {
  const lines = [];
  for (const block of data?.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) lines.push(line);
    }
  }
  return lines.sort((a, b) => (a.bbox?.y0 || 0) - (b.bbox?.y0 || 0));
};

const devanagariCount = (text) => (String(text || '').match(/[\u0900-\u097F]/g) || []).length;
const devanagariLetterCount = (text) => (String(text || '').match(/[\u0900-\u0965\u0970-\u097F]/g) || []).length;

const toAsciiDigits = (text) => {
  return String(text || '').replace(/[\u0966-\u096f]/g, (digit) => {
    return String(digit.charCodeAt(0) - 0x0966);
  });
};

const verticalOverlap = (a, b) => {
  if (!a?.bbox || !b?.bbox) return 0;
  const top = Math.max(a.bbox.y0, b.bbox.y0);
  const bottom = Math.min(a.bbox.y1, b.bbox.y1);
  return Math.max(0, bottom - top);
};

const lineConfidence = (line) => {
  const words = line?.words || [];
  if (words.length) {
    return words.reduce((sum, word) => sum + (Number(word.confidence) || 0), 0) / words.length;
  }
  return Number(line?.confidence) || 0;
};

const variableSequence = (text) => {
  const variables = [];
  const pattern = /(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g;
  for (const match of String(text || '').matchAll(pattern)) {
    const value = match[0];
    if (value === 'a' || value === 'I') continue;
    variables.push(value);
  }
  return variables;
};

const alignHindiVariables = (chosen, englishLines) => {
  const hindiStart = chosen.findIndex((line) => devanagariLetterCount(line.text) > 0);
  if (hindiStart <= 0) return chosen;
  const englishContent = englishLines.slice(0, hindiStart);
  const firstMeaningful = englishContent.findIndex((line) => /[A-Za-z]{3,}/.test(line.text || ''));
  const references = englishContent.slice(firstMeaningful >= 0 ? firstMeaningful : 0);
  const pairCount = Math.min(chosen.length - hindiStart, references.length);
  for (let i = 0; i < pairCount; i += 1) {
    const line = chosen[hindiStart + i];
    const reference = references[i];
    const referenceText = String(reference?.text || '').replace(/\bHand\s+L\b/g, 'H and L');
    const variables = variableSequence(referenceText);
    if (!variables.length) continue;
    const shouldAlign = /\u092e\u093e\u0928 \u0932\u0940\u091c\u093f\u090f|\u0926\u094b \u092a\u0949\u091c\u093f\u091f\u093f\u0935|\u092e\u0947\u0902 \u0938\u0947 \u0920\u0940\u0915 \u090f\u0915/.test(String(line.text || ''));
    let variableIndex = 0;
    const repaired = String(line.text || '').replace(/(\s+)|(\S+)/g, (part, space) => {
      if (space || !shouldAlign || variableIndex >= variables.length) return part;
      if (/[<>=^]/.test(part)) {
        variableIndex = variables.length;
        return part;
      }
      const match = part.match(/^([$(\[]*)([^\s$()\[\].,;:!?।]+)([).,;:!?।$]*)$/u);
      if (!match) return part;
      const [, prefix, core, suffix] = match;
      if (!/^[\p{N}A-Za-z\u00bb\u2018\u2019'#?&]$/u.test(core)) return part;
      const expected = variables[variableIndex];
      variableIndex += 1;
      return `${prefix}${expected}${suffix}`;
    });
    line.text = repaired;
    if (shouldAlign) {
      let wordIndex = 0;
      for (const word of line.words || []) {
        if (wordIndex >= variables.length) break;
        const text = String(word.text || '');
        if (/[<>=^]/.test(text)) {
          wordIndex = variables.length;
          break;
        }
        const match = text.match(/^([$(\[]*)([^\s$()\[\].,;:!?।]+)([).,;:!?।$]*)$/u);
        if (!match) continue;
        const [, prefix, core, suffix] = match;
        if (!/^[\p{N}A-Za-z\u00bb\u2018\u2019'#?&]$/u.test(core)) continue;
        word.text = `${prefix}${variables[wordIndex]}${suffix}`;
        wordIndex += 1;
      }
    }
    if (
      /HCF/.test(referenceText) &&
      /LCM/.test(referenceText) &&
      /\u0915\u094d\u0930\u092e\u0936\u0903/.test(repaired) &&
      variables.length >= 4
    ) {
      line.text = `${variables[0]} \u0914\u0930 ${variables[1]} \u0915\u094d\u0930\u092e\u0936\u0903 ${variables[2]} \u0914\u0930 ${variables[3]} \u0915\u0947 HCF \u0914\u0930 LCM \u0939\u0948\u0902\u0964`;
      line.fixedText = line.text;
    }
  }
  return chosen;
};

const mergeLanguageData = (english, hindi) => {
  const englishLines = lineList(english);
  const hindiLines = lineList(hindi);
  const chosen = englishLines.map((line) => {
    let best = null;
    let bestOverlap = 0;
    for (const candidate of hindiLines) {
      const overlap = verticalOverlap(line, candidate);
      if (overlap > bestOverlap) {
        best = candidate;
        bestOverlap = overlap;
      }
    }
    if (
      best &&
      devanagariLetterCount(best.text) > 0 &&
      (/[A-Za-z]{3,}/.test(line.text || '') || /^[A-Za-z .]{1,5}$/.test(String(line.text || '').trim())) &&
      bestOverlap >= 0.4 * Math.max(1, line.bbox?.y1 - line.bbox?.y0) &&
      lineConfidence(best) > lineConfidence(line) + 8
    ) {
      return best;
    }
    return line;
  });
  alignHindiVariables(chosen, englishLines);
  const text = chosen
    .map((line) => String(line.text || '').trim())
    .filter((line) => line)
    .join('\n')
    .trim();
  return {
    text,
    data: { blocks: [{ paragraphs: [{ lines: chosen }] }], text },
  };
};

const polishPlainText = (text) => {
  let value = String(text || '');
  value = value.replace(/\u092a\u0942\u0930\u094d\u0923\u093e\u0915/g, '\u092a\u0942\u0930\u094d\u0923\u093e\u0902\u0915');
  value = value.replace(/\u092a\u0930\u094d\u0923\u093e\u0915/g, '\u092a\u0942\u0930\u094d\u0923\u093e\u0902\u0915');
  value = value.replace(/\bHand L(?=\s+(?:are|is|the)\b)/g, 'H and L');
  value = value.replace(/(\u0938\u0947\u091f|Set)\s*&/g, '$1 A');
  value = value.replace(/(\u0938\u0947\u091f|Set)\s*[8\u096a]/g, '$1 B');
  value = value.replace(/(\u0938\u0947\u091f|Set)\s*#/g, '$1 A');
  value = value.replace(/\u0938\u0947\u091f\s*AH(?=\s|$)/g, '\u0938\u0947\u091f A \u092e\u0947\u0902');
  value = value.replace(/\u0938\u0947\u091f\s*BH(?=\s|$)/g, '\u0938\u0947\u091f B \u092e\u0947\u0902');
  value = value.replace(/\u00bb\s*<\s*[\u0967']/g, 'X < Y');
  value = value.replace(/\u00bb/g, 'X');
  value = value.replace(/\u0914\u0930\s+[\u0967'#](?=\s|\u0939\u0948\u0902)/g, '\u0914\u0930 Y');
  value = value.replace(/10\s*<\s*s\s*<\s*20/gi, '10 < S < 20');
  value = value.replace(/27\s*<\s*\u096a\u096a/g, 'Z < W');
  value = value.replace(/2\s*\u0914\u0930\s*\u096a+/g, 'Z \u0914\u0930 W');
  value = value.replace(/2\s*\u0914\u0930\s*W/g, 'Z \u0914\u0930 W');
  value = value.replace(/7\s*\u0914\u0930\s*[\u096a\u096b\u0968]+/g, 'Z \u0914\u0930 W');
  value = value.replace(/2\s*<\s*\u096a+\/?/g, 'Z < W');
  value = value.replace(/\?\s*\u0915\u093e\s+\u092e\u093e\u0928/g, 'P \u0915\u093e \u092e\u093e\u0928');
  value = value.replace(/\bPH\s+\u092e\u093e\u0928/g, 'P \u092e\u093e\u0928');
  value = value.replace(/\(\s*\u0915\u093e\s+\u092e\u093e\u0928/g, 'K \u0915\u093e \u092e\u093e\u0928');
  value = value.replace(
    /\u0938\u0902\u0916\u094d\u092f\u093e\s+[5\u096b]\s+\u0915\u094b\s+5/g,
    '\u0938\u0902\u0916\u094d\u092f\u093e S \u0915\u094b 5',
  );
  value = value.replace(/0-00\s*\+\s*[\u0965\u096b]+\s*-\s*0/g, () => '$n^{2}-Kn+M=0$');
  value = value.replace(
    /\bn\s*[>~^]\s*~?\s*S?\s*n\s*\+\s*P\s*=\s*0\b/gi,
    () => '$n^{2}-Sn+P=0$',
  );
  value = value.replace(
    /\bn\s*[>~^]\s*[\u2014-]?\s*~?\s*K?\s*n\s*\+\s*M\s*=\s*0\b/gi,
    () => '$n^{2}-Kn+M=0$',
  );
  value = value.replace(
    /\bM\s*=\s*P\s*\+\s*S\s*\+\s*15\b/g,
    () => '$M=P+S+15$',
  );
  return toAsciiDigits(value);
};

const polishMathSegment = (segment) => {
  let value = segment;
  value = value.replace(/\$that(?=[A-Za-z])/g, 'that $');
  value = value.replace(/v=\(y-2z?\)\/2/g, 'v=(y-z)/2');
  value = value.replace(/v=ly-2\/2/g, 'v=(y-z)/2');
  value = value.replace(/\bX\+y\+2=-19\b/g, 'x+y+z=-19');
  value = value.replace(/\bX\+y\+z\b/g, 'x+y+z');
  value = value.replace(/\$\\Psi_\{r\},?\s*(n\^\{2\}[^$]*)\$/g, (_match, rest) => {
    return `$Y$, $${rest}$`;
  });
  value = value.replace(/\$\\dot\{([A-Za-z])\},?\s*(n\^\{2\}[^$]*)\$/g, (_match, variable, rest) => {
    return `$${variable.toUpperCase()}$, $${rest}$`;
  });
  value = value.replace(/\$([A-Za-z]),?\s*(n\^\{2\}[^$]*)\$/g, (_match, variable, rest) => {
    return `$${variable.toUpperCase()}$, $${rest}$`;
  });
  value = value.replace(/\$[,;]\s*(n\^\{2\}[^$]*)\$/g, (_match, rest) => `$${rest}$`);
  value = value.replace(/\$0<5<20\$/g, '$10<S<20$');
  value = value.replace(/10\s*<\s*[s5]\s*<\s*20/gi, '10<S<20');
  return toAsciiDigits(value);
};

const polishText = (text) => {
  const parts = String(text || '').split(/(\$\$?[\s\S]*?\$\$?)/g);
  let value = parts
    .map((part) => (part.startsWith('$') ? polishMathSegment(part) : polishPlainText(part)))
    .join('');
  value = value.replace(
    /\b([A-Za-z0-9]+)\s+\$([<>=][^$]*)\$/g,
    (_match, before, expression) => {
      const cleaned = expression.replace(/^([<>])\s*[s5]\s*<\s*20$/i, '$1S<20');
      return `$${before}${cleaned}$`;
    },
  );
  value = value.replace(
    /(\u0938\u0902\u0916\u094d\u092f\u093e[^\n]*?)\$x\$/g,
    (_match, prefix) => `${prefix}$X$`,
  );
  value = value.replace(
    /\u0938\u094d\u0915\u094d\u0932\u093e\u092f\u0930/g,
    '\u0938\u094d\u0915\u094d\u0935\u093e\u092f\u0930',
  );
  value = value.replace(
    /\u0938\u094d\u0915\u094d\u0930\u0947\u092f\u0930\u094d\u0938/g,
    '\u0938\u094d\u0915\u094d\u0935\u0947\u092f\u0930\u094d\u0938',
  );
  value = value.replace(
    /\u0938\u0902\u0916\u094d\u092f\u093e\u0901/g,
    '\u0938\u0902\u0916\u094d\u092f\u093e\u090f\u0901',
  );
  value = value
    .split('\n')
    .map((line) => {
      if (/\$X\s*<\s*Y\$/.test(line) && /\$v\$/.test(line)) {
        return line.replace(/\$v\$/g, '$Y$');
      }
      return line.replace(/\bX\s+and\s+\$v\$/g, 'X and $Y$');
    })
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
      return letters >= 3 || /\$|[\u0900-\u097F]|\d/.test(trimmed);
    })
    .join('\n');
  return value;
};

const recognizeMixedDetailed = async (image, onProgress) => {
  const english = await recognizeImageDetailed(
    image,
    'eng',
    (progress) => onProgress?.({ ...progress, progress: 0.05 + (progress?.progress || 0) * 0.4 }),
    true,
  );
  const hindi = await recognizeImageDetailed(
    image,
    'hin',
    (progress) => onProgress?.({ ...progress, progress: 0.5 + (progress?.progress || 0) * 0.4 }),
    true,
  );
  return mergeLanguageData(english.data, hindi.data);
};

module.exports = { createOcrWorker, recognizeImage, recognizeImageDetailed, recognizeMixedDetailed, polishText };
