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

// YC/QC crash when card.value is missing → blank React tree (black screen)
apply(
  'qc-yc-safe-value',
  'function QC(r){return bC[r]??r}',
  'function QC(r){const v=bC[r]??r;return v==null?"?":String(v)}',
);

apply(
  'yc-safe-length',
  'style:{fontSize:r.length>2?"1.4em":"1.8em",col',
  'style:{fontSize:(String(r??"").length>2)?"1.4em":"1.8em",col',
);

// fk chosen-color chip: tl[M0cc] could be undefined
apply(
  'fk-safe-chosen-color',
  'style:{color:tl[M0cc].ink,borderColor:tl[M0cc].ink+"99",background:tl[M0cc].bg}',
  'style:{color:(tl[M0cc]||tl.wild).ink,borderColor:(tl[M0cc]||tl.wild).ink+"99",background:(tl[M0cc]||tl.wild).bg}',
);

// Lobby room card: missing mode must not crash
apply(
  'vc-safe-mode',
  'const o=w0[r.mode],l=tl[o],h=((g=r.players[0])',
  'const o=w0[r.mode]||"blue",l=tl[o]||tl.blue,h=((g=r.players[0])',
);

// pk: skip malformed cards before sort/render
apply(
  'pk-filter-valid-cards',
  '),g=[...r].sort((_,w)=>{const T=e.has(_.id)?0:1,k=e.has(w.id)?0:1;return T!==k?T-k:(_.color||"").localeCompare(w.color||"")});',
  '),g=[...r].filter(c=>c&&c.id!=null).sort((_,w)=>{const T=e.has(_.id)?0:1,k=e.has(w.id)?0:1;return T!==k?T-k:(_.color||"").localeCompare(w.color||"")});',
);

// Error boundary — show recovery UI instead of black screen on render crash
const ERR_BOUNDARY =
  'class M0VkErr extends ie.Component{constructor(p){super(p);this.state={err:null}}static getDerivedStateFromError(e){return{err:e}}componentDidCatch(e){console.error("[M0VkErr]",e)}render(){return this.state.err?I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-4 px-6",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("p",{className:"text-4xl",children:"⚠️"}),I.jsx("p",{className:"text-white font-bold text-lg text-center",children:"No se pudo cargar la partida"}),I.jsx("p",{className:"text-violet-400 text-xs text-center max-w-xs break-words",children:String(this.state.err&&this.state.err.message||this.state.err||"")}),I.jsx("button",{type:"button",onClick:this.props.onExit,className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold",children:"Volver al lobby"})]}):this.props.children}}';

if (!s.includes('class M0VkErr extends ie.Component')) {
  const anchor = 'function Ik({user:r})';
  if (!s.includes(anchor)) {
    console.error('PATCH FAILED: Ik anchor for error boundary');
    process.exit(1);
  }
  s = s.replace(anchor, ERR_BOUNDARY + anchor);
  console.log('OK: m0-vk-error-boundary');
}

// Ik: entering overlay + ensureStart on ALL restore paths (quick match rejoin)
apply(
  'ik-entering-state',
  '[j,N]=ie.useState(null),[A,ze]=ie.useState(null);ie.useEffect(()=>{window.__ceroSpectate=O;',
  '[j,N]=ie.useState(null),[A,ze]=ie.useState(null),[M0entering,setM0entering]=ie.useState(!1);ie.useEffect(()=>{window.__ceroSpectate=O;',
);

apply(
  'ik-boot-ensure-start',
  'const m=sessionStorage.getItem("cero_active_match");m&&l(m)}catch{}},[])',
  'const m=sessionStorage.getItem("cero_active_match");if(m){setM0entering(!0);(async()=>{try{await M0EnsureStart({matchId:m})}catch{}try{l(m)}catch{}finally{setM0entering(!1)}})()}}catch{}},[])',
);

apply(
  'ik-m0l-ensure-start',
  'if(m===_.matchId||_.status==="playing"){l(_.matchId);try{sessionStorage.setItem("cero_active_match",_.matchId)}catch{}}',
  'if(m===_.matchId||_.status==="playing"){const mid=m===_.matchId?m:_.matchId;setM0entering(!0);(async()=>{try{await M0EnsureStart({matchId:mid})}catch{}try{sessionStorage.setItem("cero_active_match",mid)}catch{}l(mid);setM0entering(!1)})()}',
);

apply(
  'ik-entering-overlay',
  'if(S)return I.jsx(M0T,{matchId:S,onExit:()=>O(null)});if(o)return I.jsx(vk,{matchId:o,onExit:()=>{try{sessionStorage.removeItem("cero_active_match")}catch{}l(null)}});',
  'if(S)return I.jsx(M0T,{matchId:S,onExit:()=>O(null)});if(M0entering&&!o)return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-4 px-6",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("div",{className:"w-12 h-12 border-4 border-emerald-500 border-t-emerald-200 rounded-full animate-spin"}),I.jsx("p",{className:"text-emerald-200 font-bold text-sm",children:"Entrando a tu partida…"})]});if(o)return I.jsx(M0VkErr,{onExit:()=>{try{sessionStorage.removeItem("cero_active_match")}catch{}l(null)},children:I.jsx(vk,{matchId:o,onExit:()=>{try{sessionStorage.removeItem("cero_active_match")}catch{}l(null)}})});',
);

apply(
  'ik-f-entering-flag',
  'async function f(_){try{sessionStorage.setItem("cero_active_match",_)}catch{}try{await M0EnsureStart({matchId:_})}catch{}l(_)}',
  'async function f(_){if(M0entering)return;setM0entering(!0);try{try{sessionStorage.setItem("cero_active_match",_)}catch{}try{await M0EnsureStart({matchId:_})}catch{}l(_)}finally{setM0entering(!1)}}',
);

// Brighter vk loading (dark bg looked like black screen on mobile)
{
  const loadStart = 'if(w)return I.jsxs("div",{className:`min-h-screen flex flex-col items-center justify-center';
  const loadEnd = 'children:"Conectando con la sala…"})]});';
  const i = s.indexOf(loadStart);
  const j = i >= 0 ? s.indexOf(loadEnd, i) : -1;
  if (i === -1 || j === -1) {
    console.error('PATCH FAILED: vk-loading-bright');
    process.exit(1);
  }
  const bright =
    'if(w)return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-4 px-6",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("div",{className:"w-12 h-12 border-4 border-emerald-500 border-t-emerald-200 rounded-full animate-spin"}),I.jsx("p",{className:"text-emerald-200 font-bold text-sm tracking-wide",children:"Conectando con la sala…"})]});';
  s = s.slice(0, i) + bright + s.slice(j + loadEnd.length);
  console.log('OK: vk-loading-bright');
}

// isMyTurn: recognize engine phases my_turn / opp_turn (quick match)
apply(
  'sk-is-my-turn-phases',
  '$=!!(e&&e.status==="playing"&&e.phase!=="game_over"&&e.phase!=="color_pick"&&e.phase!=="waiting"&&e.current===W)',
  '$=!!(e&&e.status==="playing"&&e.current===W&&(e.phase==="my_turn"||e.phase!=="game_over"&&e.phase!=="color_pick"&&e.phase!=="waiting"&&e.phase!=="opp_turn"))',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-continue-room-v26.js done');
