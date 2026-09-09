# 05: Cross-Platform Tests & Fallback Verification

**What to build:** Comprehensive unit tests for `PlatformAdapter` (both Linux and Windows mock environments) and verify the extension's `AutoSink` fallback behavior when NativeHost is not installed on Windows.

**Blocked by:** 04: Windows Native Image-to-Clipboard

**Status:** ready-for-agent

- [x] Add unit tests verifying `PlatformAdapter` logic, `WindowsAdapter` path resolution, and command dispatches.
- [x] Add unit tests verifying `LinuxAdapter` behavior unchanged.
- [x] Verify `tests/nativeHost.test.ts` and `tests/sink.test.ts` pass cleanly.
- [x] Run full verification loop (`bun run check`, `bun test`, `bun run build`).
