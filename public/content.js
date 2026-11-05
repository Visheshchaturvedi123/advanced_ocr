// Brahma OS Content Script Assistant

(async function() {
  if (window.location.href === 'chrome://newtab') return;

  const mode = await (async () => {
    try {
      if (chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['brahma-mode']);
        if (stored['brahma-mode']) return stored['brahma-mode'];
      }
    } catch {}
    try {
      return localStorage.getItem('brahma-mode') || 'STUDY';
    } catch {
      return 'STUDY';
    }
  })();

  const paletteByMode = {
    STUDY: {
      accent: '#2563eb',
      accentSoft: 'rgba(37, 99, 235, 0.12)',
      accentStrong: 'rgba(37, 99, 235, 0.34)',
      bg: 'rgba(255, 255, 255, 0.97)',
      bgSoft: 'rgba(248, 250, 252, 0.97)',
      text: '#0f172a',
    },
    GAMING: {
      accent: '#db2777',
      accentSoft: 'rgba(219, 39, 119, 0.10)',
      accentStrong: 'rgba(219, 39, 119, 0.32)',
      bg: 'rgba(255, 255, 255, 0.97)',
      bgSoft: 'rgba(255, 245, 250, 0.97)',
      text: '#0f172a',
    },
    DEVELOPER: {
      accent: '#0f766e',
      accentSoft: 'rgba(15, 118, 110, 0.10)',
      accentStrong: 'rgba(15, 118, 110, 0.32)',
      bg: 'rgba(255, 255, 255, 0.97)',
      bgSoft: 'rgba(240, 253, 250, 0.97)',
      text: '#0f172a',
    },
  };

  const palette = paletteByMode[mode] || paletteByMode.STUDY;
  const selectionText = () => window.getSelection().toString().trim();

  const container = document.createElement('div');
  container.id = 'brahma-assistant-root';
  document.body.appendChild(container);

  const STORAGE_KEY = 'brahma-floating-notes';
  let notes = [];
  let lastSelectedText = '';
  const contextualHints = [
    { host: 'youtube.com', text: 'Want a summary of this video?', action: 'summarize-page' },
    { host: 'github.com', text: 'Explain this repo?', action: 'summarize-page' },
    { host: 'medium.com', text: 'Create notes from this?', action: 'notes-vault' },
    { host: 'wikipedia.org', text: 'Create notes from this?', action: 'notes-vault' },
  ];

  const style = document.createElement('style');
  style.textContent = `
    #brahma-assistant-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 999999;
      font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
      color: ${palette.text};
    }
    .brahma-fab {
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: linear-gradient(180deg, #ffffff, ${palette.bgSoft});
      box-shadow:
        0 12px 30px rgba(15, 23, 42, 0.16),
        0 0 18px ${palette.accentSoft};
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
      border: 1px solid ${palette.accentStrong};
      color: ${palette.accent};
    }
    .brahma-fab:hover {
      transform: translateY(-2px) scale(1.03);
      border-color: ${palette.accent};
      box-shadow:
        0 18px 42px rgba(15, 23, 42, 0.2),
        0 0 24px ${palette.accentStrong};
    }
    .brahma-menu,
    .brahma-context-menu {
      backdrop-filter: blur(18px);
      background: linear-gradient(180deg, ${palette.bg}, ${palette.bgSoft});
      border: 1px solid rgba(15, 23, 42, 0.10);
      box-shadow:
        0 22px 60px rgba(15, 23, 42, 0.16),
        0 0 0 1px ${palette.accentSoft};
      border-radius: 18px;
    }
    .brahma-menu {
      position: absolute;
      right: 0;
      bottom: 72px;
      width: 230px;
      max-height: min(72vh, 560px);
      overflow-y: auto;
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .brahma-menu.active,
    .brahma-context-menu.active {
      display: flex;
    }
    .brahma-menu-head,
    .brahma-context-head {
      padding: 8px 10px 10px;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(15, 23, 42, 0.55);
    }
    .brahma-menu-item,
    .brahma-context-item {
      border: 1px solid transparent;
      border-radius: 14px;
      padding: 10px 12px;
      color: ${palette.text};
      font-size: 13px;
      cursor: pointer;
      transition: transform 150ms ease, background 150ms ease, border-color 150ms ease, color 150ms ease;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brahma-menu-item:hover,
    .brahma-context-item:hover {
      background: ${palette.accentSoft};
      border-color: ${palette.accentStrong};
      color: ${palette.accent};
      transform: translateX(2px);
    }
    .brahma-menu-item strong,
    .brahma-context-item strong {
      display: block;
      font-size: 13px;
      font-weight: 600;
    }
    .brahma-menu-item span:last-child,
    .brahma-context-item span:last-child {
      display: block;
      font-size: 11px;
      color: rgba(15, 23, 42, 0.55);
      margin-top: 1px;
    }
    .brahma-icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${palette.accent};
      flex: 0 0 auto;
    }
    .brahma-context-menu {
      position: fixed;
      width: min(320px, calc(100vw - 24px));
      padding: 10px;
      display: none;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
      z-index: 999998;
    }
    .brahma-context-head {
      width: 100%;
      padding-bottom: 4px;
    }
    .brahma-context-item {
      flex: 1 1 calc(50% - 6px);
      min-width: 0;
      align-items: flex-start;
      padding: 9px 10px;
      gap: 8px;
    }
    .brahma-context-item strong {
      font-size: 12px;
      line-height: 1.2;
    }
    .brahma-context-item span:last-child {
      font-size: 10px;
      line-height: 1.25;
    }
    .brahma-divider {
      display: none;
    }
    @media (max-width: 640px) {
      .brahma-context-menu {
        width: min(260px, calc(100vw - 20px));
      }
      .brahma-context-item {
        flex-basis: 100%;
      }
    }
    .brahma-notes-modal {
      position: fixed;
      right: 18px;
      bottom: 90px;
      width: 340px;
      max-height: min(72vh, 640px);
      overflow: hidden;
      display: none;
      flex-direction: column;
      z-index: 999997;
      border-radius: 20px;
      backdrop-filter: blur(18px);
      background: linear-gradient(180deg, ${palette.bg}, ${palette.bgSoft});
      border: 1px solid rgba(15, 23, 42, 0.10);
      box-shadow:
        0 24px 70px rgba(15, 23, 42, 0.18),
        0 0 0 1px ${palette.accentSoft};
    }
    .brahma-notes-modal.active {
      display: flex;
    }
    .brahma-notes-head {
      padding: 14px 16px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }
    .brahma-notes-head strong {
      font-size: 13px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${palette.text};
    }
    .brahma-notes-close {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: rgba(15, 23, 42, 0.04);
      color: ${palette.text};
      border-radius: 10px;
      cursor: pointer;
    }
    .brahma-notes-body {
      padding: 14px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .brahma-notes-textarea {
      width: 100%;
      min-height: 92px;
      resize: vertical;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.10);
      background: rgba(15, 23, 42, 0.04);
      color: ${palette.text};
      padding: 12px;
      outline: none;
      font: inherit;
    }
    .brahma-notes-textarea::placeholder {
      color: rgba(15, 23, 42, 0.50);
    }
    .brahma-notes-row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .brahma-upload {
      flex: 1 1 auto;
      font-size: 11px;
      color: rgba(15, 23, 42, 0.70);
    }
    .brahma-upload input {
      width: 100%;
      margin-top: 6px;
    }
    .brahma-save-note {
      padding: 10px 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      background: ${palette.accent};
      color: #ffffff;
      font-weight: 700;
    }
    .brahma-notes-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .brahma-note-card {
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(15, 23, 42, 0.04);
      border-radius: 16px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .brahma-note-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      font-size: 10px;
      color: rgba(15, 23, 42, 0.55);
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }
    .brahma-note-text {
      white-space: pre-wrap;
      color: ${palette.text};
      font-size: 12px;
      line-height: 1.5;
    }
    .brahma-note-image {
      width: 100%;
      max-height: 180px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
    .brahma-note-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .brahma-note-delete {
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(15, 23, 42, 0.10);
      background: rgba(15, 23, 42, 0.04);
      color: rgba(15, 23, 42, 0.80);
      cursor: pointer;
      font-size: 11px;
    }
    .brahma-notes-empty {
      padding: 18px 12px;
      text-align: center;
      border: 1px dashed rgba(15, 23, 42, 0.12);
      border-radius: 14px;
      color: rgba(15, 23, 42, 0.50);
      font-size: 12px;
    }
    .brahma-hint {
      position: absolute;
      right: 0;
      bottom: 74px;
      width: 220px;
      padding: 12px;
      border-radius: 16px;
      background: linear-gradient(180deg, ${palette.bg}, ${palette.bgSoft});
      border: 1px solid rgba(15, 23, 42, 0.10);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .brahma-hint.active {
      display: flex;
    }
    .brahma-hint-text {
      font-size: 12px;
      color: ${palette.text};
      line-height: 1.4;
    }
    .brahma-hint-actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .brahma-hint-btn,
    .brahma-hint-dismiss {
      flex: 1 1 auto;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(15, 23, 42, 0.10);
      background: rgba(15, 23, 42, 0.04);
      color: ${palette.text};
      cursor: pointer;
      font-size: 11px;
    }
    .brahma-hint-btn {
      background: ${palette.accentSoft};
      border-color: ${palette.accentStrong};
      color: ${palette.accent};
    }
    #brahma-assistant-root ::selection {
      background: ${palette.accent};
      color: #ffffff;
    }
  `;
  document.head.appendChild(style);

  const icon = (path) => `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${path}
    </svg>
  `;

  container.innerHTML = `
    <div class="brahma-menu" id="brahma-menu">
      <div class="brahma-menu-head">${mode} tools</div>
      <div class="brahma-menu-item" data-action="summarize-page">
        <div class="brahma-icon">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>')}</div>
        <div><strong>Summarize page</strong><span>Capture the main points fast</span></div>
      </div>
      <div class="brahma-menu-item" data-action="explain-selection">
        <div class="brahma-icon">${icon('<path d="M12 20h9"></path><path d="M12 4h9"></path><path d="M4 9h16"></path><path d="M4 15h10"></path>')}</div>
        <div><strong>Explain selection</strong><span>Break down highlighted text</span></div>
      </div>
      <div class="brahma-menu-item" data-action="rewrite-selection">
        <div class="brahma-icon">${icon('<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"></path>')}</div>
        <div><strong>Rewrite selection</strong><span>Clean up tone and wording</span></div>
      </div>
      <div class="brahma-menu-item" data-action="copy-summary">
        <div class="brahma-icon">${icon('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>')}</div>
        <div><strong>Copy page text</strong><span>Grab readable page content</span></div>
      </div>
      <div class="brahma-menu-item" data-action="notes-vault">
        <div class="brahma-icon">${icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>')}</div>
        <div><strong>Notes vault</strong><span>Save notes and images locally</span></div>
      </div>
      <div class="brahma-menu-item" data-action="ocr-tools">
        <div class="brahma-icon">${icon('<path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M7 8h10"></path><path d="M7 12h7"></path><path d="M7 16h5"></path>')}</div>
        <div><strong>OCR screen</strong><span>Crop the page and read the text</span></div>
      </div>
      <div class="brahma-menu-item" data-action="image-tools">
        <div class="brahma-icon">${icon('<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-5-5L5 21"></path>')}</div>
        <div><strong>Collect images</strong><span>Scan and download page images</span></div>
      </div>
      <div class="brahma-menu-item" data-action="chat-tools">
        <div class="brahma-icon">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>')}</div>
        <div><strong>Export chat</strong><span>Save the current AI chat</span></div>
      </div>
      <div class="brahma-menu-item" data-action="youtube-tools">
        <div class="brahma-icon">${icon('<rect x="2" y="4" width="20" height="16" rx="4"></rect><path d="m10 9 5 3-5 3z"></path>')}</div>
        <div><strong>YouTube transcript</strong><span>Export captions with timestamps</span></div>
      </div>
      <div class="brahma-menu-item" data-action="open-tools">
        <div class="brahma-icon">${icon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>')}</div>
        <div><strong>All browser tools</strong><span>Open the full Brahma toolbox</span></div>
      </div>
      <div class="brahma-menu-item" data-action="open-sidebar">
        <div class="brahma-icon">${icon('<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16"></path>')}</div>
        <div><strong>Open agent panel</strong><span>Launch Brahma in-page sidebar</span></div>
      </div>
      <div class="brahma-menu-item" data-action="open-brahma">
        <div class="brahma-icon">${icon('<path d="M3 12h18"></path><path d="M12 3v18"></path>')}</div>
        <div><strong>Open New Tab</strong><span>Jump to the Brahma OS start page</span></div>
      </div>
    </div>
    <div class="brahma-fab" id="brahma-fab" title="Brahma tools">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
    </div>
    <div class="brahma-hint" id="brahma-contextual-hint">
      <div class="brahma-hint-text" id="brahma-contextual-hint-text"></div>
      <div class="brahma-hint-actions">
        <button class="brahma-hint-btn" id="brahma-contextual-hint-try">Try it</button>
        <button class="brahma-hint-dismiss" id="brahma-contextual-hint-dismiss">Dismiss</button>
      </div>
    </div>
    <div class="brahma-context-menu" id="brahma-context-menu">
      <div class="brahma-context-head">Selection tools</div>
      <div class="brahma-context-item" data-action="explain">
        <div class="brahma-icon">${icon('<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>')}</div>
        <div><strong>Explain</strong><span>Clarify the selected text</span></div>
      </div>
      <div class="brahma-context-item" data-action="optimize">
        <div class="brahma-icon">${icon('<path d="m13 2-2 8h4l-2 12 8-10h-5l2-10z"></path>')}</div>
        <div><strong>Optimize</strong><span>Make it better or shorter</span></div>
      </div>
      <div class="brahma-context-item" data-action="summarize">
        <div class="brahma-icon">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>')}</div>
        <div><strong>Summarize</strong><span>Turn it into the key points</span></div>
      </div>
      <div class="brahma-context-item" data-action="translate">
        <div class="brahma-icon">${icon('<path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path>')}</div>
        <div><strong>Translate</strong><span>Rephrase for another language</span></div>
      </div>
      <div class="brahma-divider"></div>
      <div class="brahma-context-item" data-action="copy">
        <div class="brahma-icon">${icon('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>')}</div>
        <div><strong>Copy</strong><span>Copy selected text</span></div>
      </div>
      <div class="brahma-context-item" data-action="search">
        <div class="brahma-icon">${icon('<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>')}</div>
        <div><strong>Search web</strong><span>Look it up in a new tab</span></div>
      </div>
    </div>
    <div class="brahma-notes-modal" id="brahma-notes-modal">
      <div class="brahma-notes-head">
        <strong>Notes Vault</strong>
        <button class="brahma-notes-close" id="brahma-notes-close">&times;</button>
      </div>
      <div class="brahma-notes-body">
        <textarea class="brahma-notes-textarea" id="brahma-note-input" placeholder="Write a note, paste ideas, or save something important..."></textarea>
        <div class="brahma-notes-row">
          <label class="brahma-upload">
            Add image
            <input type="file" id="brahma-note-image" accept="image/*" />
          </label>
          <button class="brahma-save-note" id="brahma-save-note">Save</button>
        </div>
        <div class="brahma-notes-list" id="brahma-notes-list"></div>
      </div>
    </div>
  `;

  const fab = container.querySelector('#brahma-fab');
  const menu = container.querySelector('#brahma-menu');
  const contextMenu = container.querySelector('#brahma-context-menu');
  const notesModal = container.querySelector('#brahma-notes-modal');
  const notesList = container.querySelector('#brahma-notes-list');
  const notesInput = container.querySelector('#brahma-note-input');
  const noteImageInput = container.querySelector('#brahma-note-image');
  const hintEl = container.querySelector('#brahma-contextual-hint');
  const hintTextEl = container.querySelector('#brahma-contextual-hint-text');
  let activeHint = null;

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request?.type === 'set-mode' && request.mode && request.mode !== mode) {
        window.location.reload();
        return;
      }
      if (request?.action === 'BRAHMA_OPEN_PANEL') {
        openSidebar();
        if (sendResponse) sendResponse({ ok: true });
        return;
      }
      const sidebarActionMap = {
        BRAHMA_SUMMARIZE: 'summarize',
        BRAHMA_EXPLAIN: 'explain',
        BRAHMA_OPTIMIZE: 'optimize',
        BRAHMA_TRANSLATE: 'translate',
      };
      const sidebarAction = sidebarActionMap[request?.action];
      if (sidebarAction) {
        openSidebar(sidebarAction, request.text || '');
        if (sendResponse) sendResponse({ ok: true });
      }
    });
  }

  const readStorage = () => new Promise((resolve) => {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], (result) => resolve(result[STORAGE_KEY] || []));
        return;
      }
    } catch {}
    try {
      resolve(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch {
      resolve([]);
    }
  });

  const writeStorage = (value) => new Promise((resolve) => {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: value }, () => resolve());
        return;
      }
    } catch {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {}
    resolve();
  });

  const renderNotes = () => {
    if (!notes.length) {
      notesList.innerHTML = '<div class="brahma-notes-empty">No saved notes yet. Add text or an image to keep it here locally.</div>';
      return;
    }

    notesList.innerHTML = notes.map((note) => `
      <div class="brahma-note-card" data-note-id="${note.id}">
        <div class="brahma-note-meta">
          <span>${new Date(note.createdAt).toLocaleString()}</span>
          <span>${note.image ? 'Image note' : 'Text note'}</span>
        </div>
        ${note.text ? `<div class="brahma-note-text"></div>` : ''}
        ${note.image ? `<img class="brahma-note-image" src="${note.image}" alt="Saved note image" />` : ''}
        <div class="brahma-note-actions">
          <button class="brahma-note-delete" data-delete-note="${note.id}">Delete</button>
        </div>
      </div>
    `).join('');

    notes.forEach((note) => {
      if (!note.text) return;
      const card = notesList.querySelector(`[data-note-id="${note.id}"] .brahma-note-text`);
      if (card) card.textContent = note.text;
    });
  };

  const loadNotes = async () => {
    notes = await readStorage();
    renderNotes();
  };

  const saveNotes = async () => {
    await writeStorage(notes);
    renderNotes();
  };

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      document.execCommand('copy');
      area.remove();
      return true;
    } catch {
      return false;
    }
  };

  const sendRuntime = (payload) => {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(payload);
    }
  };

  const openBrahmaTools = (tool) => {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const pending = chrome.runtime.sendMessage({ type: 'BRAHMA_OPEN_TOOLS', tool: tool || 'ocr' });
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        return;
      }
    } catch {}
    try {
      window.open(chrome.runtime.getURL(`index.html?tools=1&tool=${encodeURIComponent(tool || 'ocr')}`), '_blank');
    } catch {}
  };

  const getPageText = () => (document.body?.innerText || '').trim().substring(0, 4000);
  const onboardingDone = () => {
    try {
      return localStorage.getItem('onboarding_done') === 'true' || localStorage.getItem('onboarding_done') === '1';
    } catch {
      return false;
    }
  };

  const postSidebarAction = (frame, action, text) => {
    if (!frame || !frame.contentWindow || !action) return;
    try {
      frame.contentWindow.postMessage({
        type: 'BRAHMA_SIDEBAR_ACTION',
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action,
        text: text || '',
      }, '*');
    } catch {}
  };

  const openSidebar = (action, text) => {
    const existingShell = document.getElementById('brahma-sidebar-shell');
    if (existingShell) {
      if (action) {
        const frame = existingShell.querySelector('#brahma-iframe');
        if (frame && frame.dataset.brahmaReady === 'true') {
          postSidebarAction(frame, action, text);
        } else if (frame) {
          frame.addEventListener('load', () => postSidebarAction(frame, action, text), { once: true });
        }
      } else {
        existingShell.remove();
      }
      return;
    }

    let iframeUrl = '';
    try {
      iframeUrl = chrome.runtime.getURL('index.html') + '?sidebar=true&t=' + Date.now();
    } catch {
      return;
    }

    const shell = document.createElement('div');
    shell.id = 'brahma-sidebar-shell';
    shell.style.position = 'fixed';
    shell.style.inset = '0';
    shell.style.zIndex = '2147483646';
    shell.style.pointerEvents = 'none';

    // Click-catcher only: no blur, no heavy dim, so the page stays usable.
    const backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0, 0, 0, 0.05)';
    backdrop.style.pointerEvents = 'auto';

    const panel = document.createElement('div');
    panel.id = 'brahma-sidebar';
    panel.style.position = 'absolute';
    panel.style.top = '0';
    panel.style.right = '0';
    panel.style.width = 'min(380px, 92vw)';
    panel.style.height = '100%';
    panel.style.background = palette.bg;
    panel.style.borderLeft = `1px solid ${palette.accentStrong}`;
    panel.style.boxShadow = '-14px 0 34px rgba(15, 23, 42, 0.16)';
    panel.style.pointerEvents = 'auto';
    panel.style.overflow = 'hidden';

    const iframe = document.createElement('iframe');
    iframe.id = 'brahma-iframe';
    iframe.src = iframeUrl;
    iframe.setAttribute('allow', 'microphone; clipboard-write');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = palette.bg;
    panel.appendChild(iframe);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '\u00d7';
    closeBtn.type = 'button';
    closeBtn.title = 'Close Brahma';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.width = '30px';
    closeBtn.style.height = '30px';
    closeBtn.style.borderRadius = '10px';
    closeBtn.style.border = `1px solid ${palette.accentStrong}`;
    closeBtn.style.background = 'rgba(255, 255, 255, 0.92)';
    closeBtn.style.color = palette.text;
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.zIndex = '1';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') removeSidebar();
    };
    const removeSidebar = () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('message', onSidebarReady);
      shell.remove();
    };
    closeBtn.addEventListener('click', removeSidebar);
    backdrop.addEventListener('click', removeSidebar);
    window.addEventListener('keydown', onKeyDown, true);

    let pendingAction = action;
    let pendingText = text;
    let actionSent = !action;
    const flushPendingAction = () => {
      if (actionSent || !pendingAction) return;
      actionSent = true;
      const actionToSend = pendingAction;
      const textToSend = pendingText || '';
      pendingAction = null;
      pendingText = '';
      postSidebarAction(iframe, actionToSend, textToSend);
    };
    const onSidebarReady = (event) => {
      if (event.source !== iframe.contentWindow) return;
      if (!event.data || event.data.type !== 'BRAHMA_SIDEBAR_READY') return;
      flushPendingAction();
    };
    iframe.addEventListener('load', () => {
      iframe.dataset.brahmaReady = 'true';
      window.setTimeout(flushPendingAction, 180);
    });
    window.addEventListener('message', onSidebarReady);

    panel.appendChild(closeBtn);
    shell.appendChild(backdrop);
    shell.appendChild(panel);
    document.documentElement.appendChild(shell);

    if (typeof panel.animate === 'function') {
      panel.animate(
        [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
        { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    }
  };

  fab.addEventListener('click', () => {
    menu.classList.toggle('active');
    contextMenu.classList.remove('active');
    hintEl.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.classList.remove('active');
      contextMenu.classList.remove('active');
      notesModal.classList.remove('active');
    }
  });

  document.addEventListener('mouseup', () => {
    const selected = selectionText();
    if (!selected) {
      contextMenu.classList.remove('active');
      return;
    }
    lastSelectedText = selected;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    contextMenu.style.left = rect.left + window.scrollX + 'px';
    contextMenu.style.top = rect.bottom + window.scrollY + 12 + 'px';
    contextMenu.classList.add('active');
    menu.classList.remove('active');
    notesModal.classList.remove('active');
    hintEl.classList.remove('active');
  });

  document.addEventListener('contextmenu', (e) => {
    const selected = selectionText();
    if (!selected) return;
    lastSelectedText = selected;
    e.preventDefault();
    contextMenu.style.left = e.clientX + window.scrollX + 'px';
    contextMenu.style.top = e.clientY + window.scrollY + 'px';
    contextMenu.classList.add('active');
    menu.classList.remove('active');
    notesModal.classList.remove('active');
    hintEl.classList.remove('active');
  });

  const handleContextAction = (action) => {
    const selected = selectionText() || lastSelectedText;
    try {
      if (action === 'explain') openSidebar('explain', selected);
      else if (action === 'optimize') openSidebar('optimize', selected);
      else if (action === 'summarize') openSidebar('summarize', selected);
      else if (action === 'translate') openSidebar('translate', selected);
      else if (action === 'copy') copyText(selected);
      else if (action === 'search') window.open(`https://www.google.com/search?q=${encodeURIComponent(selected)}`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Context action error:', error);
    }
    contextMenu.classList.remove('active');
  };

  const handleAction = (action) => {
    try {
      if (action === 'summarize-page') openSidebar('summarize', getPageText());
      else if (action === 'explain-selection') {
        const selected = selectionText() || lastSelectedText;
        if (selected) openSidebar('explain', selected);
      } else if (action === 'rewrite-selection') {
        const selected = selectionText() || lastSelectedText;
        if (selected) openSidebar('optimize', selected);
      } else if (action === 'copy-summary') {
        copyText(getPageText());
      } else if (action === 'notes-vault') {
        notesModal.classList.toggle('active');
        contextMenu.classList.remove('active');
        hintEl.classList.remove('active');
      } else if (action === 'ocr-tools') {
        openBrahmaTools('ocr');
      } else if (action === 'image-tools') {
        openBrahmaTools('images');
      } else if (action === 'chat-tools') {
        openBrahmaTools('chat');
      } else if (action === 'youtube-tools') {
        openBrahmaTools('youtube');
      } else if (action === 'open-tools') {
        openBrahmaTools('ocr');
      } else if (action === 'open-sidebar') {
        openSidebar();
      } else if (action === 'open-brahma') {
        window.open(chrome.runtime.getURL('index.html'), '_blank');
      }
      menu.classList.remove('active');
    } catch (error) {
      console.error('Extension context invalidated or error occurred:', error);
      menu.classList.remove('active');
    }
  };

  container.querySelectorAll('.brahma-context-item').forEach((item) => {
    item.addEventListener('click', (e) => handleContextAction(e.currentTarget.getAttribute('data-action')));
  });

  container.querySelectorAll('.brahma-menu-item').forEach((item) => {
    item.addEventListener('click', (e) => handleAction(e.currentTarget.getAttribute('data-action')));
  });

  container.querySelector('#brahma-notes-close').addEventListener('click', () => {
    notesModal.classList.remove('active');
  });

  container.querySelector('#brahma-save-note').addEventListener('click', async () => {
    const text = notesInput.value.trim();
    const file = noteImageInput.files && noteImageInput.files[0];
    if (!text && !file) return;

    let image = '';
    if (file) {
      try {
        image = await readFileAsDataUrl(file);
      } catch (error) {
        console.error('Failed to read image', error);
      }
    }

    notes.unshift({
      id: `note-${Date.now()}`,
      text,
      image,
      createdAt: Date.now(),
    });

    notesInput.value = '';
    noteImageInput.value = '';
    await saveNotes();
  });

  notesList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const noteId = target.getAttribute('data-delete-note');
    if (!noteId) return;
    notes = notes.filter((note) => note.id !== noteId);
    await saveNotes();
  });

  container.querySelector('#brahma-contextual-hint-try').addEventListener('click', () => {
    if (!activeHint) return;
    handleAction(activeHint.action);
  });

  container.querySelector('#brahma-contextual-hint-dismiss').addEventListener('click', () => {
    hintEl.classList.remove('active');
  });

  if (onboardingDone()) {
    activeHint = contextualHints.find((hint) => window.location.hostname.includes(hint.host)) || null;
    if (activeHint) {
      hintTextEl.textContent = activeHint.text;
      window.setTimeout(() => hintEl.classList.add('active'), 1400);
    }
  }

  loadNotes();
})();
