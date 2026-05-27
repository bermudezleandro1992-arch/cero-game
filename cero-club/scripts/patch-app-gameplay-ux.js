#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing snippet:', from.slice(0, 160));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Callables extra (rejoin expiry — nombres únicos, después del bloque wallet) ─
apply(
  'callable-rejoin-expiry',
  'async function M0N(r){return Rc(M0F(),r)}',
  `async function M0N(r){return Rc(M0F(),r)}
let M0rej=null;
function M0rejG(){return M0rej??(M0rej=or(ur,"checkMatchRejoinExpiry"))}
async function M0rejX(r){return Rc(M0rejG,{matchId:r})}`,
);

// ── Sonidos Web Audio ─────────────────────────────────────────────────────────
apply(
  'sounds-helper',
  'const wk=[{id:"home"',
  `let M0snd=null;
function M0beep(r,e=.08,t=440){try{M0snd??=new(window.AudioContext||window.webkitAudioContext);const s=M0snd,o=s.createOscillator(),g=s.createGain();o.type="sine",o.frequency.value=t,g.gain.value=r,g.gain.exponentialRampToValueAtTime(.001,s.currentTime+e),o.connect(g),g.connect(s.destination),o.start(),o.stop(s.currentTime+e)}catch{}}
function M0playCero(){M0beep(.12,.18,880),setTimeout(()=>M0beep(.1,.14,1175),90)}
function M0playDraw(){M0beep(.06,.06,520)}
function M0playCard(){M0beep(.05,.05,660)}
const M0cardHint=(r,e)=>{const t={skip:"Salta el turno del rival.",reverse:"Invierte el sentido del juego.",draw2:"+2: el rival roba dos cartas.",wild:"Comodín: elegís el color activo.",wild4:"+4: elegís color y el rival roba cuatro."};if(t[e])return t[e];if(/^[0-9]$/.test(e))return"Número "+e+": jugala si coincide color o número.";return"Carta "+e+" de color "+(r||"")+"."};
const wk=[{id:"home"`,
);

// ── Emojis chat + proyectiles ───────────────────────────────────────────────────
apply(
  'emoji-list',
  'ok=["👍","🎉","😤","🤝","⭐","🃏"]',
  'ok=["👍","🎉","😤","🤝","⭐","🃏","🥧","🎂","💩","🍅","💣","🔥","👊","😂","💀"]',
);

// ── lk: sendProjectile ────────────────────────────────────────────────────────
apply(
  'lk-projectile',
  'return{messages:e,sendMessage:h,sendReaction:f,sending:s,MAX_CHARS:Hy}}',
  `const u=ie.useCallback(async g=>{var T,k;const _=(T=Xn.currentUser)==null?void 0:T.uid,w=((k=Xn.currentUser)==null?void 0:k.displayName)??"Jugador";if(!(!_||!r))try{await Uy(za(br,"matches",r,"chat"),{uid:_,name:w,type:"projectile",text:g,createdAt:$d()})}catch{}},[r]);return{messages:e,sendMessage:h,sendReaction:f,sendProjectile:u,sending:s,MAX_CHARS:Hy}}`,
);

// ── Banner reconexión 5 min (ambos jugadores) ─────────────────────────────────
const rejoinBannerFn = 'function M0RejoinBanner({match:r,currentUid:e,stakeCC:t}){const[s,o]=ie.useState(Date.now());ie.useEffect(()=>{const h=setInterval(()=>o(Date.now()),500);return()=>clearInterval(h)},[]);const l=r==null?void 0:r.rejoinBanner,h=(r==null?void 0:r.absences)||{},f=l==null?void 0:l.rejoinUntil,g=f&&(f.toMillis?f.toMillis():f)||Object.values(h).map(_=>_.rejoinUntil&&(_.rejoinUntil.toMillis?_.rejoinUntil.toMillis():_.rejoinUntil)).filter(Boolean)[0];if(!g||g<=s)return null;const _=Math.max(0,Math.ceil((g-s)/1e3)),w=Math.floor(_/60),T=_%60,k=(l==null?void 0:l.absentName)||((r==null?void 0:r.players)||[]).find(F=>h[F.uid])?.name||"Rival",F=l==null?void 0:l.absentUid,K=F===e;return I.jsxs("div",{className:"mx-3 mt-2 p-4 rounded-2xl border-2 border-amber-500/70 bg-amber-950/80 text-center shadow-lg z-30",children:[I.jsx("p",{className:"text-xs font-bold text-amber-300 uppercase tracking-widest mb-1",children:K?"Te desconectaste — volvé pronto":"Jugador desconectado"}),I.jsxs("p",{className:"text-sm text-amber-100 mb-2",children:[I.jsx("span",{className:"font-black",children:k})," tiene ",I.jsxs("span",{className:"font-mono text-lg text-white",children:[w,":",String(T).padStart(2,"0")]})," para volver"]}),I.jsx("p",{className:"text-[0.65rem] text-amber-400/90",children:K?"Si no volvés a tiempo, perdés la partida.":t>0?"Si no vuelve, ganás "+t*2+" Cero Coins.":"Si no vuelve, ganás la partida."})]})}';

apply(
  'rejoin-banner-fn',
  'function hk({matchId:r,currentUid:e})',
  `${rejoinBannerFn}
function M0Projectile({emoji:r,onDone:e}){const[t,s]=ie.useState({x:window.innerWidth-48,y:window.innerHeight-80});ie.useEffect(()=>{const o=setTimeout(()=>{s({x:window.innerWidth/2,y:120})},40);return()=>clearTimeout(o)},[]);ie.useEffect(()=>{const l=setTimeout(()=>e==null?void 0:e(),900);return()=>clearTimeout(l)},[e]);return I.jsx("div",{className:"fixed z-[60] pointer-events-none text-4xl transition-all duration-[850ms] ease-in",style:{left:t.x,top:t.y,transform:"translate(-50%,-50%)"},children:r})}
function M0Tutorial({onDone:r}){const[e,t]=ie.useState(0),s=[{t:"👆 Tocá una carta resaltada para jugarla.",a:"play"},{t:"👇 Si no podés jugar, tocá el mazo para robar.",a:"draw"},{t:"⚡ Con 1 carta, declará ¡CERO! antes de jugar.",a:"cero"},{t:"Cartas especiales: Salto · Reverso · +2 · Comodín · +4",a:"cards"}];return I.jsxs("div",{className:"fixed inset-0 z-[55] flex items-end justify-center pb-32 px-4",style:{background:"rgba(0,0,0,.55)"},children:[I.jsxs("div",{className:"max-w-sm w-full p-5 rounded-2xl border border-violet-500 bg-[#12082a]/95 text-center",children:[I.jsx("p",{className:"text-white text-sm font-semibold mb-4",children:s[e].t}),I.jsxs("div",{className:"flex gap-2 justify-center",children:[I.jsx("button",{type:"button",onClick:()=>{try{localStorage.setItem("cero_tutorial_v1","1")}catch{}r()},className:"px-4 py-2 text-xs text-violet-400",children:"Saltar"}),I.jsx("button",{type:"button",onClick:()=>{if(e>=s.length-1){try{localStorage.setItem("cero_tutorial_v1","1")}catch{}r()}else t(e+1)},className:"px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold",children:e>=s.length-1?"¡Listo!":"Siguiente"})]})]}),s[e].a==="draw"&&I.jsx("span",{className:"fixed text-4xl animate-bounce",style:{left:"28%",bottom:"42%"},children:"👇"})]})}
function hk({matchId:r,currentUid:e})`,
);

// ── hk: proyectiles + rival target ────────────────────────────────────────────
apply(
  'hk-projectiles-ui',
  'const{messages:t,sendMessage:s,sendReaction:o,sending:l,MAX_CHARS:h}=lk(r)',
  'const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r),[Ae,we]=ie.useState(null);ie.useEffect(()=>{const P=t.filter(B=>B.type==="projectile"&&B.uid!==e);if(!P.length)return;const B=P[P.length-1];we(B.text),setTimeout(()=>we(null),950)},[t,e])',
);

apply(
  'hk-emoji-bar',
  'children:ok.map(J=>I.jsx("button",{type:"button",onClick:()=>o(J)',
  'children:ok.map(J=>I.jsx("button",{type:"button",onClick:()=>{J==="🥧"||J==="🎂"||J==="💩"||J==="🍅"||J==="💣"?le(J):o(J)}',
);

apply(
  'hk-projectile-render',
  'return I.jsxs("div",{className:"fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2",children:[f&&I.jsxs("div"',
  'return I.jsxs("div",{className:"fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2",children:[Ae&&I.jsx(M0Projectile,{emoji:Ae,onDone:()=>we(null)}),f&&I.jsxs("div"',
);

// ── yk: sin Salir 5 min, CERO grande con sonido ───────────────────────────────
const oldYkStart = 'function yk({state:r,matchId:e,onExit:t})';
const ykIdx = s.indexOf(oldYkStart);
const ykEnd = s.indexOf('function _k({state:r})', ykIdx);
if (ykIdx < 0 || ykEnd < 0) {
  console.error('PATCH FAILED: yk bounds');
  process.exit(1);
}

const newYk = `function yk({state:r}){const{match:e,isMyTurn:t,mustDeclareCero:s,busy:o,draw:l,declareCero:h,forfeit:f,myHand:g}=r,_=(e==null?void 0:e.phase)??"waiting",w=(e==null?void 0:e.drawStack)??0,T=(g==null?void 0:g.length)??0,k=s||T===2;return _==="game_over"||_==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[(s||T===2)&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playCero(),h()},className:\`font-black text-white border shadow-lg active:scale-95 disabled:opacity-50 transition-all \${k?"px-8 py-4 rounded-2xl text-xl animate-pulse bg-pink-600 border-pink-300":"px-5 py-2 rounded-xl text-sm bg-pink-600 border-pink-400"}\`,children:"¡CERO!"}),t&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playDraw(),l()},className:\`px-5 py-2 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-50 transition-all duration-150\`,children:w>0?\`Robar \${w} cartas (+stack)\`:"Robar carta"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{window.confirm("¿Abandonar la partida? Tu rival ganará.")&&f()},className:\`px-3 py-2 rounded-xl font-semibold text-xs bg-transparent hover:bg-red-900/40 active:scale-95 text-red-400 border border-red-800/60 disabled:opacity-40 transition-all duration-150\`,children:"Abandonar"})]})}`;

s = s.slice(0, ykIdx) + newYk + s.slice(ykEnd);
console.log('OK: yk-no-leave-big-cero');

apply(
  'yk-vk-props',
  'children:[I.jsx(yk,{state:t,matchId:r,onExit:e}),I.jsx(pk,{cards:l,',
  'children:[I.jsx(yk,{state:t}),I.jsx(pk,{cards:l,',
);

// ── fk: mano animada al robar ──────────────────────────────────────────────────
apply(
  'fk-hand-hint',
  'title:e?"Robar carta":void 0,children:[I.jsx(qf,{small:!1})',
  'title:e?"Robar carta":void 0,children:[e&&!s&&I.jsx("span",{className:"absolute -left-8 top-1/2 -translate-y-1/2 text-2xl pointer-events-none animate-bounce z-30",style:{filter:"drop-shadow(0 0 6px rgba(0,239,144,.8))"},children:"👆"}),I.jsx(qf,{small:!1})',
);

apply(
  'fk-faster',
  'className:["relative transition-all duration-150",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer":"cursor-default opacity-70"].join(" ")',
  'className:["relative transition-all duration-100",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" ")',
);

// ── T0: tooltip carta ─────────────────────────────────────────────────────────
apply(
  't0-hint',
  '"aria-pressed":s,children:[I.jsx("div"',
  '"title":M0cardHint(r,e),"aria-pressed":s,children:[I.jsx("div"',
);

// ── pk: selección más rápida + sonido ──────────────────────────────────────────
apply(
  'pk-faster',
  'transition:"all 0.2s ease"',
  'transition:"all 0.12s ease"',
);

apply(
  'pk-play-sound',
  'return}s(_),h(null)},[t,o,e,s])',
  'return}M0playCard(),s(_),h(null)},[t,o,e,s])',
);

apply(
  'pk-tap',
  'onClick:()=>f(_.id)})},_.id)})})}function mk(',
  'onClick:()=>f(_.id),onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})}function mk(',
);

// ── vk: tutorial, banner, auto-leave, polling expiry ──────────────────────────
const vkHooks = '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,actionError:$,clearActionError:ne}=t;const[M0tu,M0tuDone]=ie.useState(()=>{try{return!localStorage.getItem("cero_tutorial_v1")}catch{return!1}}),M0left=ie.useRef(!1);ie.useEffect(()=>{if((o==null?void 0:o.status)!=="playing")return;const Y=setInterval(()=>{M0s(r).catch(()=>{})},15e3);return()=>clearInterval(Y)},[r,o==null?void 0:o.status]),ie.useEffect(()=>{if((o==null?void 0:o.status)!=="playing")return;function Y(){M0left.current||(M0left.current=!0,M0k(r).catch(()=>{}))}return window.addEventListener("pagehide",Y),document.addEventListener("visibilitychange",()=>{document.visibilityState==="hidden"&&Y()}),()=>{window.removeEventListener("pagehide",Y)}},[r,o==null?void 0:o.status]);if(w)return';

apply(
  'vk-hooks-top',
  '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,actionError:$,clearActionError:ne}=t;if(w)return',
  vkHooks,
);

apply(
  'vk-ux-inject',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col select-none overflow-hidden",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[g&&I.jsx(mk,{onPick:W,busy:k}),$&&I.jsx(gk,{message:$,onClose:ne,type:"error"}),I.jsx("div",{className:"flex justify-center pt-6 pb-2",children:_?I.jsx(dk,{count:',
  `return I.jsxs("div",{className:"min-h-screen flex flex-col select-none overflow-hidden",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[M0tu&&I.jsx(M0Tutorial,{onDone:()=>M0tuDone(!1)}),I.jsx(M0RejoinBanner,{match:o,currentUid:s,stakeCC:o.stakeCC??0}),g&&I.jsx(mk,{onPick:W,busy:k}),$&&I.jsx(gk,{message:$,onClose:ne,type:"error"}),I.jsx("div",{className:"flex justify-center pt-6 pb-2",children:_?I.jsx(dk,{count:`,
);

// ── mk más rápido ─────────────────────────────────────────────────────────────
apply(
  'mk-faster',
  'transition-all duration-150',
  'transition-all duration-100',
);

fs.writeFileSync(bundlePath, s);
console.log('Gameplay UX patch applied successfully.');
