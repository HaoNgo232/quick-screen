# Windows Native Messaging Host Installation & Operations Guide

This document provides detailed instructions on how to install, operate, and troubleshoot the **Native Messaging Host** component of `quick-shot` on **Windows**.

---

## 1. Why Native Host on Windows?

By default, Chrome extensions run inside a secure browser sandbox. When saving images via the standard browser Downloads API:
- If your browser has *"Ask where to save each file before downloading"* enabled, Chrome will **open a Save As dialog for every single screenshot** (capturing 5 tabs triggers 5 prompts).
- The browser restricts downloads exclusively to the `Downloads` directory.

The **Native Messaging Host** resolves these constraints:
- **Zero-Prompt Auto Save**: Screenshots are saved silently to the Windows temporary directory (`%TEMP%\quick-shot`), with zero prompts.
- **Dual Clipboard**: Automatically loads both the absolute file path (`C:\Users\...\AppData\Local\Temp\quick-shot\...png`) and raw image binary directly into the Windows Clipboard via PowerShell / Win32 API, enabling instant pasting into AI coding tools (Antigravity, Cursor, ChatGPT, Claude) or Discord, Slack, and Figma.

---

## 2. System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit).
- **Browser**: Google Chrome, Microsoft Edge, Brave, or Chromium.
- **Python**: **Python 3.8+** installed with the **"Add Python to PATH"** option checked during setup.
  > *Verify by opening Command Prompt or PowerShell and running: `python --version`.*

---

## 3. Quick Installation (1-Click)

You can choose either installation method:

### Option 1: Command Prompt / Batch File (Recommended)
1. Open the `quick-shot` project directory.
2. Double-click the file:
   ```cmd
   install-native-host.bat
   ```
3. The console will display `[+] Registered` status for all detected browsers.

### Option 2: PowerShell
Open PowerShell in the project directory and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\install-native-host.ps1
```

After installation:
1. Navigate to `chrome://extensions/` in Chrome.
2. Enable **Developer mode** -> Click **Load unpacked** and select the `dist/chromium` folder.
3. (Recommended) Restart Chrome once so the browser reloads registry keys.

---

## 4. Technical Architecture & File Locations

Running the installer configures the following components:

### A. Host Installation Directory
Files are copied into the user profile directory:
```text
%USERPROFILE%\.quick-shot\
  ├── quick_screen_host.py   (Python host handling stdio communication)
  ├── quick-screen-host.bat  (Wrapper batch script executing Python windowless)
  └── com.quickscreen.host.json (Native messaging host manifest)
```

### B. Artifact Output Directory
Screenshots are saved directly to:
```text
%TEMP%\quick-shot\
(Example: C:\Users\<Username>\AppData\Local\Temp\quick-shot\<filename>.png)
```

### C. Windows Registry Keys
The script registers the manifest in the Windows Registry under `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host`:
```text
Key:   HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host
Value: (Default) = "%USERPROFILE%\.quick-shot\com.quickscreen.host.json"
```
*(Also registered for Edge, Brave, and Chromium if installed).*

---

## 5. Verification

1. In Chrome, open `chrome://extensions/`.
2. Inspect background logs or open the extension action popup.
3. The header status badge should display **`HOST ACTIVE (/tmp)`** (or temp path).
4. Trigger a capture -> Verify image appears in `%TEMP%\quick-shot\` and path is copied to clipboard.

---

## 6. Uninstallation

To cleanly remove the native host from Windows:
1. Double-click `uninstall-native-host.bat` (or run `./uninstall-native-host.bat` in terminal).
2. Delete the folder `%USERPROFILE%\.quick-shot\`.
