/**
 * Audio Visualizer — 9 modes, zero dependencies
 * Uses Web Audio API (AnalyserNode) + Canvas 2D
 * Palette: amber (#e8a435), rose (#c47a7a), purple (#b68adf)
 * HIGH CONTRAST: exaggerated response to audio energy
 */

class Visualizer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.mode = 'nebula';
    this.running = false;
    this.animId = null;
    this.frame = 0;

    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.freqArray = null;

    this.stars = [];
    this.particles = [];
    this.matrixDrops = [];

    this.initStars();
    this.initParticles();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.w = rect.width;
    this.h = rect.height;
  }

  initAudio() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;
    this.source = this.audioCtx.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  start() { if (this.running) return; this.running = true; this.loop(); }
  stop() { this.running = false; if (this.animId) cancelAnimationFrame(this.animId); this.clear(); }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'starfield') this.initStars();
    if (mode === 'glow') this.initParticles();
    if (mode === 'matrix') this.initMatrix();
  }

  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }

  loop() {
    if (!this.running) return;
    this.animId = requestAnimationFrame(() => this.loop());
    this.frame++;
    if (!this.analyser) { this.clear(); return; }
    this.analyser.getByteFrequencyData(this.freqArray);
    this.analyser.getByteTimeDomainData(this.dataArray);
    this.clear();

    switch (this.mode) {
      case 'nebula': this.drawNebula(); break;
      case 'wave': this.drawWave(); break;
      case 'starfield': this.drawStarfield(); break;
      case 'spectrum': this.drawSpectrum(); break;
      case 'glow': this.drawGlow(); break;
      case 'aurora': this.drawAurora(); break;
      case 'matrix': this.drawMatrix(); break;
      case 'bars': this.drawBars(); break;
      case 'circular': this.drawCircular(); break;
    }
  }

  // Exaggerated energy helpers (high contrast)
  getAvg(start, end) {
    let sum = 0;
    for (let i = start; i < end && i < this.freqArray.length; i++) sum += this.freqArray[i];
    return sum / (end - start) / 255;
  }
  // Boost: raises energy curve for more dramatic response
  boost(val, power) { return Math.pow(val, power || 0.7); }

  // ─── NEBULA (default) — fluid cosmic clouds ──────────────────────────────
  drawNebula() {
    const { ctx, w, h } = this;
    const bass = this.boost(this.getAvg(0, 6));
    const mid = this.boost(this.getAvg(8, 20));
    const high = this.boost(this.getAvg(24, 50));
    const t = this.frame * 0.012;

    ctx.fillStyle = `rgba(10, 10, 11, ${0.06 + (1 - bass) * 0.06})`;
    ctx.fillRect(0, 0, w, h);

    const layers = [
      { cx: 0.3 + Math.sin(t * 0.7) * 0.15, cy: 0.4 + Math.cos(t * 0.5) * 0.15, r: 0.35 + bass * 0.5, hue: 30, alpha: 0.03 + bass * 0.12 },
      { cx: 0.7 + Math.cos(t * 0.6) * 0.12, cy: 0.5 + Math.sin(t * 0.8) * 0.12, r: 0.3 + mid * 0.4, hue: 320, alpha: 0.025 + mid * 0.1 },
      { cx: 0.5 + Math.sin(t * 0.9) * 0.18, cy: 0.35 + Math.cos(t * 0.4) * 0.15, r: 0.25 + high * 0.35, hue: 270, alpha: 0.02 + high * 0.08 },
      { cx: 0.4 + Math.cos(t * 1.1) * 0.1, cy: 0.65 + Math.sin(t * 0.6) * 0.1, r: 0.2 + bass * 0.3, hue: 50, alpha: 0.02 + bass * 0.06 },
    ];

    for (const l of layers) {
      const gradient = ctx.createRadialGradient(l.cx * w, l.cy * h, 0, l.cx * w, l.cy * h, l.r * w);
      gradient.addColorStop(0, `hsla(${l.hue}, 85%, 60%, ${l.alpha})`);
      gradient.addColorStop(0.4, `hsla(${l.hue + 15}, 75%, 45%, ${l.alpha * 0.6})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // Bright flash on bass hit
    if (bass > 0.7) {
      ctx.fillStyle = `rgba(232, 164, 53, ${(bass - 0.7) * 0.15})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ─── WAVE — layered waveform ──────────────────────────────────────────────
  drawWave() {
    const { ctx, w, h, dataArray } = this;
    const bufferLength = dataArray.length;
    const bass = this.boost(this.getAvg(0, 4));

    const layers = [
      { lineWidth: 8, alpha: 0.08 + bass * 0.15, color: '232, 164, 53' },
      { lineWidth: 4, alpha: 0.3 + bass * 0.3, color: '196, 122, 122' },
      { lineWidth: 2, alpha: 0.8 + bass * 0.2, color: '240, 235, 228' },
    ];

    layers.forEach(({ lineWidth, alpha, color }) => {
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.shadowColor = `rgba(232, 164, 53, ${0.3 + bass * 0.5})`;
      ctx.shadowBlur = lineWidth * 3;

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  // ─── STARFIELD — speed + color tied to bass ───────────────────────────────
  initStars() {
    this.stars = [];
    for (let i = 0; i < 250; i++) {
      this.stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() });
    }
  }

  drawStarfield() {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2;
    const bass = this.boost(this.getAvg(0, 6));
    const speed = 0.004 + bass * 0.06; // Much faster on bass

    ctx.fillStyle = `rgba(10, 10, 11, ${0.25 + (1 - bass) * 0.1})`;
    ctx.fillRect(0, 0, w, h);

    for (const star of this.stars) {
      const prevX = star.x / star.z;
      const prevY = star.y / star.z;
      star.z -= speed;

      if (star.z <= 0) { star.x = Math.random() * 2 - 1; star.y = Math.random() * 2 - 1; star.z = 1; continue; }

      const sx = (star.x / star.z) * cx + cx;
      const sy = (star.y / star.z) * cy + cy;
      const px = prevX * cx + cx;
      const py = prevY * cy + cy;
      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

      const size = (1 - star.z) * (2 + bass * 3);
      const brightness = (1 - star.z);
      const hue = 30 + bass * 280; // amber → pink → purple on bass

      ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${brightness})`;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  // ─── SPECTRUM — mirrored vertical bars with glow ──────────────────────────
  drawSpectrum() {
    const { ctx, w, h, freqArray } = this;
    const barCount = 80;
    const barWidth = w / barCount;
    const step = Math.floor(freqArray.length / barCount);
    const halfH = h / 2;

    for (let i = 0; i < barCount; i++) {
      const raw = freqArray[i * step] / 255;
      const value = this.boost(raw, 0.6); // Exaggerate
      const barHeight = value * halfH * 0.95;
      const t = i / barCount;
      const hue = 25 + t * 290;

      const grad = ctx.createLinearGradient(0, halfH - barHeight, 0, halfH + barHeight);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.3, `hsla(${hue}, 85%, 60%, ${value * 0.8})`);
      grad.addColorStop(0.5, `hsla(${hue}, 90%, 70%, ${0.5 + value * 0.5})`);
      grad.addColorStop(0.7, `hsla(${hue}, 85%, 60%, ${value * 0.8})`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth, halfH - barHeight, barWidth - 1, barHeight * 2);

      // Glow on loud bars
      if (value > 0.5) {
        ctx.shadowColor = `hsla(${hue}, 90%, 65%, 0.6)`;
        ctx.shadowBlur = 12;
        ctx.fillRect(i * barWidth, halfH - 2, barWidth - 1, 4);
        ctx.shadowBlur = 0;
      }
    }
  }

  // ─── GLOW — reactive floating particles ───────────────────────────────────
  initParticles() {
    this.particles = [];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.003,
        vy: (Math.random() - 0.5) * 0.003,
        size: Math.random() * 3 + 1.5,
        hue: Math.random() * 80 + 10,
      });
    }
  }

  drawGlow() {
    const { ctx, w, h } = this;
    const bass = this.boost(this.getAvg(0, 6));
    const mid = this.boost(this.getAvg(6, 16));

    ctx.fillStyle = `rgba(10, 10, 11, ${0.1 + (1 - bass) * 0.08})`;
    ctx.fillRect(0, 0, w, h);

    for (const p of this.particles) {
      // Movement reacts strongly to bass
      p.x += p.vx * (1 + bass * 5) + (Math.random() - 0.5) * 0.002 * (1 + bass * 4);
      p.y += p.vy * (1 + bass * 5) + (Math.random() - 0.5) * 0.002 * (1 + bass * 4);
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
      p.x = Math.max(0, Math.min(1, p.x));
      p.y = Math.max(0, Math.min(1, p.y));

      const px = p.x * w, py = p.y * h;
      const radius = p.size * (1 + bass * 6); // Much bigger on bass

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * 5);
      gradient.addColorStop(0, `hsla(${p.hue + mid * 80}, 85%, 70%, ${0.5 + bass * 0.5})`);
      gradient.addColorStop(0.3, `hsla(${p.hue + mid * 80}, 75%, 55%, ${0.2 + bass * 0.3})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radius * 5, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `hsla(${p.hue}, 95%, 85%, ${0.7 + bass * 0.3})`;
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── AURORA — dramatic northern lights ────────────────────────────────────
  drawAurora() {
    const { ctx, w, h } = this;
    const bass = this.boost(this.getAvg(0, 6));
    const mid = this.boost(this.getAvg(8, 20));
    const high = this.boost(this.getAvg(24, 50));
    const t = this.frame * 0.01;

    ctx.fillStyle = `rgba(10, 10, 11, ${0.08 + (1 - bass) * 0.06})`;
    ctx.fillRect(0, 0, w, h);

    const bands = [
      { hue: 140 + bass * 40, yBase: 0.25, amplitude: 0.06 + mid * 0.25, speed: 1.0, alpha: 0.1 + bass * 0.35 },
      { hue: 180 + mid * 30, yBase: 0.35, amplitude: 0.05 + high * 0.2, speed: 1.4, alpha: 0.08 + mid * 0.25 },
      { hue: 280 + high * 20, yBase: 0.45, amplitude: 0.05 + bass * 0.3, speed: 0.7, alpha: 0.07 + high * 0.2 },
      { hue: 50, yBase: 0.2, amplitude: 0.04 + mid * 0.15, speed: 1.8, alpha: 0.05 + bass * 0.15 },
    ];

    for (const band of bands) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const nx = x / w;
        const wave = Math.sin(nx * 5 + t * band.speed) * band.amplitude
          + Math.sin(nx * 8 + t * band.speed * 0.6) * band.amplitude * 0.6
          + Math.sin(nx * 3 + t * band.speed * 1.4) * band.amplitude * 0.4;
        ctx.lineTo(x, (band.yBase + wave) * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `hsla(${band.hue}, 85%, 65%, ${band.alpha})`);
      grad.addColorStop(0.25, `hsla(${band.hue + 15}, 75%, 50%, ${band.alpha * 0.8})`);
      grad.addColorStop(0.5, `hsla(${band.hue}, 65%, 40%, ${band.alpha * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // ─── MATRIX — high-energy falling characters ──────────────────────────────
  initMatrix() {
    this.matrixDrops = [];
    const cols = Math.floor((this.w || 400) / 14);
    for (let i = 0; i < cols; i++) this.matrixDrops.push(Math.random() * -50);
  }

  drawMatrix() {
    const { ctx, w, h, freqArray } = this;
    const fontSize = 14;
    const cols = Math.floor(w / fontSize);
    const bass = this.boost(this.getAvg(0, 6));
    const mid = this.boost(this.getAvg(8, 20));

    if (this.matrixDrops.length !== cols) this.initMatrix();

    ctx.fillStyle = `rgba(10, 10, 11, ${0.08 + (1 - bass) * 0.08})`;
    ctx.fillRect(0, 0, w, h);
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < cols; i++) {
      const freqIdx = Math.floor((i / cols) * freqArray.length);
      const energy = this.boost(freqArray[freqIdx] / 255, 0.5); // Strong exaggeration
      const char = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));

      const x = i * fontSize;
      const y = this.matrixDrops[i] * fontSize;

      // Color: bright amber on energy, dim when quiet
      const lightness = 25 + energy * 55;
      const alpha = 0.15 + energy * 0.85;
      const hue = 35 + energy * 15 + mid * 20;
      ctx.fillStyle = `hsla(${hue}, 95%, ${lightness}%, ${alpha})`;
      ctx.fillText(char, x, y);

      // Strong glow for high-energy
      if (energy > 0.5) {
        ctx.shadowColor = `hsla(35, 100%, 60%, ${energy})`;
        ctx.shadowBlur = 10 + energy * 8;
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;
      }

      if (y > h && Math.random() > 0.97 - bass * 0.04) this.matrixDrops[i] = 0;
      this.matrixDrops[i] += 0.4 + energy * 2 + bass * 1.5;
    }
  }

  // ─── BARS — premium redesign with glow + reflection ───────────────────────
  drawBars() {
    const { ctx, w, h, freqArray } = this;
    const barCount = 48;
    const totalGap = w * 0.15;
    const barWidth = (w - totalGap) / barCount;
    const gap = totalGap / barCount;
    const step = Math.floor(freqArray.length / barCount);
    const bass = this.boost(this.getAvg(0, 4));

    for (let i = 0; i < barCount; i++) {
      const raw = freqArray[i * step] / 255;
      const value = this.boost(raw, 0.6);
      const barHeight = value * h * 0.75;
      const x = i * (barWidth + gap) + gap;
      const y = h - barHeight;

      const t = i / barCount;
      const hue = 25 + t * 280;
      const sat = 75 + value * 25;
      const light = 45 + value * 25;

      // Main bar gradient
      const grad = ctx.createLinearGradient(x, h, x, y);
      grad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.95)`);
      grad.addColorStop(0.5, `hsla(${hue}, ${sat + 5}%, ${light + 10}%, 0.8)`);
      grad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light - 10}%, 0.4)`);

      // Glow
      ctx.shadowColor = `hsla(${hue}, 90%, 60%, ${value * 0.7})`;
      ctx.shadowBlur = 8 + value * 12;

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 2, 2]);
      ctx.fill();

      // Top cap (bright dot)
      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${0.5 + value * 0.5})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, 3, 2);
      ctx.fill();

      // Reflection (faded mirror below)
      const reflGrad = ctx.createLinearGradient(x, h, x, h + barHeight * 0.3);
      reflGrad.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, 0.15)`);
      reflGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = reflGrad;
      ctx.fillRect(x, h, barWidth, barHeight * 0.3);
    }
    ctx.shadowBlur = 0;

    // Bass flash overlay
    if (bass > 0.7) {
      ctx.fillStyle = `rgba(232, 164, 53, ${(bass - 0.7) * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ─── CIRCULAR — radial frequency ─────────────────────────────────────────
  drawCircular() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.4;
    const bars = 120;
    const step = Math.floor(freqArray.length / bars);
    const bass = this.boost(this.getAvg(0, 6));

    // Background pulse
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * (1.2 + bass * 0.6));
    glow.addColorStop(0, `rgba(232, 164, 53, ${bass * 0.2})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Inner orb
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3 * (1 + bass * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232, 164, 53, ${0.05 + bass * 0.2})`;
    ctx.fill();

    // Frequency bars
    for (let i = 0; i < bars; i++) {
      const raw = freqArray[i * step] / 255;
      const value = this.boost(raw, 0.6);
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barLength = value * radius * 0.9;
      const innerR = radius * 0.35;
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + barLength);
      const y2 = cy + Math.sin(angle) * (innerR + barLength);

      const hue = 30 + (i / bars) * 300;
      ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${0.2 + value * 0.8})`;
      ctx.lineWidth = 2 + value * 2;
      ctx.shadowColor = `hsla(${hue}, 85%, 60%, ${value * 0.5})`;
      ctx.shadowBlur = value * 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Center bright dot
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.06 * (1 + bass * 0.8), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 220, ${0.6 + bass * 0.4})`;
    ctx.fill();
  }
}

window.Visualizer = Visualizer;
