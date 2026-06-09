const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { startServer, stopServer, isRunning, getLanIp, getConfig, saveConfig, setDataDir } = require('./server-module');

let mainWindow = null;
let tray = null;

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
    title: 'Ghetto Blaster',
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
  tray.setToolTip('Ghetto Blaster');
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
      label: 'Open Ghetto Blaster',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
      },
    },
    { type: 'separator' },
    { label: `Server: ${getLanIp()}:3000`, enabled: false },
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
  if (iconPath) {
    // Resize to 16x16 for tray (removes excess padding)
    const img = nativeImage.createFromPath(iconPath);
    return img.resize({ width: 16, height: 16 });
  }
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 232; canvas[i * 4 + 1] = 164;
    canvas[i * 4 + 2] = 53; canvas[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('server:status', () => {
  return { running: true, ip: getLanIp(), port: 3000 };
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('app:restart-update', () => {
  autoUpdater.quitAndInstall();
});

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

  // Delay update check to ensure renderer is ready to receive events
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log('Update check skipped:', err.message);
    });
  }, 5000);
}

// ─── Splash Screen ──────────────────────────────────────────────────────────
let splashWindow = null;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 340,
    height: 220,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false },
  });

  const splashHtml = `data:text/html,
    <style>
      body { margin:0; display:flex; align-items:center; justify-content:center; height:100vh; background:transparent; font-family:'Segoe UI',sans-serif; }
      .splash { background:rgba(15,14,13,0.95); border-radius:16px; padding:40px 50px; text-align:center; border:1px solid rgba(232,164,53,0.2); box-shadow:0 20px 60px rgba(0,0,0,0.5); }
      h1 { font-size:1.4rem; font-weight:700; background:linear-gradient(135deg,%23e8a435,%23c47a7a); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0 0 12px; }
      p { color:%239a918a; font-size:0.78rem; margin:0; }
      .dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:%23e8a435; margin:0 2px; animation:pulse 1.2s infinite; }
      .dot:nth-child(2){animation-delay:0.2s} .dot:nth-child(3){animation-delay:0.4s}
      @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}
    </style>
    <div class="splash">
      <h1>Ghetto Blaster</h1>
      <p><span class="dot"></span><span class="dot"></span><span class="dot"></span></p>
    </div>`;

  splashWindow.loadURL(splashHtml);
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();

  // Set data dir to userData (persists across updates)
  setDataDir(app.getPath('userData'));

  // Always start server locally (UI needs it for fetch/WS)
  try {
    await startServer(3000);
    console.log('Server started on port 3000');
  } catch (err) {
    console.error('Failed to start server:', err.message);
  }

  createWindow();
  mainWindow.loadURL('http://localhost:3000');

  // Close splash when main window is ready (min 1.5s display)
  const splashStart = Date.now();
  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStart;
    const delay = Math.max(0, 1500 - elapsed);
    setTimeout(() => {
      if (splashWindow) { splashWindow.close(); splashWindow = null; }
    }, delay);
  });

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
