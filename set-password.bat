@echo off
setlocal

cd /d "%~dp0"

echo Change Editor password
echo.
call npm run auth:set-password
if errorlevel 1 goto :error

echo.
echo Password updated.
echo Note:
echo   Running init.bat later will reset the seeded Editor password back to the default.
exit /b 0

:error
echo.
echo Password update failed.
echo.
pause
exit /b 1
