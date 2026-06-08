const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { startServer, stopServer, isRunning, getLanIp, getConfig, saveConfig } = require('./server-module');

let mainWindow = null;
let tray = null;
let serverRunning = false;

// ─── Single Instance Lock ───────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── Create Window ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Resonance',
    icon: getIconPath(),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0a0a0b',
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    app.isQuitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Tray ───────────────────────────────────────────────────────────────────
function createTray() {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Resonance');
  updateTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Resonance',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: `LAN Server: ${serverRunning ? 'ON' : 'OFF'}`,
      click: () => { toggleLanServer(); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { app.isQuitting = true; app.quit(); },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// ─── Icon Helpers ───────────────────────────────────────────────────────────
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  try {
    if (fs.existsSync(iconPath)) return iconPath;
  } catch (e) { /* ignore */ }
  return undefined;
}

function getTrayIcon() {
  const iconPath = getIconPath();
  if (iconPath) return nativeImage.createFromPath(iconPath);
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 232; canvas[i * 4 + 1] = 164;
    canvas[i * 4 + 2] = 53; canvas[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ─── LAN Server Toggle ──────────────────────────────────────────────────────
async function toggleLanServer() {
  if (serverRunning) {
    // We can't actually stop the server (UI depends on it)
    // Instead, toggle network visibility — for now, just update state
    serverRunning = false;
  } else {
    serverRunning = true;
  }
  updateTrayMenu();
  notifyRenderer('server:status-changed', {
    running: serverRunning,
    ip: serverRunning ? getLanIp() : null,
    port: 3000,
  });
}

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('server:toggle', async () => {
  await toggleLanServer();
  return { running: serverRunning, ip: serverRunning ? getLanIp() : null, port: 3000 };
});

ipcMain.handle('server:status', () => {
  return { running: serverRunning, ip: serverRunning ? getLanIp() : null, port: 3000 };
});

ipcMain.handle('app:version', () => app.getVersion());

// Window controls (frameless)
ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.handle('window:close', () => { if (mainWindow) mainWindow.close(); });

// Config / Settings
ipcMain.handle('config:get', () => getConfig());

ipcMain.handle('config:set', (event, newConfig) => {
  saveConfig(newConfig);
  return { ok: true };
});

ipcMain.handle('config:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Music Folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── Auto Updater ───────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    notifyRenderer('app:update-available', { version: info.version });
  });

  autoUpdater.on('update-downloaded', (info) => {
    notifyRenderer('app:update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log('Update check skipped:', err.message);
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Always start server locally (UI needs it for fetch/WS)
  try {
    await startServer(3000);
    console.log('Server started on port 3000');
  } catch (err) {
    console.error('Failed to start server:', err.message);
  }

  createWindow();
  mainWindow.loadURL('http://localhost:3000');

  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await stopServer();
});
