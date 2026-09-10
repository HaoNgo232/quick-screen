# Native Messaging Host for Zero-Prompt /tmp Storage

We added an optional Native Messaging Host (`com.quickscreen.host`) on Linux to write directly to `/tmp/quick-shot/`.

When users have "Ask where to save each file before downloading" enabled in browser settings, the browser's download manager forces a GTK "Save As" modal even with `saveAs: false`. The native host circumvents this browser limitation, writes images directly to `/tmp/quick-shot/`, copies paths via `xclip`/`wl-copy`, and falls back gracefully to `chrome.downloads` if the host is unavailable.
