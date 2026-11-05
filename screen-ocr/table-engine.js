const sharp = require('sharp');
const { PSM } = require('tesseract.js');
const { createOcrWorker } = require('./ocr-engine');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const medianNumber = (values) => {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  return numbers[Math.floor(numbers.length / 2)];
};

const getWordBox = (word) => {
  const box = word?.bbox;
  if (!box) return null;
  const width = Number(box.x1) - Number(box.x0);
  const height = Number(box.y1) - Number(box.y0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    x0: Number(box.x0),
    y0: Number(box.y0),
    x1: Number(box.x1),
    y1: Number(box.y1),
    width,
    height,
  };
};

const extractWords = (data) => {
  const words = [];
  for (const block of data?.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          const text = String(word.text || '').trim();
          const box = getWordBox(word);
          if (!text || !box) continue;
          words.push({
            text,
            confidence: Number(word.confidence) || 0,
            ...box,
          });
        }
      }
    }
  }
  return words;
};

const filterLayoutWords = (words, width, height) => {
  return words.filter((word) => {
    if (!word.text || word.confidence < 8) return false;
    if (word.width > width * 0.55) return false;
    if (word.height > height * 0.32) return false;
    return true;
  });
};

const EDGE_THRESHOLD = 18;

const contentBounds = (data, width, height) => {
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const rowStart = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const offset = rowStart + x;
      const gx = Math.abs(data[offset + 1] - data[offset - 1]);
      const gy = Math.abs(data[offset + width] - data[offset - width]);
      if (gx <= EDGE_THRESHOLD && gy <= EDGE_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (left > right || top > bottom) return { left: 0, right: width - 1, top: 0, bottom: height - 1 };
  return { left, right, top, bottom };
};

// A table border runs the full extent of the table, so the share of that extent
// which is an edge is close to 1. Text glyphs only cover their own line boxes,
// so they score much lower. Coverage (rather than run length) is also immune to
// the interruptions where grid lines cross each other.
const edgeCoverage = (data, width, height, bounds, vertical) => {
  const scores = new Float32Array(vertical ? width : height);
  const { left, right, top, bottom } = bounds;
  const xStart = Math.max(1, left);
  const xEnd = Math.min(width - 2, right);
  const yStart = Math.max(1, top);
  const yEnd = Math.min(height - 2, bottom);

  if (vertical) {
    const span = Math.max(1, yEnd - yStart + 1);
    for (let x = xStart; x <= xEnd; x += 1) {
      let count = 0;
      for (let y = yStart; y <= yEnd; y += 1) {
        const offset = y * width + x;
        if (Math.abs(data[offset + 1] - data[offset - 1]) > EDGE_THRESHOLD) count += 1;
      }
      scores[x] = count / span;
    }
  } else {
    const span = Math.max(1, xEnd - xStart + 1);
    for (let y = yStart; y <= yEnd; y += 1) {
      let count = 0;
      const rowStart = y * width;
      for (let x = xStart; x <= xEnd; x += 1) {
        const offset = rowStart + x;
        if (Math.abs(data[offset + width] - data[offset - width]) > EDGE_THRESHOLD) count += 1;
      }
      scores[y] = count / span;
    }
  }
  return scores;
};

const findLineBands = (scores) => {
  const collect = (minimum) => {
    const bands = [];
    let current = null;
    for (let index = 0; index < scores.length; index += 1) {
      if (scores[index] >= minimum) {
        if (current) current.end = index;
        else current = { start: index, end: index };
      } else if (current && index - current.end > 1) {
        bands.push(current);
        current = null;
      }
    }
    if (current) bands.push(current);
    return bands;
  };
  let bands = collect(0.75);
  if (bands.length < 2) bands = collect(0.6);
  return bands.map((band) => ({ start: band.start, end: band.end, center: (band.start + band.end) / 2 }));
};

const mergeBands = (bands, minimumGap) => {
  const sorted = [...bands].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const band of sorted) {
    const last = merged[merged.length - 1];
    if (last && band.start - last.end <= minimumGap) {
      last.end = Math.max(last.end, band.end);
      last.center = (last.start + last.end) / 2;
    } else {
      merged.push({ ...band });
    }
  }
  return merged;
};

const toOriginal = (band, scale) => ({
  center: band.center / scale,
  start: Math.floor(band.start / scale),
  end: Math.ceil(band.end / scale),
});

const detectGrid = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const empty = { width, height, xLines: [], yLines: [], xBands: [], yBands: [] };
  if (width < 16 || height < 16) return empty;

  const maxWidth = 2000;
  const scale = width > maxWidth ? maxWidth / width : 1;
  const { data, info } =
    scale < 1
      ? await sharp(buffer).resize({ width: maxWidth, kernel: 'lanczos3' }).greyscale().raw().toBuffer({ resolveWithObject: true })
      : await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const sampleWidth = info.width;
  const sampleHeight = info.height;
  if (sampleWidth < 8 || sampleHeight < 8) return empty;

  const bounds = contentBounds(data, sampleWidth, sampleHeight);
  const xScores = edgeCoverage(data, sampleWidth, sampleHeight, bounds, true);
  const yScores = edgeCoverage(data, sampleWidth, sampleHeight, bounds, false);

  // A stroke or gap yields an edge on each side; they belong to one table line.
  const minimumGap = clamp(Math.round(Math.min(width, height) * 0.03), 4, 14);
  const xMapped = mergeBands(findLineBands(xScores).map((band) => toOriginal(band, scale)), minimumGap);
  const yMapped = mergeBands(findLineBands(yScores).map((band) => toOriginal(band, scale)), minimumGap);

  return {
    width,
    height,
    xLines: xMapped.map((band) => band.center),
    yLines: yMapped.map((band) => band.center),
    xBands: xMapped.map((band) => ({ start: band.start, end: band.end })),
    yBands: yMapped.map((band) => ({ start: band.start, end: band.end })),
  };
};

// Lines are only meaningful where the table's text is. Photographs, window
// chrome and drop shadows around the table produce long edges too, and keeping
// them would add empty or garbage rows and columns.
const clampGridToText = (grid, textBox, width, height) => {
  if (!textBox) return grid;
  const padX = Math.max(8, Math.round(width * 0.03));
  const padY = Math.max(8, Math.round(height * 0.03));
  const left = textBox.x0 - padX;
  const right = textBox.x1 + padX;
  const top = textBox.y0 - padY;
  const bottom = textBox.y1 + padY;

  const xBands = grid.xBands.filter((band) => band.center >= left && band.center <= right);
  const yBands = grid.yBands.filter((band) => band.center >= top && band.center <= bottom);
  if (xBands.length < 2 || yBands.length < 2) return grid;

  const closeAt = (bands, limit) => {
    const padded = [...bands];
    if (padded[0].center > limit.start) padded.unshift({ start: Math.max(0, limit.start), end: Math.max(0, limit.start) });
    if (padded[padded.length - 1].center < limit.end) {
      padded.push({ start: Math.min(limit.max, limit.end), end: Math.min(limit.max, limit.end) });
    }
    return padded.map((band) => ({ ...band, center: (band.start + band.end) / 2 }));
  };

  const xFinal = closeAt(xBands, { start: Math.round(left), end: Math.round(right), max: width - 1 });
  const yFinal = closeAt(yBands, { start: Math.round(top), end: Math.round(bottom), max: height - 1 });

  return {
    ...grid,
    xLines: xFinal.map((band) => band.center),
    yLines: yFinal.map((band) => band.center),
    xBands: xFinal.map((band) => ({ start: Math.round(band.start), end: Math.round(band.end) })),
    yBands: yFinal.map((band) => ({ start: Math.round(band.start), end: Math.round(band.end) })),
  };
};

const removeGridLines = async (buffer, grid) => {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const rowBytes = info.width * channels;

  for (const band of grid.yBands) {
    const y0 = clamp(Math.floor(band.start), 0, info.height - 1);
    const y1 = clamp(Math.ceil(band.end), 0, info.height - 1);
    for (let y = y0; y <= y1; y += 1) data.fill(255, y * rowBytes, y * rowBytes + rowBytes);
  }

  for (const band of grid.xBands) {
    const x0 = clamp(Math.floor(band.start), 0, info.width - 1);
    const x1 = clamp(Math.ceil(band.end), 0, info.width - 1);
    for (let x = x0; x <= x1; x += 1) {
      for (let y = 0; y < info.height; y += 1) {
        const offset = y * rowBytes + x * channels;
        for (let channel = 0; channel < channels; channel += 1) data[offset + channel] = 255;
      }
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels } }).png().toBuffer();
};

const groupWordsIntoRows = (words) => {
  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  if (!sorted.length) return [];
  const tolerance = Math.max(5, medianNumber(sorted.map((word) => word.height)) * 0.6);
  const rows = [];

  for (const word of sorted) {
    const center = (word.y0 + word.y1) / 2;
    const last = rows[rows.length - 1];
    if (last && Math.abs(center - last.center) <= tolerance) {
      last.words.push(word);
      last.center = last.words.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / last.words.length;
      last.top = Math.min(last.top, word.y0);
      last.bottom = Math.max(last.bottom, word.y1);
    } else {
      rows.push({ words: [word], center, top: word.y0, bottom: word.y1 });
    }
  }

  rows.forEach((row, index) => {
    for (const word of row.words) word.rowIndex = index;
  });
  return rows;
};

const isDataNumber = (text) => {
  const value = String(text || '').replace(/\s+/g, '');
  return (
    /^[₹$€]?[+-]?(?:\d+(?:[.,]\d+)?|\.\d+)%?$/.test(value) ||
    /^\d+[:/]\d+$/.test(value) ||
    /^\(?[A-Za-z]?[:/][A-Za-z0-9]+\)?$/.test(value)
  );
};

const layoutFromWords = (words, width, height) => {
  const layoutWords = filterLayoutWords(words, width, height);
  if (layoutWords.length < 4) return null;

  const rows = groupWordsIntoRows(layoutWords);
  if (!rows.length) return null;
  const firstBodyIndex = rows.findIndex(
    (row) => row.words.length >= 2 && row.words.some((word) => isDataNumber(word.text)),
  );
  if (firstBodyIndex < 0) return null;

  // Without borders, columns have to be inferred. Group words by left edge and
  // keep the groups that recur across rows: a multi-word header stays in one
  // cell, while true columns line up vertically.
  const wordHeight = medianNumber(layoutWords.map((word) => word.height));
  const tolerance = Math.max(6, wordHeight * 0.9);
  const ordered = [...layoutWords].sort((a, b) => a.x0 - b.x0);
  const clusters = [];
  for (const word of ordered) {
    const last = clusters[clusters.length - 1];
    if (last && word.x0 - last.x0 <= tolerance) {
      last.x0 = Math.min(last.x0, word.x0);
      last.x1 = Math.max(last.x1, word.x1);
      last.rows.add(word.rowIndex);
      last.words.push(word);
    } else {
      clusters.push({ x0: word.x0, x1: word.x1, rows: new Set([word.rowIndex]), words: [word] });
    }
  }

  const minimumRows = Math.max(2, Math.ceil(rows.length * 0.4));
  const anchors = clusters.filter((cluster) => cluster.rows.size >= minimumRows);
  if (anchors.length < 2) return null;

  const extents = anchors.map((anchor) => ({ x0: anchor.x0, x1: anchor.x1 }));
  const anchorWords = new Set(anchors);
  for (const cluster of clusters) {
    if (anchorWords.has(cluster)) continue;
    for (const word of cluster.words) {
      let best = 0;
      let bestDistance = Infinity;
      extents.forEach((extent, index) => {
        const distance = word.x0 < extent.x0 ? extent.x0 - word.x0 : Math.max(0, word.x0 - extent.x1);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      extents[best].x0 = Math.min(extents[best].x0, word.x0);
      extents[best].x1 = Math.max(extents[best].x1, word.x1);
    }
  }

  const columnLines = [Math.max(0, Math.round(extents[0].x0 - 6))];
  for (let index = 1; index < extents.length; index += 1) {
    columnLines.push(Math.round((extents[index - 1].x1 + extents[index].x0) / 2));
  }
  columnLines.push(Math.min(width, Math.round(extents[extents.length - 1].x1 + 6)));
  if (columnLines.length < 3) return null;

  const bodyRows = rows.slice(firstBodyIndex);
  const headerTop = Math.max(0, Math.min(...layoutWords.map((word) => word.y0)) - 8);
  const firstBodyTop = bodyRows[0].top;
  const headerBottom = Math.max(headerTop + 4, firstBodyTop - 3);
  const tableBottom = Math.min(height, Math.max(...layoutWords.map((word) => word.y1)) + 8);
  const rowLines = [headerBottom];
  for (let index = 1; index < bodyRows.length; index += 1) {
    rowLines.push(Math.round((bodyRows[index - 1].bottom + bodyRows[index].top) / 2));
  }
  rowLines.push(tableBottom);

  return {
    columnLines,
    header: { top: headerTop, bottom: headerBottom },
    rowLines,
    method: 'layout',
  };
};

const dedupeLines = (lines, minimumGap = 5) => {
  const sorted = [...lines].sort((a, b) => a - b);
  const kept = [];
  for (const line of sorted) {
    if (!kept.length || line - kept[kept.length - 1] >= minimumGap) kept.push(line);
  }
  return kept;
};

const layoutFromGrid = (grid, words) => {
  const { xLines, yLines, width, height } = grid;
  if (xLines.length < 2 || yLines.length < 2) return null;

  const layoutWords = filterLayoutWords(words, width, height);
  const hasWords = layoutWords.length > 0;
  const minWordY = hasWords ? Math.min(...layoutWords.map((word) => word.y0)) : 0;
  const maxWordY = hasWords ? Math.max(...layoutWords.map((word) => word.y1)) : height;
  const topLine = yLines.find((line) => line <= minWordY + 10);
  const tableTop = hasWords ? (topLine ?? Math.max(0, minWordY - 10)) : yLines[0];
  const lastLine = yLines[yLines.length - 1];
  const tableBottom = !hasWords || lastLine >= maxWordY - 12 ? lastLine : Math.min(height, maxWordY + 12);

  const innerLines = dedupeLines(
    yLines.filter((line) => line > tableTop + 3 && line < tableBottom - 3),
  );
  if (!innerLines.length) return null;

  const columnLines = dedupeLines(xLines);
  if (columnLines.length < 2) return null;
  columnLines[0] = clamp(columnLines[0], 0, width);
  columnLines[columnLines.length - 1] = clamp(columnLines[columnLines.length - 1], 0, width);
  if (columnLines[columnLines.length - 1] <= columnLines[0] + 4) return null;

  return {
    columnLines,
    header: { top: tableTop, bottom: innerLines[0] },
    rowLines: [...innerLines, tableBottom],
    method: 'grid',
  };
};

const normalizeCellText = (text) => {
  const value = String(text || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/[\u00a0\t ]+/g, ' ')
    .replace(/^[|�]+|[|�]+$/g, '')
    .trim();
  if (/^S[O0]%$/.test(value)) return '50%';
  if (/^S[1-9]\d?%$/.test(value)) return `5${value.slice(1)}`;
  return value.replace(/^(\d+)[OQ]([A-Za-z%])$/, '$10$2').replace(/^(\d+)[OQ](\d)/, '$10$2');
};

const cellTextScore = (text, confidence) => {
  const value = normalizeCellText(text);
  if (!value) return -Infinity;
  let score = Math.min(100, Math.max(0, Number(confidence) || 0)) / 40 + 1;
  if (/[|�]/.test(value)) score -= 4;
  if (/^\d+(?:[.,]\d+)?%$/.test(value)) score += 3;
  else if (/^\(?[A-Za-z0-9+\-./]+\s*:\s*[A-Za-z0-9+\-./]+\)?$/.test(value)) score += 3;
  else if (/^\d+(?:[.,]\d+)?$/.test(value)) score += 2;
  else if (/^[A-Za-z]{1,2}$/.test(value)) score += 1;
  else if (/\d/.test(value) && /[A-Za-z]/.test(value)) score -= 1;
  if (/^\d[OQ][A-Za-z%]$/.test(value)) score -= 2;
  return score;
};

const headerTextScore = (text, confidence) => {
  const value = normalizeCellText(text);
  if (!value) return -Infinity;
  let score = Math.min(100, Math.max(0, Number(confidence) || 0)) / 10;
  score += (value.match(/[A-Za-z]/g) || []).length;
  if (/[|�]/.test(value)) score -= 10;
  return score;
};

const orderWordsByLine = (words) => {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines = [];
  for (const word of sorted) {
    let line = lines[lines.length - 1];
    const tolerance = line ? Math.max(3, Math.min(word.height, line.height) * 0.5) : 0;
    if (!line || Math.abs(word.y0 - line.y0) > tolerance) {
      line = { y0: word.y0, height: word.height, words: [] };
      lines.push(line);
    }
    line.words.push(word);
    line.height = Math.max(line.height, word.height);
  }
  return lines.flatMap((line) => line.words.sort((a, b) => a.x0 - b.x0));
};

const textFromOcrWords = (data, normalizeOrder) => {
  const words = extractWords(data);
  if (!words.length) return '';
  const ordered = normalizeOrder ? orderWordsByLine(words) : words;
  return normalizeCellText(ordered.map((word) => word.text).join(' '));
};

const wordsInRect = (words, rect) => {
  return words
    .filter((word) => {
      const cx = (word.x0 + word.x1) / 2;
      const cy = (word.y0 + word.y1) / 2;
      return cx >= rect.left && cx <= rect.left + rect.width && cy >= rect.top && cy <= rect.top + rect.height;
    })
    .sort((a, b) => {
      const lineDelta = a.y0 - b.y0;
      if (Math.abs(lineDelta) > Math.max(a.height, b.height) * 0.7) return lineDelta;
      return a.x0 - b.x0;
    });
};

const cellTextFromWords = (words, rect) => {
  return normalizeCellText(wordsInRect(words, rect).map((word) => word.text).join(' '));
};

const preprocessCell = (buffer, rect, isHeader) => {
  const inset = rect.width < 12 || rect.height < 12 ? 1 : 2;
  const left = Math.round(rect.left + inset);
  const top = Math.round(rect.top + inset);
  const width = Math.max(2, Math.round(rect.width - inset * 2));
  const height = Math.max(2, Math.round(rect.height - inset * 2));
  const scale = isHeader ? 2 : 3;
  let image = sharp(buffer).extract({ left, top, width, height }).greyscale();
  if (scale !== 1) {
    image = image.resize({
      width: Math.max(2, Math.round(width * scale)),
      height: Math.max(2, Math.round(height * scale)),
      kernel: 'lanczos3',
    });
  }
  return image.png().toBuffer();
};

const recognizeCell = async (worker, buffer, words, rect, isHeader) => {
  if (rect.width < 3 || rect.height < 3) return '';
  const scoreText = isHeader ? headerTextScore : cellTextScore;
  let bestText = '';
  let bestScore = -Infinity;

  try {
    const image = await preprocessCell(buffer, rect, isHeader);
    const result = await worker.recognize(image, {}, { text: true, blocks: true });
    const text = textFromOcrWords(result.data, isHeader) || normalizeCellText(result.data.text);
    const score = scoreText(text, result.data.confidence) + (isHeader ? 2 : 0);
    if (score > bestScore) {
      bestText = text;
      bestScore = score;
    }
  } catch {}

  const cellWords = wordsInRect(words, rect);
  if (cellWords.length) {
    const fallback = cellTextFromWords(cellWords, rect);
    const confidence = cellWords.reduce((sum, word) => sum + word.confidence, 0) / cellWords.length;
    const score = scoreText(fallback, confidence);
    if (score > bestScore) bestText = fallback;
  }
  return bestText;
};

const escapeCell = (text) => String(text || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

const toMarkdown = (rows) => {
  if (!rows.length) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const cells = [...row];
    while (cells.length < columnCount) cells.push('');
    return cells;
  });
  const header = padded[0].map(escapeCell);
  const separator = Array.from({ length: columnCount }, () => '---');
  const body = padded.slice(1).map((row) => row.map(escapeCell));
  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
};

const normalizeRowLabels = (rows) => {
  if (rows.length < 4) return rows;
  const body = rows.slice(1);
  const labels = body.map((row) => String(row[0] || '').trim());
  const first = labels[0].match(/^([A-Za-z])$/);
  if (!first) return rows;

  const firstCode = first[0].toUpperCase().charCodeAt(0);
  if (firstCode < 65 || firstCode + body.length - 1 > 90) return rows;

  let matches = 0;
  labels.forEach((label, index) => {
    const expected = String.fromCharCode(firstCode + index);
    if (label.toUpperCase().startsWith(expected)) matches += 1;
  });
  if (matches < Math.max(2, Math.ceil(body.length * 0.4))) return rows;

  body.forEach((row, index) => {
    const expected = String.fromCharCode(firstCode + index);
    const current = String(row[0] || '').trim();
    if (/^[A-Z]$/.test(current)) return;
    if (/^[\x20-\x7E]{1,2}$/.test(current)) row[0] = expected;
  });
  return rows;
};

const toTsv = (rows) => {
  if (!rows.length) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  return rows
    .map((row) => {
      const cells = [...row];
      while (cells.length < columnCount) cells.push('');
      return cells.map((cell) => String(cell || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t');
    })
    .join('\n');
};

const buildRects = (layout) => {
  const { columnLines, header, rowLines } = layout;
  const columnCount = columnLines.length - 1;
  if (columnCount < 2) return null;

  const headerCells = [];
  for (let column = 0; column < columnCount; column += 1) {
    headerCells.push({
      left: columnLines[column],
      top: header.top,
      width: columnLines[column + 1] - columnLines[column],
      height: header.bottom - header.top,
    });
  }

  const bodyCells = [];
  for (let row = 0; row < rowLines.length - 1; row += 1) {
    const cells = [];
    for (let column = 0; column < columnCount; column += 1) {
      cells.push({
        left: columnLines[column],
        top: rowLines[row],
        width: columnLines[column + 1] - columnLines[column],
        height: rowLines[row + 1] - rowLines[row],
      });
    }
    bodyCells.push(cells);
  }

  if (!bodyCells.length) return null;
  return { headerCells, bodyCells };
};

const recognizeTable = async (buffer, options = {}) => {
  const language = options.language || 'eng';
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const report = (status, progress) => {
    onProgress?.({ status, progress: clamp(Number(progress) || 0, 0, 1) });
  };

  report('Preparing table image', 0.01);
  let oriented;
  try {
    oriented = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).png().toBuffer();
  } catch {
    oriented = buffer;
  }

  let loadingWorker = true;
  const worker = await createOcrWorker(language, (message) => {
    if (!loadingWorker) return;
    const value = typeof message?.progress === 'number' ? message.progress : 0;
    report(message?.status || 'Loading OCR engine', 0.02 + value * 0.1);
  });
  loadingWorker = false;

  try {
    report('Detecting table borders', 0.13);
    const metadata = await sharp(oriented).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const grid = await detectGrid(oriented);

    let tableImage = oriented;
    if (grid.xBands.length >= 2 && grid.yBands.length >= 2) {
      report('Clearing table borders', 0.2);
      tableImage = await removeGridLines(oriented, grid);
    }

    report('Reading table layout', 0.26);
    const full = await worker.recognize(tableImage, {}, { text: true, blocks: true });
    const words = filterLayoutWords(extractWords(full.data), width, height);
    const reliable = words.filter((word) => word.confidence >= 55);
    const boxWords = reliable.length ? reliable : words;
    const textBox = boxWords.length
      ? {
          x0: Math.min(...boxWords.map((word) => word.x0)),
          x1: Math.max(...boxWords.map((word) => word.x1)),
          y0: Math.min(...boxWords.map((word) => word.y0)),
          y1: Math.max(...boxWords.map((word) => word.y1)),
        }
      : null;
    const trimmed = clampGridToText(grid, textBox, width, height);

    let layout = layoutFromGrid(trimmed, words);
    let warning = '';
    if (!layout) {
      layout = layoutFromWords(words, width, height);
      warning = 'Table borders were not detected; using text layout reconstruction.';
    }
    if (!layout) {
      return {
        ok: false,
        reason: words.length
          ? 'Could not detect a table grid in this image.'
          : 'Not enough text was found to reconstruct a table.',
      };
    }

    const rects = buildRects(layout);
    if (!rects) {
      return { ok: false, reason: 'Could not detect table rows and columns.' };
    }

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });

    const totalCells = rects.headerCells.length + rects.bodyCells.reduce((sum, row) => sum + row.length, 0);
    let completed = 0;
    const rows = [];

    const header = [];
    for (const rect of rects.headerCells) {
      report(`Reading table header ${completed + 1}/${totalCells}`, 0.38 + (completed / totalCells) * 0.55);
      header.push(await recognizeCell(worker, tableImage, words, rect, true));
      completed += 1;
    }
    rows.push(header);

    for (const rectRow of rects.bodyCells) {
      const row = [];
      for (const rect of rectRow) {
        report(`Reading table cell ${completed + 1}/${totalCells}`, 0.38 + (completed / totalCells) * 0.55);
        row.push(await recognizeCell(worker, tableImage, words, rect, false));
        completed += 1;
      }
      rows.push(row);
    }

    const columnCount = rects.headerCells.length;
    const bodyCount = rects.bodyCells.length;
    if (columnCount < 2 || bodyCount < 1) {
      return { ok: false, reason: 'The detected table did not contain enough rows or columns.' };
    }

    normalizeRowLabels(rows);
    const markdown = toMarkdown(rows);
    const tsv = toTsv(rows);
    report('Table ready', 1);
    return {
      ok: true,
      text: markdown,
      table: {
        markdown,
        tsv,
        rows: rows.length,
        columns: columnCount,
        method: layout.method,
      },
      warning,
    };
  } finally {
    await worker.terminate();
  }
};

module.exports = { recognizeTable };
