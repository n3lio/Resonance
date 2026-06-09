# Ghetto Blaster

Personal music player & LAN streamer for Windows, by n3lio.

Play your collection, control it from your phone.

---

## Download

[**Latest Release**](https://github.com/n3lio/Resonance/releases/latest) — grab `Ghetto-Blaster-Setup-X.X.X.exe`, install, done.

> **Note:** Windows may show a SmartScreen warning ("Unknown publisher"). This is normal for indie software — click **More info** → **Run anyway**.

---

## Features

- Play MP3, M4A, FLAC, OGG, WAV, AAC
- Stream to any device on your network (phone, tablet, laptop)
- Remote control from mobile (play, pause, skip, volume, browse library)
- Switch audio output (PC speakers / Bluetooth) from desktop or phone
- Fuzzy search across title, artist, album, genre
- Smart shuffle (spaces artists, varies genres)
- 10 audio visualizers with fullscreen expand mode
- Equalizer with presets
- Smart playlists by genre + drag & drop reorder
- Favorites (heart tracks)
- Library views: Tracks, Albums, Artists
- Sort by title, artist, album, duration
- Crossfade between tracks (configurable)
- Play history + stats dashboard
- QR code in settings for instant mobile access
- Customizable accent color theme
- Auto-update

---

## Setup

1. Install and launch
2. Go to Settings (gear icon) → add your music folder(s)
3. Wait for scan to complete
4. Play

Mobile: scan the QR code in Settings, or open `http://<your-PC-IP>:3000` on your phone.

---

## Development

```
npm install
npm start        # dev (Electron)
npm run build    # produce .exe
```

Release: bump version in `package.json`, then `git tag vX.X.X && git push --tags`.

---

Made by [n3lio](https://github.com/n3lio)
