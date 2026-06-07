const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resonance', {
  // Server control
  toggleServer: () => ipcRenderer.invoke('server:toggle'),
  getServerStatus: () => ipcRenderer.invoke('server:status'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Events from main process
  onServerStatusChanged: (callback) => {
    ipcRenderer.on('server:status-changed', (event, data) => callback(data));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('app:update-available', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('app:update-downloaded', (event, data) => callback(data));
  },

  // Check if running in Electron
  isElectron: true,
});
