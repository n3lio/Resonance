# Radio MP3

Personal MP3 player/streamer. Runs on your PC, accessible from any device on the same network (or remotely via Cloudflare Tunnel).

## Setup (Windows 11)

1. Install [Node.js](https://nodejs.org/) (LTS)
2. Install [mpv](https://mpv.io/installation/) (for local playback mode) — add to PATH
3. Clone/copy this folder to your PC
4. Edit `config.json` — set your music folder path(s)
5. Run:
   ```bash
   npm install
   npm start
   ```
6. Open `http://localhost:3000` on the PC, or `http://<PC-IP>:3000` from another device on the same WiFi

## Remote Access (from anywhere)

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary public URL. Open it from anywhere.

## Features

- Stream to your device (phone, laptop, tablet)
- Play on PC speakers (remote control from any device)
- Search by title, artist, album
- Queue management, shuffle
- Real-time sync between all connected devices (WebSocket)
- Supports MP3, M4A, FLAC, OGG, WAV, AAC

## Config

Edit `config.json`:
```json
{
  "musicFolders": [
    "C:/Users/Lionel/Music",
    "D:/More Music"
  ],
  "port": 3000,
  "scanOnStartup": true
}
```
