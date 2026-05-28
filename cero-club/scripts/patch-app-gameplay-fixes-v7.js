#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 240));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Audio: reanudar AudioContext tras gesto del usuario + toggle mute con estado React ──
apply(
  'audio-resume',
  'function M0beep(r,e=.08,t=440){if(M0isMuted())return;try{M0snd??=new(window.AudioContext||window.webkitAudioContext);const s=M0snd,o=s.createOscillator()',
  'function M0resumeAudio(){try{M0snd??=new(window.AudioContext||window.webkitAudioContext);M0snd.state==="suspended"&&M0snd.resume()}catch{}}function M0beep(r,e=.08,t=440){if(M0isMuted())return;try{M0snd??=new(window.AudioContext||window.webkitAudioContext);M0snd.state==="suspended"&&M0snd.resume();const s=M0snd,o=s.createOscillator()',
);

apply(
  'vk-mute-state',
  'const[M0tu,M0tuDone]=ie.useState(()=>{try{return!localStorage.getItem("cero_tutorial_v2")}catch{return!1}}),M0left=ie.useRef(!1);',
  'const[M0tu,M0tuDone]=ie.useState(()=>{try{return!localStorage.getItem("cero_tutorial_v2")}catch{return!1}}),M0left=ie.useRef(!1);const[M0muted,setM0muted]=ie.useState(()=>M0isMuted());',
);

apply(
  'vk-mute-button',
  'onClick:()=>M0setMuted(!M0isMuted()),className:"shrink-0 px-2 py-1 rounded-lg text-[0.6rem] font-bold border border-violet-800/60 text-violet-400 hover:text-violet-200",title:"Silenciar sonidos",children:M0isMuted()?"🔇":"🔊"',
  'onClick:()=>{const v=!M0muted;M0setMuted(v);setM0muted(v);M0resumeAudio();v||M0beep(.04,.05,660)},className:"shrink-0 px-2 py-1 rounded-lg text-[0.6rem] font-bold border border-violet-800/60 text-violet-400 hover:text-violet-200",title:M0muted?"Activar sonido":"Silenciar sonidos",children:M0muted?"🔇":"🔊"',
);

// ── Última carta: hint si falta declarar CERO ───────────────────────────────────
apply(
  'pk-cero-hint',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o}){const[l,h]=ie.useState(null);ie.useEffect(()=>{h(null)},[r.length]);const f=ie.useCallback(_=>{if(!t||o)return;if(!e.has(_)){h(_),setTimeout(()=>h(T=>T===_?null:T),350);return}M0playCard(),s(_),h(null)},[t,o,e,s])',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o,mustDeclareCero:M0mc=false}){const[l,h]=ie.useState(null);const[M0hint,setM0hint]=ie.useState(null);ie.useEffect(()=>{h(null),setM0hint(null)},[r.length]);const f=ie.useCallback(_=>{if(!t||o)return;if(!e.has(_)){h(_);if(M0mc)setM0hint("¡Tocá CERO! antes de jugar la última carta"),setTimeout(()=>setM0hint(null),2200);setTimeout(()=>h(T=>T===_?null:T),350);return}M0resumeAudio(),M0playCard(),s(_),h(null)},[t,o,e,s,M0mc])',
);

apply(
  'pk-hint-render',
  'return I.jsx("div",{className:"flex items-end justify-center overflow-x-auto pb-2",style:{gap:"-20px"},children:g.map((_,w)=>{',
  'return I.jsxs("div",{className:"flex flex-col items-center gap-1 w-full",children:[M0hint&&I.jsx("p",{className:"text-[0.65rem] font-bold text-pink-300 animate-pulse px-3 py-1 rounded-full border border-pink-500/50 bg-pink-950/60",children:M0hint}),I.jsx("div",{className:"flex items-end justify-center overflow-x-auto pb-2 w-full",style:{gap:"-20px"},children:g.map((_,w)=>{',
);

apply(
  'pk-hint-close',
  'onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})}',
  'onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})]});}',
);

apply(
  'vk-pk-must-cero',
  'I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k})',
  'I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k,mustDeclareCero:t.mustDeclareCero})',
);

// ── Chat: panel fijo (no se recorta) + proyectiles rápidos + errores visibles ───
apply(
  'lk-chat-errors',
  'try{await Uy(za(br,"matches",r,"chat"),{uid:w,name:T,type:"text",text:_,createdAt:$d()})}finally{o(!1)}}},[r,s])',
  'try{await Uy(za(br,"matches",r,"chat"),{uid:w,name:T,type:"text",text:_,createdAt:$d()});return!0}catch(err){console.error("[chat]",err);return!1}finally{o(!1)}}},[r,s])',
);

apply(
  'lk-projectile-errors',
  'if(!(!_||!r))try{await Uy(za(br,"matches",r,"chat"),{uid:_,name:w,type:"projectile",text:g,createdAt:$d()})}catch{}},[r]);return{messages:e',
  'if(!(!_||!r)){try{await Uy(za(br,"matches",r,"chat"),{uid:_,name:w,type:"projectile",text:g,createdAt:$d()});return!0}catch(err){console.error("[projectile]",err);return!1}}},[r]);return{messages:e',
);

apply(
  'hk-chat-panel-fixed',
  'f&&I.jsxs("div",{className:"flex flex-col w-64 rounded-2xl border overflow-hidden",style:{background:"rgba(4,3,13,.95)",borderColor:"rgba(124,58,237,.35)",backdropFilter:"blur(10px)",boxShadow:"0 8px 32px rgba(0,0,0,.6)",maxHeight:"320px"}',
  'f&&I.jsxs("div",{className:(hkIn?"fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[55] ":"")+"flex flex-col w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border overflow-hidden",style:{background:"rgba(4,3,13,.97)",borderColor:"rgba(124,58,237,.45)",backdropFilter:"blur(12px)",boxShadow:"0 8px 32px rgba(0,0,0,.75)",maxHeight:"min(360px,55vh)"}',
);

apply(
  'hk-quick-projectiles',
  'I.jsxs("button",{type:"button",onClick:W,className:["relative flex items-center gap-2 px-3 py-2 rounded-full","font-bold text-xs border transition-all",f?"bg-violet-900/70 border-violet-500":"bg-[#0e0524]/90 border-violet-800/60 hover:border-violet-500"].join(" "),style:{boxShadow:"0 4px 16px rgba(0,0,0,.4)"},"aria-label":f?"Cerrar chat":"Abrir chat",children:[I.jsx("span",{className:"text-base",children:"💬"})',
  'hkIn&&!f&&I.jsx("div",{className:"flex items-center gap-1 mr-1",children:["🥧","🎂","💩","🍅","💣"].map(P=>I.jsx("button",{type:"button",onClick:async()=>{M0resumeAudio();M0playProjectile();const ok=await le(P);!ok&&we("❌")},className:"text-base hover:scale-125 active:scale-95 transition-transform px-0.5",title:"Enviar "+P,children:P},P))}),I.jsxs("button",{type:"button",onClick:W,className:["relative flex items-center gap-2 px-3 py-2 rounded-full","font-bold text-xs border transition-all",f?"bg-violet-900/70 border-violet-500":"bg-[#0e0524]/90 border-violet-800/60 hover:border-violet-500"].join(" "),style:{boxShadow:"0 4px 16px rgba(0,0,0,.4)"},"aria-label":f?"Cerrar chat":"Abrir chat",children:[I.jsx("span",{className:"text-base",children:"💬"})',
);

// ── Mesa 3D + fondos mejorados ─────────────────────────────────────────────────
apply(
  'room-bg-3d',
  'const M0ROOM_BG={bg_stadium:"radial-gradient(ellipse at 50% 30%, #1a5030 0%, #04030d 70%), repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 40px)",bg_beach:"radial-gradient(ellipse at 50% 10%, #2a6090 0%, #04030d 65%), linear-gradient(180deg,rgba(96,165,250,.08) 0%,transparent 40%)",bg_city:"radial-gradient(ellipse at 50% 20%, #3a1860 0%, #04030d 68%), repeating-linear-gradient(0deg,rgba(167,139,250,.04) 0 1px,transparent 1px 24px)",bg_football:"radial-gradient(ellipse at 50% 35%, #0d5028 0%, #04030d 72%), repeating-linear-gradient(0deg,rgba(74,222,128,.06) 0 48px,transparent 48px 96px)"};',
  'const M0ROOM_BG={bg_stadium:"radial-gradient(ellipse at 50% 18%, #1a6040 0%, #04030d 62%), repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 2px,transparent 2px 36px)",bg_beach:"radial-gradient(ellipse at 50% 8%, #3a7ab0 0%, #04030d 60%), linear-gradient(180deg,rgba(96,165,250,.12) 0%,transparent 45%)",bg_city:"radial-gradient(ellipse at 50% 15%, #4a2080 0%, #04030d 65%), repeating-linear-gradient(0deg,rgba(167,139,250,.06) 0 1px,transparent 1px 20px)",bg_football:"radial-gradient(ellipse at 50% 30%, #0f6030 0%, #04030d 68%), repeating-linear-gradient(0deg,rgba(74,222,128,.08) 0 40px,transparent 40px 80px)"};function M0Table3D(){return I.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none z-0",children:I.jsx("div",{className:"rounded-[50%] border border-violet-400/25",style:{width:"min(94vw,24rem)",height:"9rem",background:"radial-gradient(ellipse at 50% 28%, rgba(109,40,217,.55) 0%, rgba(30,10,60,.35) 45%, rgba(4,3,13,.15) 78%)",boxShadow:"0 18px 48px rgba(124,58,237,.35), inset 0 4px 28px rgba(196,181,253,.15), inset 0 -8px 20px rgba(0,0,0,.45)",transform:"perspective(520px) rotateX(14deg)"}})})}',
);

apply(
  'fk-table-3d',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s}){const o=(r==null?void 0:r.topDiscard)??null,l=(r==null?void 0:r.drawStack)??0;return I.jsxs("div",{className:"flex items-center justify-center gap-6",children:[',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s}){const o=(r==null?void 0:r.topDiscard)??null,l=(r==null?void 0:r.drawStack)??0;return I.jsxs("div",{className:"relative flex items-center justify-center gap-6 z-10",children:[I.jsx(M0Table3D,{}),',
);

fs.writeFileSync(bundlePath, s);
console.log('Gameplay fixes v7 applied.');
