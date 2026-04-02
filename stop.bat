@echo off
setlocal

cd /d "%~dp0"

set "RUN_DIR=%CD%\.run"

call :stop_process frontend "%RUN_DIR%\frontend.pid"
call :stop_process backend "%RUN_DIR%\backend.pid"

echo.
echo Stop complete.
exit /b 0

:stop_process
set "NAME=%~1"
set "PID_FILE=%~2"
set "PID="

if not exist "%PID_FILE%" (
  echo No %NAME% PID file found.
  exit /b 0
)

set /p PID=<"%PID_FILE%"
if not defined PID (
  del "%PID_FILE%" >nul 2>&1
  echo No PID recorded for %NAME%.
  exit /b 0
)

tasklist /FI "PID eq %PID%" | find "%PID%" >nul 2>&1
if errorlevel 1 (
  echo %NAME% is not running.
  del "%PID_FILE%" >nul 2>&1
  exit /b 0
)

taskkill /PID %PID% /T /F >nul 2>&1
if errorlevel 1 (
  echo Failed to stop %NAME% (PID %PID%).
  exit /b 1
)

del "%PID_FILE%" >nul 2>&1
echo Stopped %NAME% (PID %PID%).
exit /b 0
