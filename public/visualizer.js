/**
 * Audio Visualizer — 4 modes, zero dependencies
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

    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.freqArray = null;

    // Starfield state
    this.stars = [];
    this.initStars();

    // Resize
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
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
    if (mode === 'retrowave') this.retroOffset = 0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  loop() {
    if (!this.running) return;
    this.animId = requestAnimationFrame(() => this.loop());

    if (!this.analyser) {
      this.clear();
      return;
    }

    this.analyser.getByteFrequencyData(this.freqArray);
    this.analyser.getByteTimeDomainData(this.dataArray);

    this.clear();

    switch (this.mode) {
      case 'bars': this.drawBars(); break;
      case 'circular': this.drawCircular(); break;
      case 'wave': this.drawWave(); break;
      case 'starfield': this.drawStarfield(); break;
      case 'retrowave': this.drawRetrowave(); break;
    }
  }

  // ─── MODE: Warm Bars ──────────────────────────────────────────────────────────
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

      // Amber → rose → purple gradient across bars
      const t = i / barCount;
      let r, g, b;
      if (t < 0.5) {
        // Amber to rose
        const p = t * 2;
        r = Math.round(232 + (196 - 232) * p);
        g = Math.round(164 + (122 - 164) * p);
        b = Math.round(53 + (122 - 53) * p);
      } else {
        // Rose to purple
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

  // ─── MODE: Circular (zoomed in) ──────────────────────────────────────────────
  drawCircular() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.42; // Much bigger than before
    const bars = 128;
    const step = Math.floor(freqArray.length / bars);

    // Background glow (amber)
    const avgBass = (freqArray[0] + freqArray[1] + freqArray[2] + freqArray[3]) / 4 / 255;
    const glowRadius = radius * (1 + avgBass * 0.5);
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(232, 164, 53, ${avgBass * 0.25})`);
    glow.addColorStop(1, 'rgba(232, 164, 53, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Inner circle (amber/warm)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(232, 164, 53, ${0.06 + avgBass * 0.15})`;
    ctx.fill();

    // Frequency bars radiating outward
    for (let i = 0; i < bars; i++) {
      const value = freqArray[i * step] / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barLength = value * radius * 0.8;

      const x1 = cx + Math.cos(angle) * radius * 0.4;
      const y1 = cy + Math.sin(angle) * radius * 0.4;
      const x2 = cx + Math.cos(angle) * (radius * 0.4 + barLength);
      const y2 = cy + Math.sin(angle) * (radius * 0.4 + barLength);

      // Amber → rose → purple cycle
      const t = i / bars;
      const hue = 30 + t * 280; // amber(30) → rose(0/360) → purple(280)
      const saturation = 70 + value * 30;

      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 65%, ${0.3 + value * 0.7})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `hsla(${hue}, ${saturation}%, 65%, 0.4)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Center dot pulse (white/amber)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.08 * (1 + avgBass * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 235, 228, ${0.5 + avgBass * 0.5})`;
    ctx.shadowColor = 'rgba(232, 164, 53, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ─── MODE: Wave ─────────────────────────────────────────────────────────────
  drawWave() {
    const { ctx, w, h, dataArray } = this;
    const bufferLength = dataArray.length;

    // Multiple glow layers with warm colors
    const layers = [
      { lineWidth: 6, alpha: 0.12, color: '232, 164, 53' },   // amber glow
      { lineWidth: 3, alpha: 0.4, color: '196, 122, 122' },    // rose
      { lineWidth: 1.5, alpha: 1, color: '240, 235, 228' },    // cream (main)
    ];

    layers.forEach(({ lineWidth, alpha, color }) => {
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.shadowColor = `rgba(232, 164, 53, 0.4)`;
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

    // Faint center line (amber tint)
    ctx.strokeStyle = 'rgba(232, 164, 53, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  // ─── MODE: Starfield ────────────────────────────────────────────────────────
  initStars() {
    this.stars = [];
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random(),
        prevX: 0,
        prevY: 0,
      });
    }
  }

  drawStarfield() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2;
    const cy = h / 2;

    // Speed based on bass
    const bass = (freqArray[0] + freqArray[1] + freqArray[2] + freqArray[3]) / 4 / 255;
    const speed = 0.005 + bass * 0.04;

    // Trail with warm black
    ctx.fillStyle = 'rgba(10, 10, 11, 0.3)';
    ctx.fillRect(0, 0, w, h);

    for (const star of this.stars) {
      star.prevX = star.x / star.z;
      star.prevY = star.y / star.z;

      star.z -= speed;

      if (star.z <= 0) {
        star.x = Math.random() * 2 - 1;
        star.y = Math.random() * 2 - 1;
        star.z = 1;
        star.prevX = star.x;
        star.prevY = star.y;
      }

      const sx = (star.x / star.z) * cx + cx;
      const sy = (star.y / star.z) * cy + cy;
      const px = star.prevX * cx + cx;
      const py = star.prevY * cy + cy;

      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

      const size = (1 - star.z) * 2.5;
      const brightness = (1 - star.z);
      // Warm color shift: amber when calm, rose/purple on bass
      const hue = 30 + bass * 250;

      ctx.strokeStyle = `hsla(${hue}, 75%, 70%, ${brightness})`;
      ctx.lineWidth = size;
      ctx.shadowColor = `hsla(${hue}, 75%, 70%, 0.4)`;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  // ─── MODE: Retrowave / Synthwave Road ──────────────────────────────────────
  drawRetrowave() {
    const { ctx, w, h, freqArray } = this;

    if (this.retroOffset === undefined) this.retroOffset = 0;

    const bass = (freqArray[0] + freqArray[1] + freqArray[2] + freqArray[3]) / 4 / 255;
    const mid = (freqArray[8] + freqArray[9] + freqArray[10] + freqArray[11]) / 4 / 255;
    const speed = 2 + bass * 6;
    this.retroOffset = (this.retroOffset + speed) % 60;

    // Sky gradient (dark purple to deep blue)
    const horizon = h * 0.5;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#0a001a');
    skyGrad.addColorStop(0.6, '#1a0033');
    skyGrad.addColorStop(1, '#330055');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizon);

    // Sun (pulsing with bass)
    const sunY = horizon - 20;
    const sunRadius = 30 + bass * 15;
    const sunGrad = ctx.createRadialGradient(w / 2, sunY, 0, w / 2, sunY, sunRadius);
    sunGrad.addColorStop(0, 'rgba(255, 80, 180, 1)');
    sunGrad.addColorStop(0.4, 'rgba(255, 50, 100, 0.9)');
    sunGrad.addColorStop(0.7, 'rgba(200, 0, 80, 0.5)');
    sunGrad.addColorStop(1, 'rgba(100, 0, 60, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(w / 2 - sunRadius * 2, sunY - sunRadius * 2, sunRadius * 4, sunRadius * 2.5);

    // Sun horizontal lines (striped retro look)
    ctx.save();
    ctx.beginPath();
    ctx.rect(w / 2 - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      const lineY = sunY - sunRadius + i * (sunRadius / 4);
      const lineH = 2 + i * 0.8;
      ctx.fillStyle = '#0a001a';
      ctx.fillRect(w / 2 - sunRadius, lineY, sunRadius * 2, lineH);
    }
    ctx.restore();

    // Ground (dark grid floor)
    const groundGrad = ctx.createLinearGradient(0, horizon, 0, h);
    groundGrad.addColorStop(0, '#1a0033');
    groundGrad.addColorStop(1, '#0a001a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Perspective grid - horizontal lines
    const lineCount = 14;
    for (let i = 0; i < lineCount; i++) {
      // Exponential spacing for perspective
      const t = (i + this.retroOffset / 60) / lineCount;
      const y = horizon + Math.pow(t, 1.8) * (h - horizon);
      if (y > h) continue;

      const alpha = 0.15 + t * 0.4;
      const pulse = 1 + mid * 0.3;

      ctx.strokeStyle = `rgba(180, 50, 255, ${alpha * pulse})`;
      ctx.lineWidth = 1 + t * 1.5;
      ctx.shadowColor = 'rgba(180, 50, 255, 0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Perspective grid - vertical lines (converging to horizon center)
    const vLines = 16;
    for (let i = -vLines / 2; i <= vLines / 2; i++) {
      const topX = w / 2;
      const bottomX = w / 2 + (i / (vLines / 2)) * w * 0.9;

      const alpha = 0.1 + Math.abs(i / (vLines / 2)) * 0.2;
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.2)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(topX, horizon);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Side mountains/buildings silhouette (reacts to bass)
    ctx.fillStyle = '#0a001a';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const bldgCount = 12;
    for (let i = 0; i <= bldgCount; i++) {
      const x = (i / bldgCount) * w * 0.3;
      const bh = 10 + (freqArray[i * 2] / 255) * 40;
      ctx.lineTo(x, horizon - bh);
      ctx.lineTo(x + w * 0.3 / bldgCount * 0.7, horizon - bh);
    }
    ctx.lineTo(w * 0.3, horizon);
    ctx.fill();

    // Right side buildings
    ctx.beginPath();
    ctx.moveTo(w, horizon);
    for (let i = 0; i <= bldgCount; i++) {
      const x = w - (i / bldgCount) * w * 0.3;
      const bh = 10 + (freqArray[i * 2 + 1] / 255) * 40;
      ctx.lineTo(x, horizon - bh);
      ctx.lineTo(x - w * 0.3 / bldgCount * 0.7, horizon - bh);
    }
    ctx.lineTo(w * 0.7, horizon);
    ctx.fill();

    // Glow line at horizon
    ctx.strokeStyle = `rgba(255, 50, 180, ${0.6 + bass * 0.4})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 50, 180, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Scanlines overlay (subtle CRT effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}

window.Visualizer = Visualizer;
