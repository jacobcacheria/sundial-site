// Sundial site — starry-night finale.
// Ported from the app's Sky.swift (StarField / DeepSpace meteors, shower, saucer),
// OrbitView.swift (ShootingStar) and Constellations.swift. Plain 2D canvas, no libs.
(function(){
  const canvas = document.getElementById('nightsky');
  if(!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // <canvas data-constellation="off"> — stars and meteors, no crown and no
  // name under it. The invite page wants a quiet sky behind one short card.
  const showCst = canvas.dataset.constellation !== 'off';
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;

  // deterministic pseudo-random 0..1
  const hash = (n, salt=0) => { const v = Math.sin(n*928371 + salt*1299709)*43758.5453; return v - Math.floor(v); };
  const slot = (t, every) => { const i = Math.floor(t/every); return [i, t - i*every]; };
  const ell  = (cx,cy,rx,ry) => { ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(0.1,rx),Math.max(0.1,ry),0,0,6.2832); };
  const bez  = (a,b,c,t) => { const u=1-t; return [u*u*a[0]+2*u*t*b[0]+t*t*c[0], u*u*a[1]+2*u*t*b[1]+t*t*c[1]]; };

  // ---- stars ----
  let stars = [];
  function buildStars(){
    stars = [];
    const count = Math.round(Math.min(110, Math.max(55, W*H/12000)));
    for(let i=0;i<count;i++){
      stars.push({ x: hash(i,1)*W, y: hash(i,2)*H*0.82, s: 1.2 + hash(i,3)*2.4,
                   phase: hash(i,5)*6.2832, speed: 0.8 + hash(i,6)*2.4 });
    }
  }
  function drawStars(t){
    ctx.fillStyle = '#fff';
    for(const st of stars){
      const base = 0.5 + 0.5*Math.sin(t*st.speed + st.phase);   // squared -> lingers dim, flashes bright
      ctx.globalAlpha = 0.04 + 0.96*base*base;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.s/2, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- tonight's constellation (a warm crown, twinkling; brightest star glows) ----
  const CST = {
    name: 'corona borealis', warm: true, brightest: 3,
    stars: [[0.08,0.62],[0.22,0.38],[0.36,0.24],[0.52,0.19],[0.68,0.25],[0.82,0.40],[0.94,0.64]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]
  };
  function drawConstellation(t){
    const bw = Math.min(240, W*0.28), bh = bw*0.62;
    const bx = W*0.07, by = H*0.13, m = 12;
    const core = CST.warm ? '#FFE0A6' : '#ffffff';
    const halo = CST.warm ? 'rgba(224,138,76,0.30)' : 'rgba(255,255,255,0.16)';
    const web  = CST.warm ? 'rgba(242,185,92,0.28)' : 'rgba(255,255,255,0.20)';
    const pts = CST.stars.map(p => [bx+m+p[0]*(bw-m*2), by+m+p[1]*(bh-m*2)]);
    ctx.strokeStyle = web; ctx.lineWidth = 0.8; ctx.beginPath();
    for(const [a,b] of CST.lines){ ctx.moveTo(pts[a][0],pts[a][1]); ctx.lineTo(pts[b][0],pts[b][1]); }
    ctx.stroke();
    for(let i=0;i<pts.length;i++){
      const lead = i === CST.brightest;
      const tw = 0.5 + 0.5*Math.sin(t*(0.9+(i%5)*0.35) + i*1.7);
      const swell = lead ? 0.75+0.25*tw : tw;
      const r = (lead?3.0:1.6) + (lead?1.6:1.3)*swell;
      const haloR = r*(lead?3.1:2);
      ctx.globalAlpha = 1; ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(pts[i][0],pts[i][1],haloR,0,6.2832); ctx.fill();
      ctx.globalAlpha = lead ? 0.85+0.15*tw : 0.35+0.65*tw; ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(pts[i][0],pts[i][1],r,0,6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '500 12px Ranade, Georgia, serif';
    ctx.fillStyle = CST.warm ? 'rgba(242,185,92,0.62)' : 'rgba(255,255,255,0.45)';
    ctx.fillText('tonight · ' + CST.name + (CST.warm ? ' <3' : ''), bx+4, by+bh+20);
  }

  // ---- meteor streak (a tapering trail with a bright head) ----
  function streak(seed, p, length, width, radiant){
    const originX = radiant ? 0.78 : 0.10 + hash(seed,3)*0.85;
    const originY = radiant ? 0.06 : hash(seed,5)*0.45;
    const angle   = radiant ? (2.25 + hash(seed,11)*0.45) : (2.05 + hash(seed,13)*0.75);
    const span    = (radiant ? 0.55 : 0.75 + hash(seed,17)*0.5) * Math.hypot(W,H);
    const fx = originX*W, fy = originY*H, dx = Math.cos(angle)*span, dy = Math.sin(angle)*span;
    const fade = Math.min(1, p*8) * Math.min(1, (1-p)*2.6);
    const tailP = Math.max(0, p-length), steps = 16;
    ctx.lineCap = 'round';
    for(let s=0;s<steps;s++){
      const a = s/steps, b = (s+1)/steps;
      const pa = tailP+(p-tailP)*a, pb = tailP+(p-tailP)*b;
      ctx.strokeStyle = `rgba(255,255,255,${fade*0.8*a*a})`;
      ctx.lineWidth = width*a;
      ctx.beginPath(); ctx.moveTo(fx+dx*pa, fy+dy*pa); ctx.lineTo(fx+dx*pb, fy+dy*pb); ctx.stroke();
    }
    const r = width*1.5;
    ctx.globalAlpha = fade; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(fx+dx*p, fy+dy*p, r, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function meteors(t){                 // one every few seconds, most slots fire
    const every = 5.0, life = 1.5, [i,phase] = slot(t, every);
    if(hash(i,91) < 0.8 && phase < life) streak(i, phase/life, 0.30, 3.0, false);
  }
  function shower(t){                  // rarely, a burst from one radiant
    const every = 78.0, life = 5.0, [i,phase] = slot(t, every);
    if(phase < life) for(let n=0;n<9;n++){
      const st = n*0.22 + hash(i, n*7)*0.35, p = (phase-st)/1.25;
      if(p>0 && p<1) streak(i*100+n, p, 0.20, 2.2, true);
    }
  }

  // ---- shooting star (a bowed bezier with a glowing sparkle head) ----
  function shootingStar(t){
    const every = 15.0, life = 1.7, [i,phase] = slot(t, every);
    if(!(hash(i,53) < 0.85 && phase < life)) return;
    const p0 = [W*(0.04+0.34*hash(i*7+3)), H*(0.04+0.20*hash(i*13+5))];
    const p2 = [p0[0]+W*0.62, p0[1]+H*0.42];
    const dxv = p2[0]-p0[0], dyv = p2[1]-p0[1], len = Math.max(1, Math.hypot(dxv,dyv)), bow = len*0.18;
    const p1 = [(p0[0]+p2[0])/2 - dyv/len*bow, (p0[1]+p2[1])/2 + dxv/len*bow];
    const p = phase/life, env = Math.min(1, p*6)*Math.min(1, (1-p)*3);
    const tail = Math.max(0, p-0.52), steps = 34;
    for(let s=0;s<=steps;s++){
      const f = s/steps, pt = bez(p0,p1,p2, tail+(p-tail)*f), r = 0.5 + 3.2*f;
      ctx.globalAlpha = f*f*env; ctx.fillStyle = '#DCEBFF';
      ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, 6.2832); ctx.fill();
    }
    const head = bez(p0,p1,p2,p);
    ctx.globalAlpha = env;
    const g = ctx.createRadialGradient(head[0],head[1],0, head[0],head[1],15);
    g.addColorStop(0,'rgba(255,255,255,0.95)'); g.addColorStop(0.4,'rgba(174,203,242,0.6)'); g.addColorStop(1,'rgba(174,203,242,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head[0],head[1],15,0,6.2832); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head[0],head[1],2.4,0,6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- the visitor: a little saucer that drops in, hovers, and darts off ----
  function saucer(cx, cy, scale, stretch, alpha, seed){
    const bw = 34*scale*stretch, bh = 10*scale;
    ctx.globalAlpha = 0.95*alpha; ctx.fillStyle = '#DCE9E5'; ell(cx, cy, bw/2, bh/2); ctx.fill();
    ctx.globalAlpha = 0.8*alpha;  ctx.strokeStyle = '#7FA79E'; ctx.lineWidth = 1.2; ell(cx, cy, bw/2, bh/2); ctx.stroke();
    const dw = 14*scale*Math.min(stretch,1.5), dh = 8*scale;
    ctx.globalAlpha = 0.85*alpha; ctx.fillStyle = '#9BE07A'; ell(cx, cy-bh/2-dh*0.34, dw/2, dh/2); ctx.fill();
    for(let n=0;n<3;n++){
      const lx = cx + (n-1)*bw*0.26;
      const blink = 0.45 + 0.55*Math.abs(Math.sin(seed+n + cx*0.03 + n*1.7));
      const r = 1.7*scale;
      ctx.globalAlpha = blink*alpha; ctx.fillStyle = '#FACB77';
      ctx.beginPath(); ctx.arc(lx, cy+bh*0.28, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function ships(t){
    const every = 32.0, life = 7.0, [i,phase] = slot(t, every);
    if(!(hash(i,71) < 0.72 && phase < life)) return;
    const restX = (0.16 + hash(i,23)*0.68)*W, restY = (0.18 + hash(i,29)*0.22)*H;
    const leftward = hash(i,31) < 0.5, arrive = 0.9, hover = 3.6;
    let x = restX, y = restY, alpha = 1, stretch = 1;
    if(phase < arrive){ const p = phase/arrive; alpha = p*p; y = restY - (1-p)*26; }
    else if(phase < arrive+hover){ const p = phase-arrive; y = restY + Math.sin(p*1.9)*5; }
    else { const p = Math.min(1,(phase-arrive-hover)/1.1), e = p*p*p; x = restX + (leftward?-1:1)*e*W*1.5; alpha = 1 - p*0.35; stretch = 1 + e*5; }
    saucer(x, y, 1 + hash(i,37)*0.5, stretch, alpha, i);
  }

  function resize(){
    const r = (canvas.parentElement || canvas).getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    buildStars();
  }

  let startT = 0;
  function frame(now){
    requestAnimationFrame(frame);
    const rect = canvas.getBoundingClientRect();
    if(rect.bottom < -120 || rect.top > innerHeight + 120) return;   // skip drawing when far off-screen
    const t = now/1000 - startT;
    ctx.clearRect(0, 0, W, H);
    drawStars(t); if(showCst) drawConstellation(t);
    meteors(t); shower(t); shootingStar(t); ships(t);
  }

  resize();
  window.addEventListener('resize', resize);
  if(reduce){ ctx.clearRect(0,0,W,H); drawStars(2); if(showCst) drawConstellation(2); }
  else { startT = performance.now()/1000; requestAnimationFrame(frame); }
})();
