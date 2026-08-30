@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-Workbench-v0.27-SourceMirror.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo SOURCE MIRROR FAILED with exit code %RC%
) else (
  echo SOURCE MIRROR COMPLETED
)
echo.
pause
exit /b %RC%
