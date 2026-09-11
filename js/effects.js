// Sundial site — WebGL effects (ported from React Bits Strands + Aurora to vanilla ogl)
import { Renderer, Program, Mesh, Color, Triangle } from 'https://esm.sh/ogl@1.0.11';

const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

/* ---------------- Strands ---------------- */
const MAX_STRANDS = 12, MAX_COLORS = 8;
const STRANDS_FRAG = `#version 300 es
precision highp float;
uniform float uTime; uniform vec2 uResolution;
uniform vec3 uColors[${MAX_COLORS}]; uniform int uColorCount; uniform int uStrandCount;
uniform float uSpeed,uAmplitude,uWaviness,uThickness,uGlow,uTaper,uSpread,uHueShift,uIntensity,uOpacity,uScale,uSaturation;
out vec4 fragColor;
const float PI=3.14159265;
vec3 spectrum(float t){ return 0.5+0.5*cos(2.0*PI*(t+vec3(0.0,0.33,0.67))); }
vec3 samplePalette(float t){ t=fract(t); float s=t*float(uColorCount); int i=int(floor(s)); float b=fract(s); int n=i+1; if(n>=uColorCount)n=0; return mix(uColors[i],uColors[n],b); }
vec3 strandColor(float t){ if(uColorCount>0) return samplePalette(t); return spectrum(t); }
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uResolution)/uResolution.y; uv/=max(uScale,0.0001);
  float e=0.06+uIntensity*0.94;
  float env=pow(max(cos(uv.x*PI*1.05),0.0),uTaper);
  vec3 col=vec3(0.0);
  for(int i=0;i<${MAX_STRANDS};i++){
    if(i>=uStrandCount) break;
    float fi=float(i); float ph=fi*1.7*uSpread; float freq=(2.0+fi*0.35)*uWaviness; float spd=1.4+fi*1.2; float tt=uTime*uSpeed;
    float w=sin(uv.x*freq+tt*spd+ph)*0.60+sin(uv.x*freq*1.1-tt*spd*0.7+ph*1.7)*0.40;
    float amp=(0.1+0.02*e)*env*uAmplitude; float y=w*amp; float d=abs(uv.y-y);
    float thick=(0.001+0.05*e)*(0.35+env)*uThickness; float g=thick/(d+thick*0.45); g=g*g;
    float h=fi/float(uStrandCount)+uv.x*0.30+uTime*0.04+uHueShift;
    col+=strandColor(h)*g*env;
  }
  col*=0.45+0.7*e; col=1.0-exp(-col*uGlow);
  float gray=dot(col,vec3(0.2126,0.7152,0.0722)); col=max(mix(vec3(gray),col,uSaturation),0.0);
  float lum=max(max(col.r,col.g),col.b); float alpha=clamp(lum,0.0,1.0)*uOpacity;
  fragColor=vec4(col*uOpacity,alpha);
}`;

/* ---------------- Aurora ---------------- */
const AURORA_FRAG = `#version 300 es
precision highp float;
uniform float uTime; uniform float uAmplitude; uniform vec3 uColorStops[3]; uniform vec2 uResolution; uniform float uBlend;
out vec4 fragColor;
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x,289.0); }
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod(i,289.0);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw; return 130.0*dot(m,g);
}
struct ColorStop{ vec3 color; float position; };
#define RAMP(colors,factor,final){ int idx=0; for(int i=0;i<2;i++){ ColorStop c=colors[i]; bool b=c.position<=factor; idx=int(mix(float(idx),float(i),float(b))); } ColorStop cc=colors[idx]; ColorStop nc=colors[idx+1]; float r=nc.position-cc.position; float lf=(factor-cc.position)/r; final=mix(cc.color,nc.color,lf); }
void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  ColorStop colors[3]; colors[0]=ColorStop(uColorStops[0],0.0); colors[1]=ColorStop(uColorStops[1],0.5); colors[2]=ColorStop(uColorStops[2],1.0);
  vec3 ramp; RAMP(colors,uv.x,ramp);
  float height=snoise(vec2(uv.x*2.0+uTime*0.1,uTime*0.25))*0.5*uAmplitude; height=exp(height); height=(uv.y*2.0-height+0.2);
  float intensity=0.6*height; float mid=0.20;
  float a=smoothstep(mid-uBlend*0.5,mid+uBlend*0.5,intensity);
  vec3 c=intensity*ramp; fragColor=vec4(c*a,a);
}`;

function pad(colors){
  const filled = colors && colors.length ? colors : ['#ffffff'];
  const out = [];
  for(let i=0;i<MAX_COLORS;i++){ const c=new Color(filled[i] ?? filled[filled.length-1]); out.push([c.r,c.g,c.b]); }
  return out;
}

function mountGL(ctn, frag, uniforms, onFrame){
  const renderer = new Renderer({ alpha:true, premultipliedAlpha:true, antialias:true });
  const gl = renderer.gl;
  gl.clearColor(0,0,0,0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.backgroundColor='transparent';
  const geometry = new Triangle(gl);
  if(geometry.attributes.uv) delete geometry.attributes.uv;
  const program = new Program(gl, { vertex:VERT, fragment:frag, uniforms });
  const mesh = new Mesh(gl, { geometry, program });
  ctn.appendChild(gl.canvas);
  const resize = ()=>{ const w=ctn.offsetWidth,h=ctn.offsetHeight; renderer.setSize(w,h); program.uniforms.uResolution.value=[w,h]; };
  window.addEventListener('resize', resize); resize();
  let raf=0, visible=true;
  const io = new IntersectionObserver(([e])=>{ visible=e.isIntersecting; }, { threshold:0 });
  io.observe(ctn);
  const loop = t => { raf=requestAnimationFrame(loop); if(!visible) return; onFrame(program, t); renderer.render({ scene:mesh }); };
  raf=requestAnimationFrame(loop);
}

function initStrands(ctn){
  const o = { colors:['#F97316','#db6767','#ffffff'], count:3, speed:0.5, amplitude:1, waviness:1,
    thickness:0.7, glow:2.6, taper:2.4, spread:1, hueShift:0, intensity:0.6, saturation:1.7, opacity:1, scale:1.85 };
  mountGL(ctn, STRANDS_FRAG, {
    uTime:{value:0}, uResolution:{value:[1,1]},
    uColors:{value:pad(o.colors)}, uColorCount:{value:Math.min(o.colors.length,MAX_COLORS)}, uStrandCount:{value:Math.min(o.count,MAX_STRANDS)},
    uSpeed:{value:o.speed}, uAmplitude:{value:o.amplitude}, uWaviness:{value:o.waviness}, uThickness:{value:o.thickness},
    uGlow:{value:o.glow}, uTaper:{value:o.taper}, uSpread:{value:o.spread}, uHueShift:{value:o.hueShift},
    uIntensity:{value:o.intensity}, uOpacity:{value:o.opacity}, uScale:{value:o.scale}, uSaturation:{value:o.saturation}
  }, (p,t)=>{ p.uniforms.uTime.value = t*0.001; });
}

function initAurora(ctn){
  const stops = ['#F97316','#EAB308','#F97316'].map(h=>{ const c=new Color(h); return [c.r,c.g,c.b]; });
  mountGL(ctn, AURORA_FRAG, {
    uTime:{value:0}, uAmplitude:{value:1.0}, uColorStops:{value:stops}, uResolution:{value:[1,1]}, uBlend:{value:0.48}
  }, (p,t)=>{ p.uniforms.uTime.value = (t*0.01)*0.75*0.1; });  // 0.75 = 50% faster than original 0.5
}

/* ---------------- DOM behaviors ---------------- */
function init(){
  const strands = document.getElementById('strands'); if(strands) initStrands(strands);
  const aurora = document.getElementById('aurora'); if(aurora) initAurora(aurora);

  // scroll reveal
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // glow-card cursor tracking
  document.querySelectorAll('[data-glow]').forEach(card=>{
    card.addEventListener('pointermove', e=>{
      const r=card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX-r.left}px`);
      card.style.setProperty('--my', `${e.clientY-r.top}px`);
    });
  });

  // nav scrolled state
  const nav = document.getElementById('nav');
  const onScroll = ()=>{ nav.classList.toggle('scrolled', window.scrollY>40); };
  window.addEventListener('scroll', onScroll, { passive:true }); onScroll();

  // privacy modal — horizontal slide in (power3.out), reverse on close
  const modal = document.getElementById('privacyModal');
  if(modal){
    const card = modal.querySelector('.modal__card');
    const overlay = modal.querySelector('.modal__overlay');
    // the policy text comes straight from privacy.html (the page the App Store links to), so the popup can't drift from it
    const body = modal.querySelector('.modal__body');
    fetch('privacy.html').then(r=> r.ok ? r.text() : Promise.reject(r.status)).then(html=>{
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('footer, script').forEach(n=> n.remove());
      doc.querySelectorAll('a[href^="http"]').forEach(a=>{ a.target = '_blank'; a.rel = 'noopener'; });
      body.innerHTML = doc.body.innerHTML;
    }).catch(()=>{});   // on failure the fallback link to privacy.html stays
    const EASE = 'cubic-bezier(0.16,1,0.3,1)';   // ≈ GSAP power3.out
    const DUR = 760, DIST = 150;
    let busy = false;
    const open = ()=>{
      if(busy) return; busy = true;
      modal.hidden = false; document.body.style.overflow = 'hidden';
      overlay.animate([{opacity:0},{opacity:1}], {duration:DUR, easing:EASE, fill:'both'});
      const a = card.animate([{opacity:0, transform:`translateX(${DIST}px)`},{opacity:1, transform:'translateX(0)'}],
        {duration:DUR, easing:EASE, fill:'both'});
      a.onfinish = ()=>{ busy = false; };
    };
    const close = ()=>{
      if(busy) return; busy = true;
      overlay.animate([{opacity:1},{opacity:0}], {duration:DUR, easing:EASE, fill:'both'});
      const a = card.animate([{opacity:1, transform:'translateX(0)'},{opacity:0, transform:`translateX(${DIST}px)`}],
        {duration:DUR, easing:EASE, fill:'both'});
      a.onfinish = ()=>{ modal.hidden = true; document.body.style.overflow = ''; busy = false; };
    };
    document.querySelectorAll('.js-privacy').forEach(b=> b.addEventListener('click', e=>{ e.preventDefault(); open(); }));
    modal.querySelectorAll('[data-close]').forEach(el=> el.addEventListener('click', close));
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !modal.hidden) close(); });
  }

  // one continuous soft glide — eases in AND out, duration scales with distance (never a jump, never abrupt)
  const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  let scrollRAF = 0;
  function softScrollTo(targetY){
    if(scrollRAF) cancelAnimationFrame(scrollRAF);
    const startY = window.scrollY, diff = targetY - startY;
    if(Math.abs(diff) < 2) return;
    const dur = Math.max(650, Math.min(2200, Math.abs(diff) / 4));   // long trips stay smooth, short ones quick
    let start;
    function step(ts){ if(start===undefined) start = ts; const t = Math.min((ts - start)/dur, 1);
      window.scrollTo(0, startY + diff * easeInOut(t)); if(t < 1) scrollRAF = requestAnimationFrame(step); else scrollRAF = 0; }
    scrollRAF = requestAnimationFrame(step);
  }
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const id = a.getAttribute('href');
      if(!id || id === '#') return;                 // skip modal/no-op anchors
      const el = document.querySelector(id);
      if(!el) return;
      e.preventDefault();
      const reel = document.querySelector('#showcase .reel');
      const rt = window.ScrollTrigger && window.ScrollTrigger.getAll().find(t=>t.pin && t.trigger===reel);
      const headerTop = Math.min(108, Math.max(74, window.innerHeight * 0.10));   // matches the reel's header height
      let target;
      if(id === '#showcase' && rt){
        const n = document.querySelectorAll('#showcase .reel__shot').length || 6;
        target = Math.round(rt.start + (rt.end - rt.start) / n);    // exactly the first snap point: only the first image shows
      } else {
        const head = el.querySelector('.kicker') || el;            // land each section's heading at the same top height
        target = Math.max(0, head.getBoundingClientRect().top + window.scrollY - headerTop);
      }
      softScrollTo(target);                                          // one smooth glide from wherever you are now
    });
  });

  // cursor-following warm sun glow on primary buttons
  document.querySelectorAll('.btn--sun').forEach(btn=>{
    btn.addEventListener('pointermove', e=>{
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--bx', `${e.clientX - r.left}px`);
      btn.style.setProperty('--by', `${e.clientY - r.top}px`);
    });
  });
}

if(document.readyState!=='loading') init();
else document.addEventListener('DOMContentLoaded', init);

/* ---------------- ScrollFloat (per-character float-in on scroll) ---------------- */
function initScrollFloat(){
  const g = window.gsap, ST = window.ScrollTrigger;
  if(!g || !ST) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  g.registerPlugin(ST);
  document.querySelectorAll('.section__title, .get__title').forEach(el=>{
    if(el.dataset.sf) return; el.dataset.sf = '1';
    const nodes = Array.from(el.childNodes);
    el.textContent = '';
    const chars = [];
    nodes.forEach(node=>{
      if(node.nodeType === 3){ // text -> words -> chars (keep spaces for wrapping)
        node.textContent.split(/(\s+)/).forEach(part=>{
          if(part === '') return;
          if(/^\s+$/.test(part)){ el.appendChild(document.createTextNode(part)); return; }
          const word = document.createElement('span'); word.className = 'sf-word';
          Array.from(part).forEach(ch=>{
            const c = document.createElement('span'); c.className = 'sf-char'; c.textContent = ch;
            word.appendChild(c); chars.push(c);
          });
          el.appendChild(word);
        });
      } else if(node.nodeType === 1){ // keep element children (e.g. glowing emoticons) as one animated unit
        node.classList.add('sf-char'); el.appendChild(node); chars.push(node);
      } else { el.appendChild(node); }
    });
    if(!chars.length) return;
    // the "what it is" title gets a longer, gentler reveal so it doesn't feel rushed on the way in
    const slow = el.closest('#what');
    g.fromTo(chars,
      { opacity:0, yPercent:120, scaleY:2.3, scaleX:0.7, transformOrigin:'50% 0%' },
      { opacity:1, yPercent:0, scaleY:1, scaleX:1, ease:'back.inOut(2)', stagger: slow ? 0.06 : 0.03,
        scrollTrigger:{ trigger:el, start:'top bottom-=6%',
          end: slow ? 'bottom top+=30%' : 'bottom center+=6%',
          scrub: slow ? 2.6 : 1.4 } });
  });
}
if(document.readyState!=='loading') initScrollFloat();
else document.addEventListener('DOMContentLoaded', initScrollFloat);

/* ---------------- ScrollMotion — fluid float-in for all content below the hero (not the orange kickers) ---------------- */
function initScrollMotion(){
  const g = window.gsap, ST = window.ScrollTrigger;
  if(!g || !ST) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  g.registerPlugin(ST);
  // hand below-hero content to GSAP; drop the old one-shot reveal so it doesn't fight the scrub
  document.querySelectorAll('#what .reveal, #showcase .reveal, #story .reveal, #get .reveal, .footer .reveal')
    .forEach(el => el.classList.remove('reveal','in'));
  const sel = [
    '#what .lead', '#what .glow-card', '#what .feats-more',
    '#story .lead',
    '#get .get__icon', '#get .get__cta', '#get .fineprint', '#get .thanks',
    '.footer__inner'
  ].join(',');
  document.querySelectorAll(sel).forEach(el=>{
    el.style.transition = 'none';
    g.fromTo(el, { opacity:0, y:50 }, { opacity:1, y:0, ease:'power2.out',
      scrollTrigger:{ trigger:el, start:'top bottom-=4%', end:'top center+=14%', scrub:1.5 } });
  });
}
if(document.readyState!=='loading') initScrollMotion();
else document.addEventListener('DOMContentLoaded', initScrollMotion);

/* ---------------- Reel — pinned diagonal screenshot reveal (one at a time on scroll) ---------------- */
function initReel(){
  const g = window.gsap, ST = window.ScrollTrigger;
  if(!g || !ST) return;
  const stage = document.querySelector('#showcase .reel__stage');
  if(!stage) return;
  const cards = g.utils.toArray('#showcase .reel__card');
  if(!cards.length) return;
  stage.style.setProperty('--n', cards.length);   // the staircase layout centres on however many screenshots there are
  const hint = document.querySelector('#showcase .reel__hint');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ g.set(cards,{opacity:1}); if(hint) hint.style.display='none'; return; }
  g.registerPlugin(ST);
  g.set(cards, { opacity:0, y:52, scale:0.95 });
  // tap the front screenshot to enlarge it for reading (not full screen); scrolling, a second tap, or Esc shrinks it back
  let zoomed = null, zoomY = 0;
  const nav = document.getElementById('nav');
  function unzoom(){
    if(!zoomed) return;
    const shot = zoomed; zoomed = null;
    shot.classList.remove('is-zoomed'); shot.classList.add('is-settling');   // stays on top while it shrinks back
    stage.classList.remove('has-zoom');
    const done = e=>{ if(e && (e.target !== shot || e.propertyName !== 'transform')) return;
      shot.classList.remove('is-settling'); shot.removeEventListener('transitionend', done); };
    shot.addEventListener('transitionend', done); setTimeout(done, 700);
  }
  function zoom(shot){
    const r = shot.getBoundingClientRect(), s = stage.getBoundingClientRect();
    const top = (nav ? nav.getBoundingClientRect().bottom : 0) + 20, bottom = window.innerHeight - 20;
    const scale = Math.min((bottom - top) / r.height, 1.5);
    if(scale < 1.05) return;                                          // no room to grow on this screen
    shot.style.setProperty('--zx', (s.left + s.width / 2) - (r.left + r.width / 2) + 'px');
    shot.style.setProperty('--zy', (top + bottom) / 2 - (r.top + r.height / 2) + 'px');
    shot.style.setProperty('--zs', scale);
    shot.classList.remove('is-settling'); shot.classList.add('is-zoomed'); stage.classList.add('has-zoom');
    zoomed = shot; zoomY = window.scrollY;
  }
  cards.forEach(c=> c.addEventListener('click', ()=>{
    if(zoomed === c.parentElement) unzoom();
    else if(parseFloat(getComputedStyle(c).opacity) > 0.5){ unzoom(); zoom(c.parentElement); }   // any visible image, front or back
  }));
  window.addEventListener('scroll', ()=>{ if(zoomed && Math.abs(window.scrollY - zoomY) > 24) unzoom(); }, { passive:true });
  window.addEventListener('resize', unzoom);
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') unzoom(); });
  document.addEventListener('click', e=>{ if(zoomed && !zoomed.contains(e.target)) unzoom(); });
  let lastActive = -1;
  const setFront = p => {
    // front = the card currently revealing / most recently fully shown (aligns with snap points)
    const active = Math.max(0, Math.min(cards.length-1, Math.round(p * cards.length) - 1));
    cards.forEach((c,i)=>{
      c.classList.toggle('is-front', i===active);   // newest revealed: bright + glow
      c.classList.toggle('is-behind', i<active);    // already covered: dim back
      c.classList.toggle('is-ahead', i>active);     // not revealed yet: taps pass through to the images below
    });
    if(active !== lastActive){ lastActive = active; unzoom(); }   // the reel moved to another image: shrink back
    if(hint) hint.style.opacity = String(Math.max(0, Math.min(1, (1 - p) * 4)));   // stays until the last images, then fades
  };
  const tl = g.timeline({ scrollTrigger:{
    trigger:'#showcase .reel', start:'top top', end:'+=' + (cards.length*150) + '%',
    pin:stage, pinSpacing:true, anticipatePin:1, scrub:1,
    // inertia:false: snap from where the scroll actually stopped. With inertia on, the lagging scrub reads as leftover
    // velocity after a nav glide and pushes the landing one image too far (two images from above, none from below).
    snap:{ snapTo:1/cards.length, duration:{min:0.35,max:0.7}, delay:0.02, ease:'power2.inOut', inertia:false },
    onUpdate:self=>setFront(self.progress) } });
  cards.forEach((c,i)=> tl.to(c, { opacity:1, y:0, scale:1, ease:'power2.out', duration:1 }, i));
  setFront(0);
  window.__sundialReelTL = tl;   // exposed for debugging the reel from the console
}
if(document.readyState!=='loading') initReel();
else document.addEventListener('DOMContentLoaded', initReel);

/* ---------------- Feature peeks: hover a feature card to fade in a real screenshot of that feature ---------------- */
function initFeaturePeeks(){
  const cards = [...document.querySelectorAll('#what .glow-card[data-peek]')];
  if(!cards.length) return;
  const peek = document.createElement('div');
  peek.className = 'feat-peek'; peek.setAttribute('aria-hidden', 'true');
  document.body.appendChild(peek);
  const list = card => card.dataset.peek.trim().split(/\s+/);
  let current = null, cycle = 0;

  function build(card){
    peek.textContent = '';
    peek.classList.toggle('is-tall', card.hasAttribute('data-peek-tall'));
    peek.classList.toggle('is-wide', card.hasAttribute('data-peek-wide'));
    list(card).forEach(src=>{
      const isVideo = src.endsWith('.mp4');
      const el = document.createElement(isVideo ? 'video' : 'img');
      el.className = 'feat-peek__item';
      if(isVideo){ el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto'; if(card.dataset.poster) el.poster = card.dataset.poster; }
      else el.alt = '';
      el.src = src;
      peek.appendChild(el);
    });
  }
  function showItem(i){
    [...peek.children].forEach((el, k)=>{
      el.classList.toggle('is-shown', k === i);
      if(el.tagName === 'VIDEO'){ if(k === i){ el.currentTime = 0; el.play().catch(()=>{}); } else el.pause(); }
    });
  }
  function place(card){
    peek.style.height = '';
    const r = card.getBoundingClientRect(), w = peek.offsetWidth, gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    let h = peek.offsetHeight;
    const nav = document.getElementById('nav');
    const safeTop = (nav ? nav.getBoundingClientRect().bottom : 0) + 8;
    const above = r.top - gap - safeTop, below = vh - 8 - r.bottom - gap;
    const right = vw - 8 - r.right - gap, left = r.left - 8 - gap;
    // above the card if it fits, else below, else beside it (tall shots on short screens), else shrink to the roomier side
    const mode = above >= h ? 'above' : below >= h ? 'below' : Math.max(right, left) >= w ? 'side' : (above >= below ? 'above' : 'below');
    if(mode !== 'side' && Math.max(above, below) < h){ h = Math.max(200, Math.max(above, below)); peek.style.height = h + 'px'; }
    let x, y;
    if(mode === 'side'){ x = right >= w ? r.right + gap : r.left - w - gap; y = r.top + r.height / 2 - h / 2; }
    else { x = r.left + r.width / 2 - w / 2; y = mode === 'above' ? r.top - h - gap : r.bottom + gap; }
    x = Math.max(8, Math.min(x, vw - w - 8));
    y = Math.max(safeTop, Math.min(y, vh - h - 8));                                               // always fully on screen
    peek.style.left = x + window.scrollX + 'px';
    peek.style.top = y + window.scrollY + 'px';
    peek.classList.toggle('is-below', mode === 'below');
    peek.classList.toggle('is-side', mode === 'side');
  }
  function open(card){
    clearInterval(cycle);
    if(current !== card){ current = card; build(card); }
    place(card); showItem(0);
    peek.classList.add('is-on');
    const n = peek.children.length;
    if(n > 1){ let i = 0; cycle = setInterval(()=>{ i = (i + 1) % n; showItem(i); }, 2600); }   // several shots: slowly cross-fade through them
  }
  function close(){
    clearInterval(cycle);
    peek.classList.remove('is-on');
    peek.querySelectorAll('video').forEach(v=> v.pause());
  }

  const hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  cards.forEach(card=>{
    if(hover){
      card.addEventListener('mouseenter', ()=> open(card));
      card.addEventListener('mouseleave', close);
    } else {
      card.addEventListener('click', ()=> (current === card && peek.classList.contains('is-on')) ? close() : open(card));   // touch: tap a card to peek
    }
  });
  if(!hover) window.addEventListener('scroll', ()=>{ if(peek.classList.contains('is-on')) close(); }, { passive:true });
  window.addEventListener('resize', close);

  // warm the image cache as the section approaches, so the first hover fades in right away
  const io = new IntersectionObserver(entries=>{
    if(!entries.some(e=> e.isIntersecting)) return;
    io.disconnect();
    cards.forEach(card=>{
      list(card).filter(src=> !src.endsWith('.mp4')).forEach(src=>{ new Image().src = src; });
      if(card.dataset.poster) new Image().src = card.dataset.poster;
    });
  }, { rootMargin:'600px 0px' });
  io.observe(document.getElementById('what'));
}
if(document.readyState!=='loading') initFeaturePeeks();
else document.addEventListener('DOMContentLoaded', initFeaturePeeks);

