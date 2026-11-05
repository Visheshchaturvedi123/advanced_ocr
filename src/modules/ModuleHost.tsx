import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeft, Clapperboard, ExternalLink, Image as ImageIcon, NotebookPen, PenLine, RefreshCw, Sparkles } from 'lucide-react';
import { BrahmaModule, BrahmaModuleIcon, BrahmaModuleId, getModuleUrl } from './registry';

const MODULE_ICONS: Record<BrahmaModuleIcon, React.ReactNode> = {
  clapperboard: <Clapperboard className="w-4 h-4" />,
  pen: <PenLine className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
};

export interface ModuleSnapshot {
  title: string;
  content: string;
  sourceUrl: string;
}

export interface StoredModuleSnapshot extends ModuleSnapshot {
  moduleId: BrahmaModuleId;
  updatedAt: number;
}

export const MODULE_SNAPSHOT_KEY = 'brahma-active-module-snapshot';

export const readStoredModuleSnapshot = (): StoredModuleSnapshot | null => {
  try {
    const raw = localStorage.getItem(MODULE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.moduleId || !parsed?.content) return null;
    return parsed as StoredModuleSnapshot;
  } catch {
    return null;
  }
};

interface ModuleHostProps {
  module: BrahmaModule;
  onClose: () => void;
  onSaveSnapshot?: (snapshot: ModuleSnapshot) => void;
  onAskBrahma?: (snapshot: ModuleSnapshot) => void;
}

const cleanText = (value?: string | null) => (value || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const scribbleSnapshot = (raw: string): { title: string; content: string } | null => {
  try {
    const projects = JSON.parse(raw);
    const project = Array.isArray(projects) ? projects.find((item) => item && Array.isArray(item.scenes)) : null;
    if (!project) return null;
    const scenes: Array<{ title?: string; text?: string; duration?: number; visual?: string }> = project.scenes;
    const settings = project.settings || {};
    const sceneLines = scenes.map((scene, index) => {
      const duration = typeof scene.duration === 'number' ? ` - ${scene.duration}s` : '';
      const visual = scene.visual ? ` [${scene.visual}]` : '';
      return `${index + 1}. ${scene.title || 'Scene'}${duration}${visual}\n   ${cleanText(scene.text)}`;
    });
    const settingLine = [
      settings.language ? `language=${settings.language}` : '',
      settings.resolution ? `resolution=${settings.resolution}p` : '',
      settings.narration ? 'narration=on' : 'narration=off',
      settings.camera ? 'camera=on' : 'camera=off',
    ].filter(Boolean).join(', ');
    const content = [
      `# ${project.title || 'Untitled story'}`,
      'Module: Scribble Studio',
      'Project type: whiteboard story',
      settingLine ? `Settings: ${settingLine}` : '',
      '',
      'Script:',
      cleanText(project.script) || scenes.map((scene) => cleanText(scene.text)).join('\n\n'),
      '',
      'Scenes:',
      sceneLines.join('\n'),
    ].filter((line) => line !== '').join('\n');
    return { title: project.title || 'Scribble story', content };
  } catch {
    return null;
  }
};

export interface ModuleHostHandle {
  captureSnapshot: () => ModuleSnapshot;
}

export const ModuleHost = forwardRef<ModuleHostHandle, ModuleHostProps>(function ModuleHost(
  { module, onClose, onSaveSnapshot, onAskBrahma },
  ref
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const openInTab = () => {
    const url = getModuleUrl(module.id);
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const captureSnapshot = (): ModuleSnapshot => {
    const frame = frameRef.current;
    const sourceUrl = getModuleUrl(module.id);
    const fallbackTitle = `${module.name} snapshot`;
    let title = fallbackTitle;
    let content = '';

    try {
      const win = frame?.contentWindow;
      if (win && module.id === 'scribble') {
        const structured = scribbleSnapshot(win.localStorage.getItem('scribble.projects.v1') || '');
        if (structured) {
          title = structured.title;
          content = structured.content;
        }
      }
    } catch {}

    if (!content) {
      try {
        const doc = frame?.contentDocument;
        const visible = cleanText(doc?.body?.innerText || '').slice(0, 8000);
        const docTitle = cleanText(doc?.title);
        if (docTitle && !/^(vite|react|image lab|autocine|scribble)/i.test(docTitle)) title = docTitle;
        content = [
          `Module: ${module.name}`,
          `URL: ${sourceUrl}`,
          '',
          'Workspace snapshot (visible text):',
          visible || 'No readable text was available in the module frame.',
        ].join('\n');
      } catch {
        content = `Module: ${module.name}\nURL: ${sourceUrl}\n\nCould not read the module frame. Open it in a tab and try again.`;
      }
    }

    return { title, content: content.slice(0, 12000), sourceUrl };
  };

  const persistSnapshot = (snapshot: ModuleSnapshot) => {
    try {
      const stored: StoredModuleSnapshot = { ...snapshot, moduleId: module.id, updatedAt: Date.now() };
      localStorage.setItem(MODULE_SNAPSHOT_KEY, JSON.stringify(stored));
    } catch {}
  };

  useImperativeHandle(ref, () => ({ captureSnapshot }), [module.id, module.name]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => persistSnapshot(captureSnapshot()), 2500);
    return () => window.clearTimeout(timer);
  }, [loaded, module.id]);

  useEffect(() => {
    const clearSnapshot = () => {
      try {
        const raw = localStorage.getItem(MODULE_SNAPSHOT_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.moduleId === module.id) localStorage.removeItem(MODULE_SNAPSHOT_KEY);
      } catch {}
    };
    window.addEventListener('beforeunload', clearSnapshot);
    return () => {
      window.removeEventListener('beforeunload', clearSnapshot);
      clearSnapshot();
    };
  }, [module.id]);

  const saveSnapshot = () => {
    if (!onSaveSnapshot) return;
    const snapshot = captureSnapshot();
    persistSnapshot(snapshot);
    onSaveSnapshot(snapshot);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const askBrahma = () => {
    if (!onAskBrahma) return;
    onAskBrahma(captureSnapshot());
  };

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-[#0b0f19]">
      <header className="h-12 flex-shrink-0 flex items-center justify-between px-3 border-b border-white/10 bg-[#0f172a] text-white">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Back to Brahma"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Brahma</span>
          </button>
          <span className="w-px h-5 bg-white/15" />
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${module.accent}22`, color: module.accent }}>
              {MODULE_ICONS[module.icon]}
            </span>
            <span className="text-xs font-semibold truncate">{module.name}</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.18em] text-gray-500">{module.tagline}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onSaveSnapshot && (
            <button
              onClick={saveSnapshot}
              className={`p-2 rounded-lg transition-colors ${savedFlash ? 'text-emerald-300 bg-emerald-400/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title={savedFlash ? 'Snapshot saved to Neural Archive' : 'Save project snapshot to Neural Archive'}
            >
              <NotebookPen className="w-4 h-4" />
            </button>
          )}
          {onAskBrahma && (
            <button
              onClick={askBrahma}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Ask Brahma to review this project"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { setLoaded(false); setFrameKey((key) => key + 1); }}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Reload module"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openInTab}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Open in a new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="relative flex-1 min-h-0 bg-[#0b0f19]">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-gray-400">
            <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
            <span className="text-xs">Loading {module.name}...</span>
          </div>
        )}
        <iframe
          key={frameKey}
          ref={frameRef}
          title={module.name}
          src={getModuleUrl(module.id)}
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full border-0 bg-white"
          allow="clipboard-read; clipboard-write; fullscreen; microphone; camera"
        />
      </div>
    </div>
  );
});
