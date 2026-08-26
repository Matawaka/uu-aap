@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "TRIAL_DIR=%~dp0"
set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "DEFAULT_ARGS="
if "%~1"=="" set "DEFAULT_ARGS=--scenario synthetic --cue overview"
set "PYTHONDONTWRITEBYTECODE=1"

if exist "%BUNDLED_PYTHON%" (
  "%BUNDLED_PYTHON%" "%TRIAL_DIR%run.py" %DEFAULT_ARGS% %*
  exit /b !ERRORLEVEL!
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%TRIAL_DIR%run.py" %DEFAULT_ARGS% %*
  exit /b !ERRORLEVEL!
)

where python >nul 2>nul
if not errorlevel 1 (
  python "%TRIAL_DIR%run.py" %DEFAULT_ARGS% %*
  exit /b !ERRORLEVEL!
)

echo KONTUR trial error: Python 3 was not found. 1>&2
exit /b 1
