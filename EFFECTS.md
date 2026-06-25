# Sundial site — effects reference (for porting)

Everything here is **vanilla HTML/CSS/JS**. Only the two WebGL effects (Strands, Aurora)
need a dependency: the `ogl` library, loaded from a CDN — no build step.

```js
import { Renderer, Program, Mesh, Color, Triangle } from 'https://esm.sh/ogl@1.0.11';
```

A few effects reference a shared easing variable:

```css
:root{ --ease: cubic-bezier(.22,.61,.36,1); }
```

---

## 1. Strands — glowing woven light (WebGL)

Animated glowing "strands" of light. Used as the hero background. **Needs `ogl`.**

**HTML**
```html
<div id="strands" style="position:absolute; inset:0;"></div>
```

**Shared WebGL helpers** (used by Strands *and* Aurora):
```js
const VERT = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

function pad(colors, MAX_COLORS){
  const filled = colors && colors.length ? colors : ['#ffffff'];
  const out = [];
  for(let i=0;i<MAX_COLORS;i++){ const c=new Color(filled[i] ?? filled[filled.length-1]); out.push([c.r,c.g,c.b]); }
  return out;
}

// Mounts a fullscreen shader into `ctn`, auto-resizes, and pauses when offscreen.
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
```

**Strands shader + init**
```js
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
  float env=pow(max(cos(uv.x*PI*1.3),0.0),uTaper);
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

function initStrands(ctn){
  const o = { colors:['#F97316','#db6767','#ffffff'], count:3, speed:0.5, amplitude:1, waviness:1,
    thickness:0.7, glow:2.6, taper:3, spread:1, hueShift:0, intensity:0.6, saturation:1.7, opacity:1, scale:1.5 };
  mountGL(ctn, STRANDS_FRAG, {
    uTime:{value:0}, uResolution:{value:[1,1]},
    uColors:{value:pad(o.colors,MAX_COLORS)}, uColorCount:{value:Math.min(o.colors.length,MAX_COLORS)}, uStrandCount:{value:Math.min(o.count,MAX_STRANDS)},
    uSpeed:{value:o.speed}, uAmplitude:{value:o.amplitude}, uWaviness:{value:o.waviness}, uThickness:{value:o.thickness},
    uGlow:{value:o.glow}, uTaper:{value:o.taper}, uSpread:{value:o.spread}, uHueShift:{value:o.hueShift},
    uIntensity:{value:o.intensity}, uOpacity:{value:o.opacity}, uScale:{value:o.scale}, uSaturation:{value:o.saturation}
  }, (p,t)=>{ p.uniforms.uTime.value = t*0.001; });
}
// initStrands(document.getElementById('strands'));
```
Tweak the look via the `o` object (colors, count, glow, speed, etc.).

---

## 2. Aurora — flowing gradient curtain (WebGL)

Soft animated aurora band. Used behind the "story" section. **Needs `ogl`** + the
shared `VERT` / `mountGL` from above.

**HTML**
```html
<div id="aurora" style="position:absolute; inset:0;"></div>
```

**Aurora shader + init**
```js
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

function initAurora(ctn){
  const stops = ['#F97316','#EAB308','#F97316'].map(h=>{ const c=new Color(h); return [c.r,c.g,c.b]; });
  mountGL(ctn, AURORA_FRAG, {
    uTime:{value:0}, uAmplitude:{value:1.0}, uColorStops:{value:stops}, uResolution:{value:[1,1]}, uBlend:{value:0.48}
  }, (p,t)=>{ p.uniforms.uTime.value = (t*0.01)*0.5*0.1; });   // last 0.5 = speed
}
// initAurora(document.getElementById('aurora'));
```

---

## 3. Scroll-reveal (fade + rise on enter) — no deps

**CSS**
```css
.reveal{ opacity:0; transform:translateY(34px); transition:opacity .9s var(--ease), transform .9s var(--ease); }
.reveal.in{ opacity:1; transform:none; }
@media (prefers-reduced-motion:reduce){ .reveal{opacity:1;transform:none} }
```

**JS**
```js
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
```
Add `class="reveal"` to anything you want to animate in. Stagger with per-child
`transition-delay`.

---

## 4. Cursor-follow glow cards — no deps

A soft radial glow that tracks the cursor inside a card on hover.

**CSS**
```css
.glow-card{ position:relative; overflow:hidden; border-radius:24px; background:#fff; }
.glow-card::before{ content:""; position:absolute; width:300px; height:300px; border-radius:50%;
  background:radial-gradient(circle, rgba(242,185,92,.5), transparent 60%); filter:blur(30px);
  left:var(--mx,50%); top:var(--my,50%); transform:translate(-50%,-50%);
  opacity:0; transition:opacity .35s; pointer-events:none; }
.glow-card:hover::before{ opacity:1; }
.glow-card > *{ position:relative; z-index:1; }   /* keep content above the glow */
```

**JS**
```js
document.querySelectorAll('[data-glow]').forEach(card=>{
  card.addEventListener('pointermove', e=>{
    const r=card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX-r.left}px`);
    card.style.setProperty('--my', `${e.clientY-r.top}px`);
  });
});
```
Markup: `<article class="glow-card" data-glow>…</article>`.

---

## 5. Cursor sun-glow buttons — no deps

A warm "sunlight from the cursor" glow on a button. Wrap the label in a `<span>`.

**CSS**
```css
.btn--sun{ position:relative; overflow:hidden; isolation:isolate; }
.btn--sun > span{ position:relative; z-index:2; }
.btn--sun::after{ content:""; position:absolute; z-index:1; left:var(--bx,50%); top:var(--by,50%);
  width:180px; height:180px; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none;
  opacity:0; transition:opacity .4s var(--ease); mix-blend-mode:screen;
  background:radial-gradient(circle, rgba(255,248,228,.95) 0%, rgba(255,213,140,.6) 38%, rgba(255,180,90,0) 72%); }
.btn--sun:hover::after{ opacity:1; }
```

**JS**
```js
document.querySelectorAll('.btn--sun').forEach(btn=>{
  btn.addEventListener('pointermove', e=>{
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--bx', `${e.clientX - r.left}px`);
    btn.style.setProperty('--by', `${e.clientY - r.top}px`);
  });
});
```
Markup: `<a class="btn btn--sun"><span>Label</span></a>`.

---

## 6. Slow, eased anchor scrolling — no deps

Replaces the browser's instant jump with a ~1.5s glide. Set `html{scroll-behavior:auto}`
so it doesn't fight the native smooth-scroll.

```js
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
function slowScroll(targetY, dur){
  const startY = window.scrollY, diff = targetY - startY; let start;
  function step(ts){ if(start===undefined) start = ts; const t = Math.min((ts-start)/dur, 1);
    window.scrollTo(0, startY + diff * easeOutCubic(t)); if(t < 1) requestAnimationFrame(step); }
  requestAnimationFrame(step);
}
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const id = a.getAttribute('href');
    if(!id || id === '#') return;
    const el = document.querySelector(id); if(!el) return;
    e.preventDefault();
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 64); // 64 = sticky-nav offset
    slowScroll(y, 1500);
  });
});
```

---

## 7. Slide-in modal with reverse-on-close (Web Animations API) — no deps

Slides in horizontally (power3.out-style ease) and reverses out on ×, backdrop, or Esc.

**HTML**
```html
<button class="js-open">Open</button>
<div class="modal" id="modal" hidden>
  <div class="modal__overlay" data-close></div>
  <div class="modal__card" role="dialog" aria-modal="true">
    <button class="modal__close" data-close aria-label="Close">×</button>
    <!-- content -->
  </div>
</div>
```

**CSS**
```css
.modal{ position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:24px; }
.modal[hidden]{ display:none; }
.modal__overlay{ position:absolute; inset:0; background:rgba(20,12,8,.55); backdrop-filter:blur(6px); }
.modal__card{ position:relative; z-index:1; width:min(660px,100%); max-height:85vh; overflow:auto;
  background:#FBF4E6; border-radius:24px; padding:42px 40px; box-shadow:0 40px 100px rgba(0,0,0,.45);
  will-change:transform,opacity; }
.modal__close{ position:absolute; top:16px; right:16px; width:38px; height:38px; border:none; cursor:pointer;
  border-radius:50%; background:rgba(224,138,76,.16); font-size:22px; }
```

**JS**
```js
const modal = document.getElementById('modal');
const card = modal.querySelector('.modal__card');
const overlay = modal.querySelector('.modal__overlay');
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
document.querySelectorAll('.js-open').forEach(b=> b.addEventListener('click', e=>{ e.preventDefault(); open(); }));
modal.querySelectorAll('[data-close]').forEach(el=> el.addEventListener('click', close));
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !modal.hidden) close(); });
```

---

## 8. Frosted sticky nav (transparent → blurred on scroll) — no deps

**CSS**
```css
.nav{ position:fixed; inset:0 0 auto 0; z-index:50;
  transition:background .4s, backdrop-filter .4s, box-shadow .4s, padding .4s; }
.nav.scrolled{ background:rgba(251,244,230,.82); backdrop-filter:blur(14px) saturate(1.4);
  box-shadow:0 1px 0 rgba(90,69,52,.08); }
```

**JS**
```js
const nav = document.getElementById('nav');
const onScroll = ()=> nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive:true }); onScroll();
```

---

## 9. Infinite CSS marquee — no deps (pure CSS)

Duplicate the track's contents once so the `-50%` loop is seamless.

**HTML**
```html
<div class="marquee"><div class="marquee__track">
  <span>one</span><b>·</b><span>two</span><b>·</b>
  <span>one</span><b>·</b><span>two</span><b>·</b>   <!-- duplicate -->
</div></div>
```

**CSS**
```css
.marquee{ overflow:hidden; }
.marquee__track{ display:flex; gap:26px; align-items:center; white-space:nowrap; width:max-content;
  animation:marquee 28s linear infinite; }
@keyframes marquee{ to{ transform:translateX(-50%); } }
```

---

## 10. Scroll-hint dot — no deps (pure CSS)

```css
.scroll-hint{ position:absolute; bottom:26px; left:50%; transform:translateX(-50%);
  width:26px; height:42px; border:2px solid rgba(255,255,255,.3); border-radius:14px; }
.scroll-hint span{ position:absolute; top:8px; left:50%; width:4px; height:8px; background:#F2B95C;
  border-radius:2px; transform:translateX(-50%); animation:scrolldot 1.8s var(--ease) infinite; }
@keyframes scrolldot{
  0%{opacity:0;transform:translate(-50%,0)} 30%{opacity:1}
  80%{opacity:0;transform:translate(-50%,16px)} 100%{opacity:0} }
```
Markup: `<div class="scroll-hint"><span></span></div>`.

---

## 11. Themeable inline-SVG icon set — no deps (technique)

Replace emoji with custom, palette-matched icons. Define a hidden sprite once, then
reference symbols anywhere with `<use>`. Gradients defined in `<defs>` are shared.

```html
<!-- once, near top of <body> -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="g-sun" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F7D08A"/><stop offset="1" stop-color="#E07C3C"/>
  </linearGradient>
</defs>
  <symbol id="ic-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.6" fill="url(#g-sun)"/>
    <g stroke="#E07C3C" stroke-width="2" stroke-linecap="round">
      <line x1="12" y1="1.7" x2="12" y2="4.2"/><line x1="12" y1="19.8" x2="12" y2="22.3"/>
      <line x1="1.7" y1="12" x2="4.2" y2="12"/><line x1="19.8" y1="12" x2="22.3" y2="12"/>
      <line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/>
      <line x1="19.4" y1="4.6" x2="17.6" y2="6.4"/><line x1="6.4" y1="17.6" x2="4.6" y2="19.4"/>
    </g>
  </symbol>
  <!-- add more <symbol id="ic-…"> here -->
</svg>

<!-- use anywhere -->
<svg class="ic" style="width:24px;height:24px;vertical-align:middle"><use href="#ic-sun"/></svg>
```
The full Sundial set (sun, sunrise, clock, link/beam, lock, heart) lives in `index.html`.

---

### Quick dependency summary
| Effect | Dependency |
|---|---|
| Strands, Aurora | `ogl` (CDN) |
| Everything else (1 reveal, glow cards, sun buttons, slow scroll, modal, nav, marquee, scroll-hint, SVG icons) | none — vanilla |
