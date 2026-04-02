@echo off
setlocal

cd /d "%~dp0"

set "RUN_DIR=%CD%\.run"
if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"

call :start_process frontend "npm run dev" "%RUN_DIR%\frontend.pid"
if errorlevel 1 exit /b 1

call :start_process backend "npm run dev:server" "%RUN_DIR%\backend.pid"
if errorlevel 1 exit /b 1

echo.
echo Frontend: http://127.0.0.1:3000
echo Backend:  http://127.0.0.1:3001
echo Use stop.bat to stop both processes.
exit /b 0

:start_process
set "NAME=%~1"
set "COMMAND=%~2"
set "PID_FILE=%~3"
set "PID="

if exist "%PID_FILE%" (
  set /p PID=<"%PID_FILE%"
  if defined PID (
    tasklist /FI "PID eq %PID%" | find "%PID%" >nul 2>&1
    if not errorlevel 1 (
      echo %NAME% is already running with PID %PID%.
      exit /b 1
    )
  )
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process cmd.exe -ArgumentList '/c','%COMMAND%' -WorkingDirectory '%CD%' -PassThru; $p.Id"`) do set "PID=%%I"

if not defined PID (
  echo Failed to start %NAME%.
  exit /b 1
)

>"%PID_FILE%" echo %PID%
echo Started %NAME% with PID %PID%.
exit /b 0
