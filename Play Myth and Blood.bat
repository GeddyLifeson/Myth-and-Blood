@echo off
title Myth and Blood
cd /d "%~dp0"

REM --- Option 1: Electron desktop app (best experience) ---
if exist "node_modules\electron\dist\electron.exe" (
  echo Launching Myth and Blood desktop app...
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)

REM --- Option 2: Install Electron if Node.js is available ---
where npm >nul 2>&1
if %ERRORLEVEL%==0 (
  if not exist "node_modules\electron\dist\electron.exe" (
    echo First launch: installing desktop runtime...
    call npm install
    call npm approve-scripts electron >nul 2>&1
    if not exist "node_modules\electron\dist\electron.exe" (
      call node node_modules\electron\install.js
    )
  )
  if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
  )
)

REM --- Option 3: Browser app window (no install) ---
set "GAME_FILE=%~dp0index.html"
set "GAME_URI=file:///%GAME_FILE:\=/%"

where msedge >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" msedge --app="%GAME_URI%" --window-size=1280,800
  exit /b 0
)

where chrome >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" chrome --app="%GAME_URI%" --window-size=1280,800
  exit /b 0
)

REM --- Option 4: Default browser ---
echo Opening Myth and Blood...
start "" "%GAME_FILE%"
exit /b 0