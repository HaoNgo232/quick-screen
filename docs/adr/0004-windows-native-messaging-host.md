# 0004: Windows Support for Native Messaging Host

## Context
ADR-0003 introduced an optional Native Messaging Host (`com.quickscreen.host`) on Linux to write screenshots directly to `/tmp/quick-shot/` with zero browser download prompts and direct clipboard dispatch via `xclip`/`wl-copy`.

To achieve seamless parity on Windows without forcing users through Chrome download prompts or external Python package installations, we extended the native host with platform abstraction.

## Decision
1. **PlatformAdapter Seam**: Refactored `quick_screen_host.py` into a polymorphic `PlatformAdapter` with `LinuxAdapter` and `WindowsAdapter`.
2. **Zero-Dependency Windows Operations**:
   - Storage directory targets `%TEMP%\quick-shot\`.
   - Clipboard text operations prioritize Win32 API via standard library `ctypes` (`CF_UNICODETEXT`), falling back to `clip.exe` and PowerShell `Set-Clipboard`.
   - Clipboard image operations register `CF_PNG` via `ctypes` and fallback to PowerShell STA mode (`[System.Windows.Forms.Clipboard]::SetImage`), requiring no external packages like `Pillow` or `pywin32`.
   - File launching uses Windows-native `os.startfile()`.
3. **Automated Registration**:
   - Provided `install-native-host.bat` and `install-native-host.ps1` to deploy to `%USERPROFILE%\.quick-shot\` and register Registry keys under `HKCU\Software\<Browser>\NativeMessagingHosts\com.quickscreen.host`.
   - Included `quick-shot-host.bat` wrapper to satisfy Chromium's executable launch requirements on Windows.

## Consequences
- **Positive**: Windows users enjoy the exact same zero-prompt, high-speed capture workflow as Linux users.
- **Positive**: Zero external pip dependencies required; runs out-of-the-box on standard Python 3 installations.
- **Neutral**: Requires one-time execution of `install-native-host.bat` on Windows. If omitted, extension cleanly falls back to `chrome.downloads`.
