/**
 * Audio Visualizer — 10 modes, zero dependencies
 * Uses Web Audio API (AnalyserNode) + Canvas 2D
 * Color palette: amber (#e8a435), rose (#c47a7a), purple (#b68adf)
 */

class Visualizer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.mode = 'starfield';
    this.running = false;
    this.animId = null;
    this.frame = 0;

    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.freqArray = null;

    // Starfield state
    this.stars = [];
    this.initStars();

    // Glow particles
    this.particles = [];
    this.initParticles();

    // Matrix
    this.matrixDrops = [];

    // Resize
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
    this.analyser.smoothingTimeConstant = 0.82;

    this.source = this.audioCtx.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.freqArray = new Uint8Array(bufferLength);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.clear();
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'starfield') this.initStars();
    if (mode === 'glow') this.initParticles();
    if (mode === 'matrix') this.initMatrix();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  loop() {
    if (!this.running) return;
    this.animId = requestAnimationFrame(() => this.loop());
    this.frame++;

    if (!this.analyser) { this.clear(); return; }

    this.analyser.getByteFrequencyData(this.freqArray);
    this.analyser.getByteTimeDomainData(this.dataArray);

    this.clear();

    switch (this.mode) {
      case 'bars': this.drawBars(); break;
      case 'circular': this.drawCircular(); break;
      case 'wave': this.drawWave(); break;
      case 'starfield': this.drawStarfield(); break;
      case 'glow': this.drawGlow(); break;
      case 'nebula': this.drawNebula(); break;
      case 'spectrum': this.drawSpectrum(); break;
      case 'pulse': this.drawPulse(); break;
      case 'matrix': this.drawMatrix(); break;
      case 'aurora': this.drawAurora(); break;
    }
  }

  // Helper: average of freq range
  getAvg(start, end) {
    let sum = 0;
    for (let i = start; i < end && i < this.freqArray.length; i++) sum += this.freqArray[i];
    return sum / (end - start) / 255;
  }

  // ─── MODE: Warm Bars ──────────────────────────────────────────────────────
  drawBars() {
    const { ctx, w, h, freqArray } = this;
    const barCount = 64;
    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;
    const step = Math.floor(freqArray.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = freqArray[i * step] / 255;
      const barHeight = value * h * 0.85;
      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight;

      const t = i / barCount;
      let r, g, b;
      if (t < 0.5) {
        const p = t * 2;
        r = Math.round(232 + (196 - 232) * p);
        g = Math.round(164 + (122 - 164) * p);
        b = Math.round(53 + (122 - 53) * p);
      } else {
        const p = (t - 0.5) * 2;
        r = Math.round(196 + (182 - 196) * p);
        g = Math.round(122 + (138 - 122) * p);
        b = Math.round(122 + (223 - 122) * p);
      }

      const gradient = ctx.createLinearGradient(x, h, x, y);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.3)`);

      ctx.fillStyle = gradient;
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ─── MODE: Circular ───────────────────────────────────────────────────────
  drawCircular() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.42;
    const bars = 128;
    const step = Math.floor(freqArray.length / bars);

    const avgBass = this.getAvg(0, 4);
    const glowRadius = radius * (1 + avgBass * 0.5);
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(232, 164, 53, ${avgBass * 0.25})`);
    glow.addColorStop(1, 'rgba(232, 164, 53, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232, 164, 53, ${0.06 + avgBass * 0.15})`;
    ctx.fill();

    for (let i = 0; i < bars; i++) {
      const value = freqArray[i * step] / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barLength = value * radius * 0.8;
      const x1 = cx + Math.cos(angle) * radius * 0.4;
      const y1 = cy + Math.sin(angle) * radius * 0.4;
      const x2 = cx + Math.cos(angle) * (radius * 0.4 + barLength);
      const y2 = cy + Math.sin(angle) * (radius * 0.4 + barLength);

      const t = i / bars;
      const hue = 30 + t * 280;
      ctx.strokeStyle = `hsla(${hue}, 70%, 65%, ${0.3 + value * 0.7})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.08 * (1 + avgBass * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 235, 228, ${0.5 + avgBass * 0.5})`;
    ctx.shadowColor = 'rgba(232, 164, 53, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ─── MODE: Wave ───────────────────────────────────────────────────────────
  drawWave() {
    const { ctx, w, h, dataArray } = this;
    const bufferLength = dataArray.length;

    const layers = [
      { lineWidth: 6, alpha: 0.12, color: '232, 164, 53' },
      { lineWidth: 3, alpha: 0.4, color: '196, 122, 122' },
      { lineWidth: 1.5, alpha: 1, color: '240, 235, 228' },
    ];

    layers.forEach(({ lineWidth, alpha, color }) => {
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.shadowColor = 'rgba(232, 164, 53, 0.4)';
      ctx.shadowBlur = lineWidth * 3;

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  // ─── MODE: Starfield ──────────────────────────────────────────────────────
  initStars() {
    this.stars = [];
    for (let i = 0; i < 200; i++) {
      this.stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() });
    }
  }

  drawStarfield() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2, cy = h / 2;
    const bass = this.getAvg(0, 4);
    const speed = 0.005 + bass * 0.04;

    ctx.fillStyle = 'rgba(10, 10, 11, 0.3)';
    ctx.fillRect(0, 0, w, h);

    for (const star of this.stars) {
      const prevX = star.x / star.z;
      const prevY = star.y / star.z;
      star.z -= speed;

      if (star.z <= 0) {
        star.x = Math.random() * 2 - 1;
        star.y = Math.random() * 2 - 1;
        star.z = 1;
        continue;
      }

      const sx = (star.x / star.z) * cx + cx;
      const sy = (star.y / star.z) * cy + cy;
      const px = prevX * cx + cx;
      const py = prevY * cy + cy;

      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

      const size = (1 - star.z) * 2.5;
      const brightness = (1 - star.z);
      const hue = 30 + bass * 250;

      ctx.strokeStyle = `hsla(${hue}, 75%, 70%, ${brightness})`;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  // ─── MODE: Glow (floating particles) ─────────────────────────────────────
  initParticles() {
    this.particles = [];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002,
        size: Math.random() * 3 + 1,
        hue: Math.random() * 60 + 10, // amber-rose range
      });
    }
  }

  drawGlow() {
    const { ctx, w, h } = this;
    const bass = this.getAvg(0, 4);
    const mid = this.getAvg(4, 12);

    ctx.fillStyle = 'rgba(10, 10, 11, 0.15)';
    ctx.fillRect(0, 0, w, h);

    for (const p of this.particles) {
      p.x += p.vx + (Math.random() - 0.5) * 0.001 * (1 + bass * 3);
      p.y += p.vy + (Math.random() - 0.5) * 0.001 * (1 + bass * 3);
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
      p.x = Math.max(0, Math.min(1, p.x));
      p.y = Math.max(0, Math.min(1, p.y));

      const px = p.x * w, py = p.y * h;
      const radius = p.size * (1 + bass * 4);

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius * 4);
      gradient.addColorStop(0, `hsla(${p.hue + mid * 60}, 80%, 65%, ${0.6 + bass * 0.4})`);
      gradient.addColorStop(0.4, `hsla(${p.hue + mid * 60}, 70%, 55%, 0.2)`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, radius * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = `hsla(${p.hue}, 90%, 80%, ${0.8 + bass * 0.2})`;
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ─── MODE: Nebula (fluid color clouds) ────────────────────────────────────
  drawNebula() {
    const { ctx, w, h, freqArray } = this;
    const bass = this.getAvg(0, 4);
    const mid = this.getAvg(8, 16);
    const high = this.getAvg(20, 40);

    ctx.fillStyle = 'rgba(10, 10, 11, 0.08)';
    ctx.fillRect(0, 0, w, h);

    const t = this.frame * 0.01;
    const layers = [
      { cx: 0.3 + Math.sin(t * 0.7) * 0.1, cy: 0.4 + Math.cos(t * 0.5) * 0.1, r: 0.4 + bass * 0.3, hue: 30, sat: 80, alpha: 0.04 + bass * 0.06 },
      { cx: 0.7 + Math.cos(t * 0.6) * 0.1, cy: 0.5 + Math.sin(t * 0.8) * 0.1, r: 0.35 + mid * 0.25, hue: 320, sat: 70, alpha: 0.03 + mid * 0.05 },
      { cx: 0.5 + Math.sin(t * 0.9) * 0.15, cy: 0.6 + Math.cos(t * 0.4) * 0.1, r: 0.3 + high * 0.2, hue: 270, sat: 75, alpha: 0.03 + high * 0.04 },
    ];

    for (const l of layers) {
      const gradient = ctx.createRadialGradient(l.cx * w, l.cy * h, 0, l.cx * w, l.cy * h, l.r * w);
      gradient.addColorStop(0, `hsla(${l.hue}, ${l.sat}%, 55%, ${l.alpha})`);
      gradient.addColorStop(0.5, `hsla(${l.hue + 20}, ${l.sat - 10}%, 40%, ${l.alpha * 0.5})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ─── MODE: Spectrum (mirrored gradient bars) ──────────────────────────────
  drawSpectrum() {
    const { ctx, w, h, freqArray } = this;
    const barCount = 96;
    const barWidth = w / barCount;
    const step = Math.floor(freqArray.length / barCount);
    const halfH = h / 2;

    for (let i = 0; i < barCount; i++) {
      const value = freqArray[i * step] / 255;
      const barHeight = value * halfH * 0.9;

      const t = i / barCount;
      const hue = 25 + t * 280; // amber → purple sweep

      // Top half (mirrored down)
      const grad = ctx.createLinearGradient(0, halfH - barHeight, 0, halfH + barHeight);
      grad.addColorStop(0, `hsla(${hue}, 75%, 60%, 0.1)`);
      grad.addColorStop(0.5, `hsla(${hue}, 85%, 65%, 0.9)`);
      grad.addColorStop(1, `hsla(${hue}, 75%, 60%, 0.1)`);

      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth, halfH - barHeight, barWidth - 1, barHeight * 2);
    }

    // Center line glow
    ctx.strokeStyle = 'rgba(232, 164, 53, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(w, halfH);
    ctx.stroke();
  }

  // ─── MODE: Pulse (bass-reactive central orb) ──────────────────────────────
  drawPulse() {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2;
    const bass = this.getAvg(0, 4);
    const mid = this.getAvg(6, 14);
    const high = this.getAvg(16, 32);

    ctx.fillStyle = 'rgba(10, 10, 11, 0.2)';
    ctx.fillRect(0, 0, w, h);

    const maxR = Math.min(w, h) * 0.4;

    // Outer rings
    for (let i = 3; i >= 0; i--) {
      const ringR = maxR * (0.3 + i * 0.2) * (1 + bass * 0.5);
      const alpha = 0.05 + (3 - i) * 0.03 + mid * 0.1;
      const hue = 30 + i * 70;

      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.lineWidth = 2 + bass * 3;
      ctx.stroke();
    }

    // Central orb
    const orbR = maxR * 0.25 * (1 + bass * 0.8);
    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
    orbGrad.addColorStop(0, `rgba(255, 220, 150, ${0.8 + bass * 0.2})`);
    orbGrad.addColorStop(0.4, `rgba(232, 164, 53, ${0.5 + mid * 0.3})`);
    orbGrad.addColorStop(0.7, `rgba(196, 122, 122, ${0.2 + high * 0.2})`);
    orbGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.fillStyle = `rgba(255, 255, 240, ${0.6 + bass * 0.4})`;
    ctx.beginPath();
    ctx.arc(cx, cy, orbR * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── MODE: Matrix (falling characters) ────────────────────────────────────
  initMatrix() {
    this.matrixDrops = [];
    const cols = Math.floor((this.w || 400) / 14);
    for (let i = 0; i < cols; i++) {
      this.matrixDrops.push(Math.random() * -50);
    }
  }

  drawMatrix() {
    const { ctx, w, h, freqArray } = this;
    const fontSize = 14;
    const cols = Math.floor(w / fontSize);
    const bass = this.getAvg(0, 4);

    if (this.matrixDrops.length !== cols) this.initMatrix();

    ctx.fillStyle = 'rgba(10, 10, 11, 0.12)';
    ctx.fillRect(0, 0, w, h);

    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < cols; i++) {
      const freqIdx = Math.floor((i / cols) * freqArray.length);
      const energy = freqArray[freqIdx] / 255;
      const char = String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)); // Katakana

      const x = i * fontSize;
      const y = this.matrixDrops[i] * fontSize;

      // Color: amber (high energy) → dim (low energy)
      const alpha = 0.3 + energy * 0.7;
      const lightness = 40 + energy * 30;
      ctx.fillStyle = `hsla(35, 90%, ${lightness}%, ${alpha})`;
      ctx.fillText(char, x, y);

      // Glow for high-energy columns
      if (energy > 0.6) {
        ctx.shadowColor = 'rgba(232, 164, 53, 0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;
      }

      if (y > h && Math.random() > 0.98 - bass * 0.03) {
        this.matrixDrops[i] = 0;
      }
      this.matrixDrops[i] += 0.5 + energy * 1.5 + bass * 0.5;
    }
  }

  // ─── MODE: Aurora (northern lights) ───────────────────────────────────────
  drawAurora() {
    const { ctx, w, h } = this;
    const bass = this.getAvg(0, 4);
    const mid = this.getAvg(6, 16);
    const high = this.getAvg(20, 40);
    const t = this.frame * 0.008;

    ctx.fillStyle = 'rgba(10, 10, 11, 0.12)';
    ctx.fillRect(0, 0, w, h);

    const bands = [
      { hue: 140, yBase: 0.3, amplitude: 0.08 + mid * 0.12, speed: 1.0, alpha: 0.15 + bass * 0.2 },
      { hue: 180, yBase: 0.35, amplitude: 0.06 + high * 0.1, speed: 1.3, alpha: 0.12 + mid * 0.15 },
      { hue: 280, yBase: 0.4, amplitude: 0.07 + bass * 0.15, speed: 0.8, alpha: 0.1 + high * 0.12 },
      { hue: 50, yBase: 0.25, amplitude: 0.05 + mid * 0.08, speed: 1.5, alpha: 0.08 + bass * 0.1 },
    ];

    for (const band of bands) {
      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let x = 0; x <= w; x += 4) {
        const nx = x / w;
        const wave1 = Math.sin(nx * 4 + t * band.speed) * band.amplitude;
        const wave2 = Math.sin(nx * 7 + t * band.speed * 0.7) * band.amplitude * 0.5;
        const wave3 = Math.sin(nx * 2 + t * band.speed * 1.3) * band.amplitude * 0.3;
        const y = (band.yBase + wave1 + wave2 + wave3) * h;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `hsla(${band.hue}, 80%, 60%, ${band.alpha})`);
      grad.addColorStop(0.3, `hsla(${band.hue + 20}, 70%, 50%, ${band.alpha * 0.7})`);
      grad.addColorStop(0.6, `hsla(${band.hue}, 60%, 40%, ${band.alpha * 0.3})`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

window.Visualizer = Visualizer;
