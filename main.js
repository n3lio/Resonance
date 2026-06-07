const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { startServer, stopServer, isRunning, getLanIp } = require('./server-module');

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0a0a0b',
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
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
      label: 'Ouvrir Resonance',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: `Serveur: ${serverRunning ? 'ON' : 'OFF'}`,
      click: () => {
        toggleServer();
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Icon Helpers ───────────────────────────────────────────────────────────
function getIconPath() {
  // Placeholder: use a default icon path. Replace with actual icon later.
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  try {
    const fs = require('fs');
    if (fs.existsSync(iconPath)) return iconPath;
  } catch (e) { /* ignore */ }
  return undefined;
}

function getTrayIcon() {
  const iconPath = getIconPath();
  if (iconPath) {
    return nativeImage.createFromPath(iconPath);
  }
  // Create a simple placeholder tray icon (16x16 amber square)
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 232;     // R
    canvas[i * 4 + 1] = 164; // G
    canvas[i * 4 + 2] = 53;  // B
    canvas[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ─── Server Toggle ──────────────────────────────────────────────────────────
async function toggleServer() {
  if (serverRunning) {
    await stopServer();
    serverRunning = false;
  } else {
    try {
      await startServer(3000);
      serverRunning = true;
    } catch (err) {
      console.error('Failed to start server:', err.message);
    }
  }

  updateTrayMenu();

  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server:status-changed', {
      running: serverRunning,
      ip: serverRunning ? getLanIp() : null,
      port: 3000,
    });
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('server:toggle', async () => {
  await toggleServer();
  return {
    running: serverRunning,
    ip: serverRunning ? getLanIp() : null,
    port: 3000,
  };
});

ipcMain.handle('server:status', () => {
  return {
    running: serverRunning,
    ip: serverRunning ? getLanIp() : null,
    port: 3000,
  };
});

ipcMain.handle('app:version', () => {
  return app.getVersion();
});

// ─── Auto Updater ───────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-available', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-downloaded', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
  });

  // Check for updates (non-blocking)
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log('Update check skipped:', err.message);
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit on macOS (or Windows with tray)
  // App keeps running in tray
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  if (serverRunning) {
    await stopServer();
  }
});
