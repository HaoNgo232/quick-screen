# 02: Windows Host Adapter: Storage Dir, Launching & Text Clipboard

**What to build:** Implement `WindowsAdapter` in `native-host/quick_screen_host.py` that handles Windows temp storage resolution (`%TEMP%\quick-screen`), opening files (`os.startfile`), and text clipboard copying (`clip.exe` / win32 ctypes fallback).

**Blocked by:** 01: Platform Adapter Seam in Python Native Host

**Status:** ready-for-agent

- [x] Implement `WindowsAdapter` satisfying `PlatformAdapter`.
- [x] Resolve temp directory using `TEMP` or `TMP` environment variable with fallback to `tempfile.gettempdir()`.
- [x] Implement `open_file` using `os.startfile` on Windows.
- [x] Implement `copy_text` using `clip.exe` or Win32 API.
- [x] Implement platform detection in `get_platform_adapter()` supporting `win32` / `cygwin`.
