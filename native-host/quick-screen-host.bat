@echo off
setlocal
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python "%~dp0quick_screen_host.py" %*
    exit /b %ERRORLEVEL%
)
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py "%~dp0quick_screen_host.py" %*
    exit /b %ERRORLEVEL%
)
echo Python not found in PATH 1>&2
exit /b 1
