#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 320));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

function replaceBlock(name, startNeedle, endNeedle, replacement) {
  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    console.error(`PATCH FAILED: ${name} (block boundaries)`);
    process.exit(1);
  }
  s = s.slice(0, start) + replacement + s.slice(end);
  console.log(`OK: ${name}`);
}

// ── Sounds: projectile = throw/explosion beeps; penalize distinct ─────────────
apply(
  'sfx-projectile-no-win',
  'projectile:"/app/sounds/win.mp3"',
  'projectile:"/app/sounds/draw.mp3"',
);

apply(
  'play-projectile-beeps-only',
  'function M0playProjectile(){M0playSfx("projectile")||(M0beep(.07,.05,520),setTimeout(()=>M0beep(.05,.04,780),70))}',
  'function M0playProjectile(){M0beep(.06,.05,640),setTimeout(()=>M0beep(.08,.07,280),55),setTimeout(()=>M0beep(.1,.12,160),130)}function M0playPenalize(){M0beep(.09,.14,300),setTimeout(()=>M0beep(.11,.18,180),90)}',
);

// ── Color label: gold = Amarillo ─────────────────────────────────────────────
apply(
  'tl-gold-amarillo',
  'gold:{bg:"#1f1004",ink:"#f59e0b",glow:"rgba(245,158,11,.55)",label:"Dorado"}',
  'gold:{bg:"#1f1004",ink:"#f59e0b",glow:"rgba(245,158,11,.55)",label:"Amarillo"}',
);

// ── CERO declare without requiring own turn (1–2 cards) ───────────────────────
apply(
  'sk-cero-no-turn-required',
  'J=!!($&&(M0hl===2||M0hl===1&&!M0cc.includes(W)))',
  'J=!!(M0hl===2||M0hl===1&&!M0cc.includes(W))',
);

// ── Action bar: Robar always visible + CERO + Penalizar ───────────────────────
apply(
  'yk-action-bar-v28',
  'function yk({state:r}){const{match:e,isMyTurn:t,busy:o,pendingDraw:M0pd,draw:l,forfeit:f}=r,_=(e==null?void 0:e.phase)??"waiting",w=(e==null?void 0:e.drawStack)??0;return _==="game_over"||_==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[t&&I.jsx("button",{type:"button",disabled:o||M0pd,onClick:()=>{M0playDraw(),l()},className:`px-5 py-2 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-50 transition-all duration-150`,children:M0pd?"Robando…":w>0?`Robar ${w} cartas (+stack)`:"Robar carta"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{window.confirm("¿Abandonar la partida? Tu rival ganará.")&&f()},className:`px-3 py-2 rounded-xl font-semibold text-xs bg-transparent hover:bg-red-900/40 active:scale-95 text-red-400 border border-red-800/60 disabled:opacity-40 transition-all duration-150`,children:"Abandonar"})]})}',
  'function yk({state:r}){const{match:e,isMyTurn:t,busy:o,pendingDraw:M0pd,draw:l,forfeit:f,canDeclareCero:M0cero,canPenalizeCero:M0pen,declareCero:M0dc,penalizeCero:M0pn,myHand:g}=r,_=(e==null?void 0:e.phase)??"waiting",w=(e==null?void 0:e.drawStack)??0;return _==="game_over"||_==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-2 sm:gap-3 flex-wrap w-full max-w-lg px-1",children:[I.jsx("button",{type:"button",disabled:o||M0pd||!t,onClick:()=>{M0playDraw(),l()},className:"px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-40 transition-all",title:t?"Robar del mazo":"Esperá tu turno",children:M0pd?"Robando…":w>0?`Robar ${w}`:"Robar"}),M0cero&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playCero(),M0dc()},className:"px-4 sm:px-6 py-2.5 rounded-xl font-black text-sm sm:text-base bg-gradient-to-b from-pink-500 to-red-700 text-white border-2 border-pink-300 shadow-lg animate-pulse active:scale-95 disabled:opacity-50",children:"¡CERO!"}),M0pen&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playPenalize(),M0pn()},className:"px-3 sm:px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm text-white border-2 border-amber-300 bg-gradient-to-b from-amber-500 to-amber-700 shadow-lg animate-bounce active:scale-95 disabled:opacity-50",children:"+2 Penalizar"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{window.confirm("¿Abandonar la partida? Tu rival ganará.")&&f()},className:"px-3 py-2 rounded-xl font-semibold text-xs bg-transparent hover:bg-red-900/40 text-red-400 border border-red-800/60 disabled:opacity-40",children:"Salir"})]})}',
);

// ── Remove floating CERO / Penalizar (now in action bar) ────────────────────
apply(
  'vk-remove-floating-cero-pen',
  'I.jsx(M0CeroBtn,{visible:M0canCero&&o.status==="playing",busy:k,onPress:()=>{M0playCero(),M0dc()}}),M0canPen&&I.jsx(M0PenalizeBtn,{busy:k,onPress:()=>{M0playCero(),M0pen()}}),',
  '',
);

// ── Deck badge: real deckLeft from match snapshot ─────────────────────────────
apply(
  'fk-deck-left-badge',
  'M0cc=o&&o.color==="wild"&&(r==null?void 0:r.chosenColor)?r.chosenColor:null;return',
  'M0cc=o&&o.color==="wild"&&(r==null?void 0:r.chosenColor)?r.chosenColor:null,M0dl=(r==null?void 0:r.deckLeft);return',
);

apply(
  'fk-deck-badge-count',
  'children:[40,"+"]',
  'children:M0dl!=null?(M0dl>99?"99+":M0dl):"—"',
);

// ── Projectiles fly toward rival avatar ───────────────────────────────────────
apply(
  'rival-seat-id',
  'return I.jsx("div",{className:"flex justify-center",children:h(others[0],!1)});',
  'return I.jsx("div",{className:"flex justify-center",id:"M0rival-seat",children:h(others[0],!1)});',
);

apply(
  'projectile-target-rival-v28',
  'function M0Projectile({emoji:r,onDone:e,targetY:t=112}){const[s,setS]=ie.useState("fly");const[o,l]=ie.useState(()=>({x:Math.min(window.innerWidth-40,window.innerWidth*.84),y:Math.min(window.innerHeight-60,window.innerHeight*.76)}));ie.useEffect(()=>{const id=requestAnimationFrame(()=>{l({x:window.innerWidth/2,y:t}),setS("hit")});return()=>cancelAnimationFrame(id)},[t]);ie.useEffect(()=>{const a=setTimeout(()=>setS("fade"),560),b=setTimeout(()=>e==null?void 0:e(),980);return()=>{clearTimeout(a),clearTimeout(b)}},[e]);const h=s==="hit",f=s==="fade";return I.jsxs("div",{className:"fixed z-[80] pointer-events-none",style:{left:o.x,top:o.y,transform:"translate(-50%,-50%) scale("+(h?"2.2":"1")+")",opacity:f?0:1,transition:s==="fly"?"left .5s cubic-bezier(.25,.9,.35,1), top .5s cubic-bezier(.25,.9,.35,1), transform .15s ease-out, opacity .25s":"transform .15s ease-out, opacity .25s",fontSize:"2.75rem",lineHeight:1,filter:h?"drop-shadow(0 0 16px rgba(239,68,68,.9))":undefined},children:[r,h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"5rem",height:"5rem",transform:"translate(-50%,-50%)",borderRadius:"50%",background:"radial-gradient(circle,rgba(239,68,68,.55) 0%,rgba(245,158,11,.25) 42%,transparent 70%)",pointerEvents:"none"}}),h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"7rem",height:"7rem",transform:"translate(-50%,-50%)",borderRadius:"50%",border:"3px solid rgba(239,68,68,.35)",pointerEvents:"none",animation:"M0splatRing .45s ease-out forwards"},className:"M0splatRing"})]})}',
  'function M0Projectile({emoji:r,onDone:e}){const[s,setS]=ie.useState("fly");const[o,l]=ie.useState(()=>({x:Math.min(window.innerWidth-48,window.innerWidth*.9),y:Math.min(window.innerHeight-72,window.innerHeight*.78)}));const[target,setTarget]=ie.useState(()=>({x:window.innerWidth/2,y:112}));ie.useEffect(()=>{const el=document.getElementById("M0rival-seat");if(el){const rect=el.getBoundingClientRect();setTarget({x:rect.left+rect.width/2,y:rect.top+rect.height/2})}},[]);ie.useEffect(()=>{const id=requestAnimationFrame(()=>{l(target),setS("hit")});return()=>cancelAnimationFrame(id)},[target.x,target.y]);ie.useEffect(()=>{const a=setTimeout(()=>setS("fade"),560),b=setTimeout(()=>e==null?void 0:e(),980);return()=>{clearTimeout(a),clearTimeout(b)}},[e]);const h=s==="hit",f=s==="fade";return I.jsxs("div",{className:"fixed z-[80] pointer-events-none",style:{left:o.x,top:o.y,transform:"translate(-50%,-50%) scale("+(h?"2.2":"1")+")",opacity:f?0:1,transition:s==="fly"?"left .5s cubic-bezier(.25,.9,.35,1), top .5s cubic-bezier(.25,.9,.35,1), transform .15s ease-out, opacity .25s":"transform .15s ease-out, opacity .25s",fontSize:"2.75rem",lineHeight:1,filter:h?"drop-shadow(0 0 16px rgba(239,68,68,.9))":undefined},children:[r,h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"5rem",height:"5rem",transform:"translate(-50%,-50%)",borderRadius:"50%",background:"radial-gradient(circle,rgba(239,68,68,.55) 0%,rgba(245,158,11,.25) 42%,transparent 70%)",pointerEvents:"none"}}),h&&I.jsx("span",{style:{position:"absolute",left:"50%",top:"50%",width:"7rem",height:"7rem",transform:"translate(-50%,-50%)",borderRadius:"50%",border:"3px solid rgba(239,68,68,.35)",pointerEvents:"none",animation:"M0splatRing .45s ease-out forwards"},className:"M0splatRing"})]})}',
);

// ── Chat: text messages separate from reactions ───────────────────────────────
apply(
  'hk-text-only-main-list',
  ':t.map(J=>{const ee=J.uid===e;return J.type==="reaction"?I.jsx(uk,{msg:J,isMe:ee},J.id):I.jsx(ck,{msg:J,isMe:ee},J.id)}),',
  ':t.filter(J=>J.type==="text").map(J=>I.jsx(ck,{msg:J,isMe:J.uid===e},J.id)),',
);

apply(
  'hk-reactions-strip',
  'children:"Empezá la conversación"}):t.filter(J=>J.type==="text").map',
  'children:"Empezá la conversación"}):I.jsxs(I.Fragment,{children:[t.some(J=>J.type==="reaction")&&I.jsxs("div",{className:"px-1 py-1.5 mb-1 rounded-lg border border-violet-800/40 bg-violet-950/30",children:[I.jsx("span",{className:"text-[0.55rem] text-violet-500 font-bold uppercase tracking-wider block mb-1",children:"Reacciones"}),I.jsx("div",{className:"flex flex-wrap gap-1",children:t.filter(J=>J.type==="reaction").slice(-10).map(J=>I.jsxs("span",{className:"text-xs px-1.5 py-0.5 rounded-full bg-violet-900/60 text-violet-200",title:J.name,children:[J.text," ",I.jsx("span",{className:"text-violet-500",children:J.name})]},J.id))})]}),t.filter(J=>J.type==="text").map',
);

apply(
  'hk-text-map-close-fragment',
  '},J.id)),I.jsx("div",{ref:F})]}),',
  '},J.id))]}) ,I.jsx("div",{ref:F})]}) ,',
);

// ── rateMatchPlay callable + end screen with factor play rating ───────────────
apply(
  'rate-match-callable',
  'function M0ChatFn(){return M0chatFn??(M0chatFn=or(ur,"sendMatchChat"))}let M0chatFn=null',
  'function M0ChatFn(){return M0chatFn??(M0chatFn=or(ur,"sendMatchChat"))}let M0chatFn=null;let M0rateCall=null;function M0RateCall(){return M0rateCall??(M0rateCall=or(ur,"rateMatchPlay"))}',
);

apply(
  'match-end-component-v28',
  'function vk({matchId:r,onExit:e}){var J,ee,le;',
  `function M0MatchEnd({match:r,matchId:e,uid:t,onExit:s}){const o=(r.players??[]).find(l=>l.uid===r.winner),h=r.winner===t,[f,g]=ie.useState({}),[_,w]=ie.useState(!1),[T,k]=ie.useState(!1),F=(r.players??[]).filter(l=>l.uid!==t),K=async()=>{if(T||_)return;const W={};for(const $ of F){const ne=f[$.uid];ne>=1&&ne<=5&&(W[$.uid]=ne)}if(!Object.keys(W).length)return;k(!0);try{await Rc(M0RateCall(),{matchId:e,ratings:W}),w(!0)}catch{}finally{k(!1)}};return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-8",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsxs("div",{className:"flex flex-col items-center gap-3 text-center",children:[I.jsx("span",{className:"text-6xl",children:h?"🏆":"😞"}),I.jsx("h2",{className:"text-3xl font-black tracking-wide",style:{color:h?"#fbbf24":"#c4b5fd"},children:h?"¡Ganaste!":"Perdiste…"}),o&&!h&&I.jsxs("p",{className:"text-sm text-violet-400 font-semibold",children:["Ganó ",o.name]})]}),F.length>0&&I.jsxs("div",{className:"w-full max-w-sm rounded-2xl border border-violet-700/50 bg-violet-950/40 p-4 flex flex-col gap-3",children:[I.jsx("p",{className:"text-xs font-bold text-violet-300 uppercase tracking-widest text-center",children:"Factor play — ¿Cómo jugó tu rival?"}),F.map(W=>I.jsxs("div",{className:"flex items-center justify-between gap-2",children:[I.jsx("span",{className:"text-sm text-violet-200 font-semibold truncate",children:W.name}),I.jsx("div",{className:"flex gap-1 shrink-0",children:[1,2,3,4,5].map($=>I.jsx("button",{type:"button",disabled:_||T,onClick:()=>g(ne=>({...ne,[W.uid]:$})),className:"text-xl leading-none transition-transform "+((f[W.uid]??0)>=$?"scale-110":"opacity-35 hover:opacity-70"),children:"⭐"},$))})]},W.uid)),I.jsx("button",{type:"button",disabled:_||T||!F.some(W=>(f[W.uid]??0)>=1),onClick:K,className:"w-full py-2.5 rounded-xl font-bold text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 border border-violet-400/50",children:_?"¡Gracias por calificar!":T?"Enviando…":"Enviar calificación"})]}),I.jsx("button",{type:"button",onClick:s,className:"px-8 py-3 rounded-2xl font-black text-white border-2 transition-all hover:scale-105 active:scale-95",style:{background:"rgba(124,58,237,.4)",borderColor:"#7c3aed",boxShadow:"0 0 24px rgba(124,58,237,.4)"},children:"Volver al Lobby"})]})}function vk({matchId:r,onExit:e}){var J,ee,le;`,
);

apply(
  'vk-use-match-end-screen',
  'if(o.phase==="game_over"||o.status==="finished"){const Ae=(ee=o.players)==null?void 0:ee.find(P=>P.uid===o.winner),we=o.winner===s;return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-8",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsxs("div",{className:"flex flex-col items-center gap-3 text-center",children:[I.jsx("span",{className:"text-6xl",children:we?"🏆":"😞"}),I.jsx("h2",{className:"text-3xl font-black tracking-wide",style:{color:we?"#fbbf24":"#c4b5fd"},children:we?"¡Ganaste!":"Perdiste…"}),Ae&&!we&&I.jsxs("p",{className:"text-sm text-violet-400 font-semibold",children:["Ganó ",Ae.name]})]}),I.jsx("button",{type:"button",onClick:e,className:`px-8 py-3 rounded-2xl font-black text-white border-2\\r\n                     transition-all hover:scale-105 active:scale-95`,style:{background:"rgba(124,58,237,.4)",borderColor:"#7c3aed",boxShadow:"0 0 24px rgba(124,58,237,.4)"},children:"Volver al Lobby"})]})}return I.jsxs("div",{className:"relative h-[100dvh] max-h-[100dvh] select-none overflow-hidden"',
  'if(o.phase==="game_over"||o.status==="finished")return I.jsx(M0MatchEnd,{match:o,matchId:r,uid:s,onExit:e});return I.jsxs("div",{className:"relative h-[100dvh] max-h-[100dvh] select-none overflow-hidden"',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-gameplay-v28.js done');
