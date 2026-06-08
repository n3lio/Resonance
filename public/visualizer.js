/**
 * Audio Visualizer — 9 modes, zero dependencies
 * Uses Web Audio API (AnalyserNode) + Canvas 2D
 * HIGH CONTRAST reactive to audio
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
  setMode(mode) { this.mode = mode; if (mode === 'starfield') this.initStars(); if (mode === 'glow') this.initParticles(); }
  setTrack(title, artist) { this.trackTitle = title || ''; this.trackArtist = artist || ''; }
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
      case 'bars': this.drawBars(); break;
      case 'circular': this.drawCircular(); break;
      case 'lyrics': this.drawLyrics(); break;
    }
  }

  getAvg(s, e) { let sum=0; for(let i=s;i<e&&i<this.freqArray.length;i++) sum+=this.freqArray[i]; return sum/(e-s)/255; }
  boost(v, p) { return Math.pow(v, p||0.6); }

  // ─── NEBULA ───────────────────────────────────────────────────────────────
  drawNebula() {
    const {ctx,w,h}=this;
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,20));
    const high=this.boost(this.getAvg(24,50));
    const t=this.frame*0.012;

    ctx.fillStyle=`rgba(10,10,11,${0.05+(1-bass)*0.05})`;
    ctx.fillRect(0,0,w,h);

    const layers=[
      {cx:0.3+Math.sin(t*0.7)*0.15,cy:0.4+Math.cos(t*0.5)*0.15,r:0.35+bass*0.5,hue:30,alpha:0.03+bass*0.14},
      {cx:0.7+Math.cos(t*0.6)*0.12,cy:0.5+Math.sin(t*0.8)*0.12,r:0.3+mid*0.4,hue:320,alpha:0.025+mid*0.12},
      {cx:0.5+Math.sin(t*0.9)*0.18,cy:0.35+Math.cos(t*0.4)*0.15,r:0.25+high*0.35,hue:270,alpha:0.02+high*0.09},
      {cx:0.4+Math.cos(t*1.1)*0.1,cy:0.65+Math.sin(t*0.6)*0.1,r:0.2+bass*0.3,hue:200,alpha:0.02+mid*0.06},
    ];
    for(const l of layers){
      const g=ctx.createRadialGradient(l.cx*w,l.cy*h,0,l.cx*w,l.cy*h,l.r*w);
      g.addColorStop(0,`hsla(${l.hue},85%,60%,${l.alpha})`);
      g.addColorStop(0.4,`hsla(${l.hue+15},75%,45%,${l.alpha*0.6})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    }
    if(bass>0.65){ctx.fillStyle=`rgba(232,164,53,${(bass-0.65)*0.2})`;ctx.fillRect(0,0,w,h);}

    // Subtle wave overlay (nebula+wave combo)
    if(this.dataArray){
      ctx.beginPath();ctx.lineWidth=1.5;
      ctx.strokeStyle=`rgba(240,235,228,${0.1+mid*0.3})`;
      const sl=w/this.dataArray.length;let x=0;
      for(let i=0;i<this.dataArray.length;i++){const v=this.dataArray[i]/128;ctx.lineTo(x,(v*h)/2);x+=sl;}
      ctx.stroke();
    }
  }

  // ─── WAVE ─────────────────────────────────────────────────────────────────
  drawWave() {
    const {ctx,w,h,dataArray}=this;
    const bass=this.boost(this.getAvg(0,4));
    const layers=[
      {lw:10,alpha:0.06+bass*0.15,color:'232,164,53'},
      {lw:4,alpha:0.25+bass*0.35,color:'196,122,122'},
      {lw:2,alpha:0.7+bass*0.3,color:'240,235,228'},
    ];
    layers.forEach(({lw,alpha,color})=>{
      ctx.beginPath();ctx.lineWidth=lw;
      ctx.strokeStyle=`rgba(${color},${alpha})`;
      ctx.shadowColor=`rgba(232,164,53,${0.3+bass*0.6})`;ctx.shadowBlur=lw*4;
      const sl=w/dataArray.length;let x=0;
      for(let i=0;i<dataArray.length;i++){const v=dataArray[i]/128;const y=(v*h)/2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);x+=sl;}
      ctx.stroke();
    });
    ctx.shadowBlur=0;
  }

  // ─── STARFIELD — particles + colored trails ───────────────────────────────
  initStars() {
    this.stars=[];
    for(let i=0;i<300;i++) this.stars.push({x:Math.random()*2-1,y:Math.random()*2-1,z:Math.random(),twinkle:Math.random()});
  }

  drawStarfield() {
    const {ctx,w,h}=this;
    const cx=w/2,cy=h/2;
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,16));
    const speed=0.003+bass*0.07;

    ctx.fillStyle=`rgba(10,10,11,${0.2+(1-bass)*0.15})`;
    ctx.fillRect(0,0,w,h);

    // Background dust particles
    if(this.frame%3===0){
      for(let i=0;i<3;i++){
        const px=Math.random()*w,py=Math.random()*h;
        ctx.fillStyle=`rgba(200,180,160,${0.02+bass*0.03})`;
        ctx.beginPath();ctx.arc(px,py,0.5+Math.random(),0,Math.PI*2);ctx.fill();
      }
    }

    for(const star of this.stars){
      const prevX=star.x/star.z,prevY=star.y/star.z;
      star.z-=speed;
      if(star.z<=0){star.x=Math.random()*2-1;star.y=Math.random()*2-1;star.z=1;continue;}
      const sx=(star.x/star.z)*cx+cx,sy=(star.y/star.z)*cy+cy;
      const px=prevX*cx+cx,py=prevY*cy+cy;
      if(sx<0||sx>w||sy<0||sy>h) continue;

      const size=(1-star.z)*(2+bass*4);
      const brightness=(1-star.z);
      // White by default, colored on energy
      const energy=bass+mid*0.5;
      let hue,sat;
      if(energy<0.3){hue=0;sat=0;} // white
      else if(energy<0.5){hue=280;sat=40+energy*60;} // light violet
      else if(energy<0.7){hue=320;sat=60+energy*30;} // rose/pink
      else {hue=190;sat=70+energy*20;} // cyan

      ctx.strokeStyle=sat===0?`rgba(255,255,255,${brightness})`:`hsla(${hue},${sat}%,75%,${brightness})`;
      ctx.lineWidth=size;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(sx,sy);ctx.stroke();
    }
  }

  // ─── SPECTRUM ─────────────────────────────────────────────────────────────
  drawSpectrum() {
    const {ctx,w,h,freqArray}=this;
    const barCount=80,barWidth=w/barCount,step=Math.floor(freqArray.length/barCount),halfH=h/2;
    for(let i=0;i<barCount;i++){
      const raw=freqArray[i*step]/255;const value=this.boost(raw,0.55);
      const barHeight=value*halfH*0.95;const t=i/barCount;const hue=25+t*290;
      const grad=ctx.createLinearGradient(0,halfH-barHeight,0,halfH+barHeight);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.3,`hsla(${hue},85%,60%,${value*0.9})`);
      grad.addColorStop(0.5,`hsla(${hue},90%,72%,${0.4+value*0.6})`);
      grad.addColorStop(0.7,`hsla(${hue},85%,60%,${value*0.9})`);
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;
      ctx.fillRect(i*barWidth,halfH-barHeight,barWidth-1,barHeight*2);
      if(value>0.5){ctx.shadowColor=`hsla(${hue},90%,65%,0.7)`;ctx.shadowBlur=14;ctx.fillRect(i*barWidth,halfH-2,barWidth-1,4);ctx.shadowBlur=0;}
    }
  }

  // ─── GLOW ─────────────────────────────────────────────────────────────────
  initParticles() {
    this.particles=[];
    for(let i=0;i<50;i++) this.particles.push({x:Math.random(),y:Math.random(),vx:(Math.random()-0.5)*0.003,vy:(Math.random()-0.5)*0.003,size:Math.random()*3+2,hue:Math.random()*80+10});
  }

  drawGlow() {
    const {ctx,w,h}=this;
    const bass=this.boost(this.getAvg(0,6));const mid=this.boost(this.getAvg(6,16));
    ctx.fillStyle=`rgba(10,10,11,${0.08+(1-bass)*0.06})`;ctx.fillRect(0,0,w,h);
    for(const p of this.particles){
      p.x+=p.vx*(1+bass*6)+(Math.random()-0.5)*0.003*(1+bass*5);
      p.y+=p.vy*(1+bass*6)+(Math.random()-0.5)*0.003*(1+bass*5);
      if(p.x<0||p.x>1)p.vx*=-1;if(p.y<0||p.y>1)p.vy*=-1;
      p.x=Math.max(0,Math.min(1,p.x));p.y=Math.max(0,Math.min(1,p.y));
      const px=p.x*w,py=p.y*h,radius=p.size*(1+bass*7);
      const g=ctx.createRadialGradient(px,py,0,px,py,radius*5);
      g.addColorStop(0,`hsla(${p.hue+mid*90},85%,70%,${0.5+bass*0.5})`);
      g.addColorStop(0.3,`hsla(${p.hue+mid*90},75%,55%,${0.15+bass*0.3})`);
      g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,radius*5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`hsla(${p.hue},95%,88%,${0.6+bass*0.4})`;
      ctx.beginPath();ctx.arc(px,py,radius*0.4,0,Math.PI*2);ctx.fill();
    }
  }

  // ─── AURORA — dramatic layered curtains ───────────────────────────────────
  drawAurora() {
    const {ctx,w,h}=this;
    const bass=this.boost(this.getAvg(0,6),0.5);
    const mid=this.boost(this.getAvg(8,20),0.5);
    const high=this.boost(this.getAvg(24,50),0.5);
    const t=this.frame*0.015;

    ctx.fillStyle=`rgba(5,5,8,${0.06+(1-bass)*0.04})`;ctx.fillRect(0,0,w,h);

    const bands=[
      {hue:130+bass*50,yBase:0.15,amp:0.08+bass*0.35,speed:0.8,alpha:0.08+bass*0.4,thick:0.25},
      {hue:170+mid*40,yBase:0.3,amp:0.06+mid*0.3,speed:1.2,alpha:0.06+mid*0.3,thick:0.2},
      {hue:260+high*30,yBase:0.45,amp:0.05+high*0.25,speed:0.6,alpha:0.05+high*0.25,thick:0.18},
      {hue:80,yBase:0.1,amp:0.04+bass*0.2,speed:1.6,alpha:0.04+mid*0.15,thick:0.15},
      {hue:200+bass*40,yBase:0.55,amp:0.03+high*0.2,speed:1.0,alpha:0.03+bass*0.12,thick:0.12},
    ];

    for(const b of bands){
      ctx.beginPath();ctx.moveTo(0,h);
      for(let x=0;x<=w;x+=2){
        const nx=x/w;
        const wave=Math.sin(nx*6+t*b.speed)*b.amp
          +Math.sin(nx*10+t*b.speed*0.7)*b.amp*0.5
          +Math.sin(nx*3.5+t*b.speed*1.5)*b.amp*0.4
          +Math.sin(nx*15+t*b.speed*0.4)*b.amp*0.2;
        ctx.lineTo(x,(b.yBase+wave)*h);
      }
      ctx.lineTo(w,(b.yBase+b.thick)*h);
      for(let x=w;x>=0;x-=2){
        const nx=x/w;
        const wave=Math.sin(nx*6+t*b.speed)*b.amp*0.3
          +Math.sin(nx*10+t*b.speed*0.7)*b.amp*0.2;
        ctx.lineTo(x,(b.yBase+b.thick+wave*0.5)*h);
      }
      ctx.closePath();
      const grad=ctx.createLinearGradient(0,(b.yBase-0.1)*h,0,(b.yBase+b.thick+0.1)*h);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.3,`hsla(${b.hue},85%,60%,${b.alpha})`);
      grad.addColorStop(0.6,`hsla(${b.hue+10},80%,55%,${b.alpha*0.8})`);
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;ctx.fill();
    }
  }

  // ─── BARS — premium with glow + reflection ────────────────────────────────
  drawBars() {
    const {ctx,w,h,freqArray}=this;
    const barCount=48,totalGap=w*0.12;
    const barWidth=(w-totalGap)/barCount,gap=totalGap/barCount;
    const step=Math.floor(freqArray.length/barCount);
    const bass=this.boost(this.getAvg(0,4));
    for(let i=0;i<barCount;i++){
      const raw=freqArray[i*step]/255;const value=this.boost(raw,0.55);
      const barHeight=value*h*0.78;const x=i*(barWidth+gap)+gap;const y=h-barHeight;
      const t=i/barCount;const hue=25+t*280;const sat=75+value*25;const light=45+value*25;
      const grad=ctx.createLinearGradient(x,h,x,y);
      grad.addColorStop(0,`hsla(${hue},${sat}%,${light}%,0.95)`);
      grad.addColorStop(0.5,`hsla(${hue},${sat+5}%,${light+10}%,0.8)`);
      grad.addColorStop(1,`hsla(${hue},${sat}%,${light-10}%,0.4)`);
      ctx.shadowColor=`hsla(${hue},90%,60%,${value*0.8})`;ctx.shadowBlur=8+value*14;
      ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x,y,barWidth,barHeight,[barWidth/2,barWidth/2,2,2]);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle=`hsla(${hue},100%,82%,${0.4+value*0.6})`;ctx.beginPath();ctx.roundRect(x,y,barWidth,3,2);ctx.fill();
      const rg=ctx.createLinearGradient(x,h,x,h+barHeight*0.25);
      rg.addColorStop(0,`hsla(${hue},${sat}%,${light}%,0.12)`);rg.addColorStop(1,'transparent');
      ctx.fillStyle=rg;ctx.fillRect(x,h,barWidth,barHeight*0.25);
    }
    if(bass>0.65){ctx.fillStyle=`rgba(232,164,53,${(bass-0.65)*0.1})`;ctx.fillRect(0,0,w,h);}
  }

  // ─── CIRCULAR ─────────────────────────────────────────────────────────────
  drawCircular() {
    const {ctx,w,h,freqArray}=this;
    const cx=w/2,cy=h/2,radius=Math.min(w,h)*0.4;
    const bars=120,step=Math.floor(freqArray.length/bars);
    const bass=this.boost(this.getAvg(0,6));
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*(1.2+bass*0.6));
    glow.addColorStop(0,`rgba(232,164,53,${bass*0.2})`);glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    for(let i=0;i<bars;i++){
      const raw=freqArray[i*step]/255;const value=this.boost(raw,0.55);
      const angle=(i/bars)*Math.PI*2-Math.PI/2;const barLen=value*radius*0.9;
      const innerR=radius*0.35;
      const x1=cx+Math.cos(angle)*innerR,y1=cy+Math.sin(angle)*innerR;
      const x2=cx+Math.cos(angle)*(innerR+barLen),y2=cy+Math.sin(angle)*(innerR+barLen);
      const hue=30+(i/bars)*300;
      ctx.strokeStyle=`hsla(${hue},80%,65%,${0.15+value*0.85})`;ctx.lineWidth=2+value*2.5;
      ctx.shadowColor=`hsla(${hue},85%,60%,${value*0.6})`;ctx.shadowBlur=value*10;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(cx,cy,radius*0.06*(1+bass*0.8),0,Math.PI*2);
    ctx.fillStyle=`rgba(255,240,220,${0.5+bass*0.5})`;ctx.fill();
  }

  // ─── LYRICS — floating title/artist text ──────────────────────────────────
  drawLyrics() {
    const {ctx,w,h}=this;
    const bass=this.boost(this.getAvg(0,6));
    const mid=this.boost(this.getAvg(8,20));
    const t=this.frame;

    ctx.fillStyle=`rgba(10,10,11,0.06)`;ctx.fillRect(0,0,w,h);

    const title=this.trackTitle||'Resonance';
    const artist=this.trackArtist||'';

    // Layer 1: Title — huge, slow, sharp
    const fontSize1=Math.min(w*0.35,120);
    ctx.font=`800 ${fontSize1}px sans-serif`;
    ctx.fillStyle=`hsla(var(--hue,38),70%,55%,${0.04+bass*0.08})`;
    const tx1=(t*0.3)%(w+fontSize1*title.length*0.6)-fontSize1*title.length*0.3;
    const ty1=h*0.45+Math.sin(t*0.008)*h*0.05;
    ctx.fillText(title,tx1,ty1);

    // Layer 2: Artist — smaller, faster, blurred
    const fontSize2=Math.min(w*0.2,70);
    ctx.font=`600 ${fontSize2}px sans-serif`;
    ctx.fillStyle=`hsla(var(--hue,38),60%,50%,${0.03+mid*0.06})`;
    ctx.filter=`blur(${2+bass*3}px)`;
    const tx2=w-(t*0.5)%(w+fontSize2*artist.length*0.6);
    const ty2=h*0.7+Math.cos(t*0.012)*h*0.04;
    ctx.fillText(artist,tx2,ty2);
    ctx.filter='none';
  }
}

window.Visualizer = Visualizer;
