# AGENTS.md

Guidance for autonomous coding agents developing `quick-screen`.

## Verification Loop

Run after every code modification:
- Typecheck: `bun run check`
- Unit tests: `bun test`
- Bundle build: `bun run build`

Target output: `dist/chromium/` (manifest v3, extension.js engine).

## Architecture & Seams

`quick-screen` captures browser pages, persists images to disk, and places local file paths into the clipboard for instant AI inspection (`view_file`).

### 1. Artifact Sink Seam (`src/core/artifactSink.ts`)
- `NativeHostSink` (primary): Dispatches base64 images via native messaging to `com.quickscreen.host` (Python script configured by `install-native-host.sh`), writing directly to `/tmp/quick-screen/` and handling OS clipboard (X11/Wayland).
- `DownloadSink` (fallback): Uses `chrome.downloads.download` with `saveAs: false`.
- `AutoSink`: Tries `NativeHostSink` first; transparently falls back to `DownloadSink`.

### 2. Capture Engine (`src/core/captureEngine.ts`)
- **Rate-limit Quota**: Chromium enforces `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` (2 calls/sec). Calls to `safeCaptureVisibleTab` must maintain >= 550ms interval with exponential backoff on quota errors.
- **Canvas Scaling**: Limits maximum canvas height to `16384` px. If page height exceeds limit, scales canvas down proportionally.
- **Sticky / Fixed Headers**: `SCROLL_TO` hides `position: fixed/sticky` elements on slices > 0 to prevent duplicated floating banners. `RESTORE_CAPTURE` restores original DOM state in `finally` blocks.
- **Cancellation**: Accepts `AbortSignal` in `captureActive` and `captureBatch`. Aborts immediately restore page DOM and clean up telemetry state.

### 3. Action Popup vs Side Panel Handoff
- Action popup (`action/index.html`) is transient in Chromium: switching tabs destroys its JavaScript execution context immediately.
- Batch capture must run inside the persistent Side Panel (`chrome.sidePanel.open({ windowId })`).
- When triggered from popup, hand off batch capture by setting `qs_trigger_batch: true` in `chrome.storage.local`, opening sidepanel for the current window, and calling `window.close()`.

### 4. Storage & Viewer Tiers
- **History Metadata**: `chrome.storage.local` via `HistoryStore` (`src/core/historyStore.ts`), capped at 30 items.
- **Full Resolution Images**: IndexedDB via `imageStore` (`src/core/imageStore.ts`) to bypass Chrome storage quota and Native Messaging 1MB limits.
- **Viewer**: `options/index.html?id=<id>` renders full-resolution image with pan/zoom controls.

## Non-Negotiable Conventions

- **Zero-Emoji**: Never use emoji in user-facing UI, toasts, or logs. Use clean inline SVG icons from `ICONS` definitions with stroke 1.75-2.
- **Runtime**: Use `bun` exclusively for package management, testing, and script execution. Do not commit `package-lock.json`.
- **User Language**: Always communicate with the end user in Vietnamese. Keep code, tests, and documentation in English.
