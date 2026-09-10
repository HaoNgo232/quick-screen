# quick-shot

A browser extension that captures web page screenshots, saves them locally to the Downloads directory, and copies both the absolute file path and image data to the clipboard for instant AI ingestion.

## Language

**Full Page Capture**:
A complete top-to-bottom stitched capture of the active tab's scrollable document using Canvas viewport stitching, with adaptive scaling for very tall pages exceeding Canvas limits.
_Avoid_: Whole screen, screen recording, viewport snapshot

**Batch Tab Capture**:
Sequential full-page captures of all open tabs across the current browser window, writing a newline-separated list of absolute file paths to the clipboard.
_Avoid_: Bulk download, multi-tab grab

**Dual Clipboard**:
Writing both `text/plain` (absolute filesystem path) and `image/png` (binary blob) simultaneously to the clipboard for single tab captures.
_Avoid_: Plain text copy, image-only paste

**Artifact Path**:
The absolute local filesystem path (`/home/user/Downloads/quick-shot/YYYY-MM-DD_HH-mm-ss_slug.png`) resolved from `chrome.downloads.DownloadItem.filename`.
_Avoid_: Download URL, relative path, web link

**History Panel**:
The extension sidebar listing recent captures with preview thumbnails, single/batch capture action buttons, and one-click copy path buttons.
_Avoid_: Side drawer, popup manager

**Toast Banner**:
A lightweight, transient non-blocking overlay injected into the page confirming capture completion and clipboard status.
_Avoid_: Alert box, system dialog, push notification
