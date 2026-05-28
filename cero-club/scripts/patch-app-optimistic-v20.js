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

const NEW_SK = `function M0optPatch(act,match,hand,myIdx){if(!match)return{match,hand};if(act.action==="play"&&act.cardId!=null){const card=hand.find(c=>c.id===act.cardId);if(!card)return{match,hand};const nh=hand.filter(c=>c.id!==act.cardId);let nm={...match,topDiscard:card};const wild=card.color==="wild"||card.value==="wild"||card.value==="wild4";if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx};else{const n=(match.playerIds==null?void 0:match.playerIds.length)||2;nm={...nm,current:(myIdx+1)%n,phase:"playing",chosenColor:card.color!=="wild"?card.color:match.chosenColor??null}}return{match:nm,hand:nh}}if(act.action==="pickColor"&&act.color)return{match:{...match,chosenColor:act.color,phase:"playing",pendingTurn:null},hand};if(act.action==="declareCero"){const cc=[...(match.ceroCalled||[])];if(!cc.includes(myIdx))cc.push(myIdx);return{match:{...match,ceroCalled:cc},hand}}return{match,hand}}function sk(r){var A,ze,et,gt,$e;const[e,t]=ie.useState(null),[s,o]=ie.useState([]),[l,h]=ie.useState(!0),[f,g]=ie.useState(null),[_,w]=ie.useState(null),[T,k]=ie.useState(!1),[Se,oe]=ie.useState(null),F=ie.useRef(0),M0opt=ie.useRef(!1),M0snapM=ie.useRef(null),M0snapH=ie.useRef([]);ie.useEffect(()=>{if(!r){h(!1);return}h(!0),g(null);const Y=Ba(br,"matches",r);return Co(Y,re=>{if(!re.exists()){g(new Error("Partida no encontrada")),h(!1);return}const V=re.data();M0snapM.current=V;if(M0opt.current)return;t(V),F.current=V.turn??0,h(!1)},re=>{console.error("[useMatch] match snapshot error:",re),g(re),h(!1)})},[r]),ie.useEffect(()=>{var q;if(!r)return;const Y=(q=Xn.currentUser)==null?void 0:q.uid;if(!Y)return;const ue=Ba(br,"matches",r,"presence",Y);async function re(){try{await dC(ue,{lastSeen:$d(),matchId:r,status:"in_match"})}catch{}}re();const V=setInterval(re,XC);return()=>clearInterval(V)},[r]),ie.useEffect(()=>{var V;if(!r)return;const Y=(V=Xn.currentUser)==null?void 0:V.uid;if(!Y)return;const ue=Ba(br,"matches",r,"hands",Y);return Co(ue,q=>{if(q.exists()){const c=q.data().cards??[];M0snapH.current=c;if(!M0opt.current)o(c)}},q=>{console.error("[useMatch] hand snapshot error:",q)})},[r]);const K=((A=Xn.currentUser)==null?void 0:A.uid)??null,W=e?((ze=e.playerIds)==null?void 0:ze.indexOf(K))??-1:-1,$=!!(e&&e.status==="playing"&&e.phase!=="game_over"&&e.phase!=="color_pick"&&e.phase!=="waiting"&&e.current===W),ne=!!(e&&e.status==="playing"&&e.phase==="color_pick"&&e.pendingTurn===W),J=!!($&&s.length===1&&!((gt=(et=e==null?void 0:e.ceroCalled)==null?void 0:et.includes)!=null&&gt.call(et,W))),ee=ik(s,e,$&&!J),le=ie.useCallback(async Y=>{if(T&&Y.action!=="play")return;if(T&&Y.action==="play"&&Se!=null)return;w(null);const prevM=e,prevH=s;M0snapM.current=prevM,M0snapH.current=prevH,M0opt.current=!0;if(Y.action==="play"){oe(Y.cardId??null),M0resumeAudio(),M0playCard()}else k(!0);const opt=M0optPatch(Y,prevM,prevH,W);if(opt.match)t(opt.match);if(opt.hand)o(opt.hand);try{const res=await RC({matchId:r,turnNumber:F.current,...Y});if(res!=null&&res.publicState)t(m=>m?{...m,...res.publicState}:res.publicState);if(res!=null&&res.myHand)o(res.myHand);if(res!=null&&res.turn!=null)F.current=res.turn}catch(ue){t(prevM),o(prevH);const re=ue instanceof v0?ue.message:(ue==null?void 0:ue.message)??"Error al ejecutar la acción";w(re),console.error("[useMatch] action error:",ue)}finally{M0opt.current=!1,oe(null),k(!1)}},[r,T,e,s,W,Se]),Ae=ie.useCallback(Y=>le({action:"play",cardId:Y}),[le]),we=ie.useCallback(()=>le({action:"draw"}),[le]),P=ie.useCallback(Y=>le({action:"pickColor",color:Y}),[le]),x=ie.useCallback(()=>le({action:"declareCero"}),[le]),C=ie.useCallback(async()=>{if(!(!r||T)){k(!0),w(null);try{await PC(r)}catch(Y){w((Y==null?void 0:Y.message)??"No se pudo abandonar")}finally{k(!1)}}},[r,T]),D=ie.useCallback(()=>w(null),[]),N=e?(e.players??[]).find(Y=>Y.uid!==K)??null:null,O=e?(($e=(e.players??[])[e.current])==null?void 0:$e.name)??"Rival":null;return{match:e,myHand:s,playableIds:ee,myPlayerIndex:W,isMyTurn:$,needsColorPick:ne,mustDeclareCero:J,opponent:N,currentPlayerName:O,loading:l,error:f,busy:T,pendingCard:Se,play:Ae,draw:we,pickColor:P,declareCero:x,forfeit:C,actionError:_,clearActionError:D}}`;

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

if (s.includes('function M0optPatch') && s.includes('pendingCard:Se')) {
  console.log('SKIP: useMatch-optimistic-v20 (already applied)');
} else {
  replaceBlock(
    'useMatch-optimistic-v20',
    'function sk(r){var A,ze,et,gt,$e',
    'const ok=[',
    NEW_SK,
  );
}

apply(
  'pk-pending-card-v20',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o,mustDeclareCero:M0mc=false}){const[l,h]=ie.useState(null);const[M0hint,setM0hint]=ie.useState(null);ie.useEffect(()=>{h(null),setM0hint(null)},[r.length]);const f=ie.useCallback(_=>{if(!t||o)return;if(!e.has(_)){h(_);if(M0mc)setM0hint("¡Tocá CERO! antes de jugar la última carta"),setTimeout(()=>setM0hint(null),2200);setTimeout(()=>h(T=>T===_?null:T),250);return}M0resumeAudio(),M0playCard(),s(_),h(null)},[t,o,e,s,M0mc]),g=[...r].sort((_,w)=>{const T=e.has(_.id)?0:1,k=e.has(w.id)?0:1;return T!==k?T-k:_.color.localeCompare(w.color)});return I.jsxs("div",{className:"flex flex-col items-center gap-1 w-full",children:[M0hint&&I.jsx("p",{className:"text-[0.65rem] font-bold text-pink-300 animate-pulse px-3 py-1 rounded-full border border-pink-500/50 bg-pink-950/60",children:M0hint}),I.jsx("div",{className:"flex items-end justify-center overflow-x-auto pb-2 w-full",style:{gap:"-20px"},children:g.map((_,w)=>{const T=t&&!o&&e.has(_.id),k=l===_.id,F=t&&!o&&!T;return I.jsx("div",{style:{marginRight:w<g.length-1?"-20px":void 0,zIndex:k?50:T?20+w:w,transition:"all 0.08s ease",opacity:F?.45:1,filter:F?"saturate(0.4) brightness(0.7)":void 0},children:I.jsx(T0,{color:_.color,value:_.value,isPlayable:T,isSelected:k,onClick:()=>f(_.id),onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})]});}',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o,pendingCard:M0pc=null,mustDeclareCero:M0mc=false}){const[l,h]=ie.useState(null);const[M0hint,setM0hint]=ie.useState(null);ie.useEffect(()=>{h(null),setM0hint(null)},[r.length]);const f=ie.useCallback(_=>{if(!t)return;if(M0pc!=null&&M0pc!==_)return;if(o&&M0pc==null)return;if(!e.has(_)){h(_);if(M0mc)setM0hint("¡Tocá CERO! antes de jugar la última carta"),setTimeout(()=>setM0hint(null),2200);setTimeout(()=>h(T=>T===_?null:T),180);return}M0resumeAudio(),M0playCard(),s(_),h(null)},[t,o,e,s,M0mc,M0pc]),g=[...r].sort((_,w)=>{const T=e.has(_.id)?0:1,k=e.has(w.id)?0:1;return T!==k?T-k:_.color.localeCompare(w.color)});return I.jsxs("div",{className:"flex flex-col items-center gap-1 w-full M0-hand-row",children:[M0hint&&I.jsx("p",{className:"text-[0.65rem] font-bold text-pink-300 animate-pulse px-3 py-1 rounded-full border border-pink-500/50 bg-pink-950/60",children:M0hint}),I.jsx("div",{className:"flex items-end justify-center overflow-x-auto pb-2 w-full",style:{gap:"-20px",contain:"layout style"},children:g.map((_,w)=>{const pe=M0pc===_.id,T=t&&e.has(_.id)&&!pe&&(M0pc==null||pe),k=l===_.id,F=t&&!T&&!pe;return I.jsx("div",{className:pe?"M0-card-pending":"",style:{marginRight:w<g.length-1?"-20px":void 0,zIndex:pe?60:k?50:T?20+w:w,transition:"transform .12s cubic-bezier(.25,.9,.35,1), opacity .12s ease, filter .12s ease",opacity:pe?.35:F?.45:1,filter:pe?"brightness(1.2)":F?"saturate(0.4) brightness(0.7)":void 0,transform:pe?"translate3d(0,-48px,0) scale(.92) rotate(-4deg)":void 0,willChange:"transform,opacity"},children:I.jsx(T0,{color:_.color,value:_.value,isPlayable:T,isSelected:k,onClick:()=>f(_.id),onTouchEnd:J=>{J.preventDefault(),f(_.id)}})},_.id)})})]});}',
);

apply(
  'pk-call-pending-v20',
  'I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k,mustDeclareCero:t.mustDeclareCero})',
  'I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k,pendingCard:t.pendingCard,mustDeclareCero:t.mustDeclareCero})',
);

apply(
  'jc-gpu-cards-v20',
  'function JC(r){const e=["relative select-none rounded-xl border-2 flex flex-col","font-extrabold transition-all duration-200 ease-out","overflow-hidden"];',
  'function JC(r){const e=["relative select-none rounded-xl border-2 flex flex-col","font-extrabold transition-transform duration-100 ease-out","overflow-hidden","will-change-transform"];',
);

apply(
  'jc-hover-gpu-v20',
  'r.isPlayable?e.push("cursor-pointer","hover:-translate-y-4 hover:scale-105 hover:z-10","active:scale-95")',
  'r.isPlayable?e.push("cursor-pointer","hover:-translate-y-4 hover:scale-105 hover:z-10","active:scale-95","M0-card-playable")',
);

apply(
  'fk-discard-pop-v20',
  'o?I.jsxs("div",{className:"relative flex flex-col items-center",children:[I.jsx(T0,{color:M0cc||o.color,value:o.value,small:!1}),M0cc&&I.jsxs("span"',
  'o?I.jsxs("div",{className:"relative flex flex-col items-center M0-discard-slot",children:[I.jsx("div",{className:"M0-discard-pop",key:(o.id??"")+"-"+(o.color??"")+"-"+(o.value??""),children:I.jsx(T0,{color:M0cc||o.color,value:o.value,small:!1})}),M0cc&&I.jsxs("span"',
);

apply(
  'fk-draw-fast-v20',
  'className:["relative transition-all duration-75",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" ")',
  'className:["relative transition-transform duration-100 will-change-transform",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" ")',
);

apply(
  'm0fx-css-v20',
  'el.textContent="@keyframes M0fxPop{0%{opacity:0;transform:scale(.6)}20%{opacity:1;transform:scale(1.08)}100%{opacity:0;transform:scale(1.2)}}";',
  'el.textContent="@keyframes M0fxPop{0%{opacity:0;transform:scale(.6)}20%{opacity:1;transform:scale(1.08)}100%{opacity:0;transform:scale(1.2)}}@keyframes M0discardPop{0%{opacity:.5;transform:scale(.82) rotate(-8deg)}55%{opacity:1;transform:scale(1.06) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}.M0-discard-pop{animation:M0discardPop .22s cubic-bezier(.25,.9,.35,1) forwards;will-change:transform,opacity}.M0-card-pending{pointer-events:none}.M0-hand-row .M0-card-playable:active{transform:translate3d(0,-6px,0) scale(.97)!important}";',
);

apply(
  't0-style-gpu-v20',
  'return I.jsxs("button",{type:"button",className:`${T} ${f}`,style:k,onClick:h,disabled:!h,"aria-label":`Carta ${tl[r].label} ${_}`,"title":M0cardHint(r,e),"aria-pressed":s,children:[I.jsx("div",{className:"absolute top-1 left-1.5 leading-none z-10",children:F}),I.jsx(YC,{value:_,ink:g.ink,isWild:w}),I.jsx("div",{className:"absolute bottom-1 right-1.5 leading-none rotate-180 z-10",children:F})]})}',
  'return I.jsxs("button",{type:"button",className:`${T} ${f}`,style:{...k,willChange:"transform"},onClick:h,disabled:!h,"aria-label":`Carta ${tl[r].label} ${_}`,"title":M0cardHint(r,e),"aria-pressed":s,children:[I.jsx("div",{className:"absolute top-1 left-1.5 leading-none z-10",children:F}),I.jsx(YC,{value:_,ink:g.ink,isWild:w}),I.jsx("div",{className:"absolute bottom-1 right-1.5 leading-none rotate-180 z-10",children:F})]})}',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-optimistic-v20.js applied');
