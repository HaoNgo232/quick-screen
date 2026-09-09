# 02: Single Tab Full-Page Capture & Dual Clipboard

**What to build:** One-click full-page scroll and stitch capture for the active browser tab that saves the artifact locally, copies both the absolute file path and raw image to the clipboard, and displays an unobtrusive in-page confirmation banner.

**Blocked by:** 01: Native Messaging Host & /tmp File Persistence

**Status:** ready-for-agent

- [x] Content script measures complete scroll height, hides scrollbars, and caches fixed/sticky elements.
- [x] Scrolling loop traverses viewport increments, suppressing repeating headers on subsequent frames.
- [x] Canvas engine stitches frames with pixel-perfect bottom crop and caps dimensions at 16,000px with adaptive scaling.
- [x] File is saved via `ArtifactSink` (prioritizing Native Host `/tmp/`, falling back to `chrome.downloads`).
- [x] Absolute file path (`text/plain`) and image data (`image/png`) are written simultaneously to the clipboard.
- [x] Floating toast banner slides in at the bottom of the active page and fades after 2.5 seconds.
