const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resonance', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Server info
  getServerStatus: () => ipcRenderer.invoke('server:status'),

  // Config / Settings
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),
  pickFolder: () => ipcRenderer.invoke('config:pick-folder'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  restartToUpdate: () => ipcRenderer.invoke('app:restart-update'),
  openBluetoothSettings: () => ipcRenderer.invoke('app:open-bt-settings'),

  // Events
  onUpdateAvailable: (cb) => ipcRenderer.on('app:update-available', (_, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('app:update-downloaded', (_, d) => cb(d)),

  isElectron: true,
});
