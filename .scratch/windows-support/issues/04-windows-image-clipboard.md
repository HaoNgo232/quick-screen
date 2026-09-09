# 04: Windows Native Image-to-Clipboard

**What to build:** Implement native image copying to the Windows clipboard in `WindowsAdapter` using standard library `ctypes` (Win32 API `OpenClipboard`, `EmptyClipboard`, `SetClipboardData` with DIB / bitmap data) and PowerShell fallback so no external pip packages are required.

**Blocked by:** 03: Windows Native Host Installer & Registry Registration

**Status:** ready-for-agent

- [x] Implement `copy_image` in `WindowsAdapter`.
- [x] Use `ctypes` to convert PNG bytes or load bitmap directly into Windows clipboard (`CF_DIB` / `CF_PNG`).
- [x] Provide reliable fallback via PowerShell `[Windows.Forms.Clipboard]::SetImage` if Win32 API encounters locked clipboard.
- [x] Ensure no third-party Python dependencies (no pip install requirement, runs on stock Python).
