# 04: Side Panel Interface & History Store

**What to build:** An extension sidebar hosting the primary capture triggers, live progress indicators during execution, and a persistent gallery of recent screenshots with one-click clipboard copying.

**Blocked by:** 03: Batch Tab Capture Across Current Window

**Status:** ready-for-agent

- [x] Clicking the browser toolbar action opens the extension Side Panel.
- [x] Includes dedicated action buttons for single-tab capture and batch-tab capture with progress feedback.
- [x] Persists recent capture metadata (thumbnails, filenames, timestamps, dimensions) in `chrome.storage.local` capped at 30 items.
- [x] History cards feature preview thumbnails, one-click "Copy Path", "Copy Image", and delete buttons.
- [x] Clear-all action purges the stored history.
