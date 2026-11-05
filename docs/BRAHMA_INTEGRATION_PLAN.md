# Brahma Integration Plan and Working Context

Last updated: 2026-10-20
Project: `G:\ai agent\dhrome\Brahma-AI---Modular-Chrome-OS-main`
Target: Chrome unpacked extension, profile `Default`

## Status Snapshot

- Current phase: Phases 0-5 implemented; Phase 6 core acceptance passed in a real Chromium build. Remaining manual checks: OCR crop, chat/NotebookLM exports, extension toggles, module exports, provider settings.
- Mode: release verification
- Adblock: deferred by user request
- Tesseract: worker, SIMD/relaxed-SIMD/fallback WASM cores, and `eng` + `hin` language data are bundled under `public/ocr` (no CDN dependency)
- Files changed: plan file, module registry/host/dock, App shell wiring, manifest, vite manifests, root scripts, vendored modules, OCR assets, provider layer (`src/lib/ai/*`), Hub (`hub/*`), Image Lab Hub adapter (`modules/image-lab/src/utils/hubApi.ts`), browser tools (`src/lib/browserTools.ts`, `src/lib/ocr.ts`, `src/components/ToolsPage.tsx`), page/FAB scripts (`public/page-tools.js`, `public/content.js`), `background.js`, `scripts/verify-dist.mjs`
- Providers: Gemini, Poolside, Ollama Cloud, OpenRouter with fallback order and per-provider keys/models
- Hub: `127.0.0.1:47821`, token auth, CORS limited to extension/local origins, delegates Image Lab routes

## Locked Decisions

1. Hybrid runtime: extension UI + local Brahma Hub for sharp/FFmpeg/Python work.
2. Vendor app source into `modules/` (not prebuilt dist, not localhost iframes).
3. Providers: keep Gemini + Poolside, add Ollama Cloud free models, use OpenRouter as final fallback.
4. Absorb extension abilities: OCR/text grab, transcript/chat exporter, image/thumbnail downloader, extension manager.
5. Adblock filter lists: deferred.
6. Target Chrome profile: `Default`.
7. Bundle Tesseract and language data with the extension in Phase 4.

## Architecture

```
Brahma extension
├─ src/                    existing React OS shell
├─ modules/
│  ├─ autocine/            vendored G:\auto_video_edit
│  ├─ scribble/            vendored G:\mvms
│  └─ image-lab/           vendored G:\image_size_reduce
├─ hub/                    localhost companion on 127.0.0.1:47821
├─ public/page-tools.js    on-demand page extraction/overlays
└─ dist/modules/*          built module iframes
```

Each app is built as an isolated extension iframe:

`chrome-extension://<id>/modules/<app>/index.html`

Iframe isolation prevents Tailwind and global CSS collisions. The Brahma shell shows modules in a full-screen `ModuleHost` overlay with a back button and an open-in-tab option.

## Phase Plan

### Phase 0 - Module foundation

- [x] Create `src/modules/registry.ts`
- [x] Create `src/modules/ModuleHost.tsx`
- [x] Create `src/modules/ModulesDock.tsx`
- [x] Add Apps button to the compact left rail
- [x] Add `openModule` to the agent tool declarations and handler
- [x] Add module build configs and root build script
- [x] Add `modules/*` to `web_accessible_resources`
- [x] `page-tools.js` copied by Vite from `public/` (no postbuild step needed)

### Phase 1 - AutoCine + Scribble

- [x] Vendor `G:\auto_video_edit` into `modules/autocine`
- [x] Vendor `G:\mvms` into `modules/scribble`
- [x] Exclude `.git`, `node_modules`, `dist`, caches, `__pycache__`, test artifacts
- [x] Set module Vite `base` to `./` and output to `dist/modules/<id>`
- [x] Add `?embed=brahma` to module URLs
- [ ] Verify AutoCine folder import and browser export (manual Chrome check)
- [ ] Verify Scribble project editing and browser export (manual Chrome check)
- [x] Document that AutoCine Python engine is incomplete and not a Phase 1 dependency

### Phase 2 - Provider layer

- [x] Extract provider logic from `src/App.tsx`
- [x] Add `src/lib/ai/types.ts`
- [x] Add `src/lib/ai/router.ts`
- [x] Add providers: Gemini, Poolside, Ollama Cloud, OpenRouter
- [x] Default fallback order: Gemini -> Poolside -> Ollama Cloud -> OpenRouter
- [x] Per-provider key storage and fallback skip when key is missing
- [x] Ollama Cloud base: `https://ollama.com/v1`
- [x] Ollama Cloud default model: `gpt-oss:120b`
- [x] Ollama Cloud starter models: `gemma4:31b`, `nemotron-3-ultra`
- [x] OpenRouter base: `https://openrouter.ai/api/v1`
- [x] OpenRouter default model: `openrouter/free`
- [x] Settings UI: provider cards, model picker, test, fallback order
- [x] Native function calling for Gemini; OpenAI-compatible tool calling for Poolside, Ollama Cloud, and OpenRouter
- [x] Unsupported-tools retry without `tools`, with XML `<tool_call>` fallback parsing
- [x] Non-Gemini provider failures fall back through the rest of the saved keys
- [x] Gemini tool failures fall back to text-only providers when configured

### Phase 3 - Brahma Hub + Image Lab

- [x] Vendor `G:\image_size_reduce` into `modules/image-lab`
- [x] Create `hub/server.ts` on `127.0.0.1:47821`
- [x] Add token auth and loopback-only binding
- [x] Allow only `chrome-extension://` origins via CORS
- [x] Refactor Image Lab server routes into `modules/image-lab/server-app.ts`
- [x] Patch Image Lab frontend API base to the Hub with token-aware fetch/assets
- [x] Add `hub/start-brahma-hub.bat` and `hub/README.md`
- [x] Add Hub health/status UI in Brahma settings
- [x] API-verify health, auth rejection, sample generation, scan, preview, thumbnail token query
- [x] Manual Chrome pass: user confirmed Image Lab works through the Hub (scan/optimize/preview; ZIP/history/cache spot-check as needed)
- [ ] Optional later: AutoCine FFmpeg and Scribble Python render endpoints

### Phase 4 - Extension capabilities

- [x] Add `public/page-tools.js` injected on demand with idempotent Shadow DOM overlays
- [x] OCR and text grab: capture visible tab, drag-crop, Tesseract.js (assets bundled)
- [x] Bundle Tesseract worker, SIMD/relaxed-SIMD/fallback WASM, `eng` and `hin` traineddata under `public/ocr`
- [x] YouTube transcript extraction and export
- [x] ChatGPT/Claude/Gemini current-chat export to Markdown/TXT
- [x] NotebookLM source export
- [x] Image/thumbnail collector and downloader
- [x] Extension manager using `management` permission
- [x] Add Tools page, left-rail/top-bar entry points, FAB menu entries, and an in-page sidebar "Site tools" toolbar
- [ ] Manual Chrome pass: OCR crop, page text/selection, YouTube, chat, NotebookLM, image download, extension toggle
- [ ] Deferred: adblock filter lists (skipped by user request)

### Phase 5 - Agent and polish

- [x] Agent tools: all browser tools and module tools (`grabPageText`, `grabPageSelection`, `scanPageImages`, `downloadPageImages`, `getYouTubeTranscript`, `exportCurrentChat`, `exportNotebookSources`, `readScreenText`, `listExtensions`, `setExtensionEnabled`, `openModule`, `getModuleContext`)
- [x] Module "Send to Brahma" bridge: save project/script to Notes, ask AI
- [x] Hub health chip in top bar
- [x] README updates for modules, Hub, providers, permissions
- [x] Automated release verification: lint/build, dist manifest/assets, module renders, Hub API, page-tools fixture, YouTube transcript
- [ ] Manual Chrome acceptance pass

### Phase 6 - Release candidate verification

- [x] `npm run verify` command: lint + full build + dist verification
- [x] `scripts/verify-dist.mjs`: manifest/CSP/permissions, service worker, HTML entry points, asset references, module bundles, OCR assets, secret-file guard
- [x] Headless module smoke: AutoCine, Scribble, and Image Lab render from `dist`
- [x] Hub smoke: health, 401 on missing token, folder scan, WebP preview
- [x] Page-tools fixture: page text, selection, images, chat export, NotebookLM export
- [x] YouTube transcript: iOS player route returns 286 timestamped lines on a real video
- [x] Real Chromium E2E with unpacked `dist`: extension service worker, content script, FAB, sidebar iframe
- [x] Real E2E: sidebar Site tools -> Tube targets the YouTube host tab, not the active Brahma tab
- [x] Real E2E: transcript 286 lines, page text 2,499 chars, image scan 14 images
- [x] Unified agent layer: browser-tool coverage, host-tab targeting from the sidebar, module launching, live module context, and shared module snapshots
- [x] Real E2E: module opens from `?module=scribble`, snapshot persists to `brahma-active-module-snapshot`
- [ ] Remaining manual checks: OCR crop English/Hindi, chat/NotebookLM exports, image download, extension toggle, module exports, provider settings
- [ ] Optional release packaging: version bump, ZIP, checksum

## Current Work Log

### 2026-10-19

- Explored Brahma, AutoCine, Scribble/MVMS, and Image Lab.
- Confirmed:
  - AutoCine browser export uses canvas + MediaRecorder + Web Audio.
  - Scribble browser export uses canvas + MediaRecorder; Python render kit is optional.
  - Image Lab requires Express + sharp and therefore the local Hub.
- Confirmed extension inventory across profiles and mapped capabilities.
- User approved the hybrid plan, deferred adblock, and requested bundled Tesseract.
- Created this plan/context file.
- Vendored `modules/autocine`, `modules/scribble`, and `modules/image-lab` with build/dependency/generated folders excluded.
- Added module Vite configs with `base: './'` and output to `dist/modules/<id>`.
- Added `src/modules/registry.ts`, `ModuleHost.tsx`, and `ModulesDock.tsx`.
- Wired modules into `src/App.tsx`: state, open handler, agent tool, Apps rail button, module dock, full-screen host.
- Added `modules/*` to `web_accessible_resources`.
- Updated root build scripts with `build:modules` and `modules:install`.
- Installed module dependencies and built all three module bundles.
- `npm run lint` passes.
- `npm run build` passes; `dist/modules/{autocine,scribble,image-lab}/index.html` exist.
- Image Lab is gated as "Phase 3" until the Hub exists; AutoCine and Scribble are available.
- Installed `tesseract.js`, `@tesseract.js-data/eng`, and `@tesseract.js-data/hin` at the root.
- Added `scripts/copy-ocr-assets.mjs` and `npm run ocr:assets`.
- Bundled OCR worker, SIMD and fallback WASM cores, and `eng`/`hin` traineddata under `public/ocr`.
- Added `ocr/*` to web-accessible resources and `worker-src 'self'` to the extension CSP (`blob:` was rejected by Chrome).
- Ran headless Chrome smoke test against `dist` served over local HTTP: root page renders the welcome card, `modules/autocine` renders the AutoCine editor with beat timeline, and `modules/scribble` renders the Scribble studio. Full extension interaction (MediaRecorder export, floating drawer) still needs a manual Chrome pass.
- Phase 2 provider layer:
  - Added `src/lib/ai/types.ts` (provider ids, messages, completion request/result/options).
  - Added `src/lib/ai/router.ts`: provider catalog, per-provider key/model storage, fallback order, `completeWithFallback`, `testProvider`, `AIProviderError` classification.
  - Gemini stays on `@google/genai` (primary `gemini-3.1-pro-preview`, fallback `gemini-3.8-flash`); Poolside, Ollama Cloud, and OpenRouter use OpenAI-compatible `/chat/completions`.
  - Wired `src/App.tsx` search + agent chat to the router, so non-Gemini providers fall back through saved keys.
  - Gemini tool path keeps browser tool calling and now falls back to a text provider when configured.
  - Settings modal: 4 provider cards with saved-key badges, model picker, API key field, Test button, Clear, and reorderable fallback priority list. API prompt modal updated with the same provider cards.

### 2026-10-20

- Corrected extension CSP: removed rejected `blob:` from `worker-src`; now `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'`.
- Gemini high-demand handling: 503 / "high demand" / "overloaded" / "temporarily unavailable" now classify as `model_unavailable`, so the router and tool path try `gemini-3.8-flash` before other providers.
- Phase 3 Hub:
  - Refactored Image Lab Express routes into `modules/image-lab/server-app.ts` (`createImageLabApp`); `server.ts` remains a thin standalone wrapper.
  - Added `hub/server.ts`: loopback `127.0.0.1:47821`, token from `hub/data/hub-token.txt` or `BRAHMA_HUB_TOKEN`, `X-Brahma-Token`/`?token=`, extension CORS, `/api/hub/health`, `/api/hub/info`, delegates all other routes to Image Lab.
  - Added `hub/start-brahma-hub.bat`, `hub/README.md`, `hub/.gitignore`.
  - Added `src/lib/hub.ts` and `modules/image-lab/src/utils/hubApi.ts`; Image Lab App/Cache/Benchmark/Gallery/ZIP now use `hubFetch`/`hubAssetUrl`.
  - Added Brahma Hub settings card with URL/token, Save, Test, and online/offline status.
  - Enabled Image Lab in the module registry.
- Verified Hub over HTTP: health OK, wrong/missing token returns 401, sample generation 16 images, scan 16 images, preview succeeds, thumbnail returns WebP 200 with query token.
- `npm run lint` and `npm run build` pass; all three module bundles and `dist/manifest.json` rebuilt.
- Phase 3 manual verification: user confirmed Image Lab works through the Hub.
- Phase 4 browser tools:
  - Added `public/page-tools.js` (idempotent injection, Shadow DOM toast) with `grab-text`, `grab-selection`, `collect-images`, `export-chat`, `notebooklm-sources`, `ping`; results return through `BRAHMA_PAGE_TOOL_RESULT`.
  - Added `src/lib/browserTools.ts`: active web-tab targeting, page-tool injection with 25s timeout, YouTube captions (MAIN world `ytInitialPlayerResponse` json3 + DOM fallback), screenshot capture with source-tab switch/restore, text/image downloads, extension list/toggle.
  - Added `src/lib/ocr.ts`: Tesseract `OEM.LSTM_ONLY`, bundled worker/core/lang paths, `workerBlobURL: false` for MV3 CSP.
  - Added `src/components/ToolsPage.tsx`: OCR with drag-crop/re-run/English+Hindi, page text/selection, YouTube transcript, chat export, NotebookLM sources, image collector (select/download), extension manager, copy/save/download/edit result.
  - Wired ToolsPage into `src/App.tsx` via `?tools=1&tool=...` URL state, `BRAHMA_OPEN_TOOLS_UI` runtime message, left-rail/top-bar buttons, and save-to-Notes (`source` note, `useForAgent`).
  - `background.js` handles `BRAHMA_OPEN_TOOLS`, focuses/creates a Brahma tab, and asks it to open the requested tool. `public/content.js` FAB adds OCR, image, chat, YouTube, and all-tools entries.
  - `manifest.json`: added `downloads` and `management`; added `page-tools.js` to web-accessible resources.
  - Updated `scripts/copy-ocr-assets.mjs` for relaxed-SIMD LSTM assets and regenerated `public/ocr`.
- Phase 4 automated verification:
  - `node --check` passes for `public/page-tools.js`, `public/content.js`, and `background.js`.
  - Headless Chrome OCR run with bundled assets recognized `BRAHMA OCR TEST 123` from a canvas image.
  - Headless page-tools fixture verified `ping`, page text, selection text, image collection, chat Markdown export, and NotebookLM source Markdown export.
  - Re-opening tools from the FAB now remounts the requested tab; background prefers a runtime message to an existing Brahma tab and falls back to reloading it.
  - Page image collection includes lazy/unloaded images via layout dimensions; YouTube caption URLs set `fmt=json3` safely.
  - Added a "Site tools" toolbar to the in-page sidebar: OCR, Page, Tube, Images, Chat, Sources, Ext. Each button opens the full Tools page targeted at the exact source tab.
  - `BRAHMA_OPEN_TOOLS` now carries the sender tab ID (or the sidebar's active tab ID) into `?tabId=...`; `getToolTarget(tabId)` uses that tab directly instead of guessing by recency.
  - `npm run lint` and `npm run build` pass; `dist/page-tools.js`, OCR assets, and manifest permissions are present.
- Remaining Phase 4 work is the manual Chrome pass after reloading `dist`.

### 2026-10-20

- Phase 5 implementation:
  - Added Gemini agent tools `grabPageText`, `downloadPageImages`, `getYouTubeTranscript`, and `exportCurrentChat`; each targets the active web tab, saves results to Neural Archive, and logs success/failure.
  - Agent system prompt now advertises page text, image collection, transcripts, and chat exports.
  - `ModuleHost` now has snapshot and Ask actions. Scribble snapshots use the persisted project (script, scenes, settings); other modules fall back to the visible workspace text. Snapshots save to Notes or open a review prompt in the Brahma agent.
  - Added a top-bar Hub health chip with automatic check when a token exists; clicking it re-tests the Hub.
  - Rewrote `README.md` with modules, Hub setup, browser tools, agent tools, permissions, scripts, and security notes.
  - `npm run lint` and `npm run build` pass (chunk-size warnings only).
  - Headless Chrome bridge test: opened Scribble, clicked Save snapshot, and confirmed a structured `Rainwater harvesting` source note (script, scenes, settings) in `brahma-notes`.
  - Headless app smoke test rendered the Hub chip (`Hub check`) and Tools page with no runtime error overlay.
  - Fixed YouTube transcripts: current YouTube watch pages gate `timedtext` URLs with `exp=xpe` and return empty 200 responses, while `get_transcript` returns `FAILED_PRECONDITION`. The extractor now asks the iOS player API for caption tracks (no proof-of-origin gate), falls back to WEB player data/DOM, and then fetches JSON3. Verified 286 timestamped lines on a real video.
  - User confirmed YouTube transcript works in the installed extension.
  - Phase 6 release verification:
    - Added `scripts/verify-dist.mjs` and `npm run verify` / `npm run verify:dist`.
    - Dist verification checks the MV3 manifest, CSP, permissions, service worker, new-tab and action entry points, all HTML asset references, module bundles, OCR worker/WASM/lang assets, and rejects secret-like files.
    - Headless Chrome confirmed all three module entry points render from `dist` (AutoCine editor, Scribble workspace, Image Lab dashboard).
    - Hub smoke test: health `ok`, missing token `401`, sample scan 16 images, preview `1920x1080 423659B -> 1440x810 80428B` WebP with 81% reduction.
    - Page-tools fixture passed page text, selection, image collection, generic chat export, and NotebookLM source export.
    - Updated the YouTube tool description to remove the outdated "open the transcript panel" instruction.
    - `npm run verify` passes: lint, full build, and dist verification (27 files checked, 4 HTML entry points, 28.3 MB build).
    - Real extension E2E via Playwright Chromium 153 + CDP:
      - Loaded unpacked `dist` with `--load-extension` (branded Chrome 155 ignores it, so automation uses Chromium).
      - Verified content script injection, FAB, menu, and sidebar iframe on YouTube.
      - Verified sidebar Site tools -> Tube, YouTube tool UI, and 286-line transcript.
      - Verified Page Text (2,499 chars) and Image Collector (14 images).
      - Found and fixed a sidebar targeting bug: Site tools used `chrome.tabs.query({active:true})`, which can select the active Brahma tab instead of the tab hosting the sidebar. `openSiteTool` now prefers `chrome.tabs.getCurrent()` and falls back to the active-tab query.
      - Rebuilt and re-verified: the opened Tools page received the YouTube host tab ID, and the transcript still returned 286 lines.
  - Unified agent access:
    - Agent now targets the current web tab from both the new-tab workspace and the in-page sidebar (`chrome.tabs.getCurrent()` first, then active/recency fallback).
    - Added tools for selection capture, image listing, NotebookLM source export, visible-screen OCR, extension listing/toggling, module context, and module launching with typo/alias normalization.
    - `buildContext` now includes the current web tab, module catalog, active module, available tools, and a live module snapshot.
    - Agent system prompt now states that browser tools run silently and return results in chat, and that `openModule` opens modules automatically.
    - In the sidebar, `openModule` opens a full Brahma tab with `?module=<id>` instead of squeezing the module into the narrow sidebar.
    - `ModuleHost` exposes `captureSnapshot` through a ref and persists a shared `brahma-active-module-snapshot`, so `getModuleContext` can read modules opened in another tab.
    - Multi-step commands joined with "then" now run through the agent one step at a time instead of the old hardcoded shortcut queue.
    - `npm run lint`, `npm run build`, and `npm run verify:dist` pass.
    - Real Chromium E2E: `?module=scribble` restored the module host and wrote a structured snapshot to localStorage; the existing sidebar/YouTube E2E still targeted the host tab and returned 286 transcript lines.
  - Provider-agnostic tool calling:
    - Added `AIToolDefinition`, `AIToolCall`, and tool fields to the completion request.
    - Added `completeOpenAiToolsCompatible` / `completeWithToolsWithFallback`: native OpenAI `tools` for Poolside, Ollama Cloud, and OpenRouter, retry without `tools` on HTTP 400/404/422, then parse XML or JSON tool calls from content.
    - Extracted the Gemini handler chain into `executeAgentToolCall`; Gemini and OpenAI-compatible branches now share every tool implementation.
    - Added `OPENAI_AGENT_TOOLS` (23 tools), `runToolAgent`, and the XML fallback instruction listing high-value tools.
    - `searchWeb` and `summarizePage` now use the provider router instead of calling Gemini directly.
    - Added a deterministic direct-command fast path for transcripts, OCR, page text/selection, image scan/download, chat/NotebookLM export, and module launch, so common commands work even with weak tool-calling models.
    - Screen OCR now retries capture with window focus and falls back to page text when Chrome cannot read a tab's compositor (for example, video-overlay pages such as YouTube).
    - Mocked Poolside E2E in real Chromium verified: request includes 23 native tools; a native `getYouTubeTranscript` call executed; a 400 unsupported-tools response triggered the no-tools retry and an XML `openModule` call opened Scribble.

## Immediate Next Actions

1. Reload the unpacked `dist` in Chrome `Default` and refresh any open site tabs.
2. Manual pass: OCR capture/crop in English and Hindi; ChatGPT/Claude/Gemini chat export; NotebookLM sources; image download; extension toggle. (FAB/sidebar, page text, image scan, and YouTube transcript already pass in real Chromium.)
3. Module pass: AutoCine import/export, Scribble edit/export, Image Lab Hub run, then test Save snapshot and Ask Brahma from the module header.
4. Agent pass with the active provider key (Gemini, Poolside, Ollama Cloud, or OpenRouter): ask for "extract this YouTube transcript", "extract OCR of this page", "summarize this page", "open AutoCine", "what is in this module", "read this selection", "list my extensions", and "do X then Y"; confirm results appear in chat and the module opens correctly.
5. Check the top-bar Hub chip after starting/stopping the Hub; update this file with manual results.
6. Optional: bump the manifest version and package `dist` as a release ZIP with a checksum once manual acceptance passes.

## Key Paths

- Brahma app shell: `src/App.tsx`
- Brahma styles: `src/index.css`
- Brahma types: `src/types.ts`
- Manifest: `manifest.json`
- Background service worker: `background.js`
- Content script: `public/content.js`
- On-demand page tools: `public/page-tools.js`
- Browser tools helpers: `src/lib/browserTools.ts`
- OCR helper: `src/lib/ocr.ts`
- Tools UI: `src/components/ToolsPage.tsx`
- Build config: `vite.config.ts`
- Root package scripts: `package.json`
- Module registry: `src/modules/registry.ts`
- Module host: `src/modules/ModuleHost.tsx`
- Module dock: `src/modules/ModulesDock.tsx`
- Provider types: `src/lib/ai/types.ts`
- Provider router: `src/lib/ai/router.ts`
- Hub client helpers: `src/lib/hub.ts`
- Hub server: `hub/server.ts`
- Hub launcher/docs: `hub/start-brahma-hub.bat`, `hub/README.md`
- Image Lab server app: `modules/image-lab/server-app.ts`
- Image Lab Hub adapter: `modules/image-lab/src/utils/hubApi.ts`
- Vendored modules: `modules/autocine`, `modules/scribble`, `modules/image-lab`
- Plan/context: `docs/BRAHMA_INTEGRATION_PLAN.md`

## Source Projects

- AutoCine: `G:\auto_video_edit`
  - React UI: `src/`
  - Browser export: `src/utils/videoDownloader.ts`
  - Python engine: `autocine_ai/` (incomplete CLI/UI, do not depend on it yet)
- Scribble/MVMS: `G:\mvms`
  - React UI: `src/`
  - Browser export: `src/lib/export.ts`
  - Python engine: `whiteboard-engine/`
  - Image builder: `image-whiteboard-builder/`
- Image Lab: `G:\image_size_reduce`
  - React UI: `src/`
  - Server: `server.ts`, `server/`
  - Requires `sharp`, `multer`, `archiver`

## Vendor Exclusions

- `.git/`
- `node_modules/`
- `dist/`
- `.cache/`
- `__pycache__/`
- `test-results/`
- generated output folders: `optimized_webp/`, `imported_photos/`, `sample_photos/`, `video_to_webm/`
- secrets: `.env`, `.env.local`
- large archives: `ffmpeg-release.zip`

## Verification Checklist

- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run verify` (lint + build + dist verification)
- [x] `dist/modules/autocine/index.html` exists
- [x] `dist/modules/scribble/index.html` exists
- [x] `dist/modules/image-lab/index.html` exists
- [x] Headless smoke test: root welcome card renders from `dist`
- [x] Headless smoke test: AutoCine, Scribble, and Image Lab module pages render
- [x] Real Chromium E2E: extension loads, content script/FAB/sidebar inject on YouTube
- [x] Real Chromium E2E: sidebar Tube targets the YouTube host tab and extracts 286 lines
- [x] Real Chromium E2E: page text (2,499 chars) and image scan (14 images)
- [x] Router smoke test: provider fallback, OpenAI content extraction, and missing-key classification
- [x] Hub health, token rejection, sample generation, scan, preview, and thumbnail API smoke test
- [x] Image Lab works through the Hub (user-confirmed)
- [x] `node --check` passes for `page-tools.js`, `content.js`, `background.js`
- [x] OCR recognizes text with bundled worker/WASM/`eng` assets in headless Chrome
- [x] Page-tools fixture returns page text, selection, images, chat export, NotebookLM export
- [x] YouTube transcript verified live: 286 timestamped lines through the iOS player route
- [x] Agent tool registry covers every browser tool plus `openModule` / `getModuleContext`
- [x] Real Chromium E2E: module opens from URL and persists a shared snapshot
- [x] Real Chromium E2E: sidebar agent target resolves to the host tab (YouTube)
- [x] `dist/page-tools.js` exists; manifest has `downloads` + `management`; OCR assets are in `dist/ocr`
- [ ] Load unpacked `dist` in Chrome `Default`
- [ ] Drawer/FAB/light theme still works
- [ ] FAB opens OCR/image/chat/YouTube/all-tools correctly
- [ ] Sidebar "Site tools" toolbar opens each tool against the current site/YouTube tab
- [ ] OCR capture/crop works in English and Hindi
- [ ] Page text/selection, YouTube transcript, chat export, NotebookLM export work on real sites
- [ ] Image download starts and extension toggle works
- [ ] AutoCine imports photos and exports
- [ ] Scribble edits and exports
- [ ] Settings: test a non-Gemini key and reorder fallback priority
- [ ] Image Lab reaches Hub health and optimizes a file
- [x] No secrets in build output

## Risks and Notes

- Ollama Cloud free tier is limited and starter model availability can change.
- OpenRouter free models are rate-limited.
- All configured providers can run browser tools. Image attachments remain Gemini-only; other providers ignore them and say so.
- Poolside/Ollama/OpenRouter tool calls use OpenAI-compatible `tools`; if a provider rejects them, the agent retries without `tools` and relies on XML `<tool_call>` output.
- `chrome.tabs.captureVisibleTab` can fail on video-overlay pages; screen OCR falls back to page text and states the fallback in chat.
- Fallback order persists in `localStorage` under `brahma-ai-provider-order`; per-provider models under `brahma-ai-model-<provider>`.
- Tesseract and language data increase extension size.
- AutoCine sample media are remote Unsplash URLs; fully offline use needs bundled samples.
- Module iframes share the extension origin, so localStorage is shared but key names should not collide.
- Hub is loopback-only and token-gated; the token is stored in `hub/data/hub-token.txt` and in extension localStorage. Thumbnails/download links carry it as a query parameter.
- Extension manager can inspect/toggle extensions but cannot invoke their internals unless they declare `externally_connectable`.
- Page tools only run on normal `http(s)` tabs; Chrome Web Store and `chrome://` pages block injection. Annotation/OCR screenshots briefly activate the source tab.
- `chrome.tabs.captureVisibleTab` is rate-limited; rapid repeated captures may need a short pause.
- Chat export selectors are site-specific and may need updates when ChatGPT/Claude/Gemini markup changes.
- Adblock is deferred to avoid DNR/EasyList complexity and rule-limit risk.

## Session Resume Instructions

If a new session starts, read this file first. Then:

1. Run `npm run verify` to confirm lint, build, and dist integrity.
2. Check `dist/modules/{autocine,scribble,image-lab}/index.html` and `dist/page-tools.js` exist.
3. Continue from the first unchecked item in the phase plan above.
4. Keep this file updated at the end of every work block.

Useful commands:

- Install module dependencies: `npm run modules:install`
- Build everything: `npm run build`
- Build modules only: `npm run build:modules`
- Full release check: `npm run verify`
- Verify `dist` only: `npm run verify:dist`
- Type check: `npm run lint`
- Reload extension in Chrome: `chrome://extensions` then refresh open tabs
- Image Lab requires the Hub on `http://127.0.0.1:47821`
- Regenerate OCR assets after dependency updates: `npm run ocr:assets`
