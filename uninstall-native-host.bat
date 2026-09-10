@echo off
setlocal

echo ==========================================================
echo Uninstalling quick-shot Native Messaging Host (Windows)
echo ==========================================================

reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host" /f >nul 2>nul
reg delete "HKCU\Software\Chromium\NativeMessagingHosts\com.quickscreen.host" /f >nul 2>nul
reg delete "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.quickscreen.host" /f >nul 2>nul
reg delete "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.quickscreen.host" /f >nul 2>nul

set "INSTALL_DIR=%USERPROFILE%\.quick-shot"
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%" >nul 2>nul
)

echo [*] Native messaging registration and host files removed.
echo ==========================================================
