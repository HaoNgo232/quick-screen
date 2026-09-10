# 03: Windows Native Host Installer & Registry Registration

**What to build:** Provide automated Windows setup scripts (`install-native-host.bat` and PowerShell counterpart) that generate a `.bat` wrapper for the Python host and register Chrome/Chromium native messaging manifests in the Windows Registry (`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host`).

**Blocked by:** 02: Windows Host Adapter: Storage Dir, Launching & Text Clipboard

**Status:** ready-for-agent

- [x] Create `quick-shot-host.bat` wrapper to invoke Python without console popups.
- [x] Create `install-native-host.bat` to configure the host JSON manifest with Windows backslashes and add the Registry key.
- [x] Support both Chrome (`Google\Chrome`) and Edge / Chromium registry paths.
- [x] Include clear uninstall instructions / commands.
