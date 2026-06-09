/**
 * Audio Visualizer — 9 modes
 * Web Audio API (AnalyserNode) + Canvas 2D
 * Theme-aware: reads CSS --hue variable
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
    this.trackTitle = '';
    this.trackArtist = '';
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
    if (this.audioCtx) {
      // Ensure resumed on subsequent calls
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return;
    }
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.75;
    this.source = this.audioCtx.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.freqArray = new Uint8Array(this.analyser.frequencyBinCount);
    // Resume immediately (Chromium requires user gesture, but Electron usually allows it)
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  }

  start() { if (this.running) return; this.running = true; this.loop(); }
  stop() { this.running = false; if (this.animId) cancelAnimationFrame(this.animId); this.clear(); }
  setMode(m) { this.mode = m; if (m === 'starfield') this.initStars(); if (m === 'glow') this.initParticles(); }
  setTrack(t, a) { this.trackTitle = t || ''; this.trackArtist = a || ''; }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }

  // Theme hue from CSS
  getHue() {
    try { return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hue')) || 38; }
    catch(e) { return 38; }
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
      case 'nebula': this.drawNebula(); break;
      case 'drift': this.drawDrift(); break;
      case 'wave': this.drawWave(); break;
      case 'starfield': this.drawStarfield(); break;
      case 'spectrum': this.drawSpectrum(); break;
      case 'glow': this.drawGlow(); break;
      case 'aurora': this.drawAurora(); break;
      case 'bars': this.drawBars(); break;
      case 'circular': this.drawCircular(); break;
      case 'lyrics': this.drawLyrics(); break;
    }
  }

  getAvg(s,e){let sum=0;for(let i=s;i<e&&i<this.freqArray.length;i++)sum+=this.freqArray[i];return sum/(e-s)/255;}
  boost(v,p){return Math.pow(v,p||0.6);}

  // ─── NEBULA (pure — no wave overlay) ──────────────────────────────────────
  drawNebula() {
    const {ctx,w,h}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,20));
    const high=this.boost(this.getAvg(24,50));
    const t=this.frame*0.012;

    ctx.fillStyle=`rgba(10,10,11,${0.04+(1-bass)*0.04})`;
    ctx.fillRect(0,0,w,h);

    const layers=[
      {cx:0.3+Math.sin(t*0.7)*0.15,cy:0.4+Math.cos(t*0.5)*0.15,r:0.35+bass*0.55,h:hue,alpha:0.04+bass*0.18},
      {cx:0.7+Math.cos(t*0.6)*0.12,cy:0.5+Math.sin(t*0.8)*0.12,r:0.3+mid*0.45,h:hue+120,alpha:0.03+mid*0.14},
      {cx:0.5+Math.sin(t*0.9)*0.18,cy:0.35+Math.cos(t*0.4)*0.15,r:0.25+high*0.4,h:hue+240,alpha:0.025+high*0.12},
      {cx:0.4+Math.cos(t*1.1)*0.1,cy:0.65+Math.sin(t*0.6)*0.1,r:0.22+bass*0.35,h:hue+60,alpha:0.02+mid*0.08},
    ];
    for(const l of layers){
      const g=ctx.createRadialGradient(l.cx*w,l.cy*h,0,l.cx*w,l.cy*h,l.r*w);
      g.addColorStop(0,`hsla(${l.h},90%,60%,${l.alpha})`);
      g.addColorStop(0.35,`hsla(${l.h+10},80%,50%,${l.alpha*0.6})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    if(bass>0.6){ctx.fillStyle=`hsla(${hue},80%,60%,${(bass-0.6)*0.25})`;ctx.fillRect(0,0,w,h);}
  }

  // ─── DRIFT (nebula + wave combo) ──────────────────────────────────────────
  drawDrift() {
    const {ctx,w,h,dataArray}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,20));
    const t=this.frame*0.01;

    ctx.fillStyle=`rgba(10,10,11,${0.05+(1-bass)*0.04})`;
    ctx.fillRect(0,0,w,h);

    // Nebula background
    const layers=[
      {cx:0.35+Math.sin(t*0.8)*0.12,cy:0.45+Math.cos(t*0.6)*0.1,r:0.3+bass*0.4,h:hue,alpha:0.03+bass*0.1},
      {cx:0.65+Math.cos(t*0.7)*0.1,cy:0.55+Math.sin(t*0.9)*0.1,r:0.25+mid*0.35,h:hue+180,alpha:0.025+mid*0.08},
    ];
    for(const l of layers){
      const g=ctx.createRadialGradient(l.cx*w,l.cy*h,0,l.cx*w,l.cy*h,l.r*w);
      g.addColorStop(0,`hsla(${l.h},85%,55%,${l.alpha})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }

    // Wave overlay
    if(dataArray){
      const waveLayers=[
        {lw:6,alpha:0.08+bass*0.12,h:hue},
        {lw:2.5,alpha:0.3+bass*0.4,h:hue+30},
        {lw:1.2,alpha:0.6+bass*0.4,h:0,white:true},
      ];
      waveLayers.forEach(({lw,alpha,h:wh,white})=>{
        ctx.beginPath();ctx.lineWidth=lw;
        ctx.strokeStyle=white?`rgba(240,235,228,${alpha})`:`hsla(${wh},80%,60%,${alpha})`;
        ctx.shadowColor=`hsla(${hue},80%,55%,${0.3+bass*0.5})`;ctx.shadowBlur=lw*3;
        const sl=w/dataArray.length;let x=0;
        for(let i=0;i<dataArray.length;i++){const v=dataArray[i]/128;ctx.lineTo(x,(v*h)/2);x+=sl;}
        ctx.stroke();
      });
      ctx.shadowBlur=0;
    }
  }

  // ─── WAVE ─────────────────────────────────────────────────────────────────
  drawWave() {
    const {ctx,w,h,dataArray}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,4));
    const layers=[
      {lw:10,alpha:0.06+bass*0.18,sat:80},
      {lw:4,alpha:0.25+bass*0.4,sat:60},
      {lw:2,alpha:0.7+bass*0.3,sat:0},
    ];
    layers.forEach(({lw,alpha,sat})=>{
      ctx.beginPath();ctx.lineWidth=lw;
      ctx.strokeStyle=sat?`hsla(${hue},${sat}%,60%,${alpha})`:`rgba(240,235,228,${alpha})`;
      ctx.shadowColor=`hsla(${hue},80%,55%,${0.3+bass*0.6})`;ctx.shadowBlur=lw*4;
      const sl=w/dataArray.length;let x=0;
      for(let i=0;i<dataArray.length;i++){const v=dataArray[i]/128;if(i===0)ctx.moveTo(x,(v*h)/2);else ctx.lineTo(x,(v*h)/2);x+=sl;}
      ctx.stroke();
    });
    ctx.shadowBlur=0;
  }

  // ─── STARFIELD ────────────────────────────────────────────────────────────
  initStars(){this.stars=[];for(let i=0;i<300;i++)this.stars.push({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random()});}

  drawStarfield() {
    const {ctx,w,h}=this;
    const cx=w/2,cy=h/2;
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,16));
    const speed=0.003+bass*0.07;
    ctx.fillStyle=`rgba(10,10,11,${0.2+(1-bass)*0.15})`;ctx.fillRect(0,0,w,h);

    for(const star of this.stars){
      const prevX=star.x/star.z,prevY=star.y/star.z;
      star.z-=speed;
      if(star.z<=0){star.x=Math.random()*2-1;star.y=Math.random()*2-1;star.z=1;continue;}
      const sx=(star.x/star.z)*cx+cx,sy=(star.y/star.z)*cy+cy;
      const px=prevX*cx+cx,py=prevY*cy+cy;
      if(sx<0||sx>w||sy<0||sy>h)continue;
      const size=(1-star.z)*(2+bass*4);
      const brightness=(1-star.z);
      const energy=bass+mid*0.5;
      let color;
      if(energy<0.3) color=`rgba(255,255,255,${brightness})`;
      else if(energy<0.5) color=`hsla(280,50%,80%,${brightness})`;
      else if(energy<0.7) color=`hsla(330,60%,75%,${brightness})`;
      else color=`hsla(190,70%,75%,${brightness})`;
      ctx.strokeStyle=color;ctx.lineWidth=size;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(sx,sy);ctx.stroke();
    }
  }

  // ─── SPECTRUM ─────────────────────────────────────────────────────────────
  drawSpectrum() {
    const {ctx,w,h,freqArray}=this;
    const hue=this.getHue();
    const barCount=80,barWidth=w/barCount,step=Math.floor(freqArray.length/barCount),halfH=h/2;
    for(let i=0;i<barCount;i++){
      const value=this.boost(freqArray[i*step]/255,0.55);
      const barHeight=value*halfH*0.95;const t=i/barCount;const bh=hue+t*280;
      const grad=ctx.createLinearGradient(0,halfH-barHeight,0,halfH+barHeight);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.3,`hsla(${bh},85%,60%,${value*0.9})`);
      grad.addColorStop(0.5,`hsla(${bh},90%,72%,${0.4+value*0.6})`);
      grad.addColorStop(0.7,`hsla(${bh},85%,60%,${value*0.9})`);
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;ctx.fillRect(i*barWidth,halfH-barHeight,barWidth-1,barHeight*2);
      if(value>0.5){ctx.shadowColor=`hsla(${bh},90%,65%,0.7)`;ctx.shadowBlur=14;ctx.fillRect(i*barWidth,halfH-2,barWidth-1,4);ctx.shadowBlur=0;}
    }
  }

  // ─── GLOW (theme-aware) ───────────────────────────────────────────────────
  initParticles(){this.particles=[];for(let i=0;i<50;i++)this.particles.push({x:Math.random(),y:Math.random(),vx:(Math.random()-0.5)*0.003,vy:(Math.random()-0.5)*0.003,size:Math.random()*3+2,offset:Math.random()*360});}

  drawGlow() {
    const {ctx,w,h}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,6));const mid=this.boost(this.getAvg(6,16));
    ctx.fillStyle=`rgba(10,10,11,${0.08+(1-bass)*0.06})`;ctx.fillRect(0,0,w,h);
    for(const p of this.particles){
      p.x+=p.vx*(1+bass*6)+(Math.random()-0.5)*0.003*(1+bass*5);
      p.y+=p.vy*(1+bass*6)+(Math.random()-0.5)*0.003*(1+bass*5);
      if(p.x<0||p.x>1)p.vx*=-1;if(p.y<0||p.y>1)p.vy*=-1;
      p.x=Math.max(0,Math.min(1,p.x));p.y=Math.max(0,Math.min(1,p.y));
      const px=p.x*w,py=p.y*h,radius=p.size*(1+bass*7);
      const ph=hue+p.offset*0.3+mid*60;
      const g=ctx.createRadialGradient(px,py,0,px,py,radius*5);
      g.addColorStop(0,`hsla(${ph},85%,70%,${0.5+bass*0.5})`);
      g.addColorStop(0.3,`hsla(${ph},75%,55%,${0.15+bass*0.3})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,radius*5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`hsla(${ph},95%,88%,${0.6+bass*0.4})`;
      ctx.beginPath();ctx.arc(px,py,radius*0.4,0,Math.PI*2);ctx.fill();
    }
  }

  // ─── AURORA (theme-aware, dramatic) ───────────────────────────────────────
  drawAurora() {
    const {ctx,w,h}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,6),0.5);
    const mid=this.boost(this.getAvg(8,20),0.5);
    const high=this.boost(this.getAvg(24,50),0.5);
    const t=this.frame*0.015;

    ctx.fillStyle=`rgba(5,5,8,${0.05+(1-bass)*0.04})`;ctx.fillRect(0,0,w,h);

    const bands=[
      {bh:hue,yBase:0.15,amp:0.08+bass*0.4,speed:0.8,alpha:0.08+bass*0.45,thick:0.25},
      {bh:hue+60,yBase:0.3,amp:0.06+mid*0.35,speed:1.2,alpha:0.06+mid*0.35,thick:0.2},
      {bh:hue+140,yBase:0.45,amp:0.05+high*0.3,speed:0.6,alpha:0.05+high*0.28,thick:0.18},
      {bh:hue+200,yBase:0.1,amp:0.04+bass*0.25,speed:1.6,alpha:0.04+mid*0.18,thick:0.15},
      {bh:hue+280,yBase:0.55,amp:0.03+high*0.22,speed:1.0,alpha:0.03+bass*0.14,thick:0.12},
    ];

    for(const b of bands){
      ctx.beginPath();ctx.moveTo(0,h);
      for(let x=0;x<=w;x+=2){
        const nx=x/w;
        const wave=Math.sin(nx*6+t*b.speed)*b.amp+Math.sin(nx*10+t*b.speed*0.7)*b.amp*0.5+Math.sin(nx*3.5+t*b.speed*1.5)*b.amp*0.4+Math.sin(nx*15+t*b.speed*0.4)*b.amp*0.2;
        ctx.lineTo(x,(b.yBase+wave)*h);
      }
      ctx.lineTo(w,(b.yBase+b.thick)*h);
      for(let x=w;x>=0;x-=2){
        const nx=x/w;
        const wave=Math.sin(nx*6+t*b.speed)*b.amp*0.3+Math.sin(nx*10+t*b.speed*0.7)*b.amp*0.2;
        ctx.lineTo(x,(b.yBase+b.thick+wave*0.5)*h);
      }
      ctx.closePath();
      const grad=ctx.createLinearGradient(0,(b.yBase-0.1)*h,0,(b.yBase+b.thick+0.1)*h);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.3,`hsla(${b.bh},85%,60%,${b.alpha})`);
      grad.addColorStop(0.6,`hsla(${b.bh+10},80%,55%,${b.alpha*0.8})`);
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;ctx.fill();
    }
  }

  // ─── BARS ─────────────────────────────────────────────────────────────────
  drawBars() {
    const {ctx,w,h,freqArray}=this;
    const hue=this.getHue();
    const barCount=48,totalGap=w*0.12;
    const barWidth=(w-totalGap)/barCount,gap=totalGap/barCount;
    const step=Math.floor(freqArray.length/barCount);
    const bass=this.boost(this.getAvg(0,4));
    for(let i=0;i<barCount;i++){
      const value=this.boost(freqArray[i*step]/255,0.55);
      const barHeight=value*h*0.78;const x=i*(barWidth+gap)+gap;const y=h-barHeight;
      const t=i/barCount;const bh=hue+t*280;
      const grad=ctx.createLinearGradient(x,h,x,y);
      grad.addColorStop(0,`hsla(${bh},80%,55%,0.95)`);
      grad.addColorStop(0.5,`hsla(${bh},85%,65%,0.8)`);
      grad.addColorStop(1,`hsla(${bh},75%,45%,0.4)`);
      ctx.shadowColor=`hsla(${bh},90%,60%,${value*0.8})`;ctx.shadowBlur=8+value*14;
      ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x,y,barWidth,barHeight,[barWidth/2,barWidth/2,2,2]);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle=`hsla(${bh},100%,82%,${0.4+value*0.6})`;ctx.beginPath();ctx.roundRect(x,y,barWidth,3,2);ctx.fill();
    }
    if(bass>0.65){ctx.fillStyle=`hsla(${hue},80%,55%,${(bass-0.65)*0.1})`;ctx.fillRect(0,0,w,h);}
  }

  // ─── CIRCULAR ─────────────────────────────────────────────────────────────
  drawCircular() {
    const {ctx,w,h,freqArray}=this;
    const hue=this.getHue();
    const cx=w/2,cy=h/2,radius=Math.min(w,h)*0.4;
    const bars=120,step=Math.floor(freqArray.length/bars);
    const bass=this.boost(this.getAvg(0,6));
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*(1.2+bass*0.6));
    glow.addColorStop(0,`hsla(${hue},80%,55%,${bass*0.2})`);glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    for(let i=0;i<bars;i++){
      const value=this.boost(freqArray[i*step]/255,0.55);
      const angle=(i/bars)*Math.PI*2-Math.PI/2;const barLen=value*radius*0.9;
      const innerR=radius*0.35;
      const x1=cx+Math.cos(angle)*innerR,y1=cy+Math.sin(angle)*innerR;
      const x2=cx+Math.cos(angle)*(innerR+barLen),y2=cy+Math.sin(angle)*(innerR+barLen);
      const bh=hue+(i/bars)*300;
      ctx.strokeStyle=`hsla(${bh},80%,65%,${0.15+value*0.85})`;ctx.lineWidth=2+value*2.5;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(cx,cy,radius*0.06*(1+bass*0.8),0,Math.PI*2);
    ctx.fillStyle=`rgba(255,240,220,${0.5+bass*0.5})`;ctx.fill();
  }

  // ─── LYRICS — massive floating text ───────────────────────────────────────
  drawLyrics() {
    const {ctx,w,h}=this;
    const hue=this.getHue();
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,20));
    const t=this.frame;

    ctx.fillStyle='rgba(10,10,11,0.04)';ctx.fillRect(0,0,w,h);

    const title=(this.trackTitle||'RESONANCE').toUpperCase();
    const artist=(this.trackArtist||'').toUpperCase();

    // Layer 1: Title — MASSIVE, slow horizontal drift
    const fontSize1=Math.max(w*0.5,80);
    ctx.font=`900 ${fontSize1}px sans-serif`;
    ctx.fillStyle=`hsla(${hue},75%,55%,${0.12+bass*0.2})`;
    const textW1=ctx.measureText(title).width;
    const tx1=((t*0.4)%(textW1+w))-textW1;
    const ty1=h*0.5+Math.sin(t*0.003)*h*0.02;
    ctx.fillText(title,tx1,ty1);

    // Layer 2: Artist — large, opposite direction, blurred
    if(artist){
      const fontSize2=Math.max(w*0.3,50);
      ctx.font=`800 ${fontSize2}px sans-serif`;
      ctx.fillStyle=`hsla(${hue+40},65%,50%,${0.08+mid*0.15})`;
      ctx.filter=`blur(${3+bass*4}px)`;
      const textW2=ctx.measureText(artist).width;
      const tx2=w-((t*0.6)%(textW2+w));
      const ty2=h*0.75+Math.cos(t*0.004)*h*0.02;
      ctx.fillText(artist,tx2,ty2);
      ctx.filter='none';
    }
  }
}

window.Visualizer = Visualizer;
