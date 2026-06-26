@echo off
title Myth and Blood - Install
cd /d "%~dp0"

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Node.js is required for the desktop app.
  echo Download from https://nodejs.org/ then run this again.
  echo.
  echo You can still play by double-clicking index.html or "Play Myth and Blood.bat"
  pause
  exit /b 1
)

echo Installing Myth and Blood desktop runtime...
call npm install
if %ERRORLEVEL% neq 0 (
  echo Install failed.
  pause
  exit /b 1
)

REM Approve Electron's postinstall (npm 11+ security notice)
call npm approve-scripts electron >nul 2>&1

REM Ensure the Electron binary was downloaded
if not exist "node_modules\electron\dist\electron.exe" (
  echo Downloading Electron desktop runtime...
  call node node_modules\electron\install.js
  if %ERRORLEVEL% neq 0 (
    echo Electron download failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
call npm audit
echo.
echo Done! Use "Play Myth and Blood.bat" to launch the game.
echo.
echo Notes:
echo   - "packages are looking for funding" is harmless — ignore it.
echo   - allow-scripts warnings are cleared after the approve step above.
pause