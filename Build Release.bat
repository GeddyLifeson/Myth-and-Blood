@echo off
title Myth and Blood - Build Release
cd /d "%~dp0"

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Node.js is required. Install from https://nodejs.org/
  pause
  exit /b 1
)

echo Building production bundle and Windows installer...
call npm run dist
if %ERRORLEVEL% neq 0 (
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Done! Installers are in the release\ folder:
dir /b release\*.exe 2>nul
echo.
pause