@echo off
setlocal

cd /d "%~dp0"

echo WARNING: init.bat resets and reseeds the local database.
echo Existing products, category graphs, weekly history, and values in prisma\dev.db will be replaced.
echo.

echo Generating Prisma client...
call npm run prisma:generate
if errorlevel 1 goto :error

echo.
echo Applying Prisma schema...
call npm run prisma:push
if errorlevel 1 goto :error

echo.
echo Seeding database...
call npm run prisma:seed
if errorlevel 1 goto :error

echo.
echo Initialization complete.
echo Default Editor login:
echo   Username: editor
echo   Password: ChangeMe123!
echo Sample app data includes:
echo   - separate New and Existing category structures
echo   - weekly records used for Week, MTD, and YTD views
echo Optional:
echo   Run set-password.bat to change the Editor password after initialization.
exit /b 0

:error
echo.
echo Initialization failed.
exit /b 1
