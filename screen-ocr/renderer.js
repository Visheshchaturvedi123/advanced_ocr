const api = window.screenOcr;
const $ = (id) => document.getElementById(id);

const captureButton = $('capture');
const repeatButton = $('repeat');
const openImageButton = $('open-image');
const pasteImageButton = $('paste-image');
const dropzone = $('dropzone');
const preview = $('preview');
const empty = $('empty');
const captureMeta = $('capture-meta');
const language = $('language');
const math = $('math');
const tableMode = $('table-mode');
const tableFormat = $('table-format');
const tableFormatField = $('table-format-field');
const autoCopy = $('auto-copy');
const cleanLines = $('clean-lines');
const runButton = $('run');
const statusLabel = $('status');
const percentLabel = $('percent');
const progressBar = $('progress');
const result = $('result');
const wordCount = $('word-count');
const copyButton = $('copy');
const saveTxtButton = $('save-txt');
const saveMdButton = $('save-md');
const saveTsvButton = $('save-tsv');
const clearResultButton = $('clear-result');
const clearHistoryButton = $('clear-history');
const historyList = $('history');
const historyEmpty = $('history-empty');
const toast = $('toast');
const hotkeyLabel = $('hotkey');
const resultNote = $('result-note');

const SETTINGS_KEY = 'brahma-screen-ocr-settings-v1';
const HISTORY_KEY = 'brahma-screen-ocr-history-v1';
const MAX_HISTORY = 40;

let currentImage = '';
let sourceLabel = '';
let busy = false;
let history = [];
let toastTimer = 0;
let lastTable = null;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function showToast(message, kind = '') {
  toast.textContent = message;
  toast.className = `toast ${kind}`.trim();
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function updateCounts() {
  const text = result.value;
  const characters = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${characters.toLocaleString()} characters · ${words.toLocaleString()} words`;
  const hasText = Boolean(text.trim());
  copyButton.disabled = !hasText;
  saveTxtButton.disabled = !hasText;
  saveMdButton.disabled = !hasText;
  saveTsvButton.disabled = !hasText || !lastTable;
  saveTsvButton.hidden = !tableMode.checked;
}

function setResult(text) {
  result.value = text;
  updateCounts();
}

function updateTableUi() {
  const active = tableMode.checked;
  tableFormatField.hidden = !active;
  tableFormat.disabled = busy || !active;
  math.disabled = busy || active;
  if (active) math.checked = false;
  if (saveTsvButton) {
    saveTsvButton.hidden = !active;
    saveTsvButton.disabled = busy || !lastTable || !result.value.trim();
  }
}

function setBusy(value) {
  busy = value;
  runButton.disabled = value || !currentImage;
  captureButton.disabled = value;
  repeatButton.disabled = value;
  openImageButton.disabled = value;
  pasteImageButton.disabled = value;
  language.disabled = value;
  tableMode.disabled = value;
  tableFormat.disabled = value || !tableMode.checked;
  math.disabled = value || tableMode.checked;
  document.body.classList.toggle('busy', value);
}

function setProgress(progress, status) {
  const safe = Math.max(0, Math.min(1, Number(progress) || 0));
  progressBar.style.width = `${Math.round(safe * 100)}%`;
  percentLabel.textContent = `${Math.round(safe * 100)}%`;
  if (status) statusLabel.textContent = status;
}

function setImage(dataUrl, label) {
  currentImage = dataUrl;
  sourceLabel = label || 'Captured screen';
  lastTable = null;
  preview.src = dataUrl;
  preview.hidden = false;
  empty.hidden = true;
  captureMeta.textContent = sourceLabel;
  runButton.disabled = !dataUrl || busy;
}

function saveSettings() {
  writeJson(SETTINGS_KEY, {
    language: language.value,
    math: math.checked,
    tableMode: tableMode.checked,
    tableFormat: tableFormat.value,
    autoCopy: autoCopy.checked,
    cleanLines: cleanLines.checked,
  });
}

function cleanText(text) {
  if (!cleanLines.checked) return text;
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderHistory() {
  historyList.textContent = '';
  historyEmpty.hidden = history.length > 0;
  if (!history.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'history-empty';
    placeholder.textContent = 'Recognized text will appear here.';
    historyList.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of history) {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.dataset.id = item.id;

    const top = document.createElement('div');
    top.className = 'history-top';
    const lang = document.createElement('span');
    lang.textContent = item.language === 'hin' ? 'Hindi' : item.language === 'eng+hin' ? 'Mixed' : 'English';
    const time = document.createElement('span');
    time.textContent = new Date(item.at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    top.append(lang, time);

    const previewText = document.createElement('div');
    previewText.className = 'history-text';
    previewText.textContent = item.text.replace(/\s+/g, ' ').slice(0, 160) || '(empty)';

    button.append(top, previewText);
    fragment.appendChild(button);
  }
  historyList.appendChild(fragment);
}

function addHistory(text, lang) {
  if (!text.trim()) return;
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    language: lang,
    text,
  });
  history = history.slice(0, MAX_HISTORY);
  writeJson(HISTORY_KEY, history);
  renderHistory();
}

async function copyCurrentText(silent = false) {
  const text = result.value.trim();
  if (!text) return false;
  await api.copyText(text);
  if (!silent) showToast('Copied to clipboard.', 'success');
  return true;
}

async function runOcr() {
  if (!currentImage || busy) return;
  const lang = language.value;
  const useTable = tableMode.checked;
  const useMath = !useTable && math.checked;
  const requestedFormat = tableFormat.value === 'tsv' ? 'tsv' : 'markdown';
  setBusy(true);
  setProgress(0, useTable ? 'Starting table extraction' : 'Starting OCR');
  resultNote.textContent = useTable
    ? 'Detecting table borders, extracting cells, and preserving rows and columns. No network or cloud service is used.'
    : useMath
      ? 'Working with bundled text and equation models. No network or cloud service is used.'
      : 'Working with the bundled Brahma OCR assets. No network or external OCR service is used.';

  try {
    const response = await api.ocr(currentImage, lang, useMath, useTable);
    if (!response?.ok) {
      statusLabel.textContent = 'OCR failed';
      setProgress(0, 'OCR failed');
      showToast(response?.error || 'OCR failed.', 'error');
      return;
    }

    if (response.table) {
      lastTable = response.table;
      const text = String(response.table[requestedFormat] || '').trim();
      setResult(text);
      if (!text) {
        statusLabel.textContent = 'No table found';
        setProgress(1, 'No table found');
        showToast('The table was detected, but no cell text could be recognized.', 'error');
        return;
      }
      const formatLabel = requestedFormat === 'tsv' ? 'TSV' : 'Markdown';
      addHistory(text, response.language || lang);
      setProgress(1, 'Table complete');
      resultNote.textContent = [
        `Table mode: ${response.table.rows} rows x ${response.table.columns} columns as ${formatLabel}.`,
        response.table.method === 'layout' ? 'Borders were not detected; layout was reconstructed from text.' : '',
        response.warning || '',
      ].filter(Boolean).join(' ');
      const copied = autoCopy.checked ? ' copied to clipboard' : '';
      showToast(`Table extracted: ${response.table.rows} rows x ${response.table.columns} columns${copied}.`, 'success');
      if (autoCopy.checked) await copyCurrentText(true);
      return;
    }

    lastTable = null;
    const text = cleanText(response.text || '');
    setResult(text);
    if (!text) {
      statusLabel.textContent = 'No text found';
      setProgress(1, 'No text found');
      showToast('No text was recognized. Try a tighter crop with higher contrast.', 'error');
      return;
    }

    addHistory(text, response.language || lang);
    setProgress(1, 'OCR complete');
    resultNote.textContent =
      response.warning ||
      (useMath
        ? 'Tesseract text plus local equation recognition. Inline math uses $...$, display math uses $$...$$.'
        : 'Same Tesseract.js LSTM engine used by the Brahma extension.');
    const copied = autoCopy.checked ? ' copied to clipboard' : '';
    const warning = response.warning ? ` ${response.warning}` : '';
    showToast(`OCR complete: ${text.length.toLocaleString()} characters${copied}.${warning}`, response.warning ? 'error' : 'success');
    if (autoCopy.checked) await copyCurrentText(true);
  } catch (error) {
    statusLabel.textContent = 'OCR failed';
    showToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    setBusy(false);
    updateCounts();
  }
}

captureButton.addEventListener('click', () => api.capture());
repeatButton.addEventListener('click', () => api.repeat());
runButton.addEventListener('click', runOcr);

openImageButton.addEventListener('click', async () => {
  const response = await api.openImage();
  if (!response?.ok) {
    if (!response?.canceled) showToast(response?.error || 'Could not open that image.', 'error');
    return;
  }
  setImage(response.dataUrl, response.name || 'Opened image');
  setResult('');
  await runOcr();
});

pasteImageButton.addEventListener('click', async () => {
  const response = await api.readClipboardImage();
  if (!response?.ok) {
    showToast('The clipboard does not contain an image.', 'error');
    return;
  }
  setImage(response.dataUrl, 'Clipboard image');
  setResult('');
  await runOcr();
});

copyButton.addEventListener('click', () => {
  copyCurrentText().catch((error) => showToast(String(error), 'error'));
});

saveTxtButton.addEventListener('click', async () => {
  const response = await api.saveText(result.value, 'txt');
  if (response?.ok) showToast(`Saved to ${response.path}`, 'success');
  else if (!response?.canceled) showToast(response?.error || 'Could not save the file.', 'error');
});

saveMdButton.addEventListener('click', async () => {
  const response = await api.saveText(result.value, 'md');
  if (response?.ok) showToast(`Saved to ${response.path}`, 'success');
  else if (!response?.canceled) showToast(response?.error || 'Could not save the file.', 'error');
});

saveTsvButton.addEventListener('click', async () => {
  if (!lastTable) return;
  const response = await api.saveText(lastTable.tsv, 'tsv');
  if (response?.ok) showToast(`Saved to ${response.path}`, 'success');
  else if (!response?.canceled) showToast(response?.error || 'Could not save the file.', 'error');
});

clearResultButton.addEventListener('click', () => {
  lastTable = null;
  setResult('');
  statusLabel.textContent = 'Ready';
  setProgress(0, 'Ready');
});

clearHistoryButton.addEventListener('click', () => {
  history = [];
  writeJson(HISTORY_KEY, []);
  renderHistory();
  showToast('History cleared.');
});

historyList.addEventListener('click', (event) => {
  const button = event.target.closest('.history-item');
  if (!button) return;
  const item = history.find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  lastTable = null;
  setResult(item.text);
  statusLabel.textContent = 'Restored from history';
  showToast('Restored OCR text from history.');
});

result.addEventListener('input', updateCounts);

result.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    runOcr();
  }
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', (event) => {
  if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Drop a PNG, JPG, WEBP, BMP, or GIF image.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    setImage(String(reader.result || ''), file.name || 'Dropped image');
    setResult('');
    await runOcr();
  };
  reader.onerror = () => showToast('Could not read that image.', 'error');
  reader.readAsDataURL(file);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !toast.hidden) {
    toast.hidden = true;
  }
});

if (!api) {
  showToast('This window must be opened through the Brahma Screen OCR Electron app.', 'error');
} else {
  api.onCapture((payload) => {
    if (payload?.error) {
      statusLabel.textContent = 'Capture failed';
      showToast(payload.error, 'error');
      return;
    }
    if (!payload?.dataUrl) return;
    const label = `${payload.width} x ${payload.height}${payload.display?.label ? ` · ${payload.display.label}` : ''}`;
    setImage(payload.dataUrl, label);
    setResult('');
    runOcr();
  });

  api.onProgress((progress) => {
    if (!busy) return;
    const status = progress?.status ? `${progress.status.charAt(0).toUpperCase()}${progress.status.slice(1)}` : 'Working';
    setProgress(progress?.progress || 0, status);
  });

  api.info().then((info) => {
    if (!info) return;
    const hotkey = info.hotkey.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ');
    hotkeyLabel.textContent = hotkey;
    if (!info.hotkeyRegistered) {
      showToast(`Global shortcut ${hotkey} is already in use. Use the Capture button.`, 'error');
    }
  }).catch(() => {});
}

const saved = readJson(SETTINGS_KEY, {});
language.value = ['eng', 'hin', 'eng+hin'].includes(saved.language) ? saved.language : 'eng';
math.checked = Boolean(saved.math);
tableMode.checked = Boolean(saved.tableMode);
tableFormat.value = saved.tableFormat === 'tsv' ? 'tsv' : 'markdown';
autoCopy.checked = Boolean(saved.autoCopy);
cleanLines.checked = Boolean(saved.cleanLines);

language.addEventListener('change', saveSettings);
math.addEventListener('change', saveSettings);
autoCopy.addEventListener('change', saveSettings);
cleanLines.addEventListener('change', saveSettings);
tableMode.addEventListener('change', () => {
  if (tableMode.checked) math.checked = false;
  saveSettings();
  updateTableUi();
  updateCounts();
});
tableFormat.addEventListener('change', () => {
  saveSettings();
  if (!busy && lastTable) {
    setResult(String(lastTable[tableFormat.value] || ''));
    resultNote.textContent = `Table mode: ${lastTable.rows} rows x ${lastTable.columns} columns as ${
      tableFormat.value === 'tsv' ? 'TSV' : 'Markdown'
    }.`;
  }
});
updateTableUi();

history = readJson(HISTORY_KEY, []);
if (!Array.isArray(history)) history = [];
history = history.filter((item) => item && typeof item.text === 'string' && item.id && item.at).slice(0, MAX_HISTORY);
renderHistory();
updateCounts();
