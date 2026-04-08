@echo off
setlocal

cd /d "%~dp0"

echo Installing npm dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo Install complete.
echo Next steps:
echo   1. Run init.bat for first-time database setup
echo   2. Run start.bat to launch the app
echo   3. Optional: run set-password.bat to change the default Editor password
exit /b 0

:error
echo.
echo Install failed.
exit /b 1
