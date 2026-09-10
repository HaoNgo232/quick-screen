# 01: Native Messaging Host & /tmp File Persistence

**What to build:** A local host bridge on Linux Mint/Ubuntu that receives base64 image data from the browser extension via stdio, persists the image directly to `/tmp/quick-shot/` with zero browser download prompts, and copies the absolute file path to the system clipboard via `xclip`/`wl-copy`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Executable script installed at `~/.local/bin/quick-shot-host` handles JSON protocol over stdio.
- [x] Host registration manifests installed under `~/.config/google-chrome/NativeMessagingHosts/`, `~/.config/chromium/`, and `~/.config/BraveSoftware/`.
- [x] Directory `/tmp/quick-shot/` is created automatically if missing.
- [x] File path is copied to the X11/Wayland clipboard upon successful save.
- [x] Standalone test script verifies end-to-end ping and save actions.
