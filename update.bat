@echo off
setlocal

cd /d "%~dp0"

echo Updating npm dependencies...
call npm install
if errorlevel 1 goto :error

echo.
echo Regenerating Prisma client...
call npm run prisma:generate
if errorlevel 1 goto :error

echo.
echo Applying database schema updates...
call npm run prisma:push
if errorlevel 1 goto :error

echo.
echo Update complete.
echo Note:
echo   update.bat keeps existing data.
echo   If you need a clean reset with the default Editor account reseeded, run init.bat instead.
exit /b 0

:error
echo.
echo Update failed.
exit /b 1
