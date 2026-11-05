/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  BookOpen, 
  Gamepad2, 
  Code2, 
  Mic, 
  MicOff,
  LayoutGrid, 
  Youtube, 
  Github, 
  Mail, 
  MessageSquare, 
  StickyNote, 
  ChevronRight,
  ExternalLink,
  Terminal,
  Cpu,
  Zap,
  Plus,
  Trash2,
  X,
  Shield,
  Newspaper,
  PanelLeft,
  PanelRight,
  Send,
  Bot,
  Globe,
  Code,
  Layers,
  Monitor,
  Settings,
  PlusCircle,
  Search as SearchIcon,
  Boxes,
  Folder,
  Volume2,
  VolumeX,
  Sparkles,
  Battery,
  Activity,
  ChevronUp,
  ChevronDown,
  PlugZap,
  Wrench,
  ScanText,
  FileText,
  Captions,
  MessagesSquare,
  BookOpenCheck,
  Images,
  Puzzle,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { AppMode, Shortcut, AIResponse, Note, ChatSession, ChatFolder, ChatMessage } from './types';
import { AnalogClock } from './components/AnalogClock';
import { BRAHMA_MODULES, BrahmaModuleId, getModule, getModuleUrl } from './modules/registry';
import { ModuleHost, readStoredModuleSnapshot, type ModuleHostHandle, type ModuleSnapshot } from './modules/ModuleHost';
import { ModulesDock } from './modules/ModulesDock';
import {
  AI_PROVIDERS,
  AIProviderError,
  completeWithFallback,
  completeWithToolsWithFallback,
  clearProviderApiKey,
  getActiveProvider,
  getConfiguredProviderIds,
  getProviderApiKey,
  getProviderModel,
  getProviderModels,
  getProviderOrder,
  hasConfiguredProvider,
  saveProviderApiKey,
  saveProviderModel,
  setActiveProvider,
  setProviderOrder,
  testProvider,
  GEMINI_FALLBACK_MODEL,
  GEMINI_PRIMARY_MODEL,
  type AIProviderId,
} from './lib/ai/router';
import type { AIToolDefinition } from './lib/ai/types';
import { checkHub, getHubToken, getHubUrl, saveHubToken, saveHubUrl } from './lib/hub';
import { ToolsPage } from './components/ToolsPage';
import { recognizeImage } from './lib/ocr';
import {
  captureTargetScreenshot,
  collectPageImages,
  downloadImages,
  exportCurrentChat,
  exportNotebookSources,
  extractYoutubeTranscript,
  getInstalledExtensions,
  getToolTarget,
  grabPageText,
  grabSelection,
  setExtensionEnabled,
  type ToolTarget,
} from './lib/browserTools';

const GENAI_MODEL = GEMINI_PRIMARY_MODEL;
const FALLBACK_MODEL = GEMINI_FALLBACK_MODEL;
const MODE_THEMES: Record<AppMode, { primary: string; secondary: string; accent: string }> = {
  [AppMode.STUDY]: { primary: '#09111f', secondary: '#1b3f6b', accent: '#59d7ff' },
  [AppMode.GAMING]: { primary: '#120714', secondary: '#4a1238', accent: '#ff4fd8' },
  [AppMode.DEVELOPER]: { primary: '#071317', secondary: '#0f4b54', accent: '#2ef2d0' },
};
const LIGHT_MODE_THEMES: Record<AppMode, { primary: string; secondary: string; accent: string }> = {
  [AppMode.STUDY]: { primary: '#f5f7ff', secondary: '#dbe4ff', accent: '#4f46e5' },
  [AppMode.GAMING]: { primary: '#fff5fa', secondary: '#ffd9ea', accent: '#db2777' },
  [AppMode.DEVELOPER]: { primary: '#f0fdfa', secondary: '#ccfbf1', accent: '#0f766e' },
};
const SIDEBAR_SITE_TOOLS: Array<{ id: string; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'ocr', label: 'OCR', hint: 'Capture and read a screen region', icon: <ScanText className="w-4 h-4" /> },
  { id: 'page', label: 'Page', hint: 'Grab page text or the current selection', icon: <FileText className="w-4 h-4" /> },
  { id: 'youtube', label: 'Tube', hint: 'Export the current YouTube transcript', icon: <Captions className="w-4 h-4" /> },
  { id: 'images', label: 'Images', hint: 'Scan and download page images', icon: <Images className="w-4 h-4" /> },
  { id: 'chat', label: 'Chat', hint: 'Export the current AI chat', icon: <MessagesSquare className="w-4 h-4" /> },
  { id: 'notebook', label: 'Sources', hint: 'Export NotebookLM sources', icon: <BookOpenCheck className="w-4 h-4" /> },
  { id: 'extensions', label: 'Ext', hint: 'Review and toggle extensions', icon: <Puzzle className="w-4 h-4" /> },
];
type AIProvider = AIProviderId;

const ProviderSwitch: React.FC<{
  value: AIProvider;
  onChange: (p: AIProvider) => void;
  configured?: AIProvider[];
}> = ({ value, onChange, configured = [] }) => (
  <div className="grid grid-cols-2 gap-2">
    {(Object.keys(AI_PROVIDERS) as AIProvider[]).map((p) => (
      <button
        key={p}
        type="button"
        onClick={() => onChange(p)}
        className={`p-2.5 rounded-xl border text-left transition-all ${
          value === p
            ? 'border-jarvis-accent bg-jarvis-accent/10'
            : 'border-white/10 hover:border-jarvis-accent/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold">{AI_PROVIDERS[p].label}</div>
          {configured.includes(p) && (
            <span className="text-[8px] uppercase tracking-wider text-emerald-500">Key</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500">{AI_PROVIDERS[p].model}</div>
      </button>
    ))}
  </div>
);
type ModeAction = { label: string; action: () => void };
type OnboardingStage = 'boot' | 'welcome' | 'mode' | 'tour' | 'activate' | 'first-action' | 'complete';
type HintTarget = 'search' | 'floating' | 'actions' | null;
type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description?: string;
};
const MODE_BEHAVIORS: Record<AppMode, { suggestions: string[]; quickActions: (trigger: (key: string) => void) => ModeAction[]; hosts: string[]; distractions?: string[]; workHosts?: string[] }> = {
  [AppMode.STUDY]: {
    suggestions: [
      "Want a summary of this page?",
      "Turn this into 5 flashcards?",
      "Explain it like I'm 12?",
      "Create a quick quiz from this section?"
    ],
    quickActions: (t) => [
      { label: "TL;DR", action: () => t('Summarize') },
      { label: "Flashcards", action: () => t('Flashcards') },
      { label: "Explain simply", action: () => t('ExplainSimple') },
      { label: "Make quiz", action: () => t('Quiz') },
      { label: "Summarize URL", action: () => t('SummarizeURL') },
    ],
    hosts: ["medium.com", "wikipedia.org", "towardsdatascience.com", "docs.google.com", "notion.so"],
    distractions: ["youtube.com", "instagram.com", "tiktok.com", "facebook.com", "netflix.com", "reddit.com"]
  },
  [AppMode.GAMING]: {
    suggestions: [
      "Need best settings for this game?",
      "Want pro tips for this boss?",
      "Show latest patch notes?"
    ],
    quickActions: (t) => [
      { label: "Strategy tips", action: () => t('Strategy') },
      { label: "Best loadout", action: () => t('Strategy') },
      { label: "Patch summary", action: () => t('Summarize') },
    ],
    hosts: ["twitch.tv", "ign.com", "gamespot.com", "steamcommunity.com", "fextralife.com", "youtube.com/gaming"],
    workHosts: ["github.com", "stackoverflow.com", "notion.so", "docs.google.com"]
  },
  [AppMode.DEVELOPER]: {
    suggestions: [
      "Explain this error?",
      "Optimize this snippet?",
      "Convert this code to another language?"
    ],
    quickActions: (t) => [
      { label: "Fix error", action: () => t('Debug') },
      { label: "Optimize code", action: () => t('Debug') },
      { label: "API test", action: () => t('APITest') },
      { label: "Summarize URL", action: () => t('SummarizeURL') },
    ],
    hosts: ["github.com", "stackoverflow.com", "npmjs.com", "dev.to", "docs.python.org", "developer.mozilla.org"]
  }
};

// Browser Control Function Declarations
const browserTools: FunctionDeclaration[] = [
  {
    name: "switchMode",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: "The mode to switch to: STUDY, GAMING, or DEVELOPER",
        }
      },
      required: ["mode"]
    },
    description: "Switch the browser environment mode"
  },
  {
    name: "openModule",
    parameters: {
      type: Type.OBJECT,
      properties: {
        module: {
          type: Type.STRING,
          description: "The Brahma module to open: autocine, scribble, or image-lab",
        }
      },
      required: ["module"]
    },
    description: "Open a Brahma app module (AutoCine video editor, Scribble whiteboard studio, or Image Lab optimizer). In the in-page sidebar it opens the module in a full tab."
  },
  {
    name: "getModuleContext",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Read the live content/state of the currently open Brahma module and return it in chat"
  },
  {
    name: "grabPageText",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Read the readable text of the current website and save it to Neural Archive sources. Runs silently and returns the result in chat."
  },
  {
    name: "grabPageSelection",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Read the text the user has selected on the current web page and return it in chat"
  },
  {
    name: "scanPageImages",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "List the images on the current page without downloading or opening any UI"
  },
  {
    name: "downloadPageImages",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: "Maximum number of images to download, from 1 to 24 (default 12)"
        }
      }
    },
    description: "Collect the images on the current page and download a limited number of them"
  },
  {
    name: "getYouTubeTranscript",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Extract the captions/transcript from the current YouTube video and save it to Neural Archive sources"
  },
  {
    name: "exportCurrentChat",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Export the current ChatGPT, Claude, or Gemini conversation as Markdown and save it to Neural Archive sources"
  },
  {
    name: "exportNotebookSources",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Export the source list from the current NotebookLM notebook and return it in chat"
  },
  {
    name: "readScreenText",
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          description: "OCR language: eng for English or hin for Hindi (default eng)"
        }
      }
    },
    description: "Capture the current web tab, OCR the visible text, and return it in chat. The tab is restored afterwards."
  },
  {
    name: "listExtensions",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "List the installed Chrome extensions and whether each is enabled"
  },
  {
    name: "setExtensionEnabled",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Extension name or ID"
        },
        enabled: {
          type: Type.BOOLEAN,
          description: "True to enable, false to disable"
        }
      },
      required: ["name", "enabled"]
    },
    description: "Enable or disable a Chrome extension. Only use when the user explicitly asks."
  },
  {
    name: "openShortcut",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the shortcut to open (e.g., YouTube, GitHub)"
        }
      },
      required: ["name"]
    },
    description: "Open a predefined website shortcut"
  },
  {
    name: "searchWeb",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query to look up on the web"
        }
      },
      required: ["query"]
    },
    description: "Search the web for information using Google Search"
  },
  {
    name: "executeAutomation",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task: {
          type: Type.STRING,
          description: "The automation task to perform (e.g., 'Login to Teams', 'Submit Assignment')"
        },
        steps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of steps to execute"
        }
      },
      required: ["task", "steps"]
    },
    description: "Execute a complex browser automation sequence"
  },
  {
    name: "summarizePage",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "Optional URL of the page to summarize when the user explicitly gives one"
        },
        content: {
          type: Type.STRING,
          description: "Raw page text or pasted content to summarize when no URL is available"
        }
      }
    },
    description: "Summarize a web page from either its URL or provided page text"
  },
  {
    name: "getWeather",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "The city or location to get weather for (e.g., 'New York', 'London')"
        }
      },
      required: ["location"]
    },
    description: "Get current weather information for a specific location"
  },
  {
    name: "openNewTab",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The URL to open in a new tab"
        }
      },
      required: ["url"]
    },
    description: "Open a new browser tab with the specified URL"
  },
  {
    name: "closeCurrentTab",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Close the current active browser tab"
  },
  {
    name: "navigateTo",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The URL to navigate to in the current tab"
        }
      },
      required: ["url"]
    },
    description: "Navigate the current tab to a new URL"
  },
  {
    name: "goBack",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Go back to the previous page in the current tab"
  },
  {
    name: "goForward",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Go forward to the next page in the current tab"
  }
];


const toOpenAiSchema = (value: any): any => {
  if (Array.isArray(value)) return value.map(toOpenAiSchema);
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'type' && typeof item === 'string') {
        next[key] = item.toLowerCase();
      } else if (key === 'properties' && item && typeof item === 'object' && !Array.isArray(item)) {
        next[key] = Object.fromEntries(
          Object.entries(item as Record<string, any>).map(([prop, schema]) => [prop, toOpenAiSchema(schema)])
        );
      } else if (key === 'items' || key === 'additionalProperties') {
        next[key] = toOpenAiSchema(item);
      } else {
        next[key] = item;
      }
    }
    return next;
  }
  return value;
};

const OPENAI_AGENT_TOOLS: AIToolDefinition[] = browserTools.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name || '',
    description: tool.description || '',
    parameters: toOpenAiSchema(tool.parameters || { type: 'object', properties: {} }),
  },
}));
const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: '1', name: 'Chrome', url: 'https://google.com', icon: 'LayoutGrid', color: '#4285F4', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=256' },
  { id: '2', name: 'YouTube', url: 'https://youtube.com', icon: 'Youtube', color: '#FF0000', favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=256' },
  { id: '3', name: 'Discord', url: 'https://discord.com', icon: 'MessageSquare', color: '#5865F2', favicon: 'https://www.google.com/s2/favicons?domain=discord.com&sz=256' },
  { id: '4', name: 'Gmail', url: 'https://gmail.com', icon: 'Mail', color: '#EA4335', favicon: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=256' },
  { id: '5', name: 'GitHub', url: 'https://github.com', icon: 'Github', color: '#ffffff', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=256' },
];

const MODE_COPY: Record<AppMode, { label: string; blurb: string }> = {
  [AppMode.STUDY]: {
    label: 'Deep Focus',
    blurb: 'Organize research, notes, and summaries without losing momentum.',
  },
  [AppMode.GAMING]: {
    label: 'Play Command',
    blurb: 'Pull guides, patch notes, and gaming shortcuts into one launch surface.',
  },
  [AppMode.DEVELOPER]: {
    label: 'Build Console',
    blurb: 'Keep your tools, code prompts, and debugging flow in a sharper workspace.',
  },
};
const BOOT_LINES = [
  'Initializing Brahma OS...',
  'Loading AI modules...',
  'Connecting systems...',
  'System Ready.',
];
const CONTEXT_HINTS = [
  { match: 'youtube.com', text: 'Want a summary of this video?', action: 'Summarize' },
  { match: 'github.com', text: 'Explain this repo?', action: 'Debug' },
  { match: 'medium.com', text: 'Create notes from this?', action: 'Summarize' },
  { match: 'wikipedia.org', text: 'Turn this into study notes?', action: 'Flashcards' },
];

const decodeHtml = (value?: string | null) => {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.documentElement.textContent || '').trim();
};

const formatNewsDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const parseNewsRss = (xmlText: string): NewsItem[] => {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(xml.querySelectorAll('item')).slice(0, 8).map((item) => ({
    title: decodeHtml(item.querySelector('title')?.textContent) || 'Untitled',
    link: item.querySelector('link')?.textContent?.trim() || '#',
    source: decodeHtml(item.querySelector('source')?.textContent) || 'Google News',
    pubDate: formatNewsDate(item.querySelector('pubDate')?.textContent),
    description: decodeHtml(item.querySelector('description')?.textContent),
  }));
};

const getStoredMode = (): AppMode => {
  try {
    const savedMode = localStorage.getItem('brahma-mode') as AppMode | null;
    if (savedMode && Object.values(AppMode).includes(savedMode)) return savedMode;
  } catch {}
  return AppMode.STUDY;
};

const getStoredAutoMode = (): boolean => {
  try {
    const saved = localStorage.getItem('brahma-auto-mode');
    return saved === null ? true : saved === 'true';
  } catch {}
  return true;
};

const getStoredLightMode = (): boolean => {
  try {
    const saved = localStorage.getItem('brahma-light-mode');
    return saved === null ? true : saved === 'true';
  } catch {}
  return true;
};

const getThemePalette = (mode: AppMode, light: boolean) =>
  (light ? LIGHT_MODE_THEMES : MODE_THEMES)[mode];

const getStoredThemeForMode = (mode: AppMode, light: boolean = getStoredLightMode()) => {
  try {
    const saved = localStorage.getItem(`brahma-theme-colors-${light ? 'light-' : ''}${mode}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return getThemePalette(mode, light);
};

const getStoredProvider = (): AIProvider => getActiveProvider();

const getStoredKey = (provider: AIProvider): string => getProviderApiKey(provider);

const getOnboardingDone = () => {
  try {
    return localStorage.getItem('onboarding_done') === 'true' || localStorage.getItem('onboarding_done') === '1';
  } catch {}
  return false;
};

const SHOW_SHIELD = false; // hide Shield UI when OS-only is desired

const normalizeModuleId = (raw: string): BrahmaModuleId | null => {
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (['autocine', 'autocline', 'autocin', 'autocinevideo'].includes(key)) return 'autocine';
  if (key.includes('scribble')) return 'scribble';
  if (['imagelab', 'image', 'images', 'imagelaboratory'].includes(key)) return 'image-lab';
  const exact = BRAHMA_MODULES.find(
    (module) => module.id === key || module.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === key
  );
  return exact?.id || null;
};

const detectDirectToolIntent = (input: string): { name: string; args?: Record<string, unknown> } | null => {
  const text = input.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return null;

  if (/\btranscript\b/.test(text) && /(youtube|video|this page|current page|this tab)/.test(text)) {
    return { name: 'getYouTubeTranscript' };
  }
  if (/\bocr\b/.test(text) || /(extract|read|scan).{0,24}(screen|visible) text/.test(text)) {
    const language = /hindi|hin\b/.test(text) ? 'hin' : 'eng';
    return { name: 'readScreenText', args: { language } };
  }
  if (/(export|extract|save).{0,24}(notebooklm|notebook).{0,24}(source|sources)/.test(text) || /notebooklm sources?/.test(text)) {
    return { name: 'exportNotebookSources' };
  }
  if (/(export|extract|save|download).{0,24}(chat|conversation)/.test(text)) {
    return { name: 'exportCurrentChat' };
  }
  if (/(download|save).{0,24}(images?|pictures?)/.test(text)) {
    const limitMatch = text.match(/\b(\d{1,2})\s+(images?|pictures?)/);
    return { name: 'downloadPageImages', args: limitMatch ? { limit: Number(limitMatch[1]) } : {} };
  }
  if (/(list|scan|show|find|count).{0,24}(images?|pictures?)/.test(text)) {
    return { name: 'scanPageImages' };
  }
  if (/(selected|selection) text|text (i|you) selected|grab selection/.test(text)) {
    return { name: 'grabPageSelection' };
  }
  if (/(extract|read|grab|get).{0,24}(page|site|article|website).{0,24}text|page text/.test(text)) {
    return { name: 'grabPageText' };
  }
  if (/(open|launch|start|show).{0,24}(auto ?cine|autocline|auto cline|scribble|image ?lab)/.test(text)) {
    const moduleMatch = text.match(/(auto ?cine|autocline|auto cline|scribble(?: studio)?|image ?lab)/);
    const id = moduleMatch ? normalizeModuleId(moduleMatch[1]) : null;
    if (id) return { name: 'openModule', args: { module: id } };
  }
  return null;
};

export default function App() {
const [mode, setMode] = useState<AppMode>(() => getStoredMode());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [activeModule, setActiveModule] = useState<BrahmaModuleId | null>(() => {
    try {
      const requested = new URLSearchParams(window.location.search).get('module');
      const id = requested ? normalizeModuleId(requested) : null;
      return id && getModule(id)?.available ? id : null;
    } catch {
      return null;
    }
  });
  const activeModuleHostRef = useRef<ModuleHostHandle | null>(null);
  const agentTargetRef = useRef<ToolTarget | null>(null);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [archiveStatusMessage, setArchiveStatusMessage] = useState<string | null>(null);
  const [isCapturingSource, setIsCapturingSource] = useState(false);
  const [isCapturingSelection, setIsCapturingSelection] = useState(false);
  const [apiStatus, setApiStatus] = useState<'ready' | 'missing'>('missing');
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => getStoredProvider());
  const [userApiKey, setUserApiKey] = useState<string>(() => getStoredKey(getStoredProvider()));
  const [aiModel, setAiModel] = useState<string>(() => getProviderModel(getStoredProvider()));
  const [providerOrder, setProviderOrderState] = useState<AIProvider[]>(() => getProviderOrder());
  const [providerTest, setProviderTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [providerTestMessage, setProviderTestMessage] = useState<string | null>(null);
  const [hubUrl, setHubUrlState] = useState<string>(() => getHubUrl());
  const [hubToken, setHubTokenState] = useState<string>(() => getHubToken());
  const [hubStatus, setHubStatus] = useState<'idle' | 'checking' | 'online' | 'error'>('idle');
  const [hubMessage, setHubMessage] = useState<string | null>(null);
  const [showApiPrompt, setShowApiPrompt] = useState<boolean>(false);
  const [aiHealth, setAiHealth] = useState<'checking' | 'online' | 'error'>('checking');
  const [aiHealthMessage, setAiHealthMessage] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachments, setChatAttachments] = useState<{ name: string; mime: string; data: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sidebarTask, setSidebarTask] = useState<{ id?: string; action: string; text: string } | null>(null);
  const [sequentialMode, setSequentialMode] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [isChatNavCollapsed, setIsChatNavCollapsed] = useState(true);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isChatListening, setIsChatListening] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [showToolsPage, setShowToolsPage] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('tools') === '1';
    } catch {
      return false;
    }
  });
  const [toolsInitialTab, setToolsInitialTab] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get('tool') || 'ocr';
    } catch {
      return 'ocr';
    }
  });
  const [toolsRequestNonce, setToolsRequestNonce] = useState(0);
  const [toolsTargetTabId, setToolsTargetTabId] = useState<number | null>(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('tabId');
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  });
  const [autoMode, setAutoMode] = useState<boolean>(() => getStoredAutoMode());
  const [smartTips, setSmartTips] = useState<string[]>([]);
  const [focusAlert, setFocusAlert] = useState<string | null>(null);
  const [isFocusBlur, setIsFocusBlur] = useState(false);
  const [taskQueue, setTaskQueue] = useState<string[]>([]);
  const [isExecutingQueue, setIsExecutingQueue] = useState(false);
  const [userMemory, setUserMemory] = useState<string>('');
  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsWorld, setNewsWorld] = useState<NewsItem[]>([]);
  const [newsIndia, setNewsIndia] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [shieldStatus, setShieldStatus] = useState<'OFF'|'CONNECTING'|'ACTIVE'>('OFF');
  const [shieldProxy, setShieldProxy] = useState<string>('none');
  const [showVpnModal, setShowVpnModal] = useState(false);
  const [shieldLocation, setShieldLocation] = useState<string>('Unknown');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !getOnboardingDone());
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>(() => getOnboardingDone() ? 'complete' : 'boot');
  const [bootVisibleLines, setBootVisibleLines] = useState(0);
  const [tourStep, setTourStep] = useState(0);
  const [tourTypedText, setTourTypedText] = useState('');
  const [pendingModeSelection, setPendingModeSelection] = useState<AppMode>(() => getStoredMode());
  const [contextHint, setContextHint] = useState<{ text: string; action: string } | null>(null);
  const [modeReady, setModeReady] = useState(false);
  const sendShield = async (payload: any) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setShieldStatus('OFF');
      setShieldProxy('extension-required');
      return { ok: false, error: 'Not running as extension' };
    }
    try {
      return await chrome.runtime.sendMessage(payload);
    } catch (e) {
      console.warn('Shield message failed', e);
      return { ok: false, error: String(e) };
    }
  };
  const refreshShield = async () => {
    const res = await sendShield({ type: 'get-state' });
    if (res && res.state) {
      setShieldStatus(res.state.status);
      const proxy = res.proxies?.[res.state.currentIndex];
      setShieldProxy(proxy ? proxy.host : 'none');
    } else {
      setShieldStatus('OFF');
      setShieldProxy('none');
    }
  };


  // Check if running in sidebar mode
  const isSidebarMode = new URLSearchParams(window.location.search).get('sidebar') === 'true';

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (activeModule) url.searchParams.set('module', activeModule);
      else url.searchParams.delete('module');
      if (url.toString() !== window.location.href) {
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [activeModule]);

  // Shortcuts State - Load from localStorage or use defaults
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    try {
      const saved = localStorage.getItem('brahma-shortcuts');
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
    } catch (e) {
      return DEFAULT_SHORTCUTS;
    }
  });
  const [showAddShortcut, setShowAddShortcut] = useState(false);
  const [newShortcutName, setNewShortcutName] = useState('');
  const [newShortcutUrl, setNewShortcutUrl] = useState('');

  // Sidebar Toggles
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); // Never open automatically
  const [currentSidebarTab, setCurrentSidebarTab] = useState<'main' | 'accessibility'>('main');

  // Theme and Background Customization
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [lightMode, setLightMode] = useState<boolean>(() => getStoredLightMode());
  const [themeColors, setThemeColors] = useState(() => getStoredThemeForMode(getStoredMode(), getStoredLightMode()));
  // The in-page drawer always uses the light Brahma theme, matching the desktop sidebar.
  const effectiveLightMode = lightMode || isSidebarMode;
  const effectiveThemeColors = isSidebarMode ? getStoredThemeForMode(mode, true) : themeColors;
  // Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatSpeechRef = useRef<any>(null);
  const searchSurfaceRef = useRef<HTMLDivElement | null>(null);
  const quickActionStripRef = useRef<HTMLDivElement | null>(null);

  // System Monitoring States
  const [currentTime, setCurrentTime] = useState<string>('');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [weather, setWeather] = useState<{ temp: number; description: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const applyMode = (m: AppMode) => {
    setMode(m);
    const palette = getStoredThemeForMode(m, lightMode);
    setThemeColors(palette);
    try { localStorage.setItem('brahma-mode', m); } catch {}
    try { chrome.storage?.local?.set?.({ 'brahma-mode': m }); } catch {}
    const tips = MODE_BEHAVIORS[m]?.suggestions || [];
    setSmartTips(tips.slice(0, 3));
    // notify shield background
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'set-mode', mode: m }).catch(() => {});
    }
  };

  const toggleLightMode = (next: boolean) => {
    setLightMode(next);
    try { localStorage.setItem('brahma-light-mode', String(next)); } catch {}
    setThemeColors(getStoredThemeForMode(mode, next));
  };

  const switchProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    setProviderOrderState(setActiveProvider(provider));
    setUserApiKey(getStoredKey(provider));
    setAiModel(getProviderModel(provider));
    setProviderTest('idle');
    setProviderTestMessage(null);
    setAiHealth('checking');
    setAiHealthMessage(null);
  };

  const moveProvider = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= providerOrder.length) return;
    const next = [...providerOrder];
    [next[index], next[target]] = [next[target], next[index]];
    const saved = setProviderOrder(next);
    setProviderOrderState(saved);
    if (saved[0] !== aiProvider) {
      setAiProvider(saved[0]);
      setUserApiKey(getStoredKey(saved[0]));
      setAiModel(getProviderModel(saved[0]));
    }
  };

  const enqueueTasks = (steps: string[]) => {
    if (steps.length === 0) return;
    setTaskQueue(steps);
    runTaskQueue(steps);
  };

  const runTaskQueue = async (queue: string[]) => {
    if (queue.length === 0) {
      setTaskQueue([]);
      setIsExecutingQueue(false);
      return;
    }
    setIsExecutingQueue(true);
    const [current, ...rest] = queue;
    try {
      await handleAgentChat(undefined, current);
    } catch (error) {
      console.error('Queued task failed:', error);
    }
    setTimeout(() => runTaskQueue(rest), 700);
  };

  // auto-detect context from hostname and switch mode when enabled
  useEffect(() => {
    if (!modeReady) return;
    let lastHost = window.location.hostname;
    const detect = () => {
      const host = window.location.hostname;

      // auto mode switch
      if (autoMode) {
        const match = (Object.keys(MODE_BEHAVIORS) as AppMode[]).find(m => MODE_BEHAVIORS[m].hosts.some(h => host.includes(h)));
        if (match && match !== mode) {
          applyMode(match);
        }
      }

      if (host === lastHost) return;
      lastHost = host;

      // focus rules per mode
      const behavior = MODE_BEHAVIORS[mode];
      if (mode === AppMode.STUDY && behavior.distractions?.some(h => host.includes(h))) {
        setFocusAlert("Focus Shield: distracting site detected. Switch to a study-friendly resource?");
        setIsFocusBlur(true);
      } else if (mode === AppMode.GAMING && behavior.workHosts?.some(h => host.includes(h))) {
        setFocusAlert("Gaming Mode: work site detected. Want to switch to Dev mode?");
        setIsFocusBlur(false);
      } else {
        setFocusAlert(null);
        setIsFocusBlur(false);
      }
    };
    const id = window.setInterval(detect, 2000);
    detect();
    return () => clearInterval(id);
  }, [autoMode, mode, modeReady]);

  // poll shield state
  useEffect(() => {
    refreshShield();
    const id = setInterval(refreshShield, 4000);
    return () => clearInterval(id);
  }, []);

  // fetch location when shield active
  useEffect(() => {
    if (shieldStatus !== 'ACTIVE') return;
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        if (d && d.city) setShieldLocation(`${d.city}, ${d.country_name || d.country || ''}`);
        else setShieldLocation('Updated');
      })
      .catch(() => setShieldLocation('Unknown'));
  }, [shieldStatus]);

  useEffect(() => {
    if (!showNews) return;
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const [worldRes, indiaRes] = await Promise.all([
          fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', { cache: 'no-store' }),
          fetch('https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en', { cache: 'no-store' }),
        ]);

        if (!worldRes.ok || !indiaRes.ok) {
          throw new Error('News feeds unavailable');
        }

        const [worldXml, indiaXml] = await Promise.all([worldRes.text(), indiaRes.text()]);
        const worldItems = parseNewsRss(worldXml);
        const indiaItems = parseNewsRss(indiaXml);

        if (!worldItems.length && !indiaItems.length) {
          throw new Error('No news items found');
        }

        setNewsWorld(worldItems);
        setNewsIndia(indiaItems);
      } catch (err: any) {
        setNewsError('Could not load news right now. Please try again in a moment.');
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, [showNews]);

  // Persist notes and background so UX survives reloads
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem('brahma-notes');
      if (savedNotes) setNotes(JSON.parse(savedNotes));
    } catch {}
  }, []);

  useEffect(() => {
    applyMode(getStoredMode());
    setAutoMode(getStoredAutoMode());
    setModeReady(true);
    try {
      const savedKey = getStoredKey(getStoredProvider());
      if (savedKey) {
        setUserApiKey(savedKey);
        setShowApiPrompt(false);
      } else {
        setUserApiKey('');
        setShowApiPrompt(true);
      }
    } catch {}

    try {
      const savedMem = localStorage.getItem('brahma-user-memory');
      if (savedMem) setUserMemory(savedMem);
    } catch {}

    try {
      const savedVpn = localStorage.getItem('brahma-vpn');
      if (savedVpn) setVpnEnabled(savedVpn === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('brahma-chat-sessions');
      const savedFolders = localStorage.getItem('brahma-chat-folders');
      const savedActive = localStorage.getItem('brahma-active-chat');
      if (savedFolders) setFolders(JSON.parse(savedFolders));

      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as ChatSession[];
        if (parsed.length === 0) {
          const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
          setChatSessions([seed]);
          setActiveSessionId(seed.id);
        } else {
          setChatSessions(parsed);
          setActiveSessionId(savedActive || parsed[0].id);
        }
      } else {
        const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
        setChatSessions([seed]);
        setActiveSessionId(seed.id);
      }
    } catch {
      const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
      setChatSessions([seed]);
      setActiveSessionId(seed.id);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-chat-sessions', JSON.stringify(chatSessions));
      if (activeSessionId) localStorage.setItem('brahma-active-chat', activeSessionId);
      localStorage.setItem('brahma-chat-folders', JSON.stringify(folders));
    } catch {}
  }, [chatSessions, activeSessionId, folders]);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-notes', JSON.stringify(notes));
    } catch {}
  }, [notes]);

  useEffect(() => {
    try {
      const savedBg = localStorage.getItem('brahma-wallpaper');
      if (savedBg) setCustomBackground(savedBg);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (customBackground) {
        localStorage.setItem('brahma-wallpaper', customBackground);
      } else {
        localStorage.removeItem('brahma-wallpaper');
      }
    } catch {}
  }, [customBackground]);

  // Save shortcuts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('brahma-shortcuts', JSON.stringify(shortcuts));
  }, [shortcuts]);

  // persist theme colors
  useEffect(() => {
    try {
      localStorage.setItem(`brahma-theme-colors-${lightMode ? 'light-' : ''}${mode}`, JSON.stringify(themeColors));
    } catch {}
  }, [mode, themeColors, lightMode]);

  // persist auto-mode flag
  useEffect(() => {
    try { localStorage.setItem('brahma-auto-mode', String(autoMode)); } catch {}
    try { chrome.storage?.local?.set?.({ 'brahma-auto-mode': autoMode }); } catch {}
  }, [autoMode]);

  // persist user memory
  useEffect(() => {
    try { localStorage.setItem('brahma-user-memory', userMemory); } catch {}
  }, [userMemory]);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-vpn', String(vpnEnabled));
    } catch {}
  }, [vpnEnabled]);

  // Clock Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Battery Status Effect
  useEffect(() => {
    const getBatteryStatus = async () => {
      try {
        const battery = await (navigator as any).getBattery?.() || (navigator as any).battery;
        if (battery) {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener?.('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        }
      } catch (e) {
        console.log('Battery API not available');
      }
    };
    getBatteryStatus();
  }, []);

  // Memory Usage Effect
  useEffect(() => {
    const getMemoryUsage = () => {
      try {
        if ((performance as any).memory) {
          const used = (performance as any).memory.usedJSHeapSize;
          const limit = (performance as any).memory.jsHeapSizeLimit;
          const percentage = Math.round((used / limit) * 100);
          setMemoryUsage(percentage);
        }
      } catch (e) {
        console.log('Memory API not available');
      }
    };
    getMemoryUsage();
    const interval = setInterval(getMemoryUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  // Geolocation and Weather Effect
  useEffect(() => {
    const getLocationAndWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ lat: latitude, lng: longitude });

            try {
              const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
              );
              const data = await response.json();
              if (data.current) {
                const weatherDescriptions: { [key: number]: string } = {
                  0: 'Clear',
                  1: 'Cloudy',
                  2: 'Overcast',
                  3: 'Overcast',
                  45: 'Foggy',
                  48: 'Foggy',
                  51: 'Light Drizzle',
                  53: 'Moderate Drizzle',
                  55: 'Heavy Drizzle',
                  61: 'Slight Rain',
                  63: 'Moderate Rain',
                  65: 'Heavy Rain',
                  71: 'Slight Snow',
                  73: 'Moderate Snow',
                  75: 'Heavy Snow',
                  80: 'Rain Showers',
                  81: 'Rain Showers',
                  82: 'Heavy Rain Showers',
                  85: 'Snow Showers',
                  86: 'Heavy Snow Showers',
                  95: 'Thunderstorm',
                  96: 'Thunderstorm with Hail',
                  99: 'Thunderstorm with Hail',
                };
                setWeather({
                  temp: Math.round(data.current.temperature_2m),
                  description: weatherDescriptions[data.current.weather_code] || 'Unknown'
                });
              }
            } catch (error) {
              console.log('Weather API error:', error);
            }
          },
          (error) => {
            console.log('Geolocation error:', error);
          }
        );
      }
    };
    getLocationAndWeather();
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
        handleSearch(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      // chat speech recognition instance
      chatSpeechRef.current = new SpeechRecognition();
      chatSpeechRef.current.continuous = false;
      chatSpeechRef.current.interimResults = false;
      chatSpeechRef.current.lang = 'en-US';
      chatSpeechRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsChatListening(false);
      };
      chatSpeechRef.current.onerror = () => setIsChatListening(false);
      chatSpeechRef.current.onend = () => setIsChatListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Automation Log
  const [automationLogs, setAutomationLogs] = useState<{ id: string, text: string, status: 'pending' | 'success' | 'error' }[]>([]);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const resolveShortcut = (nameRaw: string) => {
    const name = nameRaw.toLowerCase();
    const aliasMap: Record<string, string> = {
      yt: 'youtube',
      youtube: 'youtube',
      discord: 'discord',
      dc: 'discord',
      mail: 'gmail',
      gmail: 'gmail',
      gh: 'github',
      github: 'github'
    };
    const normalized = aliasMap[name] || name;
    return shortcuts.find(s => {
      const n = s.name.toLowerCase();
      return n === normalized || n.includes(normalized) || normalized.includes(n);
    });
  };

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || null;
  const activeMessages: ChatMessage[] = activeSession?.messages || [];
  const activeMessagesRef = useRef<ChatMessage[]>(activeMessages);
  activeMessagesRef.current = activeMessages;

  const setChatMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (!activeSession) return;
    setChatSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSession.id) return s;
        const nextMessages = typeof updater === 'function' ? (updater as any)(s.messages) : updater;
        return { ...s, messages: nextMessages };
      })
    );
  };

  const appendMessages = (msgs: ChatMessage[]) => {
    if (!activeSession) {
      // Auto-bootstrap a session if something wiped it out.
      const seed: ChatSession = { id: Date.now().toString(), title: `Chat ${chatSessions.length + 1 || 1}`, messages: [], createdAt: Date.now() };
      setChatSessions(prev => [...prev, seed]);
      setActiveSessionId(seed.id);
      return;
    }
    setChatSessions(prev =>
      prev.map(s => s.id === activeSession.id ? { ...s, messages: [...s.messages, ...msgs] } : s)
    );
  };

  useEffect(() => {
    if (!activeSessionId && chatSessions.length > 0) {
      setActiveSessionId(chatSessions[0].id);
    }
  }, [chatSessions, activeSessionId]);

  const deleteSession = (id: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = chatSessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0]?.id ?? null);
    }
  };

  const moveSessionToFolder = (sessionId: string, folderId: string | null) => {
    setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId: folderId || undefined } : s));
  };

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSession: ChatSession = { id, title: `Chat ${chatSessions.length + 1}`, messages: [], createdAt: Date.now() };
    setChatSessions(prev => [...prev, newSession]);
    setActiveSessionId(id);
  };

  const createNewFolder = () => {
    const name = prompt('Folder name?');
    if (!name || !name.trim()) return;
    const folder: ChatFolder = { id: Date.now().toString(), name: name.trim() };
    setFolders(prev => [...prev, folder]);
  };

  const speakText = (text: string) => {
    if (!speakEnabled || typeof window === 'undefined' || !(window as any).speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    (window as any).speechSynthesis.cancel();
    (window as any).speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const sc = chatScrollRef.current;
    if (sc) {
      sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    }
  }, [activeSessionId, chatSessions, isChatLoading]);

  useEffect(() => {
    const key = userApiKey.trim();
    if (aiProvider === 'gemini' && key) {
      aiRef.current = new GoogleGenAI({ apiKey: key });
    } else {
      aiRef.current = null;
    }
    const anyConfigured = hasConfiguredProvider({ [aiProvider]: key });
    if (key || anyConfigured) {
      setApiStatus('ready');
      setApiMessage(null);
      setAiHealth('online');
      setAiHealthMessage(null);
      setShowApiPrompt(false);
    } else {
      setApiStatus('missing');
      setApiMessage(`Enter your ${AI_PROVIDERS[aiProvider].label} API key to start.`);
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      setShowApiPrompt(true);
    }

    // Chrome Extension Message Listener
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (request: any) => {
        if (request.action === 'BRAHMA_SUMMARIZE') {
          handleAgentChat(undefined, `Summarize this page content: ${request.text}`);
        } else if (request.action === 'BRAHMA_EXPLAIN') {
          handleAgentChat(undefined, `Explain this selected text: ${request.text}`);
        } else if (request.action === 'BRAHMA_OPTIMIZE') {
          handleAgentChat(undefined, `Rewrite and improve this text clearly: ${request.text}`);
        } else if (request.action === 'BRAHMA_TRANSLATE') {
          handleAgentChat(undefined, `Translate this text and preserve its meaning: ${request.text}`);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, [userApiKey, aiProvider]);



  const openUrl = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const aiReady = hasConfiguredProvider({ [aiProvider]: userApiKey.trim() });

  const pingModel = async () => {
    const key = userApiKey.trim() || getStoredKey(aiProvider);
    try {
      setAiHealth('checking');
      setProviderTest('testing');
      setProviderTestMessage(null);
      const result = await testProvider(aiProvider, key, aiModel);
      setAiHealth('online');
      setAiHealthMessage(null);
      setProviderTest('ok');
      setProviderTestMessage(`${AI_PROVIDERS[result.providerId].label} responded with ${result.model}.`);
    } catch (err: any) {
      const message = err instanceof AIProviderError ? err.message : parseGenAiError(err).message;
      setAiHealth('error');
      setAiHealthMessage(message);
      setProviderTest('error');
      setProviderTestMessage(message);
    }
  };

  const buildContext = () => {
    const stats = [`Mode: ${mode}`];
    if (currentTime) stats.push(`Local time: ${currentTime}`);
    if (weather) stats.push(`Weather: ${weather.temp}A�C ${weather.description}`);
    if (batteryLevel !== null) stats.push(`Battery: ${batteryLevel}%`);
    if (memoryUsage !== null) stats.push(`Memory usage: ${memoryUsage}%`);
    const shortcutsList = shortcuts.slice(0, 6).map(s => s.name).join(', ') || 'none';
    const noteList = notes.slice(0, 3).map(n => n.title || 'Untitled').join(' | ') || 'none';
    const mem = userMemory ? `User memory: ${userMemory}` : 'User memory: none yet.';
    const modules = BRAHMA_MODULES.map((module) => `${module.name} [${module.id}]`).join(', ');
    const storedModule = readStoredModuleSnapshot();
    const activeModuleInfo = activeModule ? getModule(activeModule) : storedModule ? getModule(storedModule.moduleId) : null;
    const page = agentTargetRef.current;
    const pageInfo = page ? `Current web tab: ${page.title} (${page.url}).` : 'Current web tab: unknown.';
    let moduleSnapshot = '';
    if (activeModule) {
      try {
        const snapshot = activeModuleHostRef.current?.captureSnapshot();
        if (snapshot?.content) moduleSnapshot = ` Active module content: ${snapshot.content.slice(0, 3000)}`;
      } catch {}
    }
    if (!moduleSnapshot && storedModule?.content) {
      moduleSnapshot = ` Active module content: ${storedModule.content.slice(0, 3000)}`;
    }
    return `Environment -> ${stats.join(' | ')}. ${pageInfo} Shortcuts: ${shortcutsList}. Notes: ${noteList}. ${mem} Available modules: ${modules}. Active module: ${activeModuleInfo ? `${activeModuleInfo.name} (${activeModuleInfo.id})` : 'none'}.${moduleSnapshot} Available browser tools: grabPageText, grabPageSelection, scanPageImages, downloadPageImages, getYouTubeTranscript, exportCurrentChat, exportNotebookSources, readScreenText, listExtensions, setExtensionEnabled. Module tools: openModule, getModuleContext.`;
  };

  const buildInstruction = () => {
    const base = {
      [AppMode.STUDY]: "Be a practical learning coach. Default to concise replies (<=80 words) unless the user explicitly asks for more. Offer 1-2 key points and 1 actionable next step.",
      [AppMode.GAMING]: "Be an esports analyst. Keep it concise (<=80 words). Give the single best strategy or weakness and a short execution plan.",
      [AppMode.DEVELOPER]: "Be a senior engineer. Keep answers short (<=80 words) unless asked to elaborate. Provide direct fixes or code snippets with minimal filler."
    }[mode];

    return `${base}
Guidelines: 
- Stay under ~80 words unless the user says 'long' or 'detailed'.
- Answer directly; avoid greeting-only replies.
- Use bullets only when they add clarity.
- If user just greets, give a friendly 1-liner plus a quick question to move forward.
- If uncertain, state assumptions briefly.`;
  };

  const parseGenAiError = (err: any): { message: string; quota: boolean; modelUnavailable: boolean } => {
    const msg = err?.message || '';
    const lower = msg.toLowerCase();
    const unauthorized =
      err?.status === 401 ||
      err?.status === 403 ||
      lower.includes('unauthorized') ||
      lower.includes('invalid api key') ||
      lower.includes('incorrect api key') ||
      lower.includes('invalid_api_key');
    const quota =
      lower.includes('resource_exhausted') ||
      lower.includes('quota') ||
      lower.includes('rate limit');
    const modelUnavailable =
      err?.status === 404 ||
      err?.status === 503 ||
      err?.code === 404 ||
      lower.includes('not_found') ||
      lower.includes('not found') ||
      lower.includes('no longer available') ||
      lower.includes('unsupported model') ||
      lower.includes('does not exist') ||
      lower.includes('high demand') ||
      lower.includes('overloaded') ||
      lower.includes('temporarily unavailable');
    if (unauthorized) {
      return { message: 'Invalid or unauthorized API key. Update it in API Key settings.', quota: false, modelUnavailable: false };
    }
    if (quota) {
      return { message: `${AI_PROVIDERS[aiProvider].label} quota or rate limit reached for this API key. Wait a moment or check your plan.`, quota: true, modelUnavailable };
    }
    return { message: msg || 'Connection failed.', quota: false, modelUnavailable };
  };

  const handleSearch = async (customQuery?: string) => {
    const finalQuery = customQuery || query;
    if (!finalQuery.trim()) return;

    // If it's a normal search (not starting with / or specifically for Brahma)
    // and it doesn't look like a question, we can offer Google search.
    // But the user said "like a normal searchbar", so let's make it a Google search by default
    // and use the Sparkles button for Brahma.
    
    const isBrahmaQuery = finalQuery.startsWith('/') || finalQuery.toLowerCase().includes('brahma');
    
    if (!isBrahmaQuery && !customQuery) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`, '_blank');
      return;
    }

    if (!aiReady) {
      setAiResponse({
        content: apiMessage || `Add your ${AI_PROVIDERS[aiProvider].label} API key in the API Key settings to start.`,
        type: 'general'
      });
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      return;
    }

    setIsLoading(true);
    setAiResponse(null);
    try {
      const context = buildContext();
      const systemInstruction = buildInstruction();

      const systemPrompt = `${systemInstruction}
Context: ${context}
Keep the answer tight and natural; only add structure if user asks.`;
      const hasImages = chatAttachments.length > 0;
      const geminiKey = aiProvider === 'gemini' ? (userApiKey.trim() || getStoredKey('gemini')) : getStoredKey('gemini');

      let responseText = '';
      if (hasImages && geminiKey && aiRef.current) {
        const runModel = async (model: string) => {
          return aiRef.current!.models.generateContent({
            model,
            contents: [
              ...chatAttachments.map(a => ({
                inlineData: { mimeType: a.mime, data: a.data }
              })),
              finalQuery
            ],
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.4,
              maxOutputTokens: 256
            }
          });
        };

        let response;
        try {
          response = await runModel(GENAI_MODEL);
        } catch (err: any) {
          const parsed = parseGenAiError(err);
          if (parsed.quota || parsed.modelUnavailable) {
            response = await runModel(FALLBACK_MODEL);
          } else {
            throw err;
          }
        }
        responseText = response.text || '';
      } else {
        const note = hasImages
          ? '\nNote: image attachments were ignored because the selected provider is text-only.'
          : '';
        const result = await completeWithFallback(
          {
            messages: [
              { role: 'system', content: `${systemPrompt}${note}` },
              { role: 'user', content: finalQuery },
            ],
            temperature: 0.4,
            maxTokens: 512,
          },
          {
            keys: { [aiProvider]: userApiKey.trim() },
            modelOverrides: { [aiProvider]: aiModel },
          }
        );
        responseText = result.text;
      }

      setAiResponse({
        content: responseText || "No response generated.",
        type: mode === AppMode.STUDY ? 'summary' : mode === AppMode.GAMING ? 'strategy' : 'code'
      });
      setAiHealth('online');
      setAiHealthMessage(null);
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiHealth('error');
      const parsed = parseGenAiError(error);
      setAiHealthMessage(parsed.message);
      if (parsed.quota) setShowApiPrompt(true);
      setAiResponse({ content: parsed.message || "Error connecting to Brahma Core. Please check your connection.", type: 'general' });
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: aiResponse?.content || '',
      timestamp: Date.now(),
      kind: 'note',
      useForAgent: true,
    };
    setNotes([note, ...notes]);
    setNewNoteTitle('');
    setShowNotes(true);
  };

  const addArchiveSource = () => {
    const title = newSourceTitle.trim();
    const rawUrl = newSourceUrl.trim();
    const content = newSourceContent.trim();
    if (!title || (!rawUrl && !content)) return;

    let sourceUrl = rawUrl;
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      sourceUrl = `https://${sourceUrl}`;
    }

    const source: Note = {
      id: `${Date.now()}-source`,
      title,
      content,
      sourceUrl,
      timestamp: Date.now(),
      kind: 'source',
      useForAgent: true,
    };

    setNotes([source, ...notes]);
    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourceContent('');
    setArchiveStatusMessage(`Saved "${title}" to Neural Archive.`);
  };

  const saveCurrentPageAsSource = async () => {
    setArchiveStatusMessage(null);
    setIsCapturingSource(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.scripting?.executeScript) {
        throw new Error('This feature works only inside the extension.');
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const normalTabs = tabs
        .filter((tab) => tab.id && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url))
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      const candidate = normalTabs.find((tab) => tab.active) || normalTabs[0];
      if (!candidate?.id || !candidate.url) {
        throw new Error('Open a normal website tab first, then try again.');
      }

      const injected = await chrome.scripting.executeScript({
        target: { tabId: candidate.id },
        func: () => {
          const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
          const root = document.querySelector('main, article, [role="main"]') || document.body;
          const text = clean((root as HTMLElement)?.innerText || document.body?.innerText || '');
          return {
            title: document.title || window.location.hostname,
            url: window.location.href,
            content: text.slice(0, 12000),
          };
        },
      });

      const payload = injected?.[0]?.result as { title?: string; url?: string; content?: string } | undefined;
      if (!payload?.title || !payload?.url) {
        throw new Error('Could not read the current page.');
      }

      const source: Note = {
        id: `${Date.now()}-page-source`,
        title: payload.title,
        sourceUrl: payload.url,
        content: payload.content || '',
        timestamp: Date.now(),
        kind: 'source',
        useForAgent: true,
      };

      setNotes((prev) => [source, ...prev]);
      setArchiveStatusMessage(`Saved current page: ${payload.title}`);
    } catch (error: any) {
      setArchiveStatusMessage(error?.message || 'Could not save the current page.');
    } finally {
      setIsCapturingSource(false);
    }
  };

  const saveSelectedTextAsSource = async () => {
    setArchiveStatusMessage(null);
    setIsCapturingSelection(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.scripting?.executeScript) {
        throw new Error('This feature works only inside the extension.');
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const normalTabs = tabs
        .filter((tab) => tab.id && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url))
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      const candidate = normalTabs.find((tab) => tab.active) || normalTabs[0];
      if (!candidate?.id || !candidate.url) {
        throw new Error('Open a normal website tab first, then select some text.');
      }

      const injected = await chrome.scripting.executeScript({
        target: { tabId: candidate.id },
        func: () => {
          const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
          const selection = clean(window.getSelection?.()?.toString() || '');
          return {
            title: document.title || window.location.hostname,
            url: window.location.href,
            selection: selection.slice(0, 12000),
          };
        },
      });

      const payload = injected?.[0]?.result as { title?: string; url?: string; selection?: string } | undefined;
      if (!payload?.selection) {
        throw new Error('No text is selected on the page right now.');
      }

      const source: Note = {
        id: `${Date.now()}-selection-source`,
        title: `Selection from ${payload.title || 'page'}`,
        sourceUrl: payload.url,
        content: payload.selection,
        timestamp: Date.now(),
        kind: 'source',
        useForAgent: true,
      };

      setNotes((prev) => [source, ...prev]);
      setArchiveStatusMessage(`Saved selected text from ${payload.title || 'page'}`);
    } catch (error: any) {
      setArchiveStatusMessage(error?.message || 'Could not save selected text.');
    } finally {
      setIsCapturingSelection(false);
    }
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const toggleNoteForAgent = (id: string) => {
    setNotes(notes.map((n) => n.id === id ? { ...n, useForAgent: !(n.useForAgent !== false) } : n));
  };



  const addShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcutName.trim() || !newShortcutUrl.trim()) return;
    
    let url = newShortcutUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    // Extract domain for favicon
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

    const newS: Shortcut = {
      id: Date.now().toString(),
      name: newShortcutName,
      url: url,
      icon: 'ExternalLink',
      color: '#ffffff',
      favicon: faviconUrl
    };

    setShortcuts([...shortcuts, newS]);
    setNewShortcutName('');
    setNewShortcutUrl('');
    setShowAddShortcut(false);
  };

  const deleteShortcut = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShortcuts(shortcuts.filter(s => s.id !== id));
  };

  const handleShortcutClick = (s: Shortcut) => {
    // Proactive Suggestion Logic
    if (s.name.toLowerCase() === 'github' && mode !== AppMode.DEVELOPER) {
      appendMessages([{ 
        role: 'model', 
        content: `I noticed you opened GitHub. Would you like me to switch the system to **Developer Mode** for optimized performance?` 
      }]);
      setIsRightSidebarOpen(true);
    } else if (s.name.toLowerCase() === 'youtube' && mode !== AppMode.GAMING) {
      appendMessages([{ 
        role: 'model', 
        content: `Accessing YouTube. Should I initialize **Gaming/Media Mode** to prioritize bandwidth?` 
      }]);
      setIsRightSidebarOpen(true);
    }
  };

  const triggerTool = (tool: string) => {
    let q = "";
    if (tool === 'Summarize') q = "Please summarize the current topic in detail.";
    if (tool === 'Flashcards') q = "Generate 5 flashcards for the current topic.";
    if (tool === 'ExplainSimple') q = "Explain the selected content like I'm 12, in 5 bullet points.";
    if (tool === 'Quiz') q = "Create a 5 question quiz on the current topic.";
    if (tool === 'Strategy') q = "What is the best strategy for this game/boss?";
    if (tool === 'Debug') q = "Analyze this code for bugs and suggest fixes.";
    if (tool === 'APITest') q = "Provide a quick REST call example (curl) for the current API endpoint.";
    if (tool === 'SummarizeURL') q = "Please summarize the content of a web page. I will provide the URL.";
    
    if (q) {
      handleAgentChat(undefined, q);
    }
  };

  const resolveAgentTarget = async (): Promise<ToolTarget> => {
    let preferredTabId: number | undefined;
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
        const currentTab = await chrome.tabs.getCurrent();
        if (currentTab?.id && /^https?:/i.test(currentTab.url || '')) {
          preferredTabId = currentTab.id;
        }
      }
    } catch {}
    const target = await getToolTarget(preferredTabId);
    agentTargetRef.current = target;
    return target;
  };

  const openModule = (id: BrahmaModuleId) => {
    const target = getModule(id);
    if (!target?.available) return false;
    if (isSidebarMode && typeof chrome !== 'undefined' && chrome.tabs?.create) {
      try {
        const url = new URL(chrome.runtime.getURL('index.html'));
        url.searchParams.set('module', id);
        chrome.tabs.create({ url: url.toString() });
      } catch {
        chrome.tabs.create({ url: getModuleUrl(id) });
      }
      return true;
    }
    setActiveModule(id);
    setIsRightSidebarOpen(false);
    return true;
  };

  const openToolsPage = (tool: string = 'ocr', tabId?: number | null) => {
    setToolsInitialTab(tool);
    setToolsTargetTabId(typeof tabId === 'number' && tabId > 0 ? tabId : null);
    setToolsRequestNonce((current) => current + 1);
    setShowToolsPage(true);
    setShowSettingsPage(false);
    setActiveModule(null);
    setIsRightSidebarOpen(false);
    setIsLeftSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tools', '1');
      url.searchParams.set('tool', tool);
      if (typeof tabId === 'number' && tabId > 0) url.searchParams.set('tabId', String(tabId));
      else url.searchParams.delete('tabId');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const openSiteTool = async (tool: string) => {
    let tabId: number | undefined;
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
        const currentTab = await chrome.tabs.getCurrent();
        tabId = currentTab?.id;
      }
    } catch {}
    try {
      if (!tabId && typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab?.id;
      }
    } catch {}
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        await chrome.runtime.sendMessage({ type: 'BRAHMA_OPEN_TOOLS', tool, tabId });
        return;
      } catch {}
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      try {
        const query = `tool=${encodeURIComponent(tool)}${tabId ? `&tabId=${tabId}` : ''}`;
        window.open(chrome.runtime.getURL(`index.html?tools=1&${query}`), '_blank');
        return;
      } catch {}
    }
    openToolsPage(tool, tabId);
  };

  const closeToolsPage = () => {
    setShowToolsPage(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('tools');
      url.searchParams.delete('tool');
      url.searchParams.delete('tabId');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const saveToolSource = (title: string, content: string, sourceUrl?: string) => {
    const source: Note = {
      id: `${Date.now()}-tool-source`,
      title,
      content,
      sourceUrl,
      timestamp: Date.now(),
      kind: 'source',
      useForAgent: true,
    };
    setNotes((prev) => [source, ...prev]);
    setArchiveStatusMessage(`Saved "${title}" to Neural Archive.`);
  };

  const executeAgentToolCall = async (call: { name: string; args?: any; id?: string }) => {
          const logId = Date.now().toString() + Math.random();
          
          if (call.name === 'switchMode') {
            const newMode = (call.args as any).mode as AppMode;
            applyMode(newMode);
                  setAutomationLogs(prev => [{ id: logId, text: `Switching environment to ${newMode}...`, status: 'success' }, ...prev]);
                  appendMessages([{ role: 'model', content: `Environment reconfigured to ${newMode} mode.` }]);
          } 
          else if (call.name === 'openModule') {
            const requested = String((call.args as any).module || '').trim();
            const requestedId = normalizeModuleId(requested);
            const target = requestedId ? getModule(requestedId) : null;
            if (target?.available) {
              openModule(target.id);
              setAutomationLogs(prev => [{ id: logId, text: `Opening module: ${target.name}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: isSidebarMode ? `Opening ${target.name} in a new tab.` : `Opening ${target.name}.` }]);
            } else if (target) {
              appendMessages([{ role: 'model', content: `${target.name} is not available yet${target.requiresHub ? '. Start the Brahma Hub first.' : '.'}` }]);
            } else {
              appendMessages([{ role: 'model', content: `Module "${requested}" was not found. Available: autocine, scribble, image-lab.` }]);
            }
          }
          else if (call.name === 'getModuleContext') {
            const stored = readStoredModuleSnapshot();
            const module = activeModule ? getModule(activeModule) : stored ? getModule(stored.moduleId) : null;
            if (!module) {
              appendMessages([{ role: 'model', content: 'No Brahma module is open right now. Ask me to open AutoCine, Scribble Studio, or Image Lab first.' }]);
            } else {
              try {
                let snapshot: ModuleSnapshot | null = null;
                if (activeModule) snapshot = activeModuleHostRef.current?.captureSnapshot() || null;
                if (!snapshot?.content && stored?.content) {
                  snapshot = { title: stored.title, content: stored.content, sourceUrl: stored.sourceUrl };
                }
                if (!snapshot?.content) throw new Error('The module is still loading. Try again in a moment.');
                saveToolSource(`${snapshot.title} - module snapshot`, snapshot.content, snapshot.sourceUrl);
                const preview = snapshot.content.slice(0, 2000);
                setAutomationLogs(prev => [{ id: logId, text: `Read module context: ${module.name}`, status: 'success' }, ...prev]);
                appendMessages([{
                  role: 'model',
                  content: `**${module.name}** context (${snapshot.content.length.toLocaleString()} characters):\n\n${preview}${snapshot.content.length > preview.length ? '\n\n...' : ''}`,
                }]);
              } catch (error: any) {
                setAutomationLogs(prev => [{ id: logId, text: 'Could not read module context.', status: 'error' }, ...prev]);
                appendMessages([{ role: 'model', content: error?.message || 'Could not read the active module.' }]);
              }
            }
          }
          else if (call.name === 'grabPageText') {
            try {
              const target = await resolveAgentTarget();
              const page = await grabPageText(target.id);
              saveToolSource(`${page.title} - page text`, page.text, page.url);
              const preview = page.text.slice(0, 1600);
              setAutomationLogs(prev => [{ id: logId, text: `Read page: ${page.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Read **${page.title}** (${page.text.length.toLocaleString()} characters) and saved it to Neural Archive.\n\n${preview}${page.text.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Could not read the page text.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not read the page text.' }]);
            }
          }
          else if (call.name === 'grabPageSelection') {
            try {
              const target = await resolveAgentTarget();
              const selection = await grabSelection(target.id);
              if (!selection.text.trim()) throw new Error('No text is selected on this page. Select some text first, then ask again.');
              saveToolSource(`${selection.title} - selection`, selection.text, selection.url);
              const preview = selection.text.slice(0, 1800);
              setAutomationLogs(prev => [{ id: logId, text: `Read selection: ${selection.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Selected text from **${selection.title}** (${selection.text.length.toLocaleString()} characters):\n\n${preview}${selection.text.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Could not read the selection.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not read the selected text.' }]);
            }
          }
          else if (call.name === 'scanPageImages') {
            try {
              const target = await resolveAgentTarget();
              const collection = await collectPageImages(target.id);
              if (!collection.images.length) throw new Error('No images were found on this page.');
              const list = collection.images
                .slice(0, 20)
                .map((image, index) => `${index + 1}. ${image.alt || 'Untitled'} (${image.width}x${image.height}) ${image.url}`)
                .join('\n');
              saveToolSource(`${collection.title} - image list`, list, collection.url);
              setAutomationLogs(prev => [{ id: logId, text: `Scanned ${collection.images.length} page images`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Found **${collection.images.length}** image${collection.images.length === 1 ? '' : 's'} on **${collection.title}**:\n\n${list}${collection.images.length > 20 ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Image scan failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not scan images on this page.' }]);
            }
          }
          else if (call.name === 'downloadPageImages') {
            try {
              const target = await resolveAgentTarget();
              const collection = await collectPageImages(target.id);
              const requestedLimit = Number((call.args as any)?.limit);
              const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.round(requestedLimit), 1), 24) : 12;
              const chosen = collection.images.slice(0, limit);
              if (!chosen.length) throw new Error('No downloadable images were found on this page.');
              const started = await downloadImages(chosen, 'Brahma Images');
              const list = chosen.map((image, index) => `${index + 1}. ${image.alt || image.url} (${image.width}x${image.height})`).join('\n');
              saveToolSource(`${collection.title} - images`, list, collection.url);
              setAutomationLogs(prev => [{ id: logId, text: `Downloaded ${started} page images`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Started ${started} image download${started === 1 ? '' : 's'} from **${collection.title}**. The image list is saved to Neural Archive.` }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Image collection failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not collect images from this page.' }]);
            }
          }
          else if (call.name === 'getYouTubeTranscript') {
            try {
              const target = await resolveAgentTarget();
              const transcript = await extractYoutubeTranscript(target.id);
              saveToolSource(`${transcript.title} - transcript`, transcript.text, transcript.url);
              const preview = transcript.text.slice(0, 1800);
              setAutomationLogs(prev => [{ id: logId, text: `Extracted transcript: ${transcript.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Transcript for **${transcript.title}** is ready (${transcript.text.length.toLocaleString()} characters) and saved to Neural Archive.\n\n${preview}${transcript.text.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Transcript extraction failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not extract the YouTube transcript.' }]);
            }
          }
          else if (call.name === 'exportCurrentChat') {
            try {
              const target = await resolveAgentTarget();
              const chat = await exportCurrentChat(target.id);
              saveToolSource(`${chat.title} - chat export`, chat.markdown, chat.url);
              const preview = chat.markdown.slice(0, 1600);
              setAutomationLogs(prev => [{ id: logId, text: `Exported chat: ${chat.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Exported **${chat.title}** (${chat.messageCount} messages) and saved it to Neural Archive.\n\n${preview}${chat.markdown.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Chat export failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not export this chat.' }]);
            }
          }
          else if (call.name === 'exportNotebookSources') {
            try {
              const target = await resolveAgentTarget();
              const notebook = await exportNotebookSources(target.id);
              saveToolSource(`${notebook.title} - NotebookLM sources`, notebook.markdown, notebook.url);
              const preview = notebook.markdown.slice(0, 1800);
              setAutomationLogs(prev => [{ id: logId, text: `Exported NotebookLM sources: ${notebook.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `Exported **${notebook.sourceCount}** NotebookLM source${notebook.sourceCount === 1 ? '' : 's'} from **${notebook.title}** and saved them to Neural Archive.\n\n${preview}${notebook.markdown.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'NotebookLM export failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not export NotebookLM sources.' }]);
            }
          }
          else if (call.name === 'readScreenText') {
            try {
              const requestedLanguage = String((call.args as any)?.language || 'eng').toLowerCase();
              const language = requestedLanguage.startsWith('hin') ? 'hin' : 'eng';
              const target = await resolveAgentTarget();
              let text = '';
              let captureNote = '';
              try {
                const screenshot = await captureTargetScreenshot(target);
                text = await recognizeImage(screenshot, language);
              } catch (captureError: any) {
                const page = await grabPageText(target.id);
                if (!page.text.trim()) throw captureError;
                text = page.text;
                captureNote = `Chrome could not screenshot this tab (${captureError?.message || 'capture blocked'}), so I extracted its page text instead.`;
                saveToolSource(`${target.title} - page text`, page.text, target.url);
              }
              if (!text.trim()) throw new Error('No readable text was found in the visible tab.');
              if (!captureNote) saveToolSource(`${target.title} - screen OCR`, text, target.url);
              const preview = text.slice(0, 1800);
              setAutomationLogs(prev => [{ id: logId, text: `OCR read screen: ${target.title}`, status: 'success' }, ...prev]);
              appendMessages([{
                role: 'model',
                content: `${captureNote ? `${captureNote}\n\n` : ''}Screen text from **${target.title}** (${language === 'hin' ? 'Hindi' : 'English'}, ${text.length.toLocaleString()} characters):\n\n${preview}${text.length > preview.length ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Screen OCR failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not read text from the screen.' }]);
            }
          }
          else if (call.name === 'listExtensions') {
            try {
              const extensions = await getInstalledExtensions();
              const list = extensions
                .slice(0, 50)
                .map((extension) => `- ${extension.name} (${extension.id}) - ${extension.enabled ? 'enabled' : 'disabled'}`)
                .join('\n');
              appendMessages([{
                role: 'model',
                content: `**${extensions.length}** installed extension${extensions.length === 1 ? '' : 's'}:\n\n${list}${extensions.length > 50 ? '\n\n...' : ''}`,
              }]);
            } catch (error: any) {
              appendMessages([{ role: 'model', content: error?.message || 'Could not list Chrome extensions.' }]);
            }
          }
          else if (call.name === 'setExtensionEnabled') {
            try {
              const requestedName = String((call.args as any)?.name || '').trim();
              const enabled = Boolean((call.args as any)?.enabled);
              if (!requestedName) throw new Error('Extension name or ID is required.');
              const extensions = await getInstalledExtensions();
              const query = requestedName.toLowerCase();
              const match = extensions.find((extension) =>
                extension.id === requestedName || extension.name.toLowerCase() === query
              ) || extensions.find((extension) => extension.name.toLowerCase().includes(query));
              if (!match) throw new Error(`Extension "${requestedName}" was not found.`);
              if (match.id === chrome.runtime.id) throw new Error('I cannot disable or re-enable my own extension.');
              await setExtensionEnabled(match.id, enabled);
              setAutomationLogs(prev => [{ id: logId, text: `${enabled ? 'Enabled' : 'Disabled'} ${match.name}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `${enabled ? 'Enabled' : 'Disabled'} **${match.name}**.` }]);
            } catch (error: any) {
              setAutomationLogs(prev => [{ id: logId, text: 'Extension update failed.', status: 'error' }, ...prev]);
              appendMessages([{ role: 'model', content: error?.message || 'Could not update that extension.' }]);
            }
          }
          else if (call.name === 'openShortcut') {
            const name = (call.args as any).name;
            const shortcut = shortcuts.find(s => s.name.toLowerCase() === name.toLowerCase());
            if (shortcut) {
              openUrl(shortcut.url);
              setAutomationLogs(prev => [{ id: logId, text: `Navigating to ${shortcut.name}...`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Neural link established with ${shortcut.name}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Shortcut "${name}" not found in neural database. Use the 'Add' button to initialize it.` }]);
            }
          }
          else if (call.name === 'searchWeb') {
            const sQuery = (call.args as any).query;
            setAutomationLogs(prev => [{ id: logId, text: `Searching web for: ${sQuery}...`, status: 'pending' }, ...prev]);
            
            const searchResult = await completeWithFallback({
              messages: [
                { role: 'system', content: 'You are a concise web research assistant.' },
                { role: 'user', content: `Search the web for: ${sQuery} and summarize what it is or how to access it.` },
              ],
              temperature: 0.3,
              maxTokens: 500,
            }, {
              keys: { [aiProvider]: userApiKey.trim() },
              modelOverrides: { [aiProvider]: aiModel },
            });
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: searchResult.text || `Search completed for ${sQuery}.` }]);
          }
          else if (call.name === 'executeAutomation') {
            const { task, steps } = call.args as any;
            setAutomationLogs(prev => [{ id: logId, text: `Executing Automation: ${task}`, status: 'pending' }, ...prev]);
            
            // Simulate steps
            for (const step of steps) {
              await new Promise(r => setTimeout(r, 800));
              setAutomationLogs(prev => [{ id: Math.random().toString(), text: `> ${step}`, status: 'success' }, ...prev]);
            }
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: `Task "${task}" has been processed through the automation engine.` }]);
          }
          else if (call.name === 'summarizePage') {
            const url = ((call.args as any).url || '').trim();
            const content = ((call.args as any).content || '').trim();
            const sourceLabel = url || (content ? 'provided page content' : 'current context');
            setAutomationLogs(prev => [{ id: logId, text: `Summarizing ${sourceLabel}...`, status: 'pending' }, ...prev]);
            
            const summaryResult = await completeWithFallback({
              messages: [
                { role: 'system', content: 'Summarize accurately and concisely. Use short bullets when useful.' },
                { role: 'user', content: url
                  ? `Summarize the content of this page: ${url}`
                  : `Summarize this page content clearly and concisely:\n\n${content || buildContext()}` },
              ],
              temperature: 0.3,
              maxTokens: 600,
            }, {
              keys: { [aiProvider]: userApiKey.trim() },
              modelOverrides: { [aiProvider]: aiModel },
            });
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: summaryResult.text || `Summary completed for ${sourceLabel}.` }]);
          }
          else if (call.name === 'getWeather') {
            const location = (call.args as any).location;
            setAutomationLogs(prev => [{ id: logId, text: `Fetching weather for ${location}...`, status: 'pending' }, ...prev]);
            
            try {
              // First, geocode the location to get lat/lng
              const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
              const geoData = await geoResponse.json();
              
              if (geoData.results && geoData.results[0]) {
                const { latitude, longitude, name } = geoData.results[0];
                
                const weatherResponse = await fetch(
                  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
                );
                const weatherData = await weatherResponse.json();
                
                if (weatherData.current) {
                  const weatherDescriptions: { [key: number]: string } = {
                    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                    45: 'Fog', 48: 'Depositing rime fog',
                    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                    71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
                    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                    85: 'Slight snow showers', 86: 'Heavy snow showers',
                    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
                  };
                  
                  const temp = Math.round(weatherData.current.temperature_2m);
                  const desc = weatherDescriptions[weatherData.current.weather_code] || 'Unknown';
                  
                  setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
                  appendMessages([{ role: 'model', content: `Weather in ${name}: ${temp}°C, ${desc}.` }]);
                } else {
                  appendMessages([{ role: 'model', content: `Unable to fetch weather data for ${location}.` }]);
                }
              } else {
                appendMessages([{ role: 'model', content: `Location "${location}" not found.` }]);
              }
            } catch (error) {
              console.error('Weather fetch error:', error);
              appendMessages([{ role: 'model', content: `Error fetching weather for ${location}.` }]);
            }
          }
          else if (call.name === 'openNewTab') {
            const url = (call.args as any).url;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
              setAutomationLogs(prev => [{ id: logId, text: `Opening new tab: ${url}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `New tab opened with ${url}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot open new tab in this environment.` }]);
            }
          }
          else if (call.name === 'closeCurrentTab') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0] && tabs[0].id) {
                chrome.tabs.remove(tabs[0].id);
                setAutomationLogs(prev => [{ id: logId, text: `Closing current tab`, status: 'success' }, ...prev]);
                  appendMessages([{ role: 'model', content: `Current tab closed.` }]);
              }
            });
          } else {
              appendMessages([{ role: 'model', content: `Cannot close tab in this environment.` }]);
            }
          }
          else if (call.name === 'navigateTo') {
            const url = (call.args as any).url;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
              chrome.tabs.update({ url });
              setAutomationLogs(prev => [{ id: logId, text: `Navigating to ${url}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Navigating to ${url}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot navigate in this environment.` }]);
            }
          }
          else if (call.name === 'goBack') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.goBack) {
              chrome.tabs.goBack();
              setAutomationLogs(prev => [{ id: logId, text: `Going back`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Went back to previous page.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot go back in this environment.` }]);
            }
          }
          else if (call.name === 'goForward') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.goForward) {
              chrome.tabs.goForward();
              setAutomationLogs(prev => [{ id: logId, text: `Going forward`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Went forward to next page.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot go forward in this environment.` }]);
            }
          }
  };

  const handleAgentChat = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    const inputToUse = overrideInput || chatInput;
    if (!inputToUse.trim()) return;
    if (!aiReady) {
      appendMessages([{ role: 'model', content: apiMessage || `Add your ${AI_PROVIDERS[aiProvider].label} API key in the API Key settings to start.` }]);
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      return;
    }

    // memory commands
    if (inputToUse.startsWith('/remember ')) {
      const note = inputToUse.replace('/remember ', '').trim();
      if (note) {
        setUserMemory(prev => (prev ? `${prev} | ${note}` : note));
        appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Saved to memory.' }]);
      }
      if (!overrideInput) setChatInput('');
      return;
    }
    if (inputToUse === '/memclear') {
      setUserMemory('');
      appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Memory cleared.' }]);
      if (!overrideInput) setChatInput('');
      return;
    }

    // If multi-step command with "then", enqueue tasks and short-circuit
    if (inputToUse.toLowerCase().includes(' then ')) {
      const steps = inputToUse.split(/then/ig).map(s => s.trim()).filter(Boolean);
      enqueueTasks(steps);
      appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Queued tasks: ' + steps.join(' → ') }]);
      if (!overrideInput) setChatInput('');
      return;
    }

    const userMsg = inputToUse;
    if (!overrideInput) setChatInput('');
    const newUserMsg: ChatMessage = { role: 'user', content: userMsg };
    appendMessages([newUserMsg]);
    setIsChatLoading(true);
    setIsRightSidebarOpen(true);
    try { await resolveAgentTarget(); } catch {}

    const buildToolMessages = () => {
      const context = buildContext();
      const persona = buildInstruction();
      const history = activeMessagesRef.current.map(m => ({
        role: (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }));
      const attachmentNote = chatAttachments.length > 0
        ? '\nNote: image attachments are not supported by the selected text provider and were ignored.'
        : '';
      return [
        {
          role: 'system' as const,
          content: `You are BRAHMA, an ultra-intelligent AI browser agent with Opera GX vibes. ${persona}
You control the whole Brahma OS and MUST use the provided tools for browser and module actions.
- Never claim browser tools are unavailable. If a tool is needed, call it.
- "this page", "this video", and "this chat" mean the current web tab. Browser tools run silently and return results in chat.
- openModule opens AutoCine, Scribble Studio, or Image Lab automatically. In the in-page sidebar it opens a full tab.
- getModuleContext reads the module that is currently open.
- Do not narrate a tool call you did not make. After a tool result is shown, keep any extra text short.
- If the API rejects native tool calls, emit exactly one fallback call per action:
  <tool_call>toolName<arg_key>argName</arg_key><arg_value>value</arg_value></tool_call>
  Useful tools: getYouTubeTranscript, grabPageText, grabPageSelection, readScreenText (language=eng|hin), scanPageImages, downloadPageImages, openModule (module=autocine|scribble|image-lab), getModuleContext, listExtensions, exportCurrentChat, exportNotebookSources.
Current context: ${context}${attachmentNote}`,
        },
        ...history,
        { role: 'user' as const, content: userMsg },
      ];
    };

    const runToolAgent = async (): Promise<string | null> => {
      const result = await completeWithToolsWithFallback(
        {
          messages: buildToolMessages(),
          temperature: 0.3,
          maxTokens: 900,
          tools: OPENAI_AGENT_TOOLS,
          toolChoice: 'auto',
        },
        {
          keys: { [aiProvider]: userApiKey.trim() },
          modelOverrides: { [aiProvider]: aiModel },
          order: [aiProvider, ...getProviderOrder().filter((id) => id !== aiProvider)],
        }
      );
      if (result.toolCalls.length > 0) {
        for (const call of result.toolCalls) {
          await executeAgentToolCall({ name: call.name, args: call.arguments, id: call.id });
        }
        if (result.text.trim()) {
          appendMessages([{ role: 'model', content: result.text.trim() }]);
          return result.text.trim();
        }
        return null;
      }
      const contentText = result.text || "I'm standing by for your next command.";
      appendMessages([{ role: 'model', content: contentText }]);
      return contentText;
    };

    const runTextAgent = async () => {
      const result = await completeWithFallback(
        {
          messages: buildToolMessages(),
          temperature: 0.35,
          maxTokens: 768,
        },
        {
          keys: { [aiProvider]: userApiKey.trim() },
          modelOverrides: { [aiProvider]: aiModel },
        }
      );
      return result.text || "I'm standing by for your next command.";
    };

    if (aiProvider !== 'gemini' || !aiRef.current) {
      try {
        let spoken: string | null = null;
        const directCall = detectDirectToolIntent(userMsg);
        if (directCall) {
          await executeAgentToolCall({ name: directCall.name, args: directCall.args });
        } else {
          try {
            spoken = await runToolAgent();
          } catch (toolError) {
            console.warn('Tool-capable agent failed, retrying text-only:', toolError);
            const contentText = await runTextAgent();
            appendMessages([{ role: 'model', content: contentText }]);
            spoken = contentText;
          }
        }
        if (spoken) speakText(spoken);
        setAiHealth('online');
        setAiHealthMessage(null);
      } catch (error: any) {
        console.error("Agent Error:", error);
        setAiHealth('error');
        const friendly = parseGenAiError(error);
        setAiHealthMessage(friendly.message);
        if (friendly.quota) setShowApiPrompt(true);
        appendMessages([{ role: 'model', content: friendly.message || "Error communicating with Brahma Agent Core." }]);
      } finally {
        setIsChatLoading(false);
        setChatAttachments([]);
      }
      return;
    }

    try {
      const context = buildContext();
      const persona = buildInstruction();
      const buildChat = (model: string) => aiRef.current!.chats.create({
        model,
        config: {
          systemInstruction: `You are BRAHMA, an ultra-intelligent AI browser agent with Opera GX vibes. ${persona}
You control the entire Brahma OS and can use every tool listed below:
- Browser: read page text or selection, list/scan/download images, extract YouTube transcripts, export ChatGPT/Claude/Gemini chats, export NotebookLM sources, OCR screen text, list and toggle Chrome extensions, navigate tabs, open shortcuts, search the web.
- Brahma modules: openModule (AutoCine, Scribble Studio, Image Lab) and getModuleContext (read the active module).
- Modes, notes, archive sources, weather, and automation logs.
Browser tools run silently in the background and their results must be returned directly in chat. Do NOT open the Tools page or show tool UI unless the user explicitly asks for it. In the in-page sidebar, openModule opens the module in a full tab.
"this page", "this video", and "this chat" refer to the current web tab in context. When a tool returns content, summarize the key result and mention it was saved to Neural Archive only when it was. Use getModuleContext when the user asks about the open module. For multi-step requests, call tools one after another and keep going until the task is done.

Current context: ${context}
${sequentialMode ? `Sequential mode is ON: 
- First produce a numbered plan (max 6 concise steps).
- Then execute steps one by one using available tools; log each step and progress.
- Keep overall text <=80 words per turn; focus on progress updates.` : ''}
Respond concisely (<=80 words by default). Avoid filler greetings; answer the user's intent directly. Use bullets only when they add clarity. If user greets, reply with one friendly line and a follow-up question.`,
          temperature: 0.35,
          maxOutputTokens: 256,
          tools: [
            { functionDeclarations: browserTools }
          ]
        },
        history: activeMessagesRef.current.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
      });

      let chat = buildChat(GENAI_MODEL);
      let result;

      const runWithAttachments = async (model: string) => {
        const contents: any[] = [
          ...chatAttachments.map(a => ({ inlineData: { mimeType: a.mime, data: a.data } })),
          { text: userMsg }
        ];
        const resp = await aiRef.current!.models.generateContent({
          model,
          contents
        });
        return resp;
      };

      try {
        if (chatAttachments.length > 0) {
          result = await runWithAttachments(GENAI_MODEL);
        } else {
          result = await chat.sendMessage({ message: userMsg });
        }
      } catch (err: any) {
        const parsed = parseGenAiError(err);
        if (parsed.quota || parsed.modelUnavailable) {
          if (chatAttachments.length > 0) {
            result = await runWithAttachments(FALLBACK_MODEL);
          } else {
            chat = buildChat(FALLBACK_MODEL);
            result = await chat.sendMessage({ message: userMsg });
          }
        } else {
          throw err;
        }
      }
      
      // Handle function calls
      if (result.functionCalls) {
        for (const call of result.functionCalls) {
          await executeAgentToolCall({ name: call.name || '', args: call.args });
        }
      } else {
        const contentText = result.text || "I'm standing by for your next command.";
        const botMsg: ChatMessage = { role: 'model', content: contentText };
        appendMessages([botMsg]);
        speakText(contentText);
      }
      setAiHealth('online');
      setAiHealthMessage(null);
    } catch (error: any) {
      console.error("Agent Error:", error);
      const fallbackProviders = getConfiguredProviderIds({ [aiProvider]: userApiKey.trim() })
        .filter(providerId => providerId !== 'gemini');
      if (fallbackProviders.length > 0) {
        try {
          const context = buildContext();
          const persona = buildInstruction();
          const history = activeMessagesRef.current.map(m => ({
            role: (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.content,
          }));
          const fallback = await completeWithFallback(
            {
              messages: [
                {
                  role: 'system',
                  content: `You are BRAHMA, an ultra-intelligent AI browser agent. ${persona}
Current context: ${context}
Gemini browser tools were unavailable, so answer helpfully in text instead. Respond concisely (<=80 words by default).`,
                },
                ...history,
                { role: 'user', content: userMsg },
              ],
              temperature: 0.35,
              maxTokens: 768,
            },
            {
              order: fallbackProviders,
              keys: { [aiProvider]: userApiKey.trim() },
              modelOverrides: { [aiProvider]: aiModel },
            }
          );
          const contentText = fallback.text || "I'm standing by for your next command.";
          appendMessages([{ role: 'model', content: contentText }]);
          speakText(contentText);
          setAiHealth('online');
          setAiHealthMessage(null);
          return;
        } catch (fallbackError) {
          console.error("Fallback Agent Error:", fallbackError);
        }
      }
      setAiHealth('error');
      const friendly = parseGenAiError(error);
      setAiHealthMessage(friendly.message);
      if (friendly.quota) setShowApiPrompt(true);
      const botMsg: ChatMessage = { role: 'model', content: friendly.message || "Error communicating with Brahma Agent Core." };
      appendMessages([{ role: 'user', content: userMsg }, botMsg]);
    } finally {
      setIsChatLoading(false);
      setChatAttachments([]);
    }
  };

  const saveModuleSnapshot = (snapshot: ModuleSnapshot) => {
    saveToolSource(snapshot.title, snapshot.content, snapshot.sourceUrl);
  };

  const askBrahmaAboutModule = (snapshot: ModuleSnapshot) => {
    const module = activeModule ? getModule(activeModule) : null;
    const focus = module?.id === 'autocine'
      ? 'Focus on pacing, transitions, photo order, and music sync.'
      : module?.id === 'scribble'
        ? 'Focus on script clarity, scene pacing, narration, and visual choices.'
        : 'Focus on compression settings, output format, and quality tradeoffs.';
    setActiveModule(null);
    handleAgentChat(
      undefined,
      `Review my ${module?.name || 'Brahma module'} project snapshot. ${focus} Give concrete next steps and call out anything that looks broken.\n\n${snapshot.content}`
    );
  };

  // In-page drawer bridge: the content script posts the requested action into the sidebar iframe.
  useEffect(() => {
    if (!isSidebarMode) return;
    const onSidebarMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'BRAHMA_SIDEBAR_ACTION' || !data.action) return;
      setSidebarTask({
        id: typeof data.id === 'string' ? data.id : undefined,
        action: String(data.action),
        text: String(data.text || ''),
      });
    };
    window.addEventListener('message', onSidebarMessage);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'BRAHMA_SIDEBAR_READY' }, '*');
      } catch {}
    }
    return () => window.removeEventListener('message', onSidebarMessage);
  }, [isSidebarMode]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    const listener = (message: any) => {
      if (message?.type !== 'BRAHMA_OPEN_TOOLS_UI') return;
      openToolsPage(
        typeof message.tool === 'string' && message.tool ? message.tool : 'ocr',
        typeof message.tabId === 'number' ? message.tabId : null
      );
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!isSidebarMode || !sidebarTask) return;
    if (!activeSession || !aiReady) return;
    const { action, text } = sidebarTask;
    setSidebarTask(null);
    const prompt =
      action === 'summarize' ? `Summarize this page content: ${text}` :
      action === 'explain' ? `Explain this selected text: ${text}` :
      action === 'optimize' ? `Rewrite and improve this text clearly: ${text}` :
      action === 'translate' ? `Translate this text and preserve its meaning: ${text}` :
      text;
    if (!prompt.trim()) return;
    handleAgentChat(undefined, prompt);
  }, [isSidebarMode, sidebarTask, activeSession, aiReady]);

  const getThemeClass = () => {
    switch (mode) {
      case AppMode.STUDY: return 'theme-study';
      case AppMode.GAMING: return 'theme-gaming';
      case AppMode.DEVELOPER: return 'theme-developer';
      default: return 'theme-study';
    }
  };

  // apply theme colors to document root (fallback) and tie jarvis accent to mode palette
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brahma-primary', themeColors.primary);
    root.style.setProperty('--brahma-secondary', themeColors.secondary);
    root.style.setProperty('--brahma-accent', themeColors.accent);
    root.style.setProperty('--jarvis-accent', themeColors.accent);
    root.style.setProperty('--jarvis-secondary', themeColors.secondary);
  }, [themeColors]);

  useEffect(() => {
    document.body.classList.toggle('brahma-light-body', effectiveLightMode);
    return () => document.body.classList.remove('brahma-light-body');
  }, [effectiveLightMode]);

  useEffect(() => {
    if (!isSidebarMode) return;
    const root = document.getElementById('root');
    document.documentElement.style.backgroundColor = '#f6f8fc';
    document.body.style.backgroundColor = '#f6f8fc';
    if (root) root.style.backgroundColor = '#f6f8fc';
  }, [isSidebarMode]);

  useEffect(() => {
    if (!showOnboarding || onboardingStage !== 'boot') return;
    setBootVisibleLines(0);
    let index = 0;
    const timers: number[] = [];
    const tick = () => {
      index += 1;
      setBootVisibleLines(index);
      if (index < BOOT_LINES.length) {
        timers.push(window.setTimeout(tick, 520));
      } else {
        timers.push(window.setTimeout(() => setOnboardingStage('welcome'), 900));
      }
    };
    timers.push(window.setTimeout(tick, 260));
    return () => timers.forEach(window.clearTimeout);
  }, [showOnboarding, onboardingStage]);

  useEffect(() => {
    if (!showOnboarding || onboardingStage !== 'tour') return;
    const typed = 'Summarize this page';
    setTourStep(0);
    setTourTypedText('');
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setTourStep(0);
      let idx = 0;
      const typeNext = () => {
        idx += 1;
        setTourTypedText(typed.slice(0, idx));
        if (idx < typed.length) timers.push(window.setTimeout(typeNext, 45));
      };
      typeNext();
    }, 250));
    timers.push(window.setTimeout(() => setTourStep(1), 2200));
    timers.push(window.setTimeout(() => setTourStep(2), 3900));
    timers.push(window.setTimeout(() => setOnboardingStage('activate'), 5600));
    return () => timers.forEach(window.clearTimeout);
  }, [showOnboarding, onboardingStage]);

  useEffect(() => {
    if (showOnboarding) {
      setContextHint(null);
      return;
    }
    const updateHint = () => {
      const host = window.location.hostname;
      const found = CONTEXT_HINTS.find(h => host.includes(h.match));
      setContextHint(found ? { text: found.text, action: found.action } : null);
    };
    updateHint();
    const id = window.setInterval(updateHint, 3000);
    return () => clearInterval(id);
  }, [showOnboarding]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    setOnboardingStage('complete');
    try {
      localStorage.setItem('onboarding_done', 'true');
      localStorage.setItem('brahma-onboarding-done', '1');
    } catch {}
  };

  // Suppress noisy fetch/network errors so they don't surface a runtime overlay
  useEffect(() => {
    const swallow = (ev: any) => {
      const msg = String(ev?.reason?.message || ev?.message || '');
      if (msg.includes('Failed to fetch')) {
        ev.preventDefault?.();
      }
    };
    window.addEventListener('unhandledrejection', swallow);
    window.addEventListener('error', swallow);
    return () => {
      window.removeEventListener('unhandledrejection', swallow);
      window.removeEventListener('error', swallow);
    };
  }, []);

  // compute inline style overrides (applied to our top-level container)
  const themeStyle: React.CSSProperties = {
    '--brahma-primary': effectiveThemeColors.primary,
    '--brahma-secondary': effectiveThemeColors.secondary,
    '--jarvis-secondary': effectiveThemeColors.secondary,
    '--jarvis-accent': effectiveThemeColors.accent,
    '--brahma-glow-color': `${effectiveThemeColors.accent}33`,
    backgroundColor: effectiveThemeColors.primary,
  } as React.CSSProperties;

  const healthBlurb = aiHealthMessage 
    ? (aiHealthMessage.length > 70 ? `${aiHealthMessage.slice(0, 70)}�?�` : aiHealthMessage)
    : null;
  const configuredProviders = getConfiguredProviderIds({ [aiProvider]: userApiKey.trim() });
  const providerModels = getProviderModels(aiProvider, aiModel);
  const quickActions = MODE_BEHAVIORS[mode].quickActions(triggerTool);
  const modeCopy = MODE_COPY[mode];

  const handleSaveApiKey = () => {
    const key = userApiKey.trim();
    if (!key) return;
    saveProviderApiKey(aiProvider, key);
    saveProviderModel(aiProvider, aiModel);
    setProviderOrderState(setActiveProvider(aiProvider));
    setUserApiKey(key);
    setShowApiPrompt(false);
    setProviderTest('idle');
    setProviderTestMessage(null);
    setAiHealth('checking');
    setAiHealthMessage(null);
  };

  const handleClearApiKey = () => {
    clearProviderApiKey(aiProvider);
    setUserApiKey('');
    setProviderTest('idle');
    setProviderTestMessage(null);
  };

  const handleModelChange = (model: string) => {
    setAiModel(model);
    saveProviderModel(aiProvider, model);
    setProviderTest('idle');
    setProviderTestMessage(null);
  };

  const saveHubSettings = () => {
    const savedUrl = saveHubUrl(hubUrl);
    const savedToken = saveHubToken(hubToken);
    setHubUrlState(savedUrl);
    setHubTokenState(savedToken);
    setHubStatus('idle');
    setHubMessage('Hub settings saved. Click Test Hub to connect.');
  };

  const testHubConnection = async () => {
    const savedUrl = saveHubUrl(hubUrl);
    const savedToken = saveHubToken(hubToken);
    setHubUrlState(savedUrl);
    setHubTokenState(savedToken);
    setHubStatus('checking');
    setHubMessage(null);
    const result = await checkHub();
    if (result.ok && result.health) {
      setHubStatus('online');
      setHubMessage(`Brahma Hub v${result.health.version} is online. Image Lab is ready.`);
    } else {
      setHubStatus('error');
      setHubMessage(result.error || 'Could not reach Brahma Hub.');
    }
  };

  useEffect(() => {
    if (!getHubToken()) return;
    let cancelled = false;
    setHubStatus('checking');
    checkHub().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setHubStatus('online');
        setHubMessage(`Brahma Hub v${result.health?.version || '?'} is online.`);
      } else {
        setHubStatus('error');
        setHubMessage(result.error || 'Could not reach Brahma Hub.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startOnboardingMode = () => {
    applyMode(pendingModeSelection);
    setOnboardingStage('tour');
  };

  const saveApiKeyFromOnboarding = () => {
    if (userApiKey.trim()) {
      handleSaveApiKey();
    }
    setOnboardingStage('first-action');
  };

  const skipApiActivation = () => {
    setShowApiPrompt(false);
    setOnboardingStage('first-action');
  };

  const runFirstAction = (action: string) => {
    if (action === 'Open YouTube') {
      openUrl('https://youtube.com');
    } else {
      handleAgentChat(undefined, action);
    }
    setOnboardingStage('complete');
  };


  // SIDEBAR MODE: Only show the right sidebar (AI Agent)
  const baseStyle: React.CSSProperties = {};
  if (customBackground) {
    baseStyle.backgroundImage = `url(${customBackground})`;
    baseStyle.backgroundSize = 'cover';
    baseStyle.backgroundPosition = 'center';
  }

  if (isSidebarMode) {
    return (
      <motion.aside
        initial={{ x: 0 }}
        animate={{ x: 0 }}
        className={`brahma-drawer brahma-drawer-surface w-full h-screen flex flex-col border-l ${effectiveLightMode ? 'brahma-light' : ''}`}
        style={{ ...baseStyle, ...themeStyle }}
      >
        <div className="px-4 py-3 flex items-center justify-between border-b border-brahma-border pr-12">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brahma-accent/20 rounded-full flex items-center justify-center border border-brahma-accent">
              <Bot className="text-brahma-accent w-4 h-4" />
            </div>
            <h2 className="font-display text-xs font-bold tracking-[0.18em] text-brahma-accent uppercase">Brahma Agent</h2>
          </div>
          <button
            onClick={createNewSession}
            title="Start a new chat"
            className="px-2.5 py-1 bg-jarvis-accent/20 text-jarvis-accent rounded text-[10px] border border-jarvis-accent/40 hover:bg-jarvis-accent/40"
          >
            + New
          </button>
        </div>

        {/* Site tools toolbar */}
        <div className="px-3 py-2.5 border-b border-brahma-border bg-black/10">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-semibold flex-shrink-0">Site tools</span>
            <span className="text-[9px] text-gray-500 truncate min-w-0">Current tab</span>
          </div>
          <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-0.5">
            {SIDEBAR_SITE_TOOLS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSiteTool(item.id)}
                title={item.hint}
                aria-label={item.hint}
                className="flex-shrink-0 w-11 h-11 rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 hover:text-white hover:border-jarvis-accent/40 hover:bg-jarvis-accent/10 flex flex-col items-center justify-center gap-0.5 transition"
              >
                {item.icon}
                <span className="text-[8px] leading-none">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div ref={chatScrollRef} className="brahma-drawer-messages flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {activeMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 px-8">
              <Bot className="w-12 h-12 mb-4" />
              <p className="text-xs tracking-widest uppercase">I am your browser agent. Ask me to switch modes, start timers, or open shortcuts.</p>
            </div>
          )}
          {chatAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
              {chatAttachments.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                  <span>{f.name}</span>
                  <button
                    onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-200"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {activeMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg text-xs ${
                msg.role === 'user' 
                  ? 'bg-jarvis-accent/10 border border-jarvis-accent/30 text-white' 
                  : 'bg-white/5 border border-white/10 text-gray-300'
              }`}>
                <div className="prose prose-invert prose-xs">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-100"></div>
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-jarvis-border bg-black/20">
          <form onSubmit={handleAgentChat} className="flex items-center gap-2 bg-black/40 rounded-lg p-2 border border-white/5">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Command Brahma..." 
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-600 py-2 px-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isChatListening) {
                      chatSpeechRef.current?.stop();
                      setIsChatListening(false);
                    } else {
                      chatSpeechRef.current?.start();
                      setIsChatListening(true);
                    }
                  }}
                  className={`p-2 rounded-md transition-colors ${isChatListening ? 'bg-red-500/30 text-red-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakEnabled(!speakEnabled)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                  title="Toggle speech"
                >
                  {speakEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
            <button
              type="submit"
              disabled={isChatLoading}
              className="p-2 bg-jarvis-accent text-jarvis-dark rounded-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sequentialMode}
                onChange={(e) => setSequentialMode(e.target.checked)}
                className="accent-jarvis-accent"
              />
              Sequential mode (plan + execute)
            </label>
            <span className="text-gray-600">Fast, concise replies enabled</span>
          </div>
        </div>
      </motion.aside>
    );
  }

  // FULL MODE: Show complete interface
  const baseStyle2: React.CSSProperties = {};
  if (customBackground) {
    baseStyle2.backgroundImage = `url(${customBackground})`;
    baseStyle2.backgroundSize = 'cover';
    baseStyle2.backgroundPosition = 'center';
  } else {
    baseStyle2.backgroundImage = `
      radial-gradient(circle at 20% 20%, ${themeColors.accent}15, transparent 38%),
      radial-gradient(circle at 80% 10%, ${themeColors.secondary}25, transparent 40%),
      linear-gradient(135deg, ${themeColors.primary} 0%, ${lightMode ? '#eef2f7' : '#06090e'} 100%)
    `;
  }
  return (
    <div
      className={`brahma-shell min-h-screen w-full flex bg-brahma-dark text-white font-sans overflow-hidden relative ${lightMode ? 'brahma-light' : ''} ${getThemeClass()} ${
        mode === AppMode.DEVELOPER ? 'dev-grid' : mode === AppMode.GAMING ? 'gaming-neon' : 'study-soft'
      }`}
      style={{ ...baseStyle2, ...themeStyle, filter: isFocusBlur ? 'blur(3px)' : undefined, pointerEvents: isFocusBlur ? 'none' : 'auto' }}
    >
      {/* Ambient dynamic aurora lighting */}
      <div className="ambient-aurora">
        <div className="ambient-aurora-blob-1" />
        <div className="ambient-aurora-blob-2" />
        <div className="ambient-aurora-grid" />
      </div>
      <div className="scanline"></div>
      {isFocusBlur && (
        <div className="fixed inset-0 z-[9900] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 pointer-events-auto">
          <div className="spatial-glass max-w-md w-full p-6 rounded-2xl flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-jarvis-accent font-display tracking-widest uppercase">Focus Shield</div>
            <div className="text-center text-gray-200 text-xs">
              {focusAlert || "Distraction detected. Stay on track?"}
            </div>
            <div className="flex gap-3">
              <button onClick={() => applyMode(AppMode.STUDY)} className="px-4 py-2 text-xs rounded-xl border border-jarvis-accent bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-all">Switch to Study</button>
              <button onClick={() => applyMode(AppMode.DEVELOPER)} className="px-4 py-2 text-xs rounded-xl border border-white/20 text-gray-200 hover:border-jarvis-accent hover:text-jarvis-accent transition-all">Switch to Dev</button>
              <button onClick={() => { setFocusAlert(null); setIsFocusBlur(false); }} className="px-3 py-2 text-xs rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all">Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {/* News corner */}
      <AnimatePresence>
        {showNews && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNews(false)}
              className="fixed inset-0 z-[9350] bg-black/25 backdrop-blur-[2px] lg:left-16"
            />
            <motion.aside 
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 180 }}
            className="fixed right-0 top-0 z-[9400] h-screen w-full lg:w-[50vw] min-[1600px]:w-[44vw] max-w-[900px] border-l border-white/10 spatial-glass overflow-hidden flex flex-col shadow-[-24px_0_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3 text-gray-200">
                <div className="w-10 h-10 rounded-2xl border border-jarvis-accent/30 bg-jarvis-accent/10 flex items-center justify-center shadow-[0_0_30px_var(--brahma-glow-color)]">
                  <Newspaper className="w-5 h-5 text-jarvis-accent" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Live briefing</div>
                  <span className="text-lg font-display text-white">News Corner</span>
                </div>
              </div>
              <button onClick={() => setShowNews(false)} className="text-gray-400 hover:text-white rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-jarvis-accent/40 hover:text-jarvis-accent"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-black/10">
              <div className="text-xs text-gray-400">Top world + India headlines in one side panel.</div>
              <button
                onClick={() => setShowNews(false)}
                className="hidden lg:inline-flex px-3 py-2 rounded-xl text-xs border border-white/10 bg-white/5 text-gray-300 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition"
              >
                Back to workspace
              </button>
            </div>
            <div className="p-5 space-y-6 text-sm text-gray-200 flex-1 overflow-y-auto custom-scrollbar">
              {newsLoading && (
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-jarvis-accent">Loading live feed</div>
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 animate-pulse">
                      <div className="h-3 w-24 rounded bg-white/10 mb-3" />
                      <div className="h-4 w-full rounded bg-white/10 mb-2" />
                      <div className="h-4 w-4/5 rounded bg-white/10 mb-4" />
                      <div className="h-3 w-32 rounded bg-white/10" />
                    </div>
                  ))}
                </div>
              )}
              {newsError && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{newsError}</div>}
              {!newsLoading && !newsError && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-jarvis-accent">World</div>
                      <div className="text-[11px] text-gray-500">{newsWorld.length} stories</div>
                    </div>
                    <div className="grid gap-3">
                      {newsWorld.map((n, idx) => (
                        <a key={idx} href={n.link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-jarvis-accent/45 hover:bg-white/[0.06] transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">{n.source || 'Google News'}</div>
                              <div className="font-semibold text-white leading-relaxed">{n.title}</div>
                              {n.description && <div className="text-xs text-gray-400 mt-2 line-clamp-2">{n.description}</div>}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                          </div>
                          {n.pubDate && <div className="text-[11px] text-gray-500 mt-3">{n.pubDate}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-jarvis-accent">India</div>
                      <div className="text-[11px] text-gray-500">{newsIndia.length} stories</div>
                    </div>
                    <div className="grid gap-3">
                      {newsIndia.map((n, idx) => (
                        <a key={idx} href={n.link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-jarvis-accent/45 hover:bg-white/[0.06] transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">{n.source || 'Google News'}</div>
                              <div className="font-semibold text-white leading-relaxed">{n.title}</div>
                              {n.description && <div className="text-xs text-gray-400 mt-2 line-clamp-2">{n.description}</div>}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                          </div>
                          {n.pubDate && <div className="text-[11px] text-gray-500 mt-3">{n.pubDate}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Shield / VPN modal */}

      <AnimatePresence>
        {showVpnModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="w-full max-w-md spatial-glass rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-200">
                  <Shield className="w-4 h-4 text-jarvis-accent" />
                  <span>Brahma Shield</span>
                </div>
                <button onClick={() => setShowVpnModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-xs font-semibold transition-all ${shieldStatus === 'ACTIVE' ? 'border-emerald-400 shadow-[0_0_18px_#22c55e55] text-emerald-200' : shieldStatus === 'CONNECTING' ? 'border-yellow-400 animate-pulse text-yellow-100' : 'border-gray-600 text-gray-400'}`}>
                  {shieldStatus}
                </div>
                <div className="text-gray-300 text-sm">Route traffic through proxy</div>
                <div className="text-[11px] text-gray-500">Location: {shieldLocation}</div>
                  {/* Proxy hidden per user request */}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                onClick={async () => { 
                  setShieldStatus('CONNECTING'); 
                  const res = await sendShield({ type: 'connect' }); 
                  if (!res?.ok) setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10 hover:bg-jarvis-accent/20 text-sm"
              >Connect</button>
              <button
                onClick={async () => { 
                  setShieldStatus('CONNECTING'); 
                  const res = await sendShield({ type: 'switch' }); 
                  if (!res?.ok) setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-white/10 text-gray-200 bg-white/5 hover:bg-white/10 text-sm"
              >Change Server</button>
              <button
                onClick={async () => { 
                  await sendShield({ type: 'disconnect' }); 
                  setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-white/10 text-gray-200 bg-white/5 hover:bg-white/10 text-sm"
              >Disconnect</button>
              </div>
              <div className="text-[11px] text-gray-500 text-center">Note: Uses browser proxy API; not system-wide VPN.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-[radial-gradient(circle_at_top,var(--brahma-glow-color),transparent_28%),rgba(4,6,12,0.9)] backdrop-blur-md"
          >
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

            {onboardingStage === 'boot' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.4em] text-jarvis-accent font-mono mb-6">System Boot</div>
                  <div className="space-y-3 font-mono text-sm md:text-base text-gray-200 min-h-[180px]">
                    {BOOT_LINES.slice(0, bootVisibleLines).map((line, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-jarvis-accent">{'>'}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'welcome' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-3xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Welcome</div>
                  <h1 className="font-display text-4xl md:text-6xl text-white leading-none">Welcome to Brahma OS</h1>
                  <p className="mt-4 text-lg text-gray-300">Your AI-powered browser system</p>
                  <div className="mt-8 grid md:grid-cols-3 gap-4">
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">AI Agent for tasks</div>
                      <div className="mt-2 text-xs text-gray-400">Ask, automate, summarize, and get help instantly.</div>
                    </div>
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">Smart tools on every website</div>
                      <div className="mt-2 text-xs text-gray-400">Use floating actions for explain, notes, and summaries.</div>
                    </div>
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">Mode-based workflows</div>
                      <div className="mt-2 text-xs text-gray-400">Switch the system feel for study, gaming, or building.</div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button onClick={() => setOnboardingStage('mode')} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'mode' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-4xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Personalize</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Choose your starting mode</h2>
                  <p className="mt-3 text-sm text-gray-400">This sets your theme, suggestions, and default quick tools.</p>
                  <div className="mt-8 grid md:grid-cols-3 gap-4">
                    {([AppMode.STUDY, AppMode.GAMING, AppMode.DEVELOPER] as AppMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPendingModeSelection(m)}
                        className={`rounded-2xl p-5 text-left transition-all ${
                          pendingModeSelection === m ? 'spatial-glass border-jarvis-accent shadow-[0_0_30px_var(--brahma-glow-color)]' : 'spatial-glass-subtle hover:border-white/20'
                        }`}
                      >
                        <div className="font-display text-xl text-white">{m}</div>
                        <div className="mt-2 text-sm text-gray-300">{MODE_COPY[m].label}</div>
                        <div className="mt-3 text-xs text-gray-400">
                          {m === AppMode.STUDY && 'Focus, summaries, learning tools'}
                          {m === AppMode.GAMING && 'Speed, tips, performance'}
                          {m === AppMode.DEVELOPER && 'Debugging, coding, APIs'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button onClick={startOnboardingMode} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Start with this mode
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'tour' && (
              <div className="h-full relative px-6 py-10">
                <div className="absolute top-6 right-6 rounded-2xl spatial-glass px-4 py-3 max-w-sm">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-jarvis-accent mb-2">Feature Tour</div>
                  {tourStep === 0 && (
                    <>
                      <div className="text-white font-semibold">Type anything. Brahma executes.</div>
                      <div className="mt-2 text-sm text-gray-400">Auto-typing example: <span className="text-jarvis-accent">{tourTypedText || 'Summarize this page'}</span></div>
                    </>
                  )}
                  {tourStep === 1 && (
                    <>
                      <div className="text-white font-semibold">Brahma works on every website</div>
                      <div className="mt-2 text-sm text-gray-400">The floating assistant gives you instant tools outside the new tab.</div>
                    </>
                  )}
                  {tourStep === 2 && (
                    <>
                      <div className="text-white font-semibold">Instant tools based on your mode</div>
                      <div className="mt-2 text-sm text-gray-400">Quick actions adapt to what you’re doing right now.</div>
                    </>
                  )}
                </div>
                {tourStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute bottom-10 right-10 rounded-2xl bg-jarvis-accent text-white shadow-[0_0_32px_var(--brahma-glow-color)] px-5 py-4 border border-white/10"
                  >
                    Floating Assistant
                  </motion.div>
                )}
              </div>
            )}

            {onboardingStage === 'activate' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Activate AI</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Activate AI Features</h2>
                  <p className="mt-3 text-sm text-gray-400">Choose your AI provider and add a key, or skip and use Brahma in limited mode for the moment.</p>
                  <div className="mt-5">
                    <ProviderSwitch value={aiProvider} onChange={switchProvider} configured={configuredProviders} />
                  </div>
                  <input
                    type="password"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder={`Paste ${AI_PROVIDERS[aiProvider].label} API key`}
                    className="mt-4 w-full p-4 rounded-2xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                  />
                  <a
                    href={AI_PROVIDERS[aiProvider].helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-jarvis-accent hover:underline"
                  >
                    {AI_PROVIDERS[aiProvider].helpLabel}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <div className="mt-6 flex flex-wrap gap-3 justify-end">
                    <button onClick={skipApiActivation} className="px-4 py-3 rounded-xl spatial-glass-subtle text-gray-300">Skip for now</button>
                    <button onClick={saveApiKeyFromOnboarding} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Save Key
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'first-action' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-3xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">First Action</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Get your first win fast</h2>
                  <p className="mt-3 text-sm text-gray-400">Try one of these to feel Brahma OS immediately.</p>
                  <div className="mt-8 grid md:grid-cols-2 gap-4">
                    {['Summarize this page', 'Explain this content', 'Open YouTube', 'Fix this error'].map((item) => (
                      <button
                        key={item}
                        onClick={() => runFirstAction(item)}
                        className="rounded-2xl spatial-glass-subtle p-5 text-left hover:border-jarvis-accent transition-all"
                      >
                        <div className="text-white font-semibold">{item}</div>
                        <div className="mt-2 text-xs text-gray-400">Run this now</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'complete' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)] text-center">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">System Ready</div>
                  <h2 className="font-display text-4xl md:text-6xl text-white">Brahma OS is now active</h2>
                  <p className="mt-4 text-sm text-gray-400">Your AI browser system is ready to work with you.</p>
                  <button onClick={completeOnboarding} className="mt-8 px-6 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                    Enter System
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* API Key Prompt */}
      <AnimatePresence>
        {showApiPrompt && !showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md spatial-glass rounded-2xl p-6"
            >
              <h3 className="font-display text-lg text-jarvis-accent tracking-widest mb-2">AI Provider &amp; API Key</h3>
              <p className="text-xs text-gray-400 mb-4">Choose a provider, then add its key. Brahma tries your selected provider first, then falls back through the rest of your saved keys. Keys stay in local storage.</p>
              <div className="mb-4">
                <ProviderSwitch value={aiProvider} onChange={switchProvider} configured={configuredProviders} />
              </div>
              <input
                type="password"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder={AI_PROVIDERS[aiProvider].placeholder}
                className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none mb-4"
              />
              <a
                href={AI_PROVIDERS[aiProvider].helpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-jarvis-accent hover:underline inline-flex items-center gap-2 mb-4"
              >
                {AI_PROVIDERS[aiProvider].helpLabel}
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowApiPrompt(false)}
                  className="px-4 py-2 text-xs border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-all"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleClearApiKey();
                      setShowApiPrompt(true);
                    }}
                    className="px-3 py-2 text-xs border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!userApiKey.trim()}
                    className="px-4 py-2 text-xs bg-jarvis-accent text-white rounded-lg border border-white/10 shadow-[0_0_18px_var(--brahma-glow-color)] hover:scale-105 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Settings modal */}
      <AnimatePresence>
        {showSettingsPage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="w-full max-w-3xl spatial-glass rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-jarvis-accent">Brahma Settings</div>
                  <div className="text-lg font-display text-white">AI, Themes &amp; Background</div>
                </div>
                <button onClick={() => setShowSettingsPage(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-2xl spatial-glass-subtle p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-gray-400">AI Providers</div>
                    <div className="text-[11px] text-gray-500">
                      Selected: {AI_PROVIDERS[aiProvider].label} • {configuredProviders.length} key{configuredProviders.length === 1 ? '' : 's'} saved
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${configuredProviders.includes(aiProvider) ? 'border-emerald-500/50 text-emerald-500' : 'border-red-500/50 text-red-500'}`}>
                    {configuredProviders.includes(aiProvider) ? 'Key ready' : 'No key'}
                  </span>
                </div>
                <ProviderSwitch value={aiProvider} onChange={switchProvider} configured={configuredProviders} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Model</span>
                    <select
                      value={aiModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                    >
                      {providerModels.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">API key</span>
                    <input
                      type="password"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder={AI_PROVIDERS[aiProvider].placeholder}
                      className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={AI_PROVIDERS[aiProvider].helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-jarvis-accent hover:underline inline-flex items-center gap-1.5"
                  >
                    {AI_PROVIDERS[aiProvider].helpLabel}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={pingModel}
                      disabled={providerTest === 'testing'}
                      className="px-3 py-2 text-xs rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/30 transition-all inline-flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <PlugZap className="w-3 h-3" />
                      {providerTest === 'testing' ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={handleClearApiKey}
                      className="px-3 py-2 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/30 transition-all"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSaveApiKey}
                      disabled={!userApiKey.trim()}
                      className="px-4 py-2 text-xs bg-jarvis-accent text-white rounded-lg border border-white/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      Save key
                    </button>
                  </div>
                </div>
                {providerTestMessage && (
                  <div className={`text-[11px] ${providerTest === 'ok' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {providerTestMessage}
                  </div>
                )}
                <div className="rounded-xl border border-white/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Fallback order</div>
                    <div className="text-[10px] text-gray-500">Selected provider runs first</div>
                  </div>
                  {providerOrder.map((p, index) => (
                    <div key={p} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-gray-500">{index + 1}</span>
                        <span className={`text-[11px] truncate ${p === aiProvider ? 'text-white' : 'text-gray-300'}`}>
                          {AI_PROVIDERS[p].label}
                        </span>
                        {configuredProviders.includes(p) && (
                          <span className="text-[9px] uppercase tracking-wider text-emerald-500">key</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveProvider(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${AI_PROVIDERS[p].label} up`}
                          className="p-1 rounded border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveProvider(index, 1)}
                          disabled={index === providerOrder.length - 1}
                          aria-label={`Move ${AI_PROVIDERS[p].label} down`}
                          className="p-1 rounded border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-[10px] text-gray-500">
                    Free tiers: Ollama Cloud starter models and OpenRouter free routing are rate-limited.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl spatial-glass-subtle p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-gray-400">Brahma Hub</div>
                    <div className="text-[11px] text-gray-500">Local companion for Image Lab file scanning and image processing.</div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${
                    hubStatus === 'online'
                      ? 'border-emerald-500/50 text-emerald-500'
                      : hubStatus === 'checking'
                        ? 'border-sky-500/50 text-sky-400'
                        : hubStatus === 'error'
                          ? 'border-red-500/50 text-red-400'
                          : 'border-white/15 text-gray-400'
                  }`}>
                    {hubStatus === 'online' ? 'Online' : hubStatus === 'checking' ? 'Checking' : hubStatus === 'error' ? 'Offline' : 'Not tested'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Hub URL</span>
                    <input
                      type="text"
                      value={hubUrl}
                      onChange={(e) => { setHubUrlState(e.target.value); setHubStatus('idle'); }}
                      placeholder="http://127.0.0.1:47821"
                      className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-gray-400">Hub token</span>
                    <input
                      type="password"
                      value={hubToken}
                      onChange={(e) => { setHubTokenState(e.target.value); setHubStatus('idle'); }}
                      placeholder="Paste from hub\\data\\hub-token.txt"
                      className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] text-gray-500">Start with <span className="font-mono">hub\\start-brahma-hub.bat</span>; the token is printed there.</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveHubSettings}
                      className="px-3 py-2 text-xs rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/30 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={testHubConnection}
                      disabled={hubStatus === 'checking'}
                      className="px-4 py-2 text-xs bg-jarvis-accent text-white rounded-lg border border-white/10 hover:scale-105 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center gap-1.5"
                    >
                      <PlugZap className="w-3 h-3" />
                      {hubStatus === 'checking' ? 'Testing...' : 'Test Hub'}
                    </button>
                  </div>
                </div>
                {hubMessage && (
                  <div className={`text-[11px] ${hubStatus === 'online' ? 'text-emerald-500' : hubStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                    {hubMessage}
                  </div>
                )}
              </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[AppMode.STUDY, AppMode.GAMING, AppMode.DEVELOPER].map(m => (
                <button
                  key={m}
                  onClick={() => applyMode(m)}
                  className={`p-3 rounded border text-left transition-all ${mode === m ? 'border-jarvis-accent bg-jarvis-accent/10 text-white' : 'border-white/10 text-gray-400 hover:border-jarvis-accent/40 hover:text-white'}`}
                >
                  <div className="text-xs uppercase tracking-widest">{m}</div>
                  <div className="text-[11px] text-gray-500">Optimize colors & feel for {m.toLowerCase()}.</div>
                </button>
              ))}
            </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} className="accent-jarvis-accent" />
                  Auto-switch mode based on visited site
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={lightMode} onChange={(e) => toggleLightMode(e.target.checked)} className="accent-jarvis-accent" />
                  Light theme (match your Chrome OS)
                </label>
                <span className="text-[11px] text-gray-500">e.g., GitHub → Dev, Twitch → Gaming, Wikipedia → Study</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['primary','secondary','accent'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs text-gray-400 capitalize">{key} color</label>
                    <input
                      type="color"
                      value={themeColors[key]}
                      onChange={(e) => setThemeColors(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full h-12 rounded border border-white/20 bg-white/5"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <label className="text-xs text-gray-400">Upload custom background</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setCustomBackground(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-jarvis-accent file:text-jarvis-dark hover:file:bg-jarvis-accent/80"
                />
                {customBackground && (
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-20 rounded border border-white/20 overflow-hidden">
                      <img src={customBackground} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => setCustomBackground(null)}
                      className="px-3 py-2 text-xs bg-red-500/20 border border-red-500 text-red-500 rounded hover:bg-red-500/30"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setThemeColors(getThemePalette(mode, lightMode));
                    setCustomBackground(null);
                    try { localStorage.removeItem(`brahma-theme-colors-${lightMode ? 'light-' : ''}${mode}`); } catch {}
                  }}
                  className="px-4 py-2 text-xs rounded border border-white/20 text-gray-400 hover:text-white hover:border-white/40"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={() => setShowSettingsPage(false)}
                  className="px-4 py-2 text-xs bg-jarvis-accent text-black rounded hover:scale-105 active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact icon rail */}
      <div className="fixed left-3 top-1/2 -translate-y-1/2 rounded-2xl spatial-glass flex flex-col items-center gap-3 py-4 px-2 z-20 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        <div className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-jarvis-accent shadow-inner">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="text-[8px] uppercase tracking-[0.35em] text-gray-500 [writing-mode:vertical-rl] rotate-180 select-none font-display">Brahma</div>
        <button
          onClick={() => setShowNews(true)}
          title="News corner"
          className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
        >
          <Newspaper className="w-5 h-5" />
        </button>
        <button
          onClick={() => document.getElementById('brahma-modules')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          title="Brahma modules"
          className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
        >
          <Boxes className="w-5 h-5" />
        </button>
        <button
          onClick={() => openToolsPage('ocr')}
          title="Browser tools"
          className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
        >
          <Wrench className="w-5 h-5" />
        </button>
        <div className="mt-2 flex flex-col items-center gap-2">
          <button onClick={() => setShowSettingsPage(true)} title="Settings" className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"><Settings className="w-5 h-5" /></button>
          <button onClick={() => setShowNotes(true)} title="Notes" className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main 
        className="flex-1 h-screen flex flex-col relative z-10 transition-all duration-300 ease-out overflow-y-auto"
        style={{ marginRight: showNews ? 'min(50vw, 900px)' : '0px', paddingLeft: '76px' }}
      >
        {/* Top Control Bar HUD */}
        <div className="mx-6 mt-4 rounded-2xl spatial-glass px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* System Branding & Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className={`w-2 h-2 rounded-full ${
                  aiHealth === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : aiHealth === 'checking' ? 'bg-yellow-400 animate-ping' : 'bg-red-400'
                }`} />
                <span className="text-[11px] font-display font-semibold tracking-wider text-white">BRAHMA OS</span>
                <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono ml-1">{aiHealth === 'online' ? 'ONLINE' : aiHealth}</span>
              </div>
              {currentTime && (
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
                  <span className="text-jarvis-accent font-semibold">{currentTime}</span>
                </div>
              )}
            </div>

            {/* Telemetry Metrics */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => { void testHubConnection(); }}
                disabled={hubStatus === 'checking'}
                title={hubMessage || 'Test the local Brahma Hub connection'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] transition-colors disabled:opacity-70 ${
                  hubStatus === 'online'
                    ? 'bg-emerald-400/10 border-emerald-400/25 text-emerald-300'
                    : hubStatus === 'error'
                      ? 'bg-red-400/10 border-red-400/25 text-red-300'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>
                  Hub {hubStatus === 'online' ? 'online' : hubStatus === 'checking' ? 'checking' : hubStatus === 'error' ? 'offline' : 'check'}
                </span>
              </button>
              {batteryLevel !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <Battery className={`w-3.5 h-3.5 ${batteryLevel > 50 ? 'text-emerald-400' : batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`} />
                  <span>{batteryLevel}%</span>
                </div>
              )}
              {memoryUsage !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <Activity className={`w-3.5 h-3.5 ${memoryUsage > 80 ? 'text-red-400' : memoryUsage > 60 ? 'text-yellow-400' : 'text-cyan-400'}`} />
                  <span>RAM {memoryUsage}%</span>
                </div>
              )}
              {weather && (
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <span className="text-jarvis-accent font-medium">{weather.temp}°C</span> {weather.description}
                </div>
              )}
            </div>
          </div>

          {/* Mode Switcher & Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Pills Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
              {([AppMode.DEVELOPER, AppMode.STUDY, AppMode.GAMING] as AppMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => applyMode(m)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    mode === m 
                      ? 'bg-jarvis-accent text-black shadow-[0_0_15px_var(--brahma-glow-color)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={pingModel}
              className="text-[11px] px-3 py-1.5 rounded-xl spatial-glass-subtle text-gray-300 hover:text-white hover:border-jarvis-accent/50 transition-all"
              title="Re-run AI health check"
            >
              Recheck
            </button>
            <button
              onClick={() => openToolsPage('ocr')}
              className="text-[11px] px-3 py-1.5 rounded-xl spatial-glass-subtle text-gray-300 hover:text-white hover:border-jarvis-accent/50 transition-all inline-flex items-center gap-1.5"
              title="Open browser tools"
            >
              <Wrench className="w-3.5 h-3.5" />
              Tools
            </button>
            <button
              onClick={() => setShowApiPrompt(true)}
              className="text-[11px] px-3 py-1.5 rounded-xl spatial-glass-subtle text-gray-300 hover:text-white hover:border-jarvis-accent/50 transition-all"
              title="Set API key"
            >
              API Key
            </button>
            {!isRightSidebarOpen && (
              <button 
                onClick={() => setIsRightSidebarOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-jarvis-accent/15 border border-jarvis-accent/40 text-jarvis-accent transition-all flex items-center gap-2 hover:bg-jarvis-accent hover:text-black hover:shadow-[0_0_20px_var(--brahma-glow-color)]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Agent</span>
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {contextHint && (
          <div className="mx-6 mt-4 rounded-2xl spatial-glass-subtle p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-[10px] uppercase tracking-[0.24em] text-jarvis-accent font-semibold">Brahma Hint</div>
              <div className="mt-0.5 text-sm text-white">{contextHint.text}</div>
            </div>
            <button
              onClick={() => triggerTool(contextHint.action)}
              className="px-3.5 py-1.5 text-xs bg-jarvis-accent text-black font-medium rounded-xl hover:shadow-[0_0_15px_var(--brahma-glow-color)] transition-all"
            >
              Try it
            </button>
          </div>
        )}

        {/* Hero Section: Left Clock + Center/Right Spotlight & Dock */}
        <div className="px-6 py-6 flex items-start justify-center">
          <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 xl:gap-10">
            
            {/* Left Column: Big Analogue Clock (12h format adapted to device local time) */}
            <div className="flex-shrink-0 flex flex-col items-center lg:sticky lg:top-8 pt-1">
              <AnalogClock 
                accentColor={themeColors.accent}
                glowColor="var(--brahma-glow-color)"
                mode={mode}
                light={lightMode}
              />
            </div>

            {/* Right Column: Realigned Spotlight Command Bar, Quick Chips & Launch Dock */}
            <div className="flex-1 w-full max-w-3xl space-y-5">
              
              {/* Spotlight Command Bar */}
              <div
                ref={searchSurfaceRef}
                className={`spotlight-bar rounded-2xl p-2 transition-all ${
                  showOnboarding && onboardingStage === 'tour' && tourStep === 0 ? 'ring-2 ring-jarvis-accent shadow-[0_0_40px_var(--brahma-glow-color)]' : ''
                }`}
              >
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSearch(); }} 
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <Search className="text-jarvis-accent w-5 h-5 flex-shrink-0" />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isListening ? "Listening to voice command..." : `Ask Brahma anything in ${mode} mode...`} 
                    className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-gray-500 font-sans caret-jarvis-accent"
                  />
                  
                  {/* Voice toggle with audio wave or mic */}
                  <div className="flex items-center gap-2">
                    {isListening && (
                      <div className="flex items-center gap-1 px-2">
                        <span className="listening-wave-bar" style={{ animationDelay: '0ms' }} />
                        <span className="listening-wave-bar" style={{ animationDelay: '150ms' }} />
                        <span className="listening-wave-bar" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={toggleListening}
                      className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                      title="Voice Command"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded-lg">
                      ↵ Enter
                    </kbd>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (query.trim()) {
                          openUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
                        }
                      }}
                      className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-jarvis-accent transition-all"
                      title="Google Search"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Contextual Quick Action Chips */}
              <div
                ref={quickActionStripRef}
                className={`flex flex-wrap items-center justify-center gap-2.5 transition-all ${
                  showOnboarding && onboardingStage === 'tour' && tourStep === 2 ? 'ring-2 ring-jarvis-accent shadow-[0_0_40px_var(--brahma-glow-color)] rounded-2xl p-2' : ''
                }`}
              >
                {quickActions.map((b, idx) => (
                  <button
                    key={idx}
                    onClick={b.action}
                    className="action-chip px-4 py-2 rounded-xl text-xs font-medium text-gray-300 flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-jarvis-accent" />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>

              {/* Floating Launch Dock */}
              <div className="launch-dock rounded-3xl p-5">
                <div className="flex items-center justify-between px-2 mb-4">
                  <span className="text-[11px] font-display uppercase tracking-[0.25em] text-gray-400 font-semibold flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5 text-jarvis-accent" />
                    Launch Dock
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{shortcuts.length} shortcuts</span>
                </div>

                <div className="flex items-center justify-start gap-4 flex-wrap px-1">
                  {shortcuts.map(s => (
                    <a 
                      key={s.id} 
                      href={s.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => handleShortcutClick(s)}
                      className="flex flex-col items-center gap-2 group relative"
                    >
                      <button 
                        onClick={(e) => deleteShortcut(s.id, e)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500 shadow-md"
                        title="Delete shortcut"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      <div className="dock-tile w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden relative">
                        {s.favicon ? (
                          <img 
                            src={s.favicon} 
                            alt={s.name} 
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              const sibling = (e.currentTarget.parentElement?.querySelector('.fallback-icon')) as HTMLElement;
                              if (sibling) sibling.style.display = 'flex';
                            }}
                            className="w-9 h-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" 
                          />
                        ) : null}
                        <div className={`fallback-icon w-9 h-9 items-center justify-center ${s.favicon ? 'hidden' : 'flex'}`}>
                          {renderShortcutIcon(s.icon)}
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors text-center truncate max-w-[72px] font-medium">
                        {s.name}
                      </span>
                    </a>
                  ))}
                  
                  {/* Add Shortcut Tile */}
                  <button 
                    onClick={() => setShowAddShortcut(true)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] flex items-center justify-center group-hover:border-jarvis-accent group-hover:bg-jarvis-accent/10 group-hover:scale-105 transition-all">
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-jarvis-accent transition-colors" />
                    </div>
                    <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors font-medium">Add</span>
                  </button>
                </div>
              </div>

              <ModulesDock
                onOpen={openModule}
                onOpenHubSettings={() => setShowSettingsPage(true)}
              />

            </div>
          </div>
        </div>

        {/* Add Shortcut Modal */}
        <AnimatePresence>
          {showAddShortcut && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddShortcut(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md spatial-glass p-6 rounded-2xl z-[101]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-lg text-jarvis-accent tracking-widest uppercase">Add Shortcut</h2>
                  <button onClick={() => setShowAddShortcut(false)} className="text-gray-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={addShortcut} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest px-1">Name</label>
                    <input 
                      type="text" 
                      value={newShortcutName}
                      onChange={(e) => setNewShortcutName(e.target.value)}
                      placeholder="e.g. Netflix"
                      className="w-full spatial-glass-subtle border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-jarvis-accent transition-all"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest px-1">URL</label>
                    <input 
                      type="text" 
                      value={newShortcutUrl}
                      onChange={(e) => setNewShortcutUrl(e.target.value)}
                      placeholder="e.g. netflix.com"
                      className="w-full spatial-glass-subtle border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-jarvis-accent transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-jarvis-accent text-jarvis-dark py-3 rounded-xl font-display text-xs tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 font-semibold"
                  >
                    Initialize Shortcut
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Results / Notes View */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto h-full">
            <AnimatePresence mode="wait">
              {showNotes ? (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-jarvis-border pb-4 mb-6">
                    <h2 className="font-display text-xl text-jarvis-accent flex items-center gap-2">
                      <StickyNote className="w-6 h-6" /> NEURAL ARCHIVE
                    </h2>
                    <button onClick={() => setShowNotes(false)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>

                  <div className="spatial-glass rounded-2xl p-5 mb-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-sm text-white font-medium">Add source for Brahma</div>
                        <div className="text-xs text-gray-400">Save a URL, pasted text, or both. The agent can use enabled items while answering.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveSelectedTextAsSource}
                          disabled={isCapturingSelection}
                          className="px-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCapturingSelection ? 'Saving selection...' : 'Save selected text'}
                        </button>
                        <button
                          onClick={saveCurrentPageAsSource}
                          disabled={isCapturingSource}
                          className="px-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCapturingSource ? 'Saving page...' : 'Save current page'}
                        </button>
                        <button
                          onClick={addArchiveSource}
                          className="px-4 py-2 text-xs rounded-xl bg-jarvis-accent text-black hover:scale-105 active:scale-95 transition-all"
                        >
                          Save source
                        </button>
                      </div>
                    </div>
                    {archiveStatusMessage && (
                      <div className="mb-4 rounded-xl border border-jarvis-accent/20 bg-jarvis-accent/10 px-3 py-2 text-xs text-jarvis-accent">
                        {archiveStatusMessage}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newSourceTitle}
                        onChange={(e) => setNewSourceTitle(e.target.value)}
                        placeholder="Source title"
                        className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50"
                      />
                      <input
                        type="text"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="Source URL (optional)"
                        className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50"
                      />
                      <textarea
                        value={newSourceContent}
                        onChange={(e) => setNewSourceContent(e.target.value)}
                        placeholder="Paste article text, notes, repo context, docs, or any reference Brahma should use"
                        className="md:col-span-2 min-h-[120px] rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50 resize-y"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notes.map(note => (
                      <div key={note.id} className="spatial-glass p-5 rounded-2xl group">
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-[0.25em] text-gray-500">{note.kind === 'source' ? 'Source' : 'Note'}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${note.useForAgent !== false ? 'border-jarvis-accent/40 text-jarvis-accent bg-jarvis-accent/10' : 'border-white/10 text-gray-500 bg-white/5'}`}>
                                {note.useForAgent !== false ? 'Agent on' : 'Agent off'}
                              </span>
                            </div>
                            <h3 className="font-bold text-jarvis-accent truncate">{note.title}</h3>
                            {note.sourceUrl && (
                              <a
                                href={note.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-gray-400 hover:text-jarvis-accent break-all"
                              >
                                {note.sourceUrl}
                              </a>
                            )}
                          </div>
                          <button onClick={() => deleteNote(note.id)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-4 whitespace-pre-wrap markdown-body prose prose-invert">
                          <Markdown>{note.content}</Markdown>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <button
                            onClick={() => toggleNoteForAgent(note.id)}
                            className={`text-[11px] px-3 py-1.5 rounded-lg border transition ${note.useForAgent !== false ? 'border-jarvis-accent/40 text-jarvis-accent bg-jarvis-accent/10 hover:bg-jarvis-accent/15' : 'border-white/10 text-gray-400 bg-white/5 hover:border-white/20 hover:text-white'}`}
                          >
                            {note.useForAgent !== false ? 'Used by agent' : 'Enable for agent'}
                          </button>
                          <div className="text-[9px] text-gray-600">{new Date(note.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                        <StickyNote className="w-16 h-16 mb-4" />
                        <p className="font-display tracking-widest">ARCHIVE EMPTY</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full"
                >
                  {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-6">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-jarvis-accent/10 border-t-jarvis-accent rounded-full animate-spin"></div>
                        <Cpu className="absolute inset-0 m-auto w-8 h-8 text-jarvis-accent animate-pulse" />
                      </div>
                      <div className="text-center">
                        <div className="font-display text-sm text-jarvis-accent animate-pulse tracking-[0.3em] mb-2">ACCESSING NEURAL CORE</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Decrypting response from {AI_PROVIDERS[aiProvider].model}...</div>
                      </div>
                    </div>
                  ) : aiResponse ? (
                    <div className="spatial-glass p-6 rounded-2xl min-h-[320px]">
                      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 bg-jarvis-accent rounded-full animate-ping"></div>
                          <h3 className="font-display text-sm text-jarvis-accent uppercase tracking-widest">
                            {mode} INTELLIGENCE FEED
                          </h3>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                            <input 
                              type="text" 
                              placeholder="Note title..." 
                              value={newNoteTitle}
                              onChange={(e) => setNewNoteTitle(e.target.value)}
                              className="bg-transparent border-none outline-none text-xs px-2 w-32 text-white placeholder:text-gray-500"
                            />
                            <button 
                              onClick={addNote}
                              className="bg-jarvis-accent/20 text-jarvis-accent p-1.5 rounded-lg hover:bg-jarvis-accent/40 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button onClick={() => setAiResponse(null)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"><X className="w-5 h-5" /></button>
                        </div>
                      </div>
                      <div className="markdown-body prose prose-invert max-w-none text-gray-200 leading-relaxed font-sans">
                        <Markdown>{aiResponse.content}</Markdown>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      {showToolsPage && (
        <ToolsPage
          key={`${toolsInitialTab}-${toolsRequestNonce}-${toolsTargetTabId || 0}`}
          initialTool={toolsInitialTab}
          targetTabId={toolsTargetTabId}
          onClose={closeToolsPage}
          onSaveSource={saveToolSource}
        />
      )}
      {activeModule && getModule(activeModule) && (
        <ModuleHost
          ref={activeModuleHostRef}
          module={getModule(activeModule)!}
          onClose={() => setActiveModule(null)}
          onSaveSnapshot={saveModuleSnapshot}
          onAskBrahma={askBrahmaAboutModule}
        />
      )}
      {/* RIGHT SIDEBAR - AI AGENT */}
      <AnimatePresence>
        {isRightSidebarOpen && (
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 w-[420px] max-w-full h-screen flex flex-col spatial-glass z-20 border-l overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brahma-accent/20 rounded-full flex items-center justify-center border border-brahma-accent">
                  <Bot className="text-brahma-accent w-5 h-5" />
                </div>
                <h2 className="font-display text-sm font-bold tracking-widest text-brahma-accent uppercase">Brahma Agent</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsChatNavCollapsed(!isChatNavCollapsed)}
                  className="text-gray-500 hover:text-white border border-white/10 rounded px-2 py-1"
                  title={isChatNavCollapsed ? "Show chat sidebar" : "Hide chat sidebar"}
                >
                  {isChatNavCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsRightSidebarOpen(false)} className="text-gray-500 hover:text-white">
                  <PanelRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex h-full min-h-0">
              {/* LEFT CHAT NAV */}
              <div className={`${isChatNavCollapsed ? 'w-12' : 'w-60'} border-r border-jarvis-border bg-black/30 flex flex-col p-3 gap-3 transition-all duration-200`}>
                <button onClick={createNewSession} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/40 hover:bg-jarvis-accent/30 text-xs">
                  <PlusCircle className="w-4 h-4" /> {!isChatNavCollapsed && 'New chat'}
                </button>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs">
                  <SearchIcon className="w-4 h-4 text-gray-500" />
                  {!isChatNavCollapsed && (
                    <input
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search chats"
                      className="bg-transparent border-none outline-none flex-1 text-gray-300 text-xs"
                    />
                  )}
                </div>
                {!isChatNavCollapsed && (
                  <>
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="font-semibold text-gray-200 flex items-center justify-between">
                        <span>Folders</span>
                        <button onClick={createNewFolder} className="px-2 py-1 bg-white/5 text-gray-300 rounded text-[10px] border border-white/10 hover:bg-white/10">New</button>
                      </div>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, null); }}
                        className="px-2 py-1 rounded border border-white/10 bg-white/5 hover:border-jarvis-accent/40 cursor-pointer"
                      >
                        All chats
                      </div>
                      {folders.map(f => (
                        <div
                          key={f.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, f.id); }}
                          className="px-2 py-1 rounded border border-white/10 bg-white/5 hover:border-jarvis-accent/40 cursor-pointer flex items-center gap-2"
                        >
                          <Folder className="w-4 h-4" /> {f.name}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 text-xs text-gray-400 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="font-semibold text-gray-200">Your chats</div>
              {chatSessions
                .filter(s => !chatSearch || s.title.toLowerCase().includes(chatSearch.toLowerCase()))
                .map(s => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('sessionId', s.id)}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`px-2 py-1 rounded border text-[11px] cursor-pointer flex items-center justify-between gap-2 ${activeSessionId === s.id ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10' : 'border-white/10 text-gray-300 bg-white/5 hover:border-jarvis-accent/40'}`}
                  >
                    <span className="truncate">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="text-gray-500 hover:text-red-400"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
            </div>
                  </>
                )}
              </div>

              {/* RIGHT CONTENT */}
              <div className="flex-1 min-h-0 flex flex-col">
{/* Chat Messages */}
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-6 custom-scrollbar">
                  {activeMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8">
                      <div className="w-16 h-16 rounded-[20px] border border-jarvis-accent/20 bg-jarvis-accent/10 flex items-center justify-center mb-4 opacity-80">
                        <Bot className="w-8 h-8 text-jarvis-accent" />
                      </div>
                      <p className="text-xs tracking-widest uppercase text-gray-500">I am your browser agent. Ask me to switch modes, start timers, or open shortcuts.</p>
                    </div>
                  )}
                  {smartTips.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-gray-200 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Smart suggestions</div>
                      <div className="flex flex-wrap gap-2">
                        {MODE_BEHAVIORS[mode].quickActions(triggerTool).slice(0,3).map((a, idx) => (
                          <button
                            key={idx}
                            onClick={a.action}
                            className="px-3 py-2 rounded border border-white/10 bg-black/40 hover:border-jarvis-accent hover:text-jarvis-accent transition text-[11px]"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                        msg.role === 'user' 
                          ? 'bg-jarvis-accent/10 border border-jarvis-accent/30 text-white' 
                          : 'bg-white/5 border border-white/10 text-gray-300'
                      }`}>
                        <div className="prose prose-invert prose-xs">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-100"></div>
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-200"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-jarvis-border bg-black/20">
                  <form onSubmit={handleAgentChat} className="flex items-center gap-2 bg-black/40 rounded-2xl p-2 border border-white/5">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Command Brahma..." 
                      className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-600 py-2 px-2"
                    />
                    <button 
                      type="submit"
                      disabled={isChatLoading}
                      className="p-2 bg-jarvis-accent text-jarvis-dark rounded-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sequentialMode}
                        onChange={(e) => setSequentialMode(e.target.checked)}
                        className="accent-jarvis-accent"
                      />
                      Sequential mode (plan + execute)
                    </label>
                    <span className="text-gray-600">Fast, concise replies enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 210, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 210, 255, 0.4);
        }
        .mode-surface,
        .mode-action-strip {
          transition: border-color 220ms ease, box-shadow 220ms ease, background 220ms ease, transform 220ms ease;
        }
        .gaming-neon .mode-surface,
        .gaming-neon .mode-action-strip,
        .gaming-neon .glass-panel,
        .gaming-neon .futuristic-border {
          border-color: color-mix(in srgb, var(--jarvis-accent) 40%, rgba(255,255,255,0.15));
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--jarvis-accent) 20%, transparent),
            0 0 28px color-mix(in srgb, var(--jarvis-accent) 25%, transparent),
            0 24px 60px rgba(0, 0, 0, 0.4);
        }
        .gaming-neon button:hover {
          box-shadow: 0 0 14px color-mix(in srgb, var(--jarvis-accent) 28%, transparent);
        }
        .dev-grid::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 80px 80px;
          z-index: 0;
        }
        .dev-grid .mode-surface,
        .dev-grid .mode-action-strip,
        .dev-grid .glass-panel {
          border-color: color-mix(in srgb, var(--jarvis-accent) 25%, rgba(255,255,255,0.12));
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--jarvis-accent) 15%, transparent),
            0 0 20px color-mix(in srgb, var(--jarvis-accent) 18%, transparent);
        }
      `}} />
    </div>
  );
}

function SidebarTool({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
    >
      <div className="text-gray-500 group-hover:glow-text transition-colors">
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function renderShortcutIcon(iconName: string) {
  switch (iconName) {
    case 'LayoutGrid': return <LayoutGrid className="w-7 h-7 text-blue-400" />;
    case 'Youtube': return <Youtube className="w-7 h-7 text-red-500" />;
    case 'MessageSquare': return <MessageSquare className="w-7 h-7 text-indigo-400" />;
    case 'Mail': return <Mail className="w-7 h-7 text-red-400" />;
    case 'Github': return <Github className="w-7 h-7 text-white" />;
    default: return <ExternalLink className="w-7 h-7" />;
  }
}



