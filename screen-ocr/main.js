const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, clipboard, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { recognizeImageDetailed, recognizeMixedDetailed, polishText } = require('./ocr-engine');

let mathEngine = null;
let tableEngine = null;
function getMathEngine() {
  if (!mathEngine) mathEngine = require('./math-engine');
  return mathEngine;
}
function getTableEngine() {
  if (!tableEngine) tableEngine = require('./table-engine');
  return tableEngine;
}

app.setName('Brahma Screen OCR');
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Brahma Screen OCR Data'));
}
if (process.platform === 'win32') app.setAppUserModelId('com.brahma.screenocr');

const HOTKEY = 'CommandOrControl+Shift+O';
const ICON = path.join(__dirname, 'icon128.png');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let resultWindow = null;
let overlayWindow = null;
let overlayDisplay = null;
let hotkeyRegistered = false;
let lastRegion = null;
let lastCapture = null;
let resultWasVisible = false;
let resultWasMinimized = false;

function createResultWindow() {
  if (resultWindow && !resultWindow.isDestroyed()) return resultWindow;

  resultWindow = new BrowserWindow({
    width: 1080,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: '#0b0d10',
    title: 'Brahma Screen OCR',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  resultWindow.loadFile(path.join(__dirname, 'index.html'));
  resultWindow.once('ready-to-show', () => {
    resultWindow.show();
    resultWindow.focus();
  });
  resultWindow.on('closed', () => {
    resultWindow = null;
  });
  return resultWindow;
}

function sendToResult(channel, payload) {
  const win = createResultWindow();
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return;
      win.webContents.send(channel, payload);
    });
  } else {
    win.webContents.send(channel, payload);
  }
}

function showError(message) {
  sendToResult('capture:result', { error: message });
  const win = createResultWindow();
  resultWasVisible = false;
  resultWasMinimized = false;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function hideResultForCapture() {
  resultWasVisible = Boolean(resultWindow && !resultWindow.isDestroyed());
  resultWasMinimized = Boolean(resultWasVisible && resultWindow.isMinimized());
  if (resultWasVisible) resultWindow.hide();
}

function restoreResultWindow() {
  if (resultWasVisible && resultWindow && !resultWindow.isDestroyed()) {
    if (resultWasMinimized) resultWindow.restore();
    resultWindow.show();
    resultWindow.focus();
  }
  resultWasVisible = false;
  resultWasMinimized = false;
}

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  overlayWindow = null;
  overlayDisplay = null;
}

function openCaptureOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }

  hideResultForCapture();
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  overlayDisplay = display;

  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.once('ready-to-show', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.show();
    overlayWindow.focus();
  });
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    overlayDisplay = null;
  });
  overlayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      cancelCapture();
    }
  });
}

function cancelCapture() {
  closeOverlay();
  restoreResultWindow();
}

async function captureRegion(rect) {
  const display = overlayDisplay || screen.getPrimaryDisplay();
  const selected = {
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };

  if (selected.width < 8 || selected.height < 8) {
    closeOverlay();
    showError('Select a larger region.');
    return;
  }

  lastRegion = { rect: selected, displayId: display.id };
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  await sleep(420);

  try {
    const targetWidth = Math.max(1, Math.round(display.size.width * display.scaleFactor));
    const targetHeight = Math.max(1, Math.round(display.size.height * display.scaleFactor));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: targetWidth, height: targetHeight },
      fetchWindowIcons: false,
    });
    const screenSources = sources.filter((source) => source.id.startsWith('screen:'));
    const source =
      screenSources.find((item) => item.display_id && String(item.display_id) === String(display.id)) ||
      screenSources[0];

    if (!source) throw new Error('Chrome did not expose a screen capture source.');
    if (source.thumbnail.isEmpty()) throw new Error('The screen capture was empty. Check screen-recording permission.');

    const thumbSize = source.thumbnail.getSize();
    if (!thumbSize.width || !thumbSize.height) throw new Error('The screen capture had no pixels.');

    const scaleX = thumbSize.width / display.size.width;
    const scaleY = thumbSize.height / display.size.height;
    const x = Math.max(0, Math.min(thumbSize.width - 1, Math.round(selected.x * scaleX)));
    const y = Math.max(0, Math.min(thumbSize.height - 1, Math.round(selected.y * scaleY)));
    const width = Math.max(1, Math.min(thumbSize.width - x, Math.round(selected.width * scaleX)));
    const height = Math.max(1, Math.min(thumbSize.height - y, Math.round(selected.height * scaleY)));

    const cropped = source.thumbnail.crop({ x, y, width, height });
    if (cropped.isEmpty()) throw new Error('The selected region was empty.');

    const captureScale = Math.min(2.5, Math.max(1, 1600 / width, 700 / height));
    const prepared =
      captureScale > 1.01
        ? cropped.resize({
            width: Math.round(width * captureScale),
            height: Math.round(height * captureScale),
            quality: 'best',
          })
        : cropped;
    const preparedSize = prepared.getSize();

    lastCapture = {
      dataUrl: prepared.toDataURL(),
      width: preparedSize.width,
      height: preparedSize.height,
      display: {
        id: display.id,
        label: display.label || `Display ${display.id}`,
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor,
      },
      capturedAt: Date.now(),
    };

    closeOverlay();
    sendToResult('capture:result', lastCapture);
    const win = createResultWindow();
    resultWasVisible = false;
    resultWasMinimized = false;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } catch (error) {
    closeOverlay();
    showError(error instanceof Error ? error.message : String(error));
  }
}

async function repeatLastRegion() {
  if (!lastRegion) {
    openCaptureOverlay();
    return;
  }
  hideResultForCapture();
  overlayDisplay = screen.getAllDisplays().find((display) => display.id === lastRegion.displayId) || screen.getPrimaryDisplay();
  await captureRegion(lastRegion.rect);
}

function registerIpc() {
  ipcMain.on('capture:start', () => openCaptureOverlay());
  ipcMain.on('capture:repeat', () => {
    repeatLastRegion().catch((error) => showError(error instanceof Error ? error.message : String(error)));
  });
  ipcMain.on('overlay:cancel', () => cancelCapture());
  ipcMain.on('overlay:selection', (event, rect) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (event.sender !== overlayWindow.webContents) return;
    captureRegion(rect).catch((error) => showError(error instanceof Error ? error.message : String(error)));
  });

  ipcMain.handle('ocr:run', async (event, payload) => {
    const image = typeof payload?.image === 'string' ? payload.image : '';
    const requested = payload?.language;
    const language = requested === 'hin' ? 'hin' : requested === 'eng+hin' ? 'eng+hin' : 'eng';
    const table = payload?.table === true;
    const math = !table && payload?.math === true;
    if (!/^data:image\//.test(image)) return { ok: false, error: 'No valid image was provided.' };
    const sendProgress = (progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('ocr:progress', progress);
    };
    try {
      let tableResult = null;
      let warning = '';
      if (table) {
        try {
          const base64 = image.slice(image.indexOf(',') + 1);
          const buffer = Buffer.from(base64, 'base64');
          tableResult = await getTableEngine().recognizeTable(buffer, {
            language,
            onProgress: (progress) => sendProgress(progress),
          });
          if (tableResult?.ok) {
            return {
              ok: true,
              text: tableResult.text,
              table: tableResult.table,
              language,
              math: false,
              warning: tableResult.warning || '',
            };
          }
          warning = tableResult?.reason || 'A table could not be detected.';
          sendProgress({ status: 'Table not detected; falling back to text OCR', progress: 0.35 });
        } catch (error) {
          warning = `Table extraction failed: ${error instanceof Error ? error.message : String(error)}`;
          sendProgress({ status: 'Table extraction failed; showing text only', progress: 0.35 });
        }
      }

      const onTextProgress = (progress) => {
        const value = typeof progress?.progress === 'number' ? progress.progress : 0;
        const mapped = table ? 0.35 + value * 0.65 : math ? value * 0.4 : value;
        sendProgress({ ...progress, progress: mapped });
      };
      const detailed =
        language === 'eng+hin'
          ? await recognizeMixedDetailed(image, onTextProgress)
          : await recognizeImageDetailed(image, language, onTextProgress, math);
      let text = detailed.text;
      if (math) {
        try {
          const base64 = image.slice(image.indexOf(',') + 1);
          const buffer = Buffer.from(base64, 'base64');
          text = await getMathEngine().recognizeMath(buffer, detailed.data, (progress) => {
            const value = typeof progress?.progress === 'number' ? progress.progress : 0;
            sendProgress({ ...progress, progress: 0.4 + value * 0.6 });
          });
        } catch (error) {
          warning = `Equation detection failed: ${error instanceof Error ? error.message : String(error)}`;
          sendProgress({ status: 'Equation detection failed; showing text only', progress: 1 });
        }
      }
      return { ok: true, text: polishText(text), language, math, warning };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('clipboard:write', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  });

  ipcMain.handle('clipboard:read-image', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return { ok: false };
    return { ok: true, dataUrl: image.toDataURL() };
  });

  ipcMain.handle('dialog:open-image', async () => {
    const result = await dialog.showOpenDialog(resultWindow, {
      title: 'Open an image for OCR',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const extension = path.extname(filePath).slice(1).toLowerCase();
    const mime =
      extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'bmp'
            ? 'image/bmp'
            : extension === 'gif'
              ? 'image/gif'
              : 'image/png';
    try {
      const buffer = await fs.readFile(filePath);
      return { ok: true, dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, name: path.basename(filePath) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('dialog:save', async (_event, payload) => {
    const text = String(payload?.text || '');
    const extension = payload?.extension === 'md' ? 'md' : payload?.extension === 'tsv' ? 'tsv' : 'txt';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const result = await dialog.showSaveDialog(resultWindow, {
      title: 'Save OCR text',
      defaultPath: path.join(app.getPath('documents'), `brahma-ocr-${stamp}.${extension}`),
      filters:
        extension === 'md'
          ? [{ name: 'Markdown', extensions: ['md'] }]
          : extension === 'tsv'
            ? [{ name: 'Tab-separated values', extensions: ['tsv'] }]
            : [{ name: 'Text', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      await fs.writeFile(result.filePath, text, 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    hotkey: HOTKEY,
    hotkeyRegistered,
    platform: process.platform,
    windowVisible: Boolean(resultWindow && !resultWindow.isDestroyed() && resultWindow.isVisible()),
    overlayOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
  }));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = createResultWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(() => {
    registerIpc();
    createResultWindow();
    hotkeyRegistered = globalShortcut.register(HOTKEY, () => openCaptureOverlay());
    if (!hotkeyRegistered) {
      console.warn(`Could not register ${HOTKEY}. Use the Capture button instead.`);
    }
  });

  app.on('activate', () => {
    createResultWindow();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
