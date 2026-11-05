// Brahma on-demand page tools. Injected with chrome.scripting.executeScript.
(function () {
  if (window.__BRAHMA_PAGE_TOOLS_READY__) return;
  window.__BRAHMA_PAGE_TOOLS_READY__ = true;

  const MAX_TEXT = 60000;
  const MAX_IMAGES = 250;

  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const absoluteUrl = (value) => {
    if (!value) return '';
    try {
      const parsed = new URL(value, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
      if (parsed.protocol === 'data:' && /^data:image\//i.test(parsed.href)) return parsed.href;
      return '';
    } catch {
      return '';
    }
  };

  const textFromNode = (node) => {
    if (!node) return '';
    const text = node.innerText || node.textContent || '';
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const showToast = (message, tone) => {
    let host = document.getElementById('brahma-page-tools-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'brahma-page-tools-host';
      host.style.position = 'fixed';
      host.style.right = '18px';
      host.style.bottom = '86px';
      host.style.zIndex = '2147483647';
      host.style.pointerEvents = 'none';
      document.documentElement.appendChild(host);
      host.attachShadow({ mode: 'open' });
    }
    const root = host.shadowRoot;
    const accent = tone === 'error' ? '#ef4444' : '#22d3ee';
    root.innerHTML = `
      <style>
        .card {
          pointer-events: auto;
          font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
          color: #e5e7eb;
          background: rgba(8, 12, 20, 0.94);
          border: 1px solid ${accent}66;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35), 0 0 18px ${accent}22;
          border-radius: 14px;
          padding: 10px 14px;
          font-size: 12px;
          max-width: 300px;
          line-height: 1.4;
        }
        .dot { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: ${accent}; margin-right: 8px; }
      </style>
      <div class="card"><span class="dot"></span>${message}</div>
    `;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      const current = document.getElementById('brahma-page-tools-host');
      if (current) current.remove();
    }, 2800);
  };

  const getMainText = () => {
    const root = document.querySelector('main, article, [role="main"]') || document.body;
    return textFromNode(root).slice(0, MAX_TEXT);
  };

  const grabPageText = () => ({
    title: document.title || window.location.hostname,
    url: window.location.href,
    text: getMainText(),
  });

  const grabSelection = () => ({
    title: document.title || window.location.hostname,
    url: window.location.href,
    text: (window.getSelection()?.toString() || '').trim().slice(0, MAX_TEXT),
  });

  const collectImages = () => {
    const found = new Map();

    const add = (url, alt, width, height, source) => {
      const absolute = absoluteUrl(url);
      if (!absolute) return;
      if (absolute.startsWith('data:') && absolute.length < 512) return;
      if (absolute.startsWith('blob:')) return;
      const existing = found.get(absolute);
      const nextWidth = Number(width) || 0;
      const nextHeight = Number(height) || 0;
      if (!existing || nextWidth * nextHeight > existing.width * existing.height) {
        found.set(absolute, {
          url: absolute,
          alt: clean(alt).slice(0, 200),
          width: nextWidth,
          height: nextHeight,
          source: source || 'img',
        });
      }
    };

    document.querySelectorAll('img').forEach((img) => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width * height < 32 * 32) return;
      add(img.currentSrc || img.src, img.alt, width, height, 'img');
    });

    document.querySelectorAll('source[srcset]').forEach((source) => {
      const candidates = source.srcset
        .split(',')
        .map((part) => part.trim())
        .map((part) => {
          const [url, descriptor] = part.split(/\s+/);
          const width = descriptor && descriptor.endsWith('w') ? parseInt(descriptor, 10) : 0;
          return { url, width };
        })
        .filter((item) => item.url);
      candidates.sort((a, b) => b.width - a.width);
      if (candidates[0]) add(candidates[0].url, '', candidates[0].width, 0, 'srcset');
    });

    document.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const match = style.match(/url\((['"]?)([^'")]+)\1\)/i);
      if (!match) return;
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height < 32 * 32) return;
      add(match[2], el.getAttribute('aria-label') || '', rect.width, rect.height, 'background');
    });

    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!/\.(jpe?g|png|webp|gif|avif|bmp|svg)(\?|#|$)/i.test(href)) return;
      add(href, link.getAttribute('title') || link.textContent || '', 0, 0, 'link');
    });

    const images = Array.from(found.values()).slice(0, MAX_IMAGES);
    return {
      title: document.title || window.location.hostname,
      url: window.location.href,
      images,
    };
  };

  const pushMessage = (messages, role, text) => {
    const value = (text || '').trim();
    if (!value) return;
    const last = messages[messages.length - 1];
    if (last && last.role === role && last.text === value) return;
    messages.push({ role, text: value });
  };

  const exportChat = () => {
    const host = window.location.hostname;
    const messages = [];

    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
      document.querySelectorAll('[data-message-author-role]').forEach((el) => {
        const role = el.getAttribute('data-message-author-role') === 'assistant' ? 'Assistant' : 'You';
        pushMessage(messages, role, textFromNode(el));
      });
    } else if (host.includes('claude.ai')) {
      document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], .font-claude-message').forEach((el) => {
        const isUser = el.getAttribute('data-testid') === 'user-message' || Boolean(el.closest('[data-testid="user-message"]'));
        pushMessage(messages, isUser ? 'You' : 'Assistant', textFromNode(el));
      });
    } else if (host.includes('gemini.google.com')) {
      document.querySelectorAll('user-query, model-response').forEach((el) => {
        const isUser = el.tagName.toLowerCase() === 'user-query';
        pushMessage(messages, isUser ? 'You' : 'Assistant', textFromNode(el));
      });
    }

    if (!messages.length) {
      document.querySelectorAll('[data-role], [role="article"], article').forEach((el) => {
        const role = (el.getAttribute('data-role') || el.getAttribute('aria-label') || '').toLowerCase();
        const label = role.includes('user') || role.includes('human') ? 'You' : 'Assistant';
        pushMessage(messages, label, textFromNode(el));
      });
    }

    if (!messages.length) {
      throw new Error('No chat messages were found on this page. Open a conversation and try again.');
    }

    const title = document.title || 'Chat export';
    const lines = [`# ${title}`, '', `Source: ${window.location.href}`, ''];
    messages.forEach((message) => {
      lines.push(`## ${message.role}`, '', message.text, '');
    });

    return { title, url: window.location.href, markdown: lines.join('\n'), messageCount: messages.length };
  };

  const exportNotebookSources = () => {
    const seen = new Set();
    const sources = [];
    const roots = [
      document.querySelector('aside'),
      document.querySelector('[role="complementary"]'),
      document.querySelector('[class*="source"]'),
    ].filter(Boolean);

    const candidates = [];
    roots.forEach((root) => {
      root.querySelectorAll('[role="listitem"], [data-testid*="source"], [class*="source-card"], [class*="source-item"], li').forEach((node) => {
        candidates.push(node);
      });
    });

    candidates.forEach((node) => {
      const text = textFromNode(node);
      if (!text || text.length < 8 || seen.has(text)) return;
      seen.add(text);
      const link = node.querySelector('a[href]');
      const title = clean(node.querySelector('h1, h2, h3, h4, strong')?.textContent || text.split('\n')[0]).slice(0, 160);
      if (!title) return;
      sources.push({
        title,
        text: text.slice(0, 6000),
        url: link ? absoluteUrl(link.getAttribute('href')) : '',
      });
    });

    if (!sources.length) {
      const pageText = getMainText();
      if (!pageText) throw new Error('No NotebookLM sources were found. Open a notebook and try again.');
      sources.push({
        title: document.title || 'NotebookLM notebook',
        text: pageText,
        url: window.location.href,
      });
    }

    const title = document.title || 'NotebookLM sources';
    const lines = [`# ${title}`, '', `Source: ${window.location.href}`, ''];
    sources.slice(0, 100).forEach((source, index) => {
      lines.push(`## ${index + 1}. ${source.title}`, '');
      if (source.url) lines.push(source.url, '');
      lines.push(source.text, '');
    });

    return {
      title,
      url: window.location.href,
      markdown: lines.join('\n'),
      sourceCount: Math.min(sources.length, 100),
    };
  };

  const runAction = (action) => {
    if (action === 'grab-text') {
      showToast('Grabbing readable page text...');
      return grabPageText();
    }
    if (action === 'grab-selection') {
      showToast('Grabbing selected text...');
      return grabSelection();
    }
    if (action === 'collect-images') {
      showToast('Scanning page images...');
      return collectImages();
    }
    if (action === 'export-chat') {
      showToast('Exporting the current chat...');
      return exportChat();
    }
    if (action === 'notebooklm-sources') {
      showToast('Exporting NotebookLM sources...');
      return exportNotebookSources();
    }
    if (action === 'ping') {
      return { title: document.title, url: window.location.href };
    }
    throw new Error(`Unknown page tool: ${action}`);
  };

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (!request || request.type !== 'BRAHMA_PAGE_TOOL') return undefined;
    const requestId = request.requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const data = runAction(request.action);
      chrome.runtime.sendMessage({
        type: 'BRAHMA_PAGE_TOOL_RESULT',
        requestId,
        tool: request.action,
        ok: true,
        data,
      });
      if (sendResponse) sendResponse({ ok: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(message, 'error');
      chrome.runtime.sendMessage({
        type: 'BRAHMA_PAGE_TOOL_RESULT',
        requestId,
        tool: request.action,
        ok: false,
        error: message,
      });
      if (sendResponse) sendResponse({ ok: false, error: message });
    }
    return true;
  });
})();
