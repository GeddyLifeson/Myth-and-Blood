const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getWindowMode: () => ipcRenderer.invoke('window:get-mode'),
  setWindowMode: (mode) => ipcRenderer.invoke('window:set-mode', mode),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  writeErrorLog: (entry) => ipcRenderer.invoke('error:write-log', entry),
  getErrorLogDir: () => ipcRenderer.invoke('error:get-log-dir'),
  onWindowModeChanged: (callback) => {
    const handler = (_event, mode) => callback(mode);
    ipcRenderer.on('window:mode-changed', handler);
    return () => ipcRenderer.removeListener('window:mode-changed', handler);
  },
});
