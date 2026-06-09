# Resonance

Personal music player & LAN streamer for Windows. Play your collection, control it from your phone.

---

## Download

[**Latest Release**](https://github.com/n3lio/Resonance/releases/latest) — grab `Resonance-Setup-X.X.X.exe`, install, done.

---

## Features

- Play MP3, M4A, FLAC, OGG, WAV, AAC
- Stream to any device on your network (phone, tablet, laptop)
- Remote control from mobile (play, pause, skip, volume, browse library)
- Fuzzy search across title, artist, album, genre
- Smart shuffle (spaces artists, varies genres)
- 10 audio visualizers (Nebula, Drift, Starfield, Aurora, Spectrum, Glow, Bars, Circular, Wave, Lyrics)
- Smart playlists by genre + drag & drop reorder
- Play history tracking
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
