const express = require('express');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { parseFile } = require('music-metadata');
const { spawn } = require('child_process');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('./config.json');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
// Helmet: secure HTTP headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // inline script in our SPA
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],               // cover art as data URI
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
    }
  },
  crossOriginEmbedderPolicy: false,  // needed for audio streaming
}));

// Rate limiting — generous for normal use, blocks brute-force/scraping
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 200,                   // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});
app.use('/api/', apiLimiter);

// Stricter rate limit on rescan (expensive operation)
const rescanLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { error: 'Rescan limited to 3 per 5 minutes.' },
});

app.use(express.json({ limit: '1mb' }));  // allow queue operations with many tracks
app.use(express.static(path.join(__dirname, 'public')));

// ─── State ───────────────────────────────────────────────────────────────────
let library = [];          // All tracks with metadata
let genres = new Set();    // All unique genres
let queue = [];            // Current playlist (track IDs)
let currentIndex = 0;
let isPlaying = false;
let playMode = 'stream';
let mpvProcess = null;

// Playlists stored in a JSON file
const PLAYLISTS_FILE = path.join(__dirname, 'playlists.json');
let playlists = loadPlaylists();

function loadPlaylists() {
  try {
    if (fs.existsSync(PLAYLISTS_FILE)) {
      return JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
    }
  } catch (e) { console.warn('Could not load playlists:', e.message); }
  return [];
}

function savePlaylists() {
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlists, null, 2));
}

// ─── Library Scanner ─────────────────────────────────────────────────────────
const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac']);
const EXCLUDE_FOLDERS = new Set((config.excludeFolders || []).map(f => f.toLowerCase()));

async function scanFolders() {
  console.log('🎵 Scanning music folders...');
  library = [];
  genres = new Set();

  for (const folder of config.musicFolders) {
    const resolved = path.resolve(folder);
    if (!fs.existsSync(resolved)) {
      console.warn(`⚠️  Folder not found: ${resolved}`);
      continue;
    }
    await scanDirectory(resolved);
  }

  console.log(`✅ Found ${library.length} tracks, ${genres.size} genres`);
  return library;
}

async function scanDirectory(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`⚠️  Cannot read directory: ${dir}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip excluded folders
      if (EXCLUDE_FOLDERS.has(entry.name.toLowerCase())) continue;
      await scanDirectory(fullPath);
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      try {
        const metadata = await parseFile(fullPath);
        const genre = metadata.common.genre ? metadata.common.genre[0] : null;
        if (genre) genres.add(genre);

        // Check if cover art exists
        const hasCover = metadata.common.picture && metadata.common.picture.length > 0;

        library.push({
          id: library.length,
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
const server = app.listen(config.port, '0.0.0.0', () => {
  const now = new Date().toLocaleString('fr-FR');
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║           🎵  RESONANCE — SERVER UP  🎵          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Started:  ${now.padEnd(36)}║`);
  console.log(`║  Local:    http://localhost:${config.port}                 ║`);
  console.log(`║  LAN:      http://172.20.10.5:${config.port}              ║`);
  console.log(`║  Security: Helmet + rate limiting ✔              ║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
});

const wss = new WebSocketServer({ server, maxPayload: 1024 }); // limit WS payload
const clients = new Set();

wss.on('connection', (ws, req) => {
  // Limit concurrent connections (anti-abuse)
  if (clients.size >= 20) {
    ws.close(1013, 'Too many connections');
    return;
  }
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', data: getState() }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(message) {
  const payload = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

function getState() {
  return {
    queue: queue.map(id => library[id]).filter(Boolean),
    currentIndex,
    isPlaying,
    playMode,
    currentTrack: queue[currentIndex] != null ? library[queue[currentIndex]] : null,
  };
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// Get all tracks (with optional search + genre filter)
app.get('/api/tracks', (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  const genre = (req.query.genre || '').trim();

  let results = library;

  if (genre) {
    results = results.filter(t => t.genre && t.genre.toLowerCase() === genre.toLowerCase());
  }

  if (q) {
    results = results.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      (t.genre && t.genre.toLowerCase().includes(q))
    );
  }

  // Don't send file paths to client (security)
  res.json(results.map(({ path: _, ...rest }) => rest));
});

// Get all genres
app.get('/api/genres', (req, res) => {
  res.json([...genres].sort());
});

// Get current state
app.get('/api/state', (req, res) => {
  res.json(getState());
});

// Get cover art for a track
app.get('/api/cover/:id', async (req, res) => {
  const track = getTrackById(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  try {
    const metadata = await parseFile(track.path);
    const picture = metadata.common.picture && metadata.common.picture[0];

    if (picture) {
      res.set({
        'Content-Type': picture.format,
        'Cache-Control': 'public, max-age=86400',  // cache 24h
      });
      return res.send(picture.data);
    }
  } catch (e) { /* fall through to 404 */ }

  res.status(404).json({ error: 'No cover art' });
});

// Stream a track
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
      'Content-Type': 'audio/mpeg',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ─── Queue Management ────────────────────────────────────────────────────────

app.post('/api/queue', (req, res) => {
  const { trackIds } = req.body;
  if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds must be an array' });
  // Validate all IDs
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
  if (currentIndex < queue.length - 1) currentIndex++;
  if (playMode === 'local' && isPlaying) playLocal();
  broadcast({ type: 'state', data: getState() });
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

// ─── Playlists ───────────────────────────────────────────────────────────────

// List all playlists
app.get('/api/playlists', (req, res) => {
  res.json(playlists.map(p => ({
    id: p.id,
    name: p.name,
    trackCount: p.trackIds.length,
    createdAt: p.createdAt,
  })));
});

// Get a playlist
app.get('/api/playlists/:id', (req, res) => {
  const pl = playlists.find(p => p.id === req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  res.json({
    ...pl,
    tracks: pl.trackIds.map(id => library[id]).filter(Boolean).map(({ path: _, ...rest }) => rest),
  });
});

// Create a playlist (from manual selection, genre filter, or keyword search)
app.post('/api/playlists', (req, res) => {
  const { name, trackIds, genres: genreFilter, keywords } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name required' });
  }

  let resolvedIds = [];

  if (Array.isArray(trackIds) && trackIds.length > 0) {
    // Direct track IDs
    resolvedIds = trackIds.filter(id => typeof id === 'number' && id >= 0 && id < library.length);
  } else if (Array.isArray(genreFilter) && genreFilter.length > 0) {
    // Create from genres
    const lowerGenres = genreFilter.map(g => g.toLowerCase());
    resolvedIds = library
      .filter(t => t.genre && lowerGenres.includes(t.genre.toLowerCase()))
      .map(t => t.id);
  } else if (keywords && typeof keywords === 'string' && keywords.trim().length > 0) {
    // Create from keyword search
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

// Delete a playlist
app.delete('/api/playlists/:id', (req, res) => {
  const idx = playlists.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
  playlists.splice(idx, 1);
  savePlaylists();
  res.json({ ok: true });
});

// Load a playlist into queue
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

// ─── Local Playback (mpv) ────────────────────────────────────────────────────
function playLocal() {
  if (mpvProcess) {
    mpvProcess.kill();
    mpvProcess = null;
  }

  const track = library[queue[currentIndex]];
  if (!track) return;

  mpvProcess = spawn('mpv', ['--no-video', '--input-terminal=yes', track.path], {
    stdio: ['pipe', 'pipe', 'pipe'],
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
}

// ─── Catch-all: serve SPA for any non-API route ─────────────────────────────
app.get('*', (req, res) => {
  // Don't let unknown routes leak info
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Startup ─────────────────────────────────────────────────────────────────
if (config.scanOnStartup) {
  scanFolders().catch(console.error);
}

// ─── File Watcher (auto-detect new/removed tracks) ───────────────────────────
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

        // Check if it's in an excluded folder
        const parts = filename.split(path.sep);
        if (parts.some(p => EXCLUDE_FOLDERS.has(p.toLowerCase()))) return;

        // Debounce: wait 2s after last change before rescanning
        // (handles bulk copies)
        clearTimeout(rescanTimeout);
        rescanTimeout = setTimeout(async () => {
          console.log('📂 Changes detected, rescanning...');
          await scanFolders();
          broadcast({ type: 'library-updated', data: { count: library.length } });
        }, 2000);
      });
      console.log(`👁️  Watching for changes: ${resolved}`);
    } catch (e) {
      console.warn(`⚠️  Could not watch: ${resolved}`, e.message);
    }
  }
}
