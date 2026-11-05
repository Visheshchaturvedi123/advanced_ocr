# Brahma Screen OCR

A local desktop OCR app that captures text from **any app outside Chrome** and reads it with the exact OCR engine, language data, and crop math used by Brahma's browser extension.

No Python. No external OCR binary. No cloud OCR. No CDN.

## Run it

From the repository root, double-click:

```text
run-screen-ocr.bat
```

Or run it manually:

```powershell
cd screen-ocr
npm install
npm start
```

If Electron's runtime was blocked during install, run:

```powershell
node node_modules\electron\install.js
```

## Portable Windows build

Build the single-file portable app:

```powershell
cd screen-ocr
npm install
npm run dist
```

Output:

```text
screen-ocr\release\Brahma-Screen-OCR-1.1.0-portable.exe
```

Copy that one file anywhere and run it. No installer or admin rights needed. The bundled equation models make the portable exe about 352 MB. History and settings are saved beside the executable in `Brahma Screen OCR Data`, so the app stays portable.

The build is not code-signed, so Windows SmartScreen may show a warning on first launch. Choose **More info → Run anyway**.

## Use it

1. Press **Ctrl + Shift + O** from anywhere, or click **Capture screen region**.
2. Drag a box around text in any desktop app.
3. Brahma hides its own window, captures that region, and runs OCR immediately.
4. Copy, edit, or save the result as `.txt` or `.md`.

OCR history, language, and auto-copy settings are stored locally.

For word problems with formulas, choose **English**, **Hindi**, or **Mixed English + Hindi**, then enable **Detect equations**. Inline formulas are written as `$...$`; display formulas are written as `$$...$$`. Equation recognition uses bundled ONNX models and never calls the network.

## What is reused from the extension

- `src/lib/ocr.ts` logic is copied into `ocr-engine.js`, including `OEM.LSTM_ONLY`, `gzip: true`, the progress logger, and `worker.recognize(...)`.
- `public/ocr` is copied into `screen-ocr/ocr`: the same Tesseract worker, LSTM WASM cores, and `eng` + `hin` traineddata.
- The crop math mirrors `CropOverlay` in `src/components/ToolsPage.tsx`: normalize the drag rectangle, scale it to the captured image's natural pixels, then crop.
- The only platform difference is the worker container: Electron runs Tesseract.js's Node worker instead of a Chrome extension worker. The OCR engine, language data, and recognition settings are the same.

## Features

- Global hotkey and full-desktop region selection.
- Works over any desktop app, not just Chrome.
- English, Hindi, and mixed English + Hindi text using the same bundled Tesseract data.
- Optional equation detection: inline formulas become `$...$`, display formulas become `$$...$$`.
- Equation recognition is fully local; no Python, cloud, or CDN call is used.
- Auto-run OCR after capture; run/rerun manually.
- Auto-copy to clipboard option.
- Collapse blank lines option.
- Open or drag-drop an image, or paste an image from the clipboard.
- Recent OCR history with restore.
- Save as TXT or Markdown.
- Multi-monitor and display-scaling aware.
- Brahma's result window hides during capture so it does not block the selected region.

## Notes

- The app captures the display where the mouse is when the hotkey is pressed.
- On macOS, grant **Screen Recording** permission the first time.
- On Linux/Wayland, screen capture may depend on the desktop portal.
- OCR is fully local. The renderer's CSP blocks remote connections.
- `screen-ocr/ocr` is generated from `public/ocr` by `npm run copy-ocr`. Keep it with the app when moving it to another machine.

## Files

```text
screen-ocr/
  main.js                 Electron window, screen capture, crop, IPC
  preload.js              Narrow bridge exposed to the renderer
  ocr-engine.js           Tesseract OCR logic, adapted for the Node worker
  math-engine.js          Local ONNX equation detection and recognition
  models/                 Bundled Pix2Text MFD 1.5 and MFR 1.5 ONNX models
  index.html              Result window
  renderer.js             OCR UI, history, clipboard, save
  styles.css
  overlay.html            Fullscreen region-selection overlay
  overlay.js
  overlay.css
  ocr/                    Copied Brahma OCR assets
  scripts/test-math.mjs   Equation OCR smoke test
```
