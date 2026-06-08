const express = require('express');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { parseFile } = require('music-metadata');
const { spawn } = require('child_process');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const QRCode = require('qrcode');
let serverInstance = null;
let wssInstance = null;

// ─── Data directory (set by main.js before startServer, or fallback to __dirname)
let DATA_DIR = __dirname;

function setDataDir(dir) {
  DATA_DIR = dir;
  // Reload config from the correct location
  config = loadConfig();
  // Ensure covers dir exists
  const coversDir = path.join(DATA_DIR, '__covers');
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
}

// ─── Config (stored in userData so it survives updates) ─────────────────────
const DEFAULT_CONFIG = { musicFolders: [], excludeFolders: [], port: 3000, scanOnStartup: true, watchForChanges: true };

function getConfigPath() { return path.join(DATA_DIR, 'config.json'); }

function loadConfig() {
  try {
    const cfgPath = getConfigPath();
    if (fs.existsSync(cfgPath)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
    }
  } catch (e) { /* corrupt file, use default */ }
  // First run: try shipped config as seed, then default
  try {
    const shipped = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    return { ...DEFAULT_CONFIG, ...shipped };
  } catch (e) { return DEFAULT_CONFIG; }
}

let config = loadConfig();

// ─── State ───────────────────────────────────────────────────────────────────
let library = [];
let genres = new Set();
let queue = [];
let currentIndex = 0;
let isPlaying = false;
let playMode = 'stream';
let mpvProcess = null;

// Playlists stored in a JSON file
function getPlaylistsPath() { return path.join(DATA_DIR, 'playlists.json'); }
let playlists = loadPlaylists();

function loadPlaylists() {
  try {
    var p = getPlaylistsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) { console.warn('Could not load playlists:', e.message); }
  return [];
}

function savePlaylists() {
  fs.writeFileSync(getPlaylistsPath(), JSON.stringify(playlists, null, 2));
}

// ─── Cover Cache ────────────────────────────────────────────────────────────
function getCoversDir() { return path.join(DATA_DIR, '__covers'); }
// Ensure covers dir exists at startup
(function() { var d = getCoversDir(); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); })();

// ─── Library Scanner ─────────────────────────────────────────────────────────
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac']);
let scanning = false;

async function scanFolders() {
  if (scanning) { console.log('Scan already in progress, skipping'); return library; }
  scanning = true;

  // Reload config (may have been updated via settings)
  config = loadConfig();

  const excludeFolders = new Set((config.excludeFolders || []).map(f => f.toLowerCase()));

  console.log('Scanning music folders...');
  broadcast({ type: 'scan:start' });
  library = [];
  genres = new Set();

  // Clear cover cache before rescan
  try {
    const existing = fs.readdirSync(getCoversDir());
    for (const file of existing) {
      fs.unlinkSync(path.join(getCoversDir(), file));
    }
  } catch (e) { /* ignore */ }

  for (const folder of config.musicFolders) {
    const resolved = path.resolve(folder);
    if (!fs.existsSync(resolved)) {
      console.warn(`Folder not found: ${resolved}`);
      continue;
    }
    await scanDirectory(resolved, excludeFolders);
  }

  scanning = false;
  console.log(`Found ${library.length} tracks, ${genres.size} genres`);
  broadcast({ type: 'scan:done', data: { count: library.length, genres: genres.size } });
  return library;
}

async function scanDirectory(dir, excludeFolders) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`Cannot read directory: ${dir}`);
    return;
  }

  for (let ei = 0; ei < entries.length; ei++) {
    const entry = entries[ei];
    const fullPath = path.join(dir, entry.name);

    // Yield every 50 files to keep event loop responsive (visualizer, WS)
    if (ei % 50 === 0) await new Promise(r => setImmediate(r));

    if (entry.isDirectory()) {
      if (excludeFolders.has(entry.name.toLowerCase())) continue;
      await scanDirectory(fullPath, excludeFolders);
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      try {
        const metadata = await parseFile(fullPath);
        const genre = metadata.common.genre ? metadata.common.genre[0] : null;
        if (genre) genres.add(genre);

        const picture = metadata.common.picture && metadata.common.picture[0];
        const hasCover = !!picture;
        const trackId = library.length;

        if (hasCover) {
          let ext = '.jpg';
          if (picture.format) {
            if (picture.format.includes('png')) ext = '.png';
            else if (picture.format.includes('webp')) ext = '.webp';
            else if (picture.format.includes('gif')) ext = '.gif';
          }
          const coverPath = path.join(getCoversDir(), `${trackId}${ext}`);
          try {
            fs.writeFileSync(coverPath, picture.data);
          } catch (writeErr) {
            console.warn(`Could not cache cover for track ${trackId}:`, writeErr.message);
          }
        }

        library.push({
          id: trackId,
          path: fullPath,
          filename: entry.name,
          title: metadata.common.title || entry.name.replace(/\.[^/.]+$/, ''),
          artist: metadata.common.artist || 'Unknown',
          album: metadata.common.album || 'Unknown',
          duration: metadata.format.duration || 0,
          genre: genre,
          hasCover,
        });
      } catch (e) {
        library.push({
          id: library.length,
          path: fullPath,
          filename: entry.name,
          title: entry.name.replace(/\.[^/.]+$/, ''),
          artist: 'Unknown',
          album: 'Unknown',
          duration: 0,
          genre: null,
          hasCover: false,
        });
      }
    }
  }
}

// ─── Security: validate track ID ─────────────────────────────────────────────
function getTrackById(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || numId < 0 || numId >= library.length) return null;
  return library[numId];
}

// ─── WebSocket ───────────────────────────────────────────────────────────────
const clients = new Set();

function broadcast(message) {
  const payload = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

// Desktop player state (broadcast by the Electron app)
let desktopState = { trackId: null, title: '', artist: '', isPlaying: false, progress: 0, duration: 0 };

function getState() {
  return {
    queue: queue.map(id => library[id]).filter(Boolean),
    currentIndex,
    isPlaying,
    playMode,
    currentTrack: queue[currentIndex] != null ? library[queue[currentIndex]] : null,
    desktop: desktopState,
  };
}

// ─── Local Playback (mpv) ────────────────────────────────────────────────────
function playLocal() {
  if (mpvProcess) {
    mpvProcess.kill();
    mpvProcess = null;
  }

  const track = library[queue[currentIndex]];
  if (!track) return;

  try {
    mpvProcess = spawn('mpv', ['--no-video', '--input-terminal=yes', track.path], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    mpvProcess.on('error', (err) => {
      console.error('mpv error:', err.message);
      if (err.code === 'ENOENT') {
        console.error('mpv not found. Install mpv and add it to PATH, or use Stream mode instead.');
      }
      mpvProcess = null;
      isPlaying = false;
      broadcast({ type: 'state', data: getState() });
    });

    mpvProcess.on('close', (code) => {
      mpvProcess = null;
      if (code === 0 && isPlaying && currentIndex < queue.length - 1) {
        currentIndex++;
        broadcast({ type: 'state', data: getState() });
        playLocal();
      } else {
        isPlaying = false;
        broadcast({ type: 'state', data: getState() });
      }
    });
  } catch (err) {
    console.error('Failed to start mpv:', err.message);
    mpvProcess = null;
    isPlaying = false;
    broadcast({ type: 'state', data: getState() });
  }
}

// ─── Get LAN IP ─────────────────────────────────────────────────────────────
function getLanIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}

// ─── Start Server ───────────────────────────────────────────────────────────
function startServer(port) {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      resolve({ ip: getLanIp(), port });
      return;
    }

    const app = express();

    // Security
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    const apiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, slow down.' },
      skip: (req) => req.path.startsWith('/api/cover/') || req.path.startsWith('/api/stream/'),
    });
    app.use('/api/', apiLimiter);

    const rescanLimiter = rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 3,
      message: { error: 'Rescan limited to 3 per 5 minutes.' },
    });

    app.use(express.json({ limit: '1mb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    // ─── API Routes ──────────────────────────────────────────────────────────
    app.get('/api/tracks', (req, res) => {
      const q = (req.query.q || '').toLowerCase().trim();
      const genre = (req.query.genre || '').trim().toLowerCase();
      let results = library;
      if (genre) {
        // Substring match: "Hip-Hop" matches "Hip-Hop", "Hip-Hop, R&B", etc.
        results = results.filter(t => t.genre && t.genre.toLowerCase().includes(genre));
      }
      if (q) {
        results = results.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          (t.genre && t.genre.toLowerCase().includes(q))
        );
      }
      res.json(results.map(({ path: _, ...rest }) => rest));
    });

    app.get('/api/genres', (req, res) => {
      res.json([...genres].sort());
    });

    app.get('/api/state', (req, res) => {
      res.json(getState());
    });

    app.get('/api/cover/:id', (req, res) => {
      const track = getTrackById(req.params.id);
      if (!track || !track.hasCover) return res.status(404).json({ error: 'No cover art' });
      const extensions = ['.jpg', '.png', '.webp', '.gif'];
      for (const ext of extensions) {
        const coverPath = path.join(getCoversDir(), `${track.id}${ext}`);
        if (fs.existsSync(coverPath)) {
          const mimeTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
          res.set({
            'Content-Type': mimeTypes[ext] || 'image/jpeg',
            'Cache-Control': 'public, max-age=604800',
          });
          return res.sendFile(coverPath);
        }
      }
      res.status(404).json({ error: 'No cover art' });
    });

    const MIME_TYPES = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
    };

    app.get('/api/stream/:id', (req, res) => {
      const track = getTrackById(req.params.id);
      if (!track) return res.status(404).json({ error: 'Track not found' });
      const filePath = track.path;
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'audio/mpeg';
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        if (start >= stat.size || end >= stat.size || start > end) {
          return res.status(416).set('Content-Range', `bytes */${stat.size}`).end();
        }
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });

    // Queue Management
    app.post('/api/queue', (req, res) => {
      const { trackIds } = req.body;
      if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds must be an array' });
      queue = trackIds.filter(id => typeof id === 'number' && id >= 0 && id < library.length);
      currentIndex = 0;
      isPlaying = false;
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    app.post('/api/queue/add', (req, res) => {
      const { trackIds } = req.body;
      if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds must be an array' });
      const valid = trackIds.filter(id => typeof id === 'number' && id >= 0 && id < library.length);
      queue.push(...valid);
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true, queueLength: queue.length });
    });

    app.post('/api/play', (req, res) => {
      const { index } = req.body;
      if (index != null) {
        const idx = parseInt(index);
        if (isNaN(idx) || idx < 0 || idx >= queue.length) {
          return res.status(400).json({ error: 'Invalid index' });
        }
        currentIndex = idx;
      }
      isPlaying = true;
      if (playMode === 'local') playLocal();
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    app.post('/api/pause', (req, res) => {
      isPlaying = false;
      if (mpvProcess) {
        mpvProcess.stdin.write('cycle pause\n');
      }
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    app.post('/api/next', (req, res) => {
      if (currentIndex < queue.length - 1) {
        currentIndex++;
        if (playMode === 'local' && isPlaying) playLocal();
        broadcast({ type: 'state', data: getState() });
      } else {
        isPlaying = false;
        broadcast({ type: 'state', data: getState() });
      }
      res.json({ ok: true });
    });

    app.post('/api/prev', (req, res) => {
      if (currentIndex > 0) currentIndex--;
      if (playMode === 'local' && isPlaying) playLocal();
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    app.post('/api/shuffle', (req, res) => {
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      currentIndex = 0;
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    app.post('/api/mode', (req, res) => {
      const { mode } = req.body;
      if (!['stream', 'local'].includes(mode)) {
        return res.status(400).json({ error: 'Mode must be "stream" or "local"' });
      }
      playMode = mode;
      if (mode === 'stream' && mpvProcess) {
        mpvProcess.kill();
        mpvProcess = null;
      }
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true, mode });
    });

    app.post('/api/rescan', rescanLimiter, async (req, res) => {
      await scanFolders();
      broadcast({ type: 'library-updated', data: { count: library.length } });
      res.json({ ok: true, count: library.length });
    });

    // ─── Desktop State (Electron pushes its player state here) ───────────────
    app.post('/api/desktop/state', (req, res) => {
      desktopState = req.body || {};
      broadcast({ type: 'desktop:state', data: desktopState });
      res.json({ ok: true });
    });

    app.get('/api/desktop/state', (req, res) => {
      res.json(desktopState);
    });

    // Remote commands (mobile → desktop via WS broadcast)
    app.post('/api/remote/command', (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'command required' });
      broadcast({ type: 'remote:command', data: { command } });
      res.json({ ok: true });
    });

    // QR code for mobile access
    app.get('/api/qrcode', async (req, res) => {
      const ip = getLanIp();
      const port = config.port || 3000;
      const url = `http://${ip}:${port}`;
      try {
        const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 180 });
        res.json({ url, svg });
      } catch (e) {
        res.status(500).json({ error: 'QR generation failed' });
      }
    });

    // Playlists
    app.get('/api/playlists', (req, res) => {
      res.json(playlists.map(p => ({
        id: p.id,
        name: p.name,
        trackCount: p.trackIds.length,
        createdAt: p.createdAt,
      })));
    });

    app.get('/api/playlists/:id', (req, res) => {
      const pl = playlists.find(p => p.id === req.params.id);
      if (!pl) return res.status(404).json({ error: 'Playlist not found' });
      res.json({
        ...pl,
        tracks: pl.trackIds.map(id => library[id]).filter(Boolean).map(({ path: _, ...rest }) => rest),
      });
    });

    app.post('/api/playlists', (req, res) => {
      const { name, trackIds, genres: genreFilter, keywords } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name required' });
      }

      let resolvedIds = [];
      if (Array.isArray(trackIds) && trackIds.length > 0) {
        resolvedIds = trackIds.filter(id => typeof id === 'number' && id >= 0 && id < library.length);
      } else if (Array.isArray(genreFilter) && genreFilter.length > 0) {
        const lowerGenres = genreFilter.map(g => g.toLowerCase());
        resolvedIds = library
          .filter(t => t.genre && lowerGenres.includes(t.genre.toLowerCase()))
          .map(t => t.id);
      } else if (keywords && typeof keywords === 'string' && keywords.trim().length > 0) {
        const terms = keywords.toLowerCase().split(/\s+/);
        resolvedIds = library
          .filter(t => terms.some(term =>
            t.title.toLowerCase().includes(term) ||
            t.artist.toLowerCase().includes(term) ||
            t.album.toLowerCase().includes(term) ||
            (t.genre && t.genre.toLowerCase().includes(term))
          ))
          .map(t => t.id);
      }

      if (resolvedIds.length === 0) {
        return res.status(400).json({ error: 'No tracks matched. Provide trackIds, genres, or keywords.' });
      }

      const playlist = {
        id: crypto.randomUUID(),
        name: name.trim(),
        trackIds: resolvedIds,
        createdAt: new Date().toISOString(),
      };

      playlists.push(playlist);
      savePlaylists();
      res.json({ ok: true, playlist: { id: playlist.id, name: playlist.name, trackCount: resolvedIds.length } });
    });

    app.delete('/api/playlists/:id', (req, res) => {
      const idx = playlists.findIndex(p => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
      playlists.splice(idx, 1);
      savePlaylists();
      res.json({ ok: true });
    });

    app.post('/api/playlists/:id/play', (req, res) => {
      const pl = playlists.find(p => p.id === req.params.id);
      if (!pl) return res.status(404).json({ error: 'Playlist not found' });
      queue = [...pl.trackIds];
      currentIndex = 0;
      isPlaying = true;
      if (playMode === 'local') playLocal();
      broadcast({ type: 'state', data: getState() });
      res.json({ ok: true });
    });

    // Catch-all: serve SPA
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Start listening
    const usePort = port || config.port || 3000;
    serverInstance = app.listen(usePort, '0.0.0.0', () => {
      const lanIp = getLanIp();
      console.log(`Resonance server started on http://${lanIp}:${usePort}`);

      // WebSocket
      wssInstance = new WebSocketServer({ server: serverInstance, maxPayload: 1024 });
      wssInstance.on('connection', (ws) => {
        if (clients.size >= 20) {
          ws.close(1013, 'Too many connections');
          return;
        }
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'state', data: getState() }));
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
      });

      // Scan library on start
      if (config.scanOnStartup) {
        scanFolders().catch(console.error);
      }

      // File watcher
      if (config.watchForChanges) {
        let rescanTimeout = null;
        for (const folder of config.musicFolders) {
          const resolved = path.resolve(folder);
          if (!fs.existsSync(resolved)) continue;
          try {
            fs.watch(resolved, { recursive: true }, (eventType, filename) => {
              if (!filename) return;
              const ext = path.extname(filename).toLowerCase();
              if (!AUDIO_EXTENSIONS.has(ext)) return;
              const parts = filename.split(path.sep);
              const excl = new Set((config.excludeFolders || []).map(f => f.toLowerCase()));
              if (parts.some(p => excl.has(p.toLowerCase()))) return;
              clearTimeout(rescanTimeout);
              rescanTimeout = setTimeout(async () => {
                console.log('Changes detected, rescanning...');
                await scanFolders();
                broadcast({ type: 'library-updated', data: { count: library.length } });
              }, 2000);
            });
          } catch (e) {
            console.warn(`Could not watch: ${resolved}`, e.message);
          }
        }
      }

      resolve({ ip: lanIp, port: usePort });
    });

    serverInstance.on('error', (err) => {
      serverInstance = null;
      reject(err);
    });
  });
}

// ─── Stop Server ────────────────────────────────────────────────────────────
function stopServer() {
  return new Promise((resolve) => {
    if (mpvProcess) {
      mpvProcess.kill();
      mpvProcess = null;
    }

    // Close all WebSocket connections
    clients.forEach(ws => {
      try { ws.close(); } catch (e) { /* ignore */ }
    });
    clients.clear();

    if (wssInstance) {
      wssInstance.close();
      wssInstance = null;
    }

    if (serverInstance) {
      serverInstance.close(() => {
        serverInstance = null;
        console.log('Resonance server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function isRunning() {
  return !!serverInstance;
}

function getConfig() {
  return config;
}

function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

module.exports = { startServer, stopServer, isRunning, getLanIp, getConfig, saveConfig, setDataDir };
