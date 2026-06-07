# Resonance

Personal music streaming server. Stream your MP3 collection from your PC to any device on your network (or remotely via Cloudflare Tunnel).

## 🚀 Quick Start (Windows 11)

### First Time Setup

1. **Install prerequisites:**
   - [Node.js](https://nodejs.org/) (LTS version)
   - [mpv](https://mpv.io/installation/) (for PC speakers mode) — add to PATH

2. **Get the latest version:**
   ```bash
   cd C:\Users\Lionel\Projects
   git pull origin main
   ```
   (If you don't have Git, download the zip from GitHub and extract to `C:\Users\Lionel\Projects\Resonance`)

3. **Configure your music folder:**
   - Open `config.json`
   - Set your music path (use `/` or `\\`, not just `\`):
     ```json
     {
       "musicFolders": ["C:/Users/Lionel/Music"],
       ...
     }
     ```

4. **Create desktop shortcut:**
   - Right-click on `create-desktop-shortcut.ps1`
   - Select "Run with PowerShell"
   - A shortcut will appear on your desktop

### Daily Use

**Double-click the "Resonance" icon on your desktop** — that's it!

The server will:
- Auto-install dependencies if needed
- Scan your music library
- Open at `http://localhost:3000`

Access from other devices: use `http://<your-PC-IP>:3000`

---

## 📦 Manual Start (if shortcut doesn't work)

```bash
cd C:\Users\Lionel\Projects\Resonance
npm install
npm start
```

Then open `http://localhost:3000`

---

## 🔄 Updating to the Latest Version

When there's a new version with fixes or features:

1. Open **Git Bash** or **PowerShell** in the project folder
2. Run:
   ```bash
   git pull origin main
   ```
3. Restart the server (close the window and double-click "Resonance" again)

**Note:** Your `config.json` and playlists won't be touched.

---

## 🌐 Remote Access (from anywhere)

Want to access your music from outside your home network?

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary public URL. Share it with friends or open it from anywhere.

**Security tip:** Add a password auth if you expose this publicly (not implemented yet).

---

## ✨ Features

- 🎧 **Stream** to any device (phone, laptop, tablet)
- 🔊 **PC Mode** — play on your PC speakers, control from any device
- 🔍 Search by title, artist, album, genre
- 📋 Queue management, shuffle
- 🎨 Audio visualizer (5 modes)
- 💾 Save custom playlists
- 🔄 Real-time sync between all connected devices (WebSocket)
- 🎵 Supports MP3, M4A, FLAC, OGG, WAV, AAC
- 🖼️ Cover art display (if embedded in tags)
- 👁️ Auto-detects new music files

---

## ⚙️ Configuration

Edit `config.json`:

```json
{
  "musicFolders": ["C:/Users/Lionel/Music"],
  "excludeFolders": ["Apple Music", "iTunes"],
  "port": 3000,
  "scanOnStartup": true,
  "watchForChanges": true
}
```

- **musicFolders**: Where your MP3s are stored (can have multiple paths)
- **excludeFolders**: Folder names to skip during scan
- **port**: Server port (change if 3000 is taken)
- **scanOnStartup**: Scan library on launch
- **watchForChanges**: Auto-detect new music files

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Port 3000 already in use** | Change `"port"` in `config.json` to `3001` or `8080` |
| **Can't access from other devices** | Check Windows Firewall — allow Node.js |
| **mpv not found** | Run `where mpv` in CMD — if not found, reinstall and add to PATH |
| **No tracks found** | Check `musicFolders` path in `config.json` |
| **Covers not loading** | Normal if MP3s don't have embedded cover art |
| **Desktop shortcut doesn't work** | Run `start-resonance.bat` directly |

---

## 📝 Project Structure

```
Resonance/
├── server.js                       # Node.js backend
├── config.json                     # Your settings
├── package.json                    # Dependencies
├── playlists.json                  # Saved playlists (auto-created)
├── start-resonance.bat             # Windows launcher
├── create-desktop-shortcut.ps1     # Shortcut creator
└── public/
    ├── index.html                  # Frontend (SPA)
    └── visualizer.js               # Audio visualizer
```
