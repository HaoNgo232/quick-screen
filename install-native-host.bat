@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo Installing quick-shot Native Messaging Host (Windows)
echo ========================================================

set "INSTALL_DIR=%USERPROFILE%\.quick-shot"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [*] Copying host files to %INSTALL_DIR%...
copy /Y "%~dp0native-host\quick_screen_host.py" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0native-host\quick-shot-host.bat" "%INSTALL_DIR%\" >nul

set "BAT_PATH=%INSTALL_DIR%\quick-shot-host.bat"
set "ESCAPED_BAT_PATH=%BAT_PATH:\=\\%"
set "MANIFEST_PATH=%INSTALL_DIR%\com.quickscreen.host.json"

echo [*] Generating manifest %MANIFEST_PATH%...
(
    echo {
    echo   "name": "com.quickscreen.host",
    echo   "description": "quick-shot Native Messaging Host for automatic saving to temp",
    echo   "path": "%ESCAPED_BAT_PATH%",
    echo   "type": "stdio",
    echo   "allowed_origins": [
    echo     "chrome-extension://lfjkmkbgdkejeefmjkcgakkeeajkccdo/",
    echo     "chrome-extension://gnamflndgdnmkpjnkbocgkffdkmmbieh/"
    echo   ]
    echo }
) > "%MANIFEST_PATH%"

echo [*] Registering in Windows Registry for Chrome, Chromium, Edge, and Brave...

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul
if %ERRORLEVEL% equ 0 echo     [+] Registered for Google Chrome

reg add "HKCU\Software\Chromium\NativeMessagingHosts\com.quickscreen.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul
if %ERRORLEVEL% equ 0 echo     [+] Registered for Chromium

reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.quickscreen.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul
if %ERRORLEVEL% equ 0 echo     [+] Registered for Microsoft Edge

reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.quickscreen.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul
if %ERRORLEVEL% equ 0 echo     [+] Registered for Brave

echo ========================================================
echo Installation complete! Native host is ready.
echo To test, restart your browser and capture screenshots.
echo ========================================================
