const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.html');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

let mainWindow = null;
let windowMode = 'windowed';
let hasFrame = true;
let isSwitchingMode = false;
let savedBounds = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };

function webPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    preload: PRELOAD_PATH,
  };
}

function toInt(value, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Electron setBounds rejects undefined/null x/y — omit invalid coords. */
function sanitizeBounds(bounds = {}, defaults = {}) {
  const width = Math.max(MIN_WIDTH, toInt(bounds.width, defaults.width ?? DEFAULT_WIDTH));
  const height = Math.max(MIN_HEIGHT, toInt(bounds.height, defaults.height ?? DEFAULT_HEIGHT));
  const out = { width, height };
  const x = toInt(bounds.x, NaN);
  const y = toInt(bounds.y, NaN);
  if (Number.isFinite(x)) out.x = x;
  if (Number.isFinite(y)) out.y = y;
  return out;
}

function safeSetBounds(win, bounds) {
  if (!win || win.isDestroyed()) return false;
  try {
    win.setBounds(sanitizeBounds(bounds));
    return true;
  } catch (err) {
    console.error('setBounds failed:', err.message, bounds);
    return false;
  }
}

function normalizeMode(mode) {
  if (mode === 'borderless' || mode === 'fullscreen') return mode;
  return 'windowed';
}

function captureBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return savedBounds;
  if (windowMode === 'windowed' && !mainWindow.isFullScreen()) {
    savedBounds = sanitizeBounds(mainWindow.getBounds());
  }
  return savedBounds;
}

function workAreaBounds(win) {
  try {
    let display;
    if (win && !win.isDestroyed()) {
      const b = sanitizeBounds(win.getBounds());
      display = b.width > 0 && b.height > 0
        ? screen.getDisplayMatching(b)
        : screen.getPrimaryDisplay();
    } else {
      display = screen.getPrimaryDisplay();
    }
    return sanitizeBounds(display.workArea);
  } catch (err) {
    console.error('workAreaBounds failed:', err.message);
    return sanitizeBounds(screen.getPrimaryDisplay().workArea);
  }
}

function buildOptions(mode, bounds = savedBounds) {
  const borderless = mode === 'borderless';
  const clean = sanitizeBounds(bounds);
  const opts = {
    width: clean.width,
    height: clean.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: !borderless,
    title: 'Myth and Blood',
    autoHideMenuBar: true,
    backgroundColor: '#1a1810',
    show: false,
    webPreferences: webPreferences(),
  };
  if (Number.isFinite(clean.x)) opts.x = clean.x;
  if (Number.isFinite(clean.y)) opts.y = clean.y;
  return opts;
}

function attachWindowHandlers(win) {
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.on('leave-full-screen', () => {
    if (windowMode === 'fullscreen' && mainWindow === win) {
      windowMode = hasFrame ? 'windowed' : 'borderless';
      notifyMode();
    }
  });
}

function applyModeBounds(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mode === 'fullscreen') {
    if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true);
    return;
  }

  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);

  if (mode === 'borderless') {
    safeSetBounds(mainWindow, workAreaBounds(mainWindow));
    return;
  }

  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  safeSetBounds(mainWindow, savedBounds);
}

function createWindow(mode = 'windowed') {
  windowMode = normalizeMode(mode);
  hasFrame = windowMode !== 'borderless';
  mainWindow = new BrowserWindow(buildOptions(windowMode, savedBounds));
  attachWindowHandlers(mainWindow);
  mainWindow.loadFile(INDEX_PATH);
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    applyModeBounds(windowMode);
    mainWindow.show();
    notifyMode();
  });
}

function recreateWindow(mode) {
  if (isSwitchingMode) return windowMode;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(mode);
    return windowMode;
  }

  isSwitchingMode = true;
  captureBounds();

  const target = normalizeMode(mode);
  const old = mainWindow;
  old.removeAllListeners('closed');
  old.removeAllListeners('leave-full-screen');

  const next = new BrowserWindow(buildOptions(target, savedBounds));
  windowMode = target;
  hasFrame = target !== 'borderless';

  const failSafe = setTimeout(() => {
    isSwitchingMode = false;
  }, 10000);

  next.once('ready-to-show', () => {
    clearTimeout(failSafe);
    mainWindow = next;
    attachWindowHandlers(next);
    applyModeBounds(target);
    next.show();
    if (old && !old.isDestroyed()) old.destroy();
    isSwitchingMode = false;
    notifyMode();
  });

  next.webContents.once('did-fail-load', () => {
    clearTimeout(failSafe);
    if (next && !next.isDestroyed()) next.destroy();
    if (old && !old.isDestroyed()) {
      mainWindow = old;
      attachWindowHandlers(old);
      old.show();
    }
    isSwitchingMode = false;
  });

  next.loadFile(INDEX_PATH);
  return windowMode;
}

function notifyMode() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('window:mode-changed', windowMode);
  }
}

function applyWindowMode(mode) {
  if (isSwitchingMode) return windowMode;

  const target = normalizeMode(mode);
  captureBounds();

  const needsRecreate =
    (target === 'borderless' && hasFrame) ||
    (target === 'windowed' && !hasFrame);

  if (needsRecreate) {
    recreateWindow(target);
    return windowMode;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(target);
    return windowMode;
  }

  windowMode = target;
  applyModeBounds(target);
  notifyMode();
  return windowMode;
}

ipcMain.handle('window:get-mode', () => windowMode);
ipcMain.handle('window:set-mode', (_event, mode) => {
  try {
    return applyWindowMode(mode);
  } catch (err) {
    console.error('window:set-mode failed', err);
    return windowMode;
  }
});
ipcMain.handle('app:quit', () => {
  app.quit();
  return true;
});

app.whenReady().then(() => createWindow('windowed'));

app.on('window-all-closed', () => {
  if (!isSwitchingMode) app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && !isSwitchingMode) createWindow(windowMode);
});