import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  Captions,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Images,
  Loader2,
  MessagesSquare,
  MousePointer2,
  Puzzle,
  RefreshCw,
  Save,
  ScanText,
  X,
} from 'lucide-react';
import {
  captureTargetScreenshot,
  collectPageImages,
  downloadImages,
  downloadTextFile,
  exportCurrentChat,
  exportNotebookSources,
  extractYoutubeTranscript,
  getInstalledExtensions,
  getToolTarget,
  grabPageText,
  grabSelection,
  setExtensionEnabled,
  type CollectedImage,
  type ExtensionEntry,
  type ToolTarget,
} from '../lib/browserTools';
import { recognizeImage, type OcrLanguage } from '../lib/ocr';

type ToolId = 'ocr' | 'page' | 'youtube' | 'chat' | 'notebook' | 'images' | 'extensions';
type ResultFormat = 'text' | 'markdown';

interface ToolsPageProps {
  initialTool?: string | null;
  targetTabId?: number | null;
  onClose: () => void;
  onSaveSource: (title: string, content: string, sourceUrl?: string) => void;
}

const TOOL_ITEMS: Array<{
  id: ToolId;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  { id: 'ocr', label: 'OCR & Text Grab', hint: 'Crop a screenshot and read the text', icon: <ScanText className="w-4 h-4" /> },
  { id: 'page', label: 'Page Text', hint: 'Grab readable page text or a selection', icon: <FileText className="w-4 h-4" /> },
  { id: 'youtube', label: 'YouTube Transcript', hint: 'Export captions with timestamps', icon: <Captions className="w-4 h-4" /> },
  { id: 'chat', label: 'Chat Export', hint: 'Save ChatGPT, Claude, or Gemini chats', icon: <MessagesSquare className="w-4 h-4" /> },
  { id: 'notebook', label: 'NotebookLM', hint: 'Export notebook sources to Markdown', icon: <BookOpenCheck className="w-4 h-4" /> },
  { id: 'images', label: 'Image Collector', hint: 'Scan and download page images', icon: <Images className="w-4 h-4" /> },
  { id: 'extensions', label: 'Extensions', hint: 'Review and toggle installed extensions', icon: <Puzzle className="w-4 h-4" /> },
];

const TOOL_LABELS: Record<ToolId, string> = {
  ocr: 'OCR & Text Grab',
  page: 'Page Text',
  youtube: 'YouTube Transcript',
  chat: 'Chat Export',
  notebook: 'NotebookLM Sources',
  images: 'Image Collector',
  extensions: 'Extension Manager',
};

const normalizeTool = (value?: string | null): ToolId => {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'ocr' || normalized === 'text') return 'ocr';
  if (normalized === 'page' || normalized === 'selection') return 'page';
  if (normalized === 'youtube' || normalized === 'transcript') return 'youtube';
  if (normalized === 'chat') return 'chat';
  if (normalized === 'notebook' || normalized === 'notebooklm') return 'notebook';
  if (normalized === 'images' || normalized === 'image') return 'images';
  if (normalized === 'extensions' || normalized === 'extension') return 'extensions';
  return 'ocr';
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const CropOverlay: React.FC<{
  imageUrl: string;
  onCancel: () => void;
  onCrop: (dataUrl: string) => void;
}> = ({ imageUrl, onCancel, onCrop }) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => {
      const image = imageRef.current;
      if (!image) return;
      const rect = image.getBoundingClientRect();
      const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
      const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height);
      const next = dragRef.current ? { ...dragRef.current, x, y } : null;
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => {
      setDragging(false);
      const current = dragRef.current;
      const image = imageRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || !image) return;
      const rect = image.getBoundingClientRect();
      const left = Math.min(current.startX, current.x);
      const top = Math.min(current.startY, current.y);
      const width = Math.abs(current.x - current.startX);
      const height = Math.abs(current.y - current.startY);
      if (width < 8 || height < 8) {
        setError('Drag a larger region to capture.');
        return;
      }
      const scaleX = image.naturalWidth / rect.width;
      const scaleY = image.naturalHeight / rect.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scaleX));
      canvas.height = Math.max(1, Math.round(height * scaleY));
      const context = canvas.getContext('2d');
      if (!context) {
        setError('Could not prepare the crop.');
        return;
      }
      context.drawImage(
        image,
        Math.round(left * scaleX),
        Math.round(top * scaleY),
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      onCrop(canvas.toDataURL('image/png'));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onCrop]);

  const onMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height);
    setError(null);
    const next = { startX: x, startY: y, x, y };
    dragRef.current = next;
    setDrag(next);
    setDragging(true);
  };

  const selection = drag
    ? {
        left: Math.min(drag.startX, drag.x),
        top: Math.min(drag.startY, drag.y),
        width: Math.abs(drag.x - drag.startX),
        height: Math.abs(drag.y - drag.startY),
      }
    : null;

  return (
    <div className="fixed inset-0 z-[10020] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
      <div className="flex items-center justify-between gap-4 w-full max-w-6xl">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-jarvis-accent">Capture region</div>
          <div className="text-sm text-gray-300">Drag a rectangle around the text you want Brahma to read.</div>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-white/15 text-xs text-gray-300 hover:text-white hover:border-white/30"
        >
          Cancel
        </button>
      </div>
      <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-white/20 shadow-2xl">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Screenshot to crop"
          draggable={false}
          onMouseDown={onMouseDown}
          className="block max-h-[68vh] w-auto max-w-full cursor-crosshair select-none"
        />
        {selection && (
          <div
            className="absolute border-2 border-jarvis-accent bg-jarvis-accent/10"
            style={{
              left: selection.left,
              top: selection.top,
              width: selection.width,
              height: selection.height,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
            }}
          />
        )}
      </div>
      <div className={`text-xs ${error ? 'text-red-400' : 'text-gray-500'}`}>
        {error || 'Tip: include a little padding around the text for better OCR accuracy.'}
      </div>
    </div>
  );
};

export const ToolsPage: React.FC<ToolsPageProps> = ({ initialTool, targetTabId, onClose, onSaveSource }) => {
  const [tool, setTool] = useState<ToolId>(() => normalizeTool(initialTool));
  const [target, setTarget] = useState<ToolTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultText, setResultText] = useState('');
  const [resultFormat, setResultFormat] = useState<ResultFormat>('text');
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('eng');
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
  const [ocrPreview, setOcrPreview] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [images, setImages] = useState<CollectedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [extensions, setExtensions] = useState<ExtensionEntry[]>([]);
  const [extensionBusy, setExtensionBusy] = useState<string | null>(null);
  const [extensionsLoaded, setExtensionsLoaded] = useState(false);

  const refreshTarget = async () => {
    try {
      const next = await getToolTarget(targetTabId || undefined);
      setTarget(next);
      setError(null);
      return next;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  };

  useEffect(() => {
    refreshTarget();
  }, [targetTabId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !screenshot) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, screenshot]);

  useEffect(() => {
    if (tool !== 'extensions' || extensionsLoaded) return;
    let alive = true;
    getInstalledExtensions()
      .then((items) => {
        if (!alive) return;
        setExtensions(items);
        setExtensionsLoaded(true);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [tool, extensionsLoaded]);

  const selectTool = (next: ToolId) => {
    setTool(next);
    setError(null);
    setNotice(null);
    setResultText('');
    setResultTitle('');
    setResultUrl('');
    setResultFormat('text');
    setOcrPreview('');
    setImages([]);
    setSelectedImages(new Set());
    if (next !== 'ocr') setScreenshot('');
    refreshTarget();
  };

  const withBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const requireTarget = async () => {
    const current = await getToolTarget(targetTabId || undefined);
    setTarget(current);
    return current;
  };

  const applyPageText = (data: { title: string; url: string; text: string }, label: string) => {
    setResultTitle(data.title || label);
    setResultUrl(data.url || '');
    setResultText(data.text || '');
    setResultFormat('text');
    if (!data.text) setError('No readable text was found. Try selecting text first or use OCR.');
  };

  const handleGrabPage = (selectionOnly: boolean) =>
    withBusy(selectionOnly ? 'selection' : 'page', async () => {
      const current = await requireTarget();
      const data = selectionOnly ? await grabSelection(current.id) : await grabPageText(current.id);
      applyPageText(data, selectionOnly ? 'Page selection' : 'Page text');
    });

  const handleYoutube = () =>
    withBusy('youtube', async () => {
      const current = await requireTarget();
      if (!/youtube\.com|youtu\.be/i.test(current.url)) {
        throw new Error('Open a YouTube video tab and keep it open, then try again.');
      }
      const data = await extractYoutubeTranscript(current.id);
      applyPageText(data, 'YouTube transcript');
    });

  const handleChat = () =>
    withBusy('chat', async () => {
      const current = await requireTarget();
      const data = await exportCurrentChat(current.id);
      setResultTitle(data.title);
      setResultUrl(data.url);
      setResultText(data.markdown);
      setResultFormat('markdown');
      setNotice(`${data.messageCount} message${data.messageCount === 1 ? '' : 's'} exported.`);
    });

  const handleNotebook = () =>
    withBusy('notebook', async () => {
      const current = await requireTarget();
      const data = await exportNotebookSources(current.id);
      setResultTitle(data.title);
      setResultUrl(data.url);
      setResultText(data.markdown);
      setResultFormat('markdown');
      setNotice(`${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'} exported.`);
    });

  const handleScanImages = () =>
    withBusy('images', async () => {
      const current = await requireTarget();
      const data = await collectPageImages(current.id);
      setImages(data.images);
      setSelectedImages(new Set(data.images.map((image) => image.url)));
      setResultTitle(data.title);
      setResultUrl(data.url);
      setNotice(`${data.images.length} image${data.images.length === 1 ? '' : 's'} found.`);
    });

  const handleDownloadImages = () =>
    withBusy('download-images', async () => {
      const chosen = images.filter((image) => selectedImages.has(image.url));
      if (!chosen.length) throw new Error('Select at least one image to download.');
      const started = await downloadImages(chosen);
      if (!started) throw new Error('Chrome did not start any downloads. Check the image URLs and try again.');
      setNotice(`Started ${started} download${started === 1 ? '' : 's'} from ${resultTitle || 'the page'}.`);
    });

  const handleCapture = () =>
    withBusy('capture', async () => {
      const current = await requireTarget();
      const dataUrl = await captureTargetScreenshot(current);
      setScreenshot(dataUrl);
      setOcrPreview('');
      setResultText('');
      setError(null);
    });

  const handleCrop = (dataUrl: string) => {
    setScreenshot('');
    setOcrPreview(dataUrl);
    runOcr(dataUrl);
  };

  const runOcr = async (image: string) => {
    setBusy('ocr');
    setError(null);
    setNotice(null);
    setOcrProgress({ status: 'starting OCR', progress: 0 });
    try {
      const text = await recognizeImage(image, ocrLanguage, (progress) => setOcrProgress(progress));
      setResultTitle(`OCR from ${target?.title || 'screen capture'}`);
      setResultUrl(target?.url || '');
      setResultText(text);
      setResultFormat('text');
      if (!text) setError('No text was recognized. Crop a tighter region with higher contrast.');
      else setNotice(`OCR complete: ${text.length.toLocaleString()} characters.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setOcrProgress(null);
    }
  };

  const handleCopy = async () => {
    if (!resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setNotice('Copied to clipboard.');
    } catch {
      setError('Could not copy to the clipboard.');
    }
  };

  const handleDownloadResult = () => {
    if (!resultText.trim()) return;
    const base = resultTitle || TOOL_LABELS[tool];
    const extension = resultFormat === 'markdown' ? 'md' : 'txt';
    downloadTextFile(`${base}.${extension}`, resultText, resultFormat === 'markdown' ? 'text/markdown' : 'text/plain');
    setNotice('Download started.');
  };

  const handleSaveResult = () => {
    if (!resultText.trim()) return;
    onSaveSource(resultTitle || TOOL_LABELS[tool], resultText, resultUrl || undefined);
    setNotice('Saved to Neural Archive.');
  };

  const toggleImage = (url: string) => {
    setSelectedImages((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleExtension = async (entry: ExtensionEntry) => {
    setExtensionBusy(entry.id);
    setError(null);
    try {
      await setExtensionEnabled(entry.id, !entry.enabled);
      setExtensions((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, enabled: !item.enabled } : item))
      );
      setNotice(`${entry.name} ${entry.enabled ? 'disabled' : 'enabled'}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExtensionBusy(null);
    }
  };

  const refreshExtensions = () => {
    setExtensionsLoaded(false);
    setError(null);
    setNotice(null);
  };

  const activeItem = TOOL_ITEMS.find((item) => item.id === tool) || TOOL_ITEMS[0];
  const resultChars = resultText.length;

  return (
    <>
      <div className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6">
        <div className="w-full max-w-6xl h-[88vh] spatial-glass rounded-3xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 bg-black/20">
            <div>
              <div className="text-[10px] uppercase tracking-[0.34em] text-jarvis-accent">Brahma Browser Tools</div>
              <div className="text-lg font-display text-white">Capture, export and manage the web</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition"
              title="Close browser tools"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <nav className="md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-3 flex md:flex-col gap-2 overflow-x-auto custom-scrollbar">
              {TOOL_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectTool(item.id)}
                  className={`flex-shrink-0 md:w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    tool === item.id
                      ? 'border-jarvis-accent/50 bg-jarvis-accent/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <div className="hidden md:block text-[10px] text-gray-500 mt-1">{item.hint}</div>
                </button>
              ))}
            </nav>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl spatial-glass-subtle p-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500">Source tab</div>
                  <div className="text-xs text-white truncate">{target?.title || 'No website tab found'}</div>
                  <div className="text-[10px] text-gray-500 truncate">{target?.url || 'Open a normal website and refresh.'}</div>
                </div>
                <button
                  onClick={refreshTarget}
                  className="px-3 py-2 rounded-xl border border-white/10 text-[11px] text-gray-300 hover:text-white hover:border-white/25 inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh tab
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              {tool === 'ocr' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Screen OCR</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Brahma briefly switches to the source tab, captures it, then opens the crop tool here.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-[11px] text-gray-400">
                        Language
                        <select
                          value={ocrLanguage}
                          onChange={(event) => setOcrLanguage(event.target.value as OcrLanguage)}
                          className="ml-2 px-2 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white outline-none"
                        >
                          <option value="eng">English</option>
                          <option value="hin">Hindi</option>
                        </select>
                      </label>
                      <button
                        onClick={handleCapture}
                        disabled={Boolean(busy)}
                        className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {busy === 'capture' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MousePointer2 className="w-3.5 h-3.5" />}
                        Capture screen region
                      </button>
                      {ocrPreview && (
                        <button
                          onClick={() => runOcr(ocrPreview)}
                          disabled={Boolean(busy)}
                          className="px-4 py-2 rounded-xl border border-jarvis-accent/40 text-jarvis-accent text-xs inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          {busy === 'ocr' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
                          Re-run OCR
                        </button>
                      )}
                    </div>
                    {ocrProgress && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{ocrProgress.status}</span>
                          <span>{Math.round(ocrProgress.progress * 100)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-jarvis-accent transition-all"
                            style={{ width: `${Math.max(3, Math.round(ocrProgress.progress * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {ocrPreview && (
                      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-2">
                        <img src={ocrPreview} alt="OCR crop" className="h-20 w-auto rounded-lg border border-white/10" />
                        <div className="text-[11px] text-gray-400">
                          <div className="text-gray-300 font-medium">Cropped capture</div>
                          <div>Re-run OCR after changing the language, or capture a different region.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tool === 'page' && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">Read the page</div>
                  <div className="text-xs text-gray-400">
                    Grabs the main article text or the text you selected before opening Brahma.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleGrabPage(false)}
                      disabled={Boolean(busy)}
                      className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {busy === 'page' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      Grab page text
                    </button>
                    <button
                      onClick={() => handleGrabPage(true)}
                      disabled={Boolean(busy)}
                      className="px-4 py-2 rounded-xl border border-white/15 text-xs text-gray-200 inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {busy === 'selection' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MousePointer2 className="w-3.5 h-3.5" />}
                      Grab selection
                    </button>
                  </div>
                </div>
              )}

              {tool === 'youtube' && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">YouTube transcript</div>
                  <div className="text-xs text-gray-400">
                    Uses YouTube's caption tracks with timestamped output. No transcript panel is required.
                  </div>
                  <button
                    onClick={handleYoutube}
                    disabled={Boolean(busy)}
                    className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy === 'youtube' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Captions className="w-3.5 h-3.5" />}
                    Extract transcript
                  </button>
                </div>
              )}

              {tool === 'chat' && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">Export the current chat</div>
                  <div className="text-xs text-gray-400">
                    Supports ChatGPT, Claude, and Gemini conversation pages. Keep the chat tab open while exporting.
                  </div>
                  <button
                    onClick={handleChat}
                    disabled={Boolean(busy)}
                    className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy === 'chat' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessagesSquare className="w-3.5 h-3.5" />}
                    Export chat to Markdown
                  </button>
                </div>
              )}

              {tool === 'notebook' && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">NotebookLM sources</div>
                  <div className="text-xs text-gray-400">
                    Reads source cards from the open notebook and combines them into one Markdown reference file.
                  </div>
                  <button
                    onClick={handleNotebook}
                    disabled={Boolean(busy)}
                    className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy === 'notebook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpenCheck className="w-3.5 h-3.5" />}
                    Export sources
                  </button>
                </div>
              )}

              {tool === 'images' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Page images</div>
                        <div className="text-xs text-gray-400">
                          Scans images, responsive sources, CSS backgrounds, and direct image links.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleScanImages}
                          disabled={Boolean(busy)}
                          className="px-4 py-2 rounded-xl bg-jarvis-accent text-black text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          {busy === 'images' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Images className="w-3.5 h-3.5" />}
                          Scan page
                        </button>
                        <button
                          onClick={handleDownloadImages}
                          disabled={Boolean(busy) || selectedImages.size === 0}
                          className="px-4 py-2 rounded-xl border border-white/15 text-xs text-gray-200 inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download {selectedImages.size || ''}
                        </button>
                      </div>
                    </div>
                    {images.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>{images.length} images found</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedImages(new Set(images.map((image) => image.url)))}
                            className="text-jarvis-accent hover:underline"
                          >
                            Select all
                          </button>
                          <button onClick={() => setSelectedImages(new Set())} className="hover:text-white">
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {images.map((image) => {
                        const selected = selectedImages.has(image.url);
                        return (
                          <button
                            key={image.url}
                            onClick={() => toggleImage(image.url)}
                            className={`group relative rounded-xl overflow-hidden border text-left transition ${
                              selected ? 'border-jarvis-accent ring-1 ring-jarvis-accent/40' : 'border-white/10 hover:border-white/30'
                            }`}
                          >
                            <div className="h-28 bg-black/40 flex items-center justify-center overflow-hidden">
                              <img
                                src={image.url}
                                alt={image.alt || 'Page image'}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 bg-black/40">
                              <div className="text-[10px] text-gray-300 truncate">{image.alt || image.source}</div>
                              <div className="text-[9px] text-gray-500">
                                {image.width && image.height ? `${image.width}x${image.height}` : image.source}
                              </div>
                            </div>
                            <span
                              className={`absolute top-2 right-2 w-5 h-5 rounded-md border flex items-center justify-center ${
                                selected ? 'bg-jarvis-accent border-jarvis-accent text-black' : 'bg-black/60 border-white/30 text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tool === 'extensions' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Installed extensions</div>
                      <div className="text-xs text-gray-400">Toggle extensions from Brahma. Some Chrome components cannot be changed.</div>
                    </div>
                    <button
                      onClick={refreshExtensions}
                      className="px-3 py-2 rounded-xl border border-white/15 text-xs text-gray-200 inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refresh
                    </button>
                  </div>
                  {!extensionsLoaded && !error && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading extensions...
                    </div>
                  )}
                  <div className="space-y-2">
                    {extensions.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">{entry.name}</span>
                            <span className="text-[9px] text-gray-500">v{entry.version}</span>
                            <span className="text-[9px] uppercase tracking-wider text-gray-500">{entry.type}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{entry.description || 'No description.'}</div>
                        </div>
                        <button
                          onClick={() => toggleExtension(entry)}
                          disabled={extensionBusy === entry.id}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition ${
                            entry.enabled
                              ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                              : 'border-white/15 text-gray-400 hover:text-white hover:border-white/30'
                          } disabled:opacity-50`}
                        >
                          {extensionBusy === entry.id ? 'Working...' : entry.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {extensionsLoaded && extensions.length === 0 && (
                    <div className="text-xs text-gray-500">No other extensions found.</div>
                  )}
                </div>
              )}

              {((resultText || resultTitle) && tool !== 'extensions' && tool !== 'images') && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500">{activeItem.label} result</div>
                      <div className="text-sm font-semibold text-white truncate">{resultTitle || activeItem.label}</div>
                      {resultUrl && (
                        <a
                          href={resultUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-gray-400 hover:text-jarvis-accent inline-flex items-center gap-1 break-all"
                        >
                          {resultUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleCopy}
                        disabled={!resultText.trim()}
                        className="px-3 py-2 rounded-lg border border-white/10 text-[11px] text-gray-300 hover:text-white hover:border-white/25 inline-flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={handleSaveResult}
                        disabled={!resultText.trim()}
                        className="px-3 py-2 rounded-lg border border-white/10 text-[11px] text-gray-300 hover:text-white hover:border-white/25 inline-flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </button>
                      <button
                        onClick={handleDownloadResult}
                        disabled={!resultText.trim()}
                        className="px-3 py-2 rounded-lg bg-jarvis-accent text-black text-[11px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={resultText}
                    onChange={(event) => setResultText(event.target.value)}
                    placeholder="The extracted text will appear here."
                    className="w-full min-h-[220px] max-h-[45vh] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-200 outline-none focus:border-jarvis-accent/50 resize-y"
                  />
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>{resultChars.toLocaleString()} characters</span>
                    <span>{resultFormat === 'markdown' ? 'Markdown' : 'Plain text'}</span>
                  </div>
                </div>
              )}

              {!resultText && !resultTitle && tool !== 'extensions' && (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-gray-500">
                  Run a tool above to collect text or images from the source tab.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {screenshot && (
        <CropOverlay imageUrl={screenshot} onCancel={() => setScreenshot('')} onCrop={handleCrop} />
      )}
    </>
  );
};
