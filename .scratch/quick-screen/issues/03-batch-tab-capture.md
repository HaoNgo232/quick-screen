# 03: Batch Tab Capture Across Current Window

**What to build:** Automated multi-tab capture that sequentially cycles through all open tabs in the browser window, captures each full-page screenshot, and populates the clipboard with a newline-separated list of all resulting local file paths.

**Blocked by:** 02: Single Tab Full-Page Capture & Dual Clipboard

**Status:** ready-for-agent

- [x] Discovers and filters all scriptable tabs in the current window (ignoring browser internal schemes).
- [x] Sequentially activates each tab, allows a layout paint delay, and triggers full-page capture.
- [x] Automatically returns focus to the original active tab once batching finishes.
- [x] Joins all generated file paths with newline characters (`\n`) and copies the list to clipboard.
- [x] Dispatches a completion toast reporting the total count of captured tabs.
