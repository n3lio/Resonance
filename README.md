# Resonance

Personal music player & LAN streamer for Windows. Play your MP3 collection and stream it to any device on your network.

---

## Download

Go to the [**Releases**](https://github.com/n3lio/Resonance/releases/latest) page and grab the installer:

| Platform | File | Requirements |
|----------|------|--------------|
| **Windows** | `Resonance-Setup-X.X.X.exe` | Windows 10 or 11 |

---

## Installation

1. Download `Resonance-Setup-X.X.X.exe` from Releases
2. Double-click, follow the installer
3. Launch **Resonance** — it starts scanning your music automatically

---

## Usage

1. On first launch, the app scans `C:\Users\<you>\Music` by default
2. Browse, search, queue tracks — play locally
3. Toggle **Server Mode** to stream to other devices on your WiFi
4. Open `http://<your-PC-IP>:3000` on your phone/tablet/laptop

---

## Features

- Local playback with audio visualizer (5 modes)
- LAN streaming to any device (phone, tablet, laptop)
- Real-time sync between all connected devices (WebSocket)
- Search by title, artist, album, genre
- Queue management, shuffle
- Playlist creation and persistence
- Cover art display (embedded ID3 tags)
- Auto-detect new music files
- Supports MP3, M4A, FLAC, OGG, WAV, AAC
- Auto-update: notified when a new version is available
- Minimize to system tray

---

## Configuration

After install, edit `config.json` in the app folder:

```json
{
  "musicFolders": ["C:/Users/Lionel/Music"],
  "excludeFolders": ["iTunes", "Apple Music"],
  "port": 3000,
  "scanOnStartup": true,
  "watchForChanges": true
}
```

---

## Development

```
Resonance/
├── main.js              # Electron main process
├── preload.js           # Context bridge
├── server-module.js     # Express + WebSocket server
├── config.json          # Music folders config
├── public/              # Frontend SPA + visualizer
├── assets/              # App icon
└── .github/workflows/   # CI: tag → build .exe → Release
```

### Release process
1. Bump version in `package.json`
2. `git tag vX.X.X && git push --tags`
3. GitHub Actions builds and publishes the Release

---

Made by [n3lio](https://github.com/n3lio)
