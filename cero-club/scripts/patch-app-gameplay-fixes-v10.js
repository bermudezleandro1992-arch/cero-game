#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 280));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Callable sendMatchChat ─────────────────────────────────────────────────────
apply(
  'chat-callable-helper',
  'function M0f(){return M0a??(M0a=or(ur,"temporaryLeaveMatch"))}',
  'function M0f(){return M0a??(M0a=or(ur,"temporaryLeaveMatch"))}function M0ChatFn(){return M0chatFn??(M0chatFn=or(ur,"sendMatchChat"))}let M0chatFn=null',
);

const oldLkSend = `const h=ie.useCallback(async g=>{var k,F;const _=(g??"").trim().slice(0,Hy),w=(k=Xn.currentUser)==null?void 0:k.uid,T=((F=Xn.currentUser)==null?void 0:F.displayName)??"Jugador";if(!(!w||!r||!_||s)){o(!0);try{await Uy(za(br,"matches",r,"chat"),{uid:w,name:T,type:"text",text:_,createdAt:$d()});return!0}catch(err){console.error("[chat]",err);return!1}finally{o(!1)}}},[r,s]),f=ie.useCallback(async g=>{var T,k;const _=(T=Xn.currentUser)==null?void 0:T.uid,w=((k=Xn.currentUser)==null?void 0:k.displayName)??"Jugador";if(!(!_||!r))try{await Uy(za(br,"matches",r,"chat"),{uid:_,name:w,type:"reaction",text:g,createdAt:$d()})}catch{}},[r]);const u=ie.useCallback(async g=>{var T,k;const _=(T=Xn.currentUser)==null?void 0:T.uid,w=((k=Xn.currentUser)==null?void 0:k.displayName)??"Jugador";if(!(!_||!r)){try{await Uy(za(br,"matches",r,"chat"),{uid:_,name:w,type:"projectile",text:g,createdAt:$d()});return!0}catch(err){console.error("[projectile]",err);return!1}}},[r]);`;

const newLkSend = `const h=ie.useCallback(async g=>{const _=(g??"").trim().slice(0,Hy);if(!r||!_||s)return!1;o(!0);try{await Rc(M0ChatFn(),{matchId:r,type:"text",text:_});return!0}catch(err){console.error("[chat]",err);return!1}finally{o(!1)}},[r,s]),f=ie.useCallback(async g=>{if(!r||!g)return;try{await Rc(M0ChatFn(),{matchId:r,type:"reaction",text:g})}catch(err){console.error("[chat-reaction]",err)}},[r]);const u=ie.useCallback(async g=>{if(!r||!g)return!1;try{await Rc(M0ChatFn(),{matchId:r,type:"projectile",text:g});return!0}catch(err){console.error("[projectile]",err);return!1}},[r]);`;

apply('lk-use-sendMatchChat', oldLkSend, newLkSend);

apply(
  'lk-chat-listener-errors',
  't(w.docs.map(T=>({id:T.id,...T.data()})))},()=>{});return l.current=_,()=>_()},[r]);',
  't(w.docs.map(T=>({id:T.id,...T.data()})))},err=>{console.error("[chat-listener]",err)});return l.current=_,()=>_()},[r]);',
);

// ── Proyectil: animación de impacto (splat) en el rival ───────────────────────
const oldProjectile = 'function M0Projectile({emoji:r,onDone:e}){const[t,s]=ie.useState({x:window.innerWidth-48,y:window.innerHeight-80});ie.useEffect(()=>{const o=setTimeout(()=>{s({x:window.innerWidth/2,y:120})},40);return()=>clearTimeout(o)},[]);ie.useEffect(()=>{const l=setTimeout(()=>e==null?void 0:e(),900);return()=>clearTimeout(l)},[e]);return I.jsx("div",{className:"fixed z-[60] pointer-events-none text-4xl transition-all duration-[600ms] ease-in",style:{left:t.x,top:t.y,transform:"translate(-50%,-50%)"},children:r})}';

const newProjectile = `function M0Projectile({emoji:r,onDone:e,targetY:t=112}){const[s,setS]=ie.useState("fly");const[o,l]=ie.useState(()=>({x:Math.min(window.innerWidth-40,window.innerWidth*.84),y:Math.min(window.innerHeight-60,window.innerHeight*.76)}));ie.useEffect(()=>{const id=requestAnimationFrame(()=>{l({x:window.innerWidth/2,y:t}),setS("hit")});return()=>cancelAnimationFrame(id)},[t]);ie.useEffect(()=>{const a=setTimeout(()=>setS("fade"),560),b=setTimeout(()=>e==null?void 0:e(),980);return()=>{clearTimeout(a),clearTimeout(b)}},[e]);const h=s==="hit",f=s==="fade";return I.jsxs("div",{className:"fixed z-[80] pointer-events-none",style:{left:o.x,top:o.y,transform:"translate(-50%,-50%) scale("+(h?"2.2":"1")+")",opacity:f?0:1,transition:s==="fly"?"left .5s cubic-bezier(.25,.9,.35,1), top .5s cubic-bezier(.25,.9,.35,1), transform .15s ease-out, opacity .25s":"transform .15s ease-out, opacity .25s",fontSize:"2.75rem",lineHeight:1,filter:h?"drop-shadow(0 0 16px rgba(239,68,68,.9))":undefined},children:[r,h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"5rem",height:"5rem",transform:"translate(-50%,-50%)",borderRadius:"50%",background:"radial-gradient(circle,rgba(239,68,68,.55) 0%,rgba(245,158,11,.25) 42%,transparent 70%)",pointerEvents:"none"}}),h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"7rem",height:"7rem",transform:"translate(-50%,-50%)",borderRadius:"50%",border:"3px solid rgba(239,68,68,.35)",pointerEvents:"none",animation:"M0splatRing .45s ease-out forwards"},className:"M0splatRing"})]})}`;

apply('projectile-splat-v10', oldProjectile, newProjectile);

apply(
  'projectile-local-first',
  'onClick:async()=>{M0resumeAudio();M0playProjectile();const ok=await le(P);!ok&&we("❌")}',
  'onClick:async()=>{M0resumeAudio();M0playProjectile();we(P);le(P).catch(()=>{})}',
);

// ── Cosméticos mesa/fondo: usar imágenes SVG además del gradiente ─────────────
apply(
  'table-style-with-image',
  'function M0tableStyle(id){return M0TABLE_BG[id]||{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #1c0f3a 0%, #080318 100%)",border:"3px solid rgba(124,58,237,.4)",boxShadow:"0 0 60px rgba(124,58,237,.2)"}}',
  'function M0tableStyle(id){const b=M0TABLE_BG[id]||{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #1c0f3a 0%, #080318 100%)",border:"3px solid rgba(124,58,237,.4)",boxShadow:"0 0 60px rgba(124,58,237,.2)"};const img=M0COS_IMG[id];return img?{...b,backgroundImage:"url("+img+"), "+(b.background||""),backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",border:b.border||"3px solid rgba(124,58,237,.5)",boxShadow:(b.boxShadow||"")+", inset 0 0 40px rgba(0,0,0,.35)"}:b}',
);

apply(
  'room-style-with-image',
  'function M0roomStyle(id){return M0ROOM_BG[id]||"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"}',
  'function M0roomStyle(id){const g=M0ROOM_BG[id]||"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)";const img=M0COS_IMG[id];return img?g+", url("+img+") center/cover no-repeat":g}',
);

apply(
  'table-overlay-visible',
  'I.jsx("div",{className:"absolute inset-0 rounded-full pointer-events-none",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),',
  'I.jsx("div",{className:"absolute inset-[-8%] rounded-[50%] pointer-events-none opacity-95",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),',
);

// ── Sonidos MP3 (con fallback a beep) ─────────────────────────────────────────
apply(
  'mp3-sfx-system',
  'function M0resumeAudio(){try{M0snd??=new(window.AudioContext||window.webkitAudioContext);M0snd.state==="suspended"&&M0snd.resume()}catch{}}function M0beep(r,e=.08,t=440){',
  `const M0SFX={card:"/app/sounds/card.mp3",cero:"/app/sounds/cero.mp3",draw:"/app/sounds/draw.mp3",win:"/app/sounds/win.mp3",projectile:"/app/sounds/projectile.mp3",lose:"/app/sounds/lose.mp3"};const M0sfxCache={};function M0playSfx(r,e=.85){if(M0isMuted())return;const t=M0SFX[r];if(!t){return!1}try{M0resumeAudio();let s=M0sfxCache[r];s||(s=new Audio(t),s.preload="auto",M0sfxCache[r]=s);const o=s.cloneNode();o.volume=e,o.play().catch(()=>{});return!0}catch{return!1}}function M0resumeAudio(){try{M0snd??=new(window.AudioContext||window.webkitAudioContext);M0snd.state==="suspended"&&M0snd.resume()}catch{}}function M0beep(r,e=.08,t=440){`,
);

apply(
  'sfx-play-card',
  'function M0playCero(){M0beep(.12,.18,880),setTimeout(()=>M0beep(.1,.14,1175),90)}',
  'function M0playCero(){M0playSfx("cero")||M0beep(.12,.18,880),setTimeout(()=>M0playSfx("cero")||M0beep(.1,.14,1175),90)}',
);

apply(
  'sfx-play-draw',
  'function M0playDraw(){M0beep(.06,.06,520)}',
  'function M0playDraw(){M0playSfx("draw")||M0beep(.06,.06,520)}',
);

apply(
  'sfx-play-card2',
  'function M0playCard(){M0beep(.05,.05,660)}',
  'function M0playCard(){M0playSfx("card")||M0beep(.05,.05,660)}',
);

apply(
  'sfx-play-win',
  'function M0playWin(){M0beep(.15,.12,880),setTimeout(()=>M0beep(.12,.1,1175),100),setTimeout(()=>M0beep(.1,.15,1480),220)}',
  'function M0playWin(){if(!M0playSfx("win")){M0beep(.15,.12,880),setTimeout(()=>M0beep(.12,.1,1175),100),setTimeout(()=>M0beep(.1,.15,1480),220)}}',
);

apply(
  'sfx-play-lose',
  'function M0playLose(){M0beep(.08,.2,220)}',
  'function M0playLose(){M0playSfx("lose")||M0beep(.08,.2,220)}',
);

apply(
  'sfx-play-projectile',
  'function M0playProjectile(){M0beep(.07,.05,520),setTimeout(()=>M0beep(.05,.04,780),70)}',
  'function M0playProjectile(){M0playSfx("projectile")||(M0beep(.07,.05,520),setTimeout(()=>M0beep(.05,.04,780),70))}',
);

fs.writeFileSync(bundlePath, s);
console.log('Gameplay fixes v10 applied.');
