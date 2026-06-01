/**
 * Audio Visualizer — 5 modes, zero dependencies
 * Uses Web Audio API (AnalyserNode) + Canvas 2D
 */

class Visualizer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.mode = 'bars'; // bars | circular | wave | particles | starfield
    this.running = false;
    this.animId = null;

    // Audio context (created on first user interaction)
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.freqArray = null;

    // Particles state
    this.particles = [];

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

  // Must be called after a user gesture (click play)
  initAudio() {
    if (this.audioCtx) return;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;

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
    if (mode === 'particles') this.particles = [];
    if (mode === 'starfield') this.initStars();
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
      case 'particles': this.drawParticles(); break;
      case 'starfield': this.drawStarfield(); break;
    }
  }

  // ─── MODE: Neon Bars ─────────────────────────────────────────────────────────
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

      // Gradient per bar
      const hue = (i / barCount) * 280 + 180; // cyan → purple
      const gradient = ctx.createLinearGradient(x, h, x, y);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.9)`);
      gradient.addColorStop(1, `hsla(${hue}, 100%, 80%, 0.4)`);

      ctx.fillStyle = gradient;
      ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.6)`;
      ctx.shadowBlur = 12;

      // Rounded top
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ─── MODE: Circular ──────────────────────────────────────────────────────────
  drawCircular() {
    const { ctx, w, h, freqArray } = this;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.25;
    const bars = 128;
    const step = Math.floor(freqArray.length / bars);

    // Background glow
    const avgBass = (freqArray[0] + freqArray[1] + freqArray[2] + freqArray[3]) / 4 / 255;
    const glowRadius = radius * (1 + avgBass * 0.5);
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, glowRadius);
    glow.addColorStop(0, `rgba(88, 166, 255, ${avgBass * 0.3})`);
    glow.addColorStop(1, 'rgba(88, 166, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(88, 166, 255, ${0.1 + avgBass * 0.2})`;
    ctx.fill();

    // Frequency bars radiating outward
    for (let i = 0; i < bars; i++) {
      const value = freqArray[i * step] / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barLength = value * radius * 1.2;

      const x1 = cx + Math.cos(angle) * radius * 0.5;
      const y1 = cy + Math.sin(angle) * radius * 0.5;
      const x2 = cx + Math.cos(angle) * (radius * 0.5 + barLength);
      const y2 = cy + Math.sin(angle) * (radius * 0.5 + barLength);

      const hue = (i / bars) * 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${0.4 + value * 0.6})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `hsla(${hue}, 80%, 65%, 0.5)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Center circle pulse
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.15 * (1 + avgBass * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + avgBass * 0.4})`;
    ctx.fill();
  }

  // ─── MODE: Wave (Oscilloscope) ───────────────────────────────────────────────
  drawWave() {
    const { ctx, w, h, dataArray } = this;
    const bufferLength = dataArray.length;

    // Draw multiple layers for a thick glow effect
    const layers = [
      { lineWidth: 6, alpha: 0.15 },
      { lineWidth: 3, alpha: 0.4 },
      { lineWidth: 1.5, alpha: 1 },
    ];

    layers.forEach(({ lineWidth, alpha }) => {
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(88, 166, 255, ${alpha})`;
      ctx.shadowColor = 'rgba(88, 166, 255, 0.5)';
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

    // Horizontal center line (faint)
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  // ─── MODE: Particles ─────────────────────────────────────────────────────────
  drawParticles() {
    const { ctx, w, h, freqArray } = this;

    // Detect "kick" — strong bass spike
    const bass = (freqArray[0] + freqArray[1] + freqArray[2]) / 3;
    const mid = (freqArray[10] + freqArray[11] + freqArray[12]) / 3;
    const high = (freqArray[30] + freqArray[31] + freqArray[32]) / 3;

    // Spawn particles on beat
    if (bass > 180) {
      for (let i = 0; i < 5; i++) {
        this.particles.push(this.createParticle(w / 2, h / 2, 'bass'));
      }
    }
    if (mid > 150) {
      this.particles.push(this.createParticle(w / 2, h / 2, 'mid'));
    }
    if (high > 130) {
      this.particles.push(this.createParticle(w / 2, h / 2, 'high'));
    }

    // Update & draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      p.radius *= 0.99;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
      ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.5)`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Limit particles
    if (this.particles.length > 500) {
      this.particles = this.particles.slice(-300);
    }
  }

  createParticle(cx, cy, type) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    const hueMap = { bass: 0 + Math.random() * 30, mid: 180 + Math.random() * 60, high: 270 + Math.random() * 60 };
    return {
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 4,
      life: 1,
      decay: 0.01 + Math.random() * 0.02,
      hue: hueMap[type],
    };
  }

  // ─── MODE: Starfield ─────────────────────────────────────────────────────────
  initStars() {
    this.stars = [];
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: Math.random() * 2 - 1,  // -1 to 1 (from center)
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

    // Speed based on bass energy
    const bass = (freqArray[0] + freqArray[1] + freqArray[2] + freqArray[3]) / 4 / 255;
    const speed = 0.005 + bass * 0.04;

    // Background trail
    ctx.fillStyle = `rgba(13, 17, 23, 0.3)`;
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
      const hue = 200 + bass * 160; // shift color with music

      ctx.strokeStyle = `hsla(${hue}, 70%, 70%, ${brightness})`;
      ctx.lineWidth = size;
      ctx.shadowColor = `hsla(${hue}, 70%, 70%, 0.5)`;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}

// Export for use in main script
window.Visualizer = Visualizer;
