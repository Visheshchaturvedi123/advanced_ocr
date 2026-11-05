export interface ToolTarget {
  id: number;
  windowId?: number;
  title: string;
  url: string;
  active: boolean;
}

export interface PageToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CollectedImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  source: string;
}

export interface ImageCollection {
  title: string;
  url: string;
  images: CollectedImage[];
}

export interface PageTextResult {
  title: string;
  url: string;
  text: string;
}

export interface ChatExportResult {
  title: string;
  url: string;
  markdown: string;
  messageCount: number;
}

export interface NotebookExportResult {
  title: string;
  url: string;
  markdown: string;
  sourceCount: number;
}

export interface ExtensionEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  type: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isWebUrl = (url?: string) => Boolean(url && /^https?:\/\//i.test(url));

export const getToolTarget = async (preferredTabId?: number): Promise<ToolTarget> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    throw new Error('Browser tools work only inside the Brahma extension.');
  }
  if (preferredTabId) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab.id && isWebUrl(tab.url)) {
        return {
          id: tab.id,
          windowId: tab.windowId,
          title: tab.title || '',
          url: tab.url || '',
          active: Boolean(tab.active),
        };
      }
    } catch {}
  }
  const tabs = await chrome.tabs.query({});
  const candidates = tabs
    .filter((tab) => tab.id && isWebUrl(tab.url))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const active = candidates.find((tab) => tab.active);
  const target = active || candidates[0];
  if (!target?.id) {
    throw new Error('Open a normal website tab first, then try again.');
  }
  return {
    id: target.id,
    windowId: target.windowId,
    title: target.title || '',
    url: target.url || '',
    active: Boolean(target.active),
  };
};

export const runPageTool = async <T = unknown>(tabId: number, action: string): Promise<T> => {
  if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
    throw new Error('Browser tools work only inside the Brahma extension.');
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['page-tools.js'],
  });

  const requestId = `brahma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
      fn();
    };

    const listener = (message: any) => {
      if (message?.type !== 'BRAHMA_PAGE_TOOL_RESULT' || message.requestId !== requestId) return;
      finish(() => {
        if (message.ok) resolve(message.data as T);
        else reject(new Error(message.error || 'The page tool did not return a result.'));
      });
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('The page took too long to respond. Reload it and try again.')));
    }, 25000);

    chrome.runtime.onMessage.addListener(listener);
    chrome.tabs.sendMessage(tabId, { type: 'BRAHMA_PAGE_TOOL', action, requestId }).catch((error) => {
      finish(() => reject(error));
    });
  });
};

export const grabPageText = (tabId: number) => runPageTool<PageTextResult>(tabId, 'grab-text');

export const grabSelection = (tabId: number) => runPageTool<PageTextResult>(tabId, 'grab-selection');

export const collectPageImages = (tabId: number) => runPageTool<ImageCollection>(tabId, 'collect-images');

export const exportCurrentChat = (tabId: number) => runPageTool<ChatExportResult>(tabId, 'export-chat');

export const exportNotebookSources = (tabId: number) =>
  runPageTool<NotebookExportResult>(tabId, 'notebooklm-sources');

export const extractYoutubeTranscript = async (tabId: number): Promise<PageTextResult> => {
  if (typeof chrome === 'undefined' || !chrome.scripting?.executeScript) {
    throw new Error('Transcript export works only inside the Brahma extension.');
  }

  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      type CaptionTrack = {
        baseUrl?: string;
        languageCode?: string;
        kind?: string;
        name?: { simpleText?: string; runs?: Array<{ text?: string }> };
      };

      const clean = (value: string) => (value || '').replace(/\s+/g, ' ').trim();
      const pageTitle = document.title || 'YouTube transcript';
      const pageUrl = window.location.href;

      const videoId = (() => {
        try {
          const url = new URL(window.location.href);
          if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
          if (/^\/(shorts|embed|live)\//.test(url.pathname)) return url.pathname.split('/')[2] || '';
          return url.searchParams.get('v') || '';
        } catch {
          return '';
        }
      })();

      const linesFromCaption = async (baseUrl?: string): Promise<string[] | null> => {
        if (!baseUrl) return null;
        try {
          const captionUrl = new URL(baseUrl, window.location.href);
          captionUrl.searchParams.set('fmt', 'json3');
          const response = await fetch(captionUrl.toString(), { credentials: 'include' });
          if (!response.ok) return null;
          const raw = await response.text();
          if (!raw.trim()) return null;
          let data: any;
          try {
            data = JSON.parse(raw);
          } catch {
            return null;
          }
          const events = (data?.events || []) as Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
          const lines: string[] = [];
          events.forEach((event) => {
            const text = clean((event.segs || []).map((seg) => seg.utf8 || '').join(''));
            if (!text) return;
            const seconds = Math.floor((event.tStartMs || 0) / 1000);
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const rest = seconds % 60;
            const stamp = hours
              ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
              : `${minutes}:${String(rest).padStart(2, '0')}`;
            lines.push(`[${stamp}] ${text}`);
          });
          return lines.length ? lines : null;
        } catch {
          return null;
        }
      };

      const tracksToLines = async (tracks: CaptionTrack[]): Promise<string[] | null> => {
        if (!tracks.length) return null;
        const score = (track: CaptionTrack) => {
          const language = (track.languageCode || '').toLowerCase();
          let value = 0;
          if (language === 'en') value += 30;
          else if (language.startsWith('en')) value += 20;
          if (track.kind !== 'asr') value += 5;
          return value;
        };
        const candidates = [...tracks].sort((a, b) => score(b) - score(a)).slice(0, 4);
        for (const track of candidates) {
          const lines = await linesFromCaption(track.baseUrl);
          if (lines) return lines;
        }
        return null;
      };

      // YouTube now gates the WEB caption URLs behind a proof-of-origin token, so they often
      // return HTTP 200 with an empty body. The iOS player response still exposes usable URLs
      // without that gate. Prefer it and fall back to the page's own player response.
      const ytcfg = (window as any).ytcfg;
      const apiKey = ytcfg?.get?.('INNERTUBE_API_KEY') || '';
      if (videoId) {
        for (const version of ['20.10.4', '21.03.1', '20.05.6']) {
          try {
            const playerUrl = `/youtubei/v1/player?prettyPrint=false${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`;
            const response = await fetch(playerUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-YouTube-Client-Name': '5',
                'X-YouTube-Client-Version': version,
              },
              body: JSON.stringify({
                context: {
                  client: {
                    clientName: 'IOS',
                    clientVersion: version,
                    deviceModel: 'iPhone16,2',
                    userAgent: `com.google.ios.youtube/${version} (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)`,
                    hl: 'en',
                    gl: 'US',
                    osName: 'iPhone',
                    osVersion: '18.3.2.22D82',
                  },
                },
                videoId,
                contentCheckOk: true,
                racyCheckOk: true,
              }),
              credentials: 'include',
            });
            if (!response.ok) continue;
            const data = await response.json();
            const tracks = (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []) as CaptionTrack[];
            const lines = await tracksToLines(tracks);
            if (lines) {
              return { title: pageTitle, url: pageUrl, text: lines.join('\n') };
            }
          } catch {}
        }
      }

      const playerResponses: any[] = [(window as any).ytInitialPlayerResponse];
      try {
        const movie = document.querySelector('#movie_player') as any;
        if (movie && typeof movie.getPlayerResponse === 'function') playerResponses.push(movie.getPlayerResponse());
      } catch {}
      try {
        const config = (window as any).ytplayer?.config?.args?.player_response;
        if (config) playerResponses.push(JSON.parse(config));
      } catch {}
      for (const player of playerResponses) {
        const tracks = (player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []) as CaptionTrack[];
        const lines = await tracksToLines(tracks);
        if (lines) return { title: pageTitle, url: pageUrl, text: lines.join('\n') };
      }

      const domSegments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'))
        .map((node) => clean((node as HTMLElement).innerText))
        .filter(Boolean);
      if (domSegments.length) {
        return { title: pageTitle, url: pageUrl, text: domSegments.join('\n') };
      }

      return {
        error: 'No transcript tracks were found. This video may not have captions, or YouTube may be blocking them for this session.',
      };
    },
  });

  const result = injected?.[0]?.result as PageTextResult | { error?: string } | undefined;
  if (!result) {
    throw new Error('No transcript result was returned.');
  }
  if ('error' in result && result.error) {
    throw new Error(result.error);
  }
  return result as PageTextResult;
};

export const captureTargetScreenshot = async (target: ToolTarget): Promise<string> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) {
    throw new Error('Screen capture works only inside the Brahma extension.');
  }

  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = current?.id;
  const currentWindowId = current?.windowId;
  let targetWindowId = target.windowId;

  try {
    if (!targetWindowId) {
      const tab = await chrome.tabs.get(target.id);
      targetWindowId = tab.windowId;
    }
    if (typeof targetWindowId === 'number') {
      try {
        await chrome.windows.update(targetWindowId, { focused: true });
      } catch {}
    }
    await chrome.tabs.update(target.id, { active: true });

    let lastError: unknown = null;
    for (const delay of [450, 900, 1600]) {
      await sleep(delay);
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(targetWindowId, { format: 'png' });
        if (dataUrl) return dataUrl;
        lastError = new Error('Chrome did not return a screenshot.');
      } catch (error) {
        lastError = error;
        if (!/readback|not visible|active tab|capture/i.test(String(error))) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Chrome did not return a screenshot.');
  } finally {
    if (currentTabId && currentTabId !== target.id) {
      try {
        await chrome.tabs.update(currentTabId, { active: true });
      } catch {}
    }
    if (typeof currentWindowId === 'number') {
      try {
        await chrome.windows.update(currentWindowId, { focused: true });
      } catch {}
    }
  }
};

const sanitizeFilename = (value: string) =>
  (value || 'brahma-export')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

export const downloadTextFile = (filename: string, content: string, mime = 'text/plain') => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
};

const imageFilename = (url: string, index: number) => {
  let name = '';
  try {
    const parsed = new URL(url);
    name = parsed.pathname.split('/').filter(Boolean).pop() || '';
  } catch {}
  if (url.startsWith('data:')) {
    const ext = url.match(/^data:image\/([a-z0-9+.-]+)/i)?.[1]?.replace('jpeg', 'jpg') || 'png';
    return `image-${String(index + 1).padStart(3, '0')}.${ext}`;
  }
  name = name.replace(/[^\w.\-]+/g, '-');
  if (!/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(name)) {
    name = `${name || 'image'}-${String(index + 1).padStart(3, '0')}.jpg`;
  }
  return name;
};

export const downloadImages = async (images: CollectedImage[], folder = 'Brahma Images') => {
  if (typeof chrome === 'undefined' || !chrome.downloads?.download) {
    throw new Error('Image downloads work only inside the Brahma extension.');
  }
  let started = 0;
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    try {
      await chrome.downloads.download({
        url: image.url,
        filename: `${folder}/${imageFilename(image.url, index)}`,
        conflictAction: 'uniquify',
        saveAs: false,
      });
      started += 1;
    } catch {}
  }
  return started;
};

export const getInstalledExtensions = async (): Promise<ExtensionEntry[]> => {
  if (typeof chrome === 'undefined' || !chrome.management?.getAll) {
    throw new Error('Extension manager works only inside the Brahma extension.');
  }
  const all = await chrome.management.getAll();
  return all
    .filter((item) => item.id !== chrome.runtime.id)
    .map((item) => ({
      id: item.id,
      name: item.name,
      version: item.version,
      description: item.description || '',
      enabled: item.enabled,
      type: item.type,
    }))
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
};

export const setExtensionEnabled = async (id: string, enabled: boolean) => {
  if (typeof chrome === 'undefined' || !chrome.management?.setEnabled) {
    throw new Error('Extension manager works only inside the Brahma extension.');
  }
  await new Promise<void>((resolve, reject) => {
    chrome.management.setEnabled(id, enabled, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || 'Could not update the extension.'));
      else resolve();
    });
  });
};
