@echo off
setlocal

cd /d "%~dp0"

echo Installing npm dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo Install complete.
exit /b 0

:error
echo.
echo Install failed.
exit /b 1
