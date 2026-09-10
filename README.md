# quick-shot

Browser extension for full-page screenshots. Saves captures directly to local temporary storage without download dialogs and writes both the file path and image data to the clipboard.

## Features

- **Full-Page Capture**: Scrolls and stitches the DOM into a canvas image while hiding fixed and sticky elements to avoid duplicate headers.
- **Direct Local Storage**: Writes files to `/tmp/quick-shot/` (Linux) or `%TEMP%\quick-shot\` (Windows) via a Native Messaging host.
- **Dual Clipboard**: Sets both the file path (`text/plain`) and binary image (`image/png`) on the system clipboard.
- **Batch Capture**: Captures all tabs in the active window sequentially and returns line-delimited file paths.
- **Canvas Clamping**: Scales down pages exceeding the 16,384 px canvas height limit.
- **Side Panel & History**: Displays recent captures, thumbnails, and a full-resolution viewer.

## Requirements

- [Bun](https://bun.sh) (>= 1.1)
- Python 3
- Chromium-based browser (Chrome, Chromium, Brave, Edge)

## Quick Setup

Clone the repository, install the native host, and build the extension:

### Linux

```bash
git clone https://github.com/HaoNgo232/quick-shot.git
cd quick-shot
./install-native-host.sh
bun install
bun run build
```

### Windows (PowerShell)

```powershell
git clone https://github.com/HaoNgo232/quick-shot.git
cd quick-shot
powershell -ExecutionPolicy Bypass -File .\install-native-host.ps1
bun install
bun run build
```

### Load Extension into Browser

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `dist/chromium`

## Usage

1. Open the **Side Panel** via the quick-shot extension icon.
2. Select **Capture Active Tab** or **Capture All Tabs**.
3. Use the output:
   - File paths are copied as plain text (e.g. `/tmp/quick-shot/capture-*.png`).
   - Image data is copied to the clipboard for pasting into graphic tools or web inputs.

## Development

```bash
# Typecheck
bun run check

# Unit tests
bun test

# Build
bun run build
```

## Uninstall Native Host

- **Linux**: `./uninstall-native-host.sh`
- **Windows**: `uninstall-native-host.bat`

## License

[MIT](LICENSE)
