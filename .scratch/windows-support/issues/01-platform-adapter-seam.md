# 01: Platform Adapter Seam in Python Native Host

**What to build:** Refactor the native messaging host script to decouple OS-specific operations behind a clean `PlatformAdapter` seam, moving existing Linux behavior into a `LinuxAdapter` with 100% backward compatibility for `/tmp/quick-screen`, `xclip`, `wl-copy`, and `xdg-open`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Extract native host into a dedicated `native-host/quick_screen_host.py` source file.
- [x] Define `PlatformAdapter` interface (`get_storage_dir`, `copy_text`, `copy_image`, `open_file`).
- [x] Implement `LinuxAdapter` preserving current xclip/wl-copy/xdg-open logic and `/tmp/quick-screen`.
- [x] Update `install-native-host.sh` to install or copy from `native-host/quick_screen_host.py`.
- [x] Verify all existing native host tests continue to pass on Linux.
