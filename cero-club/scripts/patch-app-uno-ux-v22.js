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

function applyOptional(name, from, to) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${name}`);
    return;
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Shop: mesas y fondos tropicales ───────────────────────────────────────────
apply(
  'shop-tropical-items',
  '{id:"skin_mundial",name:"Cartas Mundial",category:"card_skin",price:480,preview:"⚽"}];function gd({label:r',
  '{id:"skin_mundial",name:"Cartas Mundial",category:"card_skin",price:480,preview:"⚽"},{id:"table_beach",name:"Mesa Playa",category:"table_bg",price:420,preview:"🏖️"},{id:"table_tropical",name:"Mesa Tropical",category:"table_bg",price:480,preview:"🌴"},{id:"table_wood",name:"Mesa Madera",category:"table_bg",price:360,preview:"🪵"},{id:"bg_tropical",name:"Paraíso Tropical",category:"room_bg",price:520,preview:"🌴"},{id:"bg_sunset",name:"Atardecer",category:"room_bg",price:460,preview:"🌅"},{id:"bg_jungle",name:"Selva",category:"room_bg",price:440,preview:"🌿"}];function gd({label:r',
);

apply(
  'room-bg-tropical',
  'bg_mundial:"radial-gradient(ellipse at 50% 22%, #0c4a6e 0%, #041018 55%, #04030d 100%), repeating-linear-gradient(0deg,rgba(21,128,61,.18) 0 48px,transparent 48px 96px)"};function M0Table3D',
  'bg_mundial:"radial-gradient(ellipse at 50% 22%, #0c4a6e 0%, #041018 55%, #04030d 100%), repeating-linear-gradient(0deg,rgba(21,128,61,.18) 0 48px,transparent 48px 96px)",bg_tropical:"radial-gradient(ellipse at 50% 12%, #0ea5e9 0%, #0369a1 40%, #04030d 72%), linear-gradient(180deg,rgba(251,191,36,.15) 0%,transparent 35%)",bg_sunset:"radial-gradient(ellipse at 50% 18%, #f97316 0%, #be185d 45%, #312e81 70%, #04030d 100%)",bg_jungle:"radial-gradient(ellipse at 50% 25%, #166534 0%, #052e16 55%, #04030d 100%), radial-gradient(circle at 80% 70%, rgba(34,197,94,.12) 0%, transparent 45%)"};function M0Table3D',
);

apply(
  'table-bg-tropical',
  'table_mundial:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #14532d 0%, #052e16 100%)",border:"3px solid rgba(253,224,71,.55)",boxShadow:"0 0 70px rgba(21,128,61,.35), inset 0 0 30px rgba(253,224,71,.08)"}};',
  'table_mundial:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #14532d 0%, #052e16 100%)",border:"3px solid rgba(253,224,71,.55)",boxShadow:"0 0 70px rgba(21,128,61,.35), inset 0 0 30px rgba(253,224,71,.08)"},table_beach:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #d97706 0%, #92400e 100%)",border:"3px solid rgba(253,224,71,.5)",boxShadow:"0 0 60px rgba(251,191,36,.3)"},table_tropical:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #059669 0%, #064e3b 100%)",border:"3px solid rgba(110,231,183,.45)",boxShadow:"0 0 60px rgba(52,211,153,.28)"},table_wood:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #78350f 0%, #451a03 100%)",border:"3px solid rgba(217,119,6,.45)",boxShadow:"0 0 50px rgba(180,83,9,.25)"}};',
);

applyOptional(
  'cos-img-tropical',
  'bg_mundial:"/app/cosmetics/rooms/mundial.svg"',
  'bg_mundial:"/app/cosmetics/rooms/mundial.svg",table_beach:"/app/cosmetics/tables/beach.svg",table_tropical:"/app/cosmetics/tables/tropical.svg",table_wood:"/app/cosmetics/tables/wood.svg",bg_tropical:"/app/cosmetics/rooms/tropical.svg",bg_sunset:"/app/cosmetics/rooms/sunset.svg",bg_jungle:"/app/cosmetics/rooms/jungle.svg"',
);

// ── Asientos con avatar + reacciones flotantes ────────────────────────────────
const OLD_FOUR_SEATS = `function M0FourSeats({match:r,uid:e}){const ps=r.players??[],hc=r.handCounts??[],others=ps.filter(p=>p.uid!==e),cnt=i=>{const x=ps.findIndex(p=>p.uid===i);return x>=0?hc[x]??0:0};if(!others.length)return I.jsx("p",{className:"text-violet-500 text-xs animate-pulse",children:"Esperando jugadores…"});if((r.maxPlayers??2)<4||others.length===1)return I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[0].uid),name:others[0].name})});return I.jsxs("div",{className:"w-full max-w-xl mx-auto px-1 shrink-0",children:[r.format==="2v2"&&I.jsx("p",{className:"text-center text-[0.55rem] text-sky-400 font-bold mb-1 uppercase tracking-widest",children:"2 vs 2 · Equipos"}),I.jsxs("div",{className:"grid grid-cols-3 gap-1 items-end min-h-[4.5rem]",children:[others[1]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[1].uid),name:others[1].name,compact:!0})}):I.jsx("div"),others[0]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[0].uid),name:others[0].name})}):I.jsx("div"),others[2]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[2].uid),name:others[2].name,compact:!0})}):I.jsx("div")]})]})}`;

const NEW_FOUR_SEATS = `function M0SeatAvatar({player:r,count:e,compact:t,reaction:s}){const o=t?"w-10 h-10":"w-12 h-12";return I.jsxs("div",{className:"relative flex flex-col items-center "+(t?"gap-0.5":"gap-1"),children:[s&&I.jsx("span",{className:"absolute -top-3 left-1/2 -translate-x-1/2 text-xl z-30 animate-bounce pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,.85)]",children:s}),I.jsxs("div",{className:"relative",children:[I.jsx("div",{className:o+" rounded-full overflow-hidden bg-violet-900/70 border-2 border-violet-400/60 flex items-center justify-center shadow-lg ring-2 ring-violet-950/50",children:r.photoURL?I.jsx("img",{src:r.photoURL,alt:"",className:"w-full h-full object-cover"}):I.jsx("span",{className:"font-black text-violet-200 "+(t?"text-sm":"text-base"),children:(r.name||"?").slice(0,1).toUpperCase()})}),e>0&&I.jsx("span",{className:"absolute -bottom-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-0.5 rounded-full bg-red-600 border-2 border-red-300 text-[0.55rem] font-black text-white flex items-center justify-center shadow-md",children:e})]}),I.jsx("span",{className:(t?"text-[0.5rem] max-w-[4.5rem]":"text-[0.6rem] max-w-[5.5rem]")+" truncate text-violet-100 font-bold uppercase tracking-wide text-center drop-shadow",children:r.name})]})}function M0FourSeats({match:r,uid:e,matchId:t}){const ps=r.players??[],hc=r.handCounts??[],others=ps.filter(p=>p.uid!==e),cnt=i=>{const x=ps.findIndex(p=>p.uid===i);return x>=0?hc[x]??0:0};const[s,o]=ie.useState({}),l=ie.useRef({});ie.useEffect(()=>{if(!t)return;const h=jf(za(br,"matches",t,"chat"),zf("createdAt","desc"),p0(24));return Co(h,f=>{f.docs.forEach(g=>{const _=g.data();if(_.type!=="reaction"||!_.uid||!_.text)return;o(w=>({...w,[_.uid]:_.text}));l.current[_.uid]&&clearTimeout(l.current[_.uid]);l.current[_.uid]=setTimeout(()=>{o(w=>{const T={...w};delete T[_.uid];return T})},3200)})})},[t]);if(!others.length)return I.jsx("p",{className:"text-violet-500 text-xs animate-pulse",children:"Esperando jugadores…"});const h=(f,g)=>I.jsx(M0SeatAvatar,{player:f,count:cnt(f.uid),compact:g,reaction:s[f.uid]});if((r.maxPlayers??2)<4||others.length===1)return I.jsx("div",{className:"flex justify-center",children:h(others[0],!1)});return I.jsxs("div",{className:"w-full max-w-xl mx-auto px-1 shrink-0",children:[r.format==="2v2"&&I.jsx("p",{className:"text-center text-[0.55rem] text-sky-400 font-bold mb-1 uppercase tracking-widest",children:"2 vs 2 · Equipos"}),I.jsxs("div",{className:"grid grid-cols-3 gap-1 items-end min-h-[5rem]",children:[others[1]?I.jsx("div",{className:"flex justify-center",children:h(others[1],!0)}):I.jsx("div"),others[0]?I.jsx("div",{className:"flex justify-center",children:h(others[0],!1)}):I.jsx("div"),others[2]?I.jsx("div",{className:"flex justify-center",children:h(others[2],!0)}):I.jsx("div")]})]})}`;

apply('four-seats-avatars', OLD_FOUR_SEATS, NEW_FOUR_SEATS);

apply(
  'four-seats-matchid',
  'I.jsx(M0FourSeats,{match:o,uid:s})',
  'I.jsx(M0FourSeats,{match:o,uid:s,matchId:r})',
);

// ── Botón CERO flotante estilo UNO + penalidad rival ───────────────────────────
const M0_CERO_UI = `function M0CeroBtn({visible:r,busy:e,onPress:t}){return r?I.jsx("button",{type:"button",disabled:e,onClick:t,"aria-label":"Declarar CERO",className:"fixed z-40 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full font-black text-white text-base sm:text-lg border-4 border-red-200 shadow-[0_6px_28px_rgba(220,38,38,.65),inset_0_-4px_12px_rgba(0,0,0,.35)] active:scale-90 disabled:opacity-60 transition-transform animate-pulse",style:{background:"linear-gradient(180deg,#ef4444 0%,#b91c1c 55%,#991b1b 100%)"},children:"CERO"}):null}function M0PenalizeBtn({busy:r,onPress:e}){return I.jsx("button",{type:"button",disabled:r,onClick:e,className:"fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] px-5 py-2.5 rounded-2xl font-black text-sm text-white border-2 border-amber-300 bg-gradient-to-b from-amber-500 to-amber-700 shadow-xl animate-bounce active:scale-95 disabled:opacity-60",children:"+2 · ¡No dijo CERO!"})}`;

apply('cero-btn-components', 'function gk({message:r,onClose:e,type:t})', `${M0_CERO_UI}function gk({message:r,onClose:e,type:t})`);

apply(
  'yk-remove-inline-cero',
  'function yk({state:r}){const{match:e,isMyTurn:t,mustDeclareCero:s,busy:o,pendingDraw:M0pd,draw:l,declareCero:h,forfeit:f,myHand:g}=r,_=(e==null?void 0:e.phase)??"waiting",w=(e==null?void 0:e.drawStack)??0,T=(g==null?void 0:g.length)??0,k=s||T===2;return _==="game_over"||_==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[(s||T===2)&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playCero(),h()},className:`font-black text-white border shadow-lg active:scale-95 disabled:opacity-50 transition-all ${k?"px-8 py-4 rounded-2xl text-xl animate-pulse bg-pink-600 border-pink-300":"px-5 py-2 rounded-xl text-sm bg-pink-600 border-pink-400"}`,children:"¡CERO!"}),t&&I.jsx("button"',
  'function yk({state:r}){const{match:e,isMyTurn:t,busy:o,pendingDraw:M0pd,draw:l,forfeit:f}=r,_=(e==null?void 0:e.phase)??"waiting",w=(e==null?void 0:e.drawStack)??0;return _==="game_over"||_==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[t&&I.jsx("button"',
);

// ── useMatch: declarar CERO opcional + penalidad ───────────────────────────────
applyOptional(
  'sk-can-declare',
  'ne=!!(e&&e.status==="playing"&&e.phase==="color_pick"&&e.pendingTurn===W),J=!!($&&s.filter(c=>!c.ghost).length===1&&!((gt=(et=e==null?void 0:e.ceroCalled)==null?void 0:et.includes)!=null&&gt.call(et,W))),ee=ik(s.filter(c=>!c.ghost),e,$&&!J)',
  'ne=!!(e&&e.status==="playing"&&e.phase==="color_pick"&&e.pendingTurn===W),M0hl=s.filter(c=>!c.ghost).length,M0cc=(e==null?void 0:e.ceroCalled)??[],J=!!($&&(M0hl===2||M0hl===1&&!M0cc.includes(W))),ee=ik(s.filter(c=>!c.ghost),e,$)',
);

apply(
  'sk-penalize-action',
  'x=ie.useCallback(()=>le({action:"declareCero"}),[le]),C=ie.useCallback(async()=>{',
  'x=ie.useCallback(()=>le({action:"declareCero"}),[le]),B=ie.useCallback(()=>le({action:"penalizeCero"}),[le]),C=ie.useCallback(async()=>{',
);

apply(
  'sk-return-penalize',
  'return{match:e,myHand:s,playableIds:ee,myPlayerIndex:W,isMyTurn:$,needsColorPick:ne,mustDeclareCero:J,opponent:N,currentPlayerName:O,loading:l,error:f,busy:T,pendingCard:Se,pendingDraw:Be,play:Ae,draw:we,pickColor:P,declareCero:x,forfeit:C,actionError:_,clearActionError:D}}',
  'const M0cf=(e==null?void 0:e.ceroForgot)??null,M0canPen=!!(M0cf&&M0cf!==K&&e.status==="playing");return{match:e,myHand:s,playableIds:ee,myPlayerIndex:W,isMyTurn:$,needsColorPick:ne,canDeclareCero:J,mustDeclareCero:J,opponent:N,currentPlayerName:O,loading:l,error:f,busy:T,pendingCard:Se,pendingDraw:Be,play:Ae,draw:we,pickColor:P,declareCero:x,penalizeCero:B,ceroForgot:M0cf,canPenalizeCero:M0canPen,forfeit:C,actionError:_,clearActionError:D}}',
);

// Optimistic: última carta sin CERO → ceroForgot
apply(
  'opt-cero-forgot',
  'if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx};else{const n=(match.playerIds==null?void 0:match.playerIds.length)||2;nm={...nm,current:(myIdx+1)%n,phase:"playing",chosenColor:card.color!=="wild"?card.color:match.chosenColor??null}}return{match:nm,hand:nh}}',
  'if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx};else{const n=(match.playerIds==null?void 0:match.playerIds.length)||2;nm={...nm,current:(myIdx+1)%n,phase:"playing",chosenColor:card.color!=="wild"?card.color:match.chosenColor??null}}const clean=nh.filter(c=>!c.ghost);if(clean.length===0){const cc=[...(match.ceroCalled||[])];if(!cc.includes(myIdx)){const uid=(match.playerIds||[])[myIdx];nm={...nm,ceroForgot:uid??null,winner:null,status:"playing",phase:nm.phase==="game_over"?"opp_turn":nm.phase}}else nm={...nm,winner:(match.playerIds||[])[myIdx]??null,phase:"game_over",status:"finished"}}return{match:nm,hand:nh}}',
);

apply(
  'opt-penalize',
  'if(act.action==="declareCero"){const cc=[...(match.ceroCalled||[])];if(!cc.includes(myIdx))cc.push(myIdx);return{match:{...match,ceroCalled:cc},hand};}',
  'if(act.action==="declareCero"){const cc=[...(match.ceroCalled||[])];if(!cc.includes(myIdx))cc.push(myIdx);return{match:{...match,ceroCalled:cc,ceroForgot:null},hand};}if(act.action==="penalizeCero")return{match:{...match,ceroForgot:null},hand};',
);

// pk: permitir jugar última carta sin bloquear
apply(
  'pk-allow-last',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o,pendingCard:M0pc=null,mustDeclareCero:M0mc=false}){const[l,h]=ie.useState(null);const[M0hint,setM0hint]=ie.useState(null);ie.useEffect(()=>{h(null),setM0hint(null)},[r.length]);const f=ie.useCallback(_=>{if(!t)return;if(M0pc!=null&&M0pc!==_)return;if(o&&M0pc==null)return;const card=r.find(c=>c.id===_);if(card!=null&&card.ghost)return;if(!e.has(_)){h(_);if(M0mc)setM0hint("¡Tocá CERO! antes de jugar la última carta"),setTimeout(()=>setM0hint(null),2200);setTimeout(()=>h(T=>T===_?null:T),180);return}M0resumeAudio(),M0playCard(),s(_),h(null)},[t,o,e,s,M0mc,M0pc])',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o,pendingCard:M0pc=null}){const[l,h]=ie.useState(null);ie.useEffect(()=>{h(null)},[r.length]);const f=ie.useCallback(_=>{if(!t)return;if(M0pc!=null&&M0pc!==_)return;if(o&&M0pc==null)return;const card=r.find(c=>c.id===_);if(card!=null&&card.ghost)return;if(!e.has(_)){h(_);setTimeout(()=>h(T=>T===_?null:T),180);return}M0resumeAudio(),M0playCard(),s(_),h(null)},[t,o,e,s,M0pc])',
);

applyOptional(
  'pk-remove-hint-ui',
  'return I.jsxs("div",{className:"flex flex-col items-center gap-1 w-full M0-hand-row",children:[M0hint&&I.jsx("p",{className:"text-[0.65rem] font-bold text-pink-300 animate-pulse px-3 py-1 rounded-full border border-pink-500/50 bg-pink-950/60",children:M0hint}),I.jsx("div"',
  'return I.jsxs("div",{className:"flex flex-col items-center gap-1 w-full M0-hand-row",children:[I.jsx("div"',
);

// vk: botones flotantes CERO + penalidad
apply(
  'vk-destructure-cero',
  '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,actionError:$,clearActionError:ne}=t;',
  '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,declareCero:M0dc,canDeclareCero:M0canCero,penalizeCero:M0pen,canPenalizeCero:M0canPen,actionError:$,clearActionError:ne}=t;',
);

apply(
  'vk-cero-buttons',
  'I.jsx(M0FourSeats,{match:o,uid:s,matchId:r})}),I.jsx("div",{className:"flex justify-center py-0.5 sm:py-1 shrink-0",children:I.jsx(_k,{state:t})})',
  'I.jsx(M0FourSeats,{match:o,uid:s,matchId:r})}),I.jsx(M0CeroBtn,{visible:M0canCero&&o.status==="playing",busy:k,onPress:()=>{M0playCero(),M0dc()}}),M0canPen&&I.jsx(M0PenalizeBtn,{busy:k,onPress:()=>{M0playCero(),M0pen()}}),I.jsx("div",{className:"flex justify-center py-0.5 sm:py-1 shrink-0",children:I.jsx(_k,{state:t})})',
);

applyOptional(
  'pk-prop-cleanup',
  'mustDeclareCero:M0mc',
  'M0mcRemoved:0',
);

fs.writeFileSync(bundlePath, s);
console.log('\nPatch v22 (UNO UX) applied.');
