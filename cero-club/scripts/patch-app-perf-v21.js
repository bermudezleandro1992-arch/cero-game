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

function replaceBlock(name, startNeedle, endNeedle, replacement) {
  let start = s.indexOf(startNeedle);
  if (start === -1 && startNeedle === 'function M0optPatch') {
    start = s.indexOf('function sk(r){var A,ze,et,gt,$e');
  }
  const end = s.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    console.error(`PATCH FAILED: ${name} (block boundaries)`);
    process.exit(1);
  }
  s = s.slice(0, start) + replacement + s.slice(end);
  console.log(`OK: ${name}`);
}

// ── Clean useMatch + optimistic play/draw/color/cero (fixes v20 corruption) ───
const USE_MATCH_BLOCK = `function M0optPatch(act,match,hand,myIdx){if(!match)return{match,hand};if(act.action==="play"&&act.cardId!=null){const card=hand.filter(c=>!c.ghost).find(c=>c.id===act.cardId);if(!card)return{match,hand};const nh=hand.filter(c=>c.id!==act.cardId);let nm={...match,topDiscard:card};const wild=card.color==="wild"||card.value==="wild"||card.value==="wild4";if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx};else{const n=(match.playerIds==null?void 0:match.playerIds.length)||2;nm={...nm,current:(myIdx+1)%n,phase:"playing",chosenColor:card.color!=="wild"?card.color:match.chosenColor??null}}return{match:nm,hand:nh}}if(act.action==="pickColor"&&act.color)return{match:{...match,chosenColor:act.color,phase:"playing",pendingTurn:null},hand};if(act.action==="declareCero"){const cc=[...(match.ceroCalled||[])];if(!cc.includes(myIdx))cc.push(myIdx);return{match:{...match,ceroCalled:cc},hand};}if(act.action==="draw"){const ds=match.drawStack??0;const n=Math.max(1,ds>0?ds:1);const clean=hand.filter(c=>!c.ghost);const gid=Date.now();const ghosts=Array.from({length:n},(_,i)=>({id:-(gid+i),color:"blue",value:"?",ghost:!0}));return{match:{...match,drawStack:0},hand:[...clean,...ghosts]}}return{match,hand}}function sk(r){var A,ze,et,gt,$e;const[e,t]=ie.useState(null),[s,o]=ie.useState([]),[l,h]=ie.useState(!0),[f,g]=ie.useState(null),[_,w]=ie.useState(null),[T,k]=ie.useState(!1),[Se,oe]=ie.useState(null),[Be,Me]=ie.useState(!1),F=ie.useRef(0),M0opt=ie.useRef(!1),M0snapM=ie.useRef(null),M0snapH=ie.useRef([]);ie.useEffect(()=>{if(!r){h(!1);return}h(!0),g(null);const Y=Ba(br,"matches",r);return Co(Y,re=>{if(!re.exists()){g(new Error("Partida no encontrada")),h(!1);return}const V=re.data();M0snapM.current=V;if(M0opt.current)return;t(V),F.current=V.turn??0,h(!1)},re=>{console.error("[useMatch] match snapshot error:",re),g(re),h(!1)})},[r]),ie.useEffect(()=>{var q;if(!r)return;const Y=(q=Xn.currentUser)==null?void 0:q.uid;if(!Y)return;const ue=Ba(br,"matches",r,"presence",Y);async function re(){try{await dC(ue,{lastSeen:$d(),matchId:r,status:"in_match"})}catch{}}re();const V=setInterval(re,XC);return()=>clearInterval(V)},[r]),ie.useEffect(()=>{var V;if(!r)return;const Y=(V=Xn.currentUser)==null?void 0:V.uid;if(!Y)return;const ue=Ba(br,"matches",r,"hands",Y);return Co(ue,q=>{if(q.exists()){const c=(q.data().cards??[]).filter(x=>!x.ghost);M0snapH.current=c;if(!M0opt.current)o(c)}},q=>{console.error("[useMatch] hand snapshot error:",q)})},[r]);const K=((A=Xn.currentUser)==null?void 0:A.uid)??null,W=e?((ze=e.playerIds)==null?void 0:ze.indexOf(K))??-1:-1,$=!!(e&&e.status==="playing"&&e.phase!=="game_over"&&e.phase!=="color_pick"&&e.phase!=="waiting"&&e.current===W),ne=!!(e&&e.status==="playing"&&e.phase==="color_pick"&&e.pendingTurn===W),J=!!($&&s.filter(c=>!c.ghost).length===1&&!((gt=(et=e==null?void 0:e.ceroCalled)==null?void 0:et.includes)!=null&&gt.call(et,W))),ee=ik(s.filter(c=>!c.ghost),e,$&&!J),le=ie.useCallback(async Y=>{if(T&&Y.action!=="play")return;if(T&&Y.action==="play"&&Se!=null)return;w(null);const prevM=e,prevH=s.filter(c=>!c.ghost);M0snapM.current=prevM,M0snapH.current=prevH,M0opt.current=!0;if(Y.action==="play"){oe(Y.cardId??null),M0resumeAudio(),M0playCard()}else if(Y.action==="draw"){Me(!0),M0resumeAudio(),M0playDraw()}else k(!0);const opt=M0optPatch(Y,prevM,prevH,W);if(opt.match)t(opt.match);if(opt.hand)o(opt.hand);try{const res=await RC({matchId:r,turnNumber:F.current,...Y});if(res!=null&&res.publicState)t(m=>m?{...m,...res.publicState}:res.publicState);if(res!=null&&res.myHand)o(res.myHand);if(res!=null&&res.turn!=null)F.current=res.turn}catch(ue){t(prevM),o(prevH);const re=ue instanceof v0?ue.message:(ue==null?void 0:ue.message)??"Error al ejecutar la acción";w(re),console.error("[useMatch] action error:",ue)}finally{M0opt.current=!1,oe(null),Me(!1),k(!1)}},[r,T,e,s,W,Se]),Ae=ie.useCallback(Y=>le({action:"play",cardId:Y}),[le]),we=ie.useCallback(()=>le({action:"draw"}),[le]),P=ie.useCallback(Y=>le({action:"pickColor",color:Y}),[le]),x=ie.useCallback(()=>le({action:"declareCero"}),[le]),C=ie.useCallback(async()=>{if(!(!r||T)){k(!0),w(null);try{await PC(r)}catch(Y){w((Y==null?void 0:Y.message)??"No se pudo abandonar")}finally{k(!1)}}},[r,T]),D=ie.useCallback(()=>w(null),[]),N=e?(e.players??[]).find(Y=>Y.uid!==K)??null:null,O=e?(($e=(e.players??[])[e.current])==null?void 0:$e.name)??"Rival":null;return{match:e,myHand:s,playableIds:ee,myPlayerIndex:W,isMyTurn:$,needsColorPick:ne,mustDeclareCero:J,opponent:N,currentPlayerName:O,loading:l,error:f,busy:T,pendingCard:Se,pendingDraw:Be,play:Ae,draw:we,pickColor:P,declareCero:x,forfeit:C,actionError:_,clearActionError:D}}`;

if (!s.includes('pendingDraw:Be')) {
  replaceBlock('useMatch-clean-v21', 'function M0optPatch', 'const ok=[', USE_MATCH_BLOCK);
} else {
  console.log('SKIP: useMatch-clean-v21 (already applied)');
}

function applyOptional(name, from, to) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${name}`);
    return;
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

applyOptional(
  'pk-ghost-cards-v21',
  'children:I.jsx(T0,{color:_.color,value:_.value,isPlayable:T,isSelected:k,onClick:()=>f(_.id),onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})]});}',
  'children:_.ghost?I.jsx(qf,{small:!1}):I.jsx(T0,{color:_.color,value:_.value,isPlayable:T,isSelected:k,onClick:()=>f(_.id),onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})]});}',
);

applyOptional(
  'pk-skip-ghost-play-v21',
  'const f=ie.useCallback(_=>{if(!t)return;if(M0pc!=null&&M0pc!==_)return;if(o&&M0pc==null)return;if(!e.has(_)){',
  'const f=ie.useCallback(_=>{if(!t)return;if(M0pc!=null&&M0pc!==_)return;if(o&&M0pc==null)return;const card=r.find(c=>c.id===_);if(card!=null&&card.ghost)return;if(!e.has(_)){',
);

applyOptional(
  'fk-pending-draw-v21',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s}){',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s,pendingDraw:M0pd=!1}){',
);

applyOptional(
  'fk-deck-animate-v21',
  'onClick:t,className:["relative transition-transform duration-100 will-change-transform",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" ")',
  'onClick:t,className:["relative transition-transform duration-100 will-change-transform",M0pd?"M0-deck-drawing":"",e&&!s&&!M0pd?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" ")',
);

applyOptional(
  'fk-call-pending-draw-v21',
  'I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k})',
  'I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k,pendingDraw:t.pendingDraw})',
);

applyOptional(
  'yk-draw-not-global-busy-v21',
  'function yk({state:r}){const{match:e,isMyTurn:t,mustDeclareCero:s,busy:o,draw:l,declareCero:h,forfeit:f,myHand:g}=r,',
  'function yk({state:r}){const{match:e,isMyTurn:t,mustDeclareCero:s,busy:o,pendingDraw:M0pd,draw:l,declareCero:h,forfeit:f,myHand:g}=r,',
);

applyOptional(
  'yk-draw-btn-v21',
  't&&I.jsx("button",{type:"button",disabled:o,onClick:()=>{M0playDraw(),l()},className:`px-5 py-2 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-50 transition-all duration-150`,children:w>0?`Robar ${w} cartas (+stack)`:"Robar carta"}',
  't&&I.jsx("button",{type:"button",disabled:o||M0pd,onClick:()=>{M0playDraw(),l()},className:`px-5 py-2 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-50 transition-all duration-150`,children:M0pd?"Robando…":w>0?`Robar ${w} cartas (+stack)`:"Robar carta"}',
);

applyOptional(
  'css-deck-draw-v21',
  '.M0-hand-row .M0-card-playable:active{transform:translate3d(0,-6px,0) scale(.97)!important}";',
  '.M0-hand-row .M0-card-playable:active{transform:translate3d(0,-6px,0) scale(.97)!important}@keyframes M0deckDraw{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-6px,0) scale(1.04)}}.M0-deck-drawing{animation:M0deckDraw .32s ease-in-out infinite}";',
);

applyOptional(
  'ik-lazy-tabs-v21',
  '):null,g={home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f,isGuest:r.isAnonymous===true,activeRoom:A&&!o?A:null,onGoActive:f})',
  '):null;const[M0lazy,setM0lazy]=ie.useState({home:!0});ie.useEffect(()=>{setM0lazy(v=>({...v,[t]:!0}))},[t]);const g={home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f,isGuest:r.isAnonymous===true,activeRoom:A&&!o?A:null,onGoActive:f})',
);

applyOptional(
  'ik-lazy-render-v21',
  'paddingBottom:"max(8rem,calc(env(safe-area-inset-bottom,0px) + 5.5rem))"},children:g[t]}),I.jsx(Ek,{active:t,onChange:s,isGuest:r.isAnonymous===true})',
  'paddingBottom:"max(8rem,calc(env(safe-area-inset-bottom,0px) + 5.5rem))"},children:M0lazy[t]?g[t]:I.jsx("div",{className:"flex justify-center py-20",children:I.jsx("div",{className:"w-8 h-8 border-4 border-violet-600 border-t-violet-300 rounded-full animate-spin"})})}),I.jsx(Ek,{active:t,onChange:s,isGuest:r.isAnonymous===true})',
);

applyOptional(
  'prefetch-game-assets-v21',
  'const M0COS_IMG={skin_neon:',
  'if(typeof document!=="undefined"&&!window.__M0pre){window.__M0pre=1;["/app/cards/classic-back.png","/app/logo/cero-club-mark.svg"].forEach(u=>{const l=document.createElement("link");l.rel="preload",l.as="image",l.href=u,document.head.appendChild(l)})}const M0COS_IMG={skin_neon:',
);

// v20 patch uses replaceBlock in v21 fix script — see patch-app-perf-v21.js note

fs.writeFileSync(bundlePath, s);
console.log('patch-app-perf-v21.js applied');
