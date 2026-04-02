@echo off
setlocal

cd /d "%~dp0"

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
exit /b 0

:error
echo.
echo Initialization failed.
exit /b 1
