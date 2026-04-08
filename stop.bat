@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-dev.ps1" -ProjectRoot "%CD%"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Stop failed.
  exit /b %EXIT_CODE%
)

echo.
echo Stop complete.
exit /b 0
