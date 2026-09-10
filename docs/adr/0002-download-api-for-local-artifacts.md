# Download API for Local Artifacts

We chose the browser's native `chrome.downloads` API instead of a Native Messaging Host script.

Chrome extensions are sandboxed and cannot directly write to `/tmp` on Linux without an external native binary installed on the OS. By routing files through `chrome.downloads` into a dedicated subfolder (`quick-shot/`), the extension remains zero-configuration. The absolute filesystem path is extracted directly from the completed `DownloadItem.filename` property and copied to the clipboard.
