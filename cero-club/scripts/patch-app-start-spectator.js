#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 200));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// Callable ensureMatchStarted
apply(
  'ensure-start-callable',
  'let M0rej=null;',
  'let M0Ensure=null;function M0EnsureG(){return M0Ensure??(M0Ensure=or(ur,"ensureMatchStarted"))}async function M0EnsureStart(r){return Rc(M0EnsureG(),r)}let M0rej=null;',
);

// vk: auto-start when room is full but stuck waiting
apply(
  'vk-auto-start-effect',
  'M0left=ie.useRef(!1);ie.useEffect(()=>{if((o==null?void 0:o.status)!=="playing")return;const Y=setInterval(()=>{M0rejX(r).catch(()=>{})},12e3);',
  'M0left=ie.useRef(!1);const M0fs=ie.useRef(0);ie.useEffect(()=>{if(!r||!o)return;const cnt=o.playerCount??0,mx=o.maxPlayers??2;if(cnt<mx)return;const waiting=o.status==="waiting"||(o.status==="playing"&&o.phase==="waiting"&&!o.topDiscard);if(!waiting)return;let cancelled=!1;const kick=async()=>{if(cancelled||Date.now()-M0fs.current<3500)return;M0fs.current=Date.now();try{await M0EnsureStart({matchId:r})}catch{}};kick();const iv=setInterval(kick,5000);return()=>{cancelled=!0;clearInterval(iv)}},[r,o==null?void 0:o.status,o==null?void 0:o.playerCount,o==null?void 0:o.phase,o==null?void 0:o.topDiscard]);ie.useEffect(()=>{if((o==null?void 0:o.status)!=="playing")return;const Y=setInterval(()=>{M0rejX(r).catch(()=>{})},12e3);',
);

apply(
  'vk-waiting-title-full',
  'children:"Esperando rival…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[o.playerCount,"/",o.maxPlayers," jugadores ·',
  'children:(o.playerCount??0)>=(o.maxPlayers??2)?"Iniciando partida…":"Esperando rival…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[o.playerCount,"/",o.maxPlayers," jugadores ·',
);

// M0T spectator: fix infinite loading + auto-start + waiting UI
apply(
  'm0t-fix-loading',
  'ie.useEffect(()=>{M0M({matchId:r}).then(F=>h(F)).catch(()=>{})},[r,s==null?void 0:s.status]);async function $(F){',
  'ie.useEffect(()=>{M0M({matchId:r}).then(F=>h(F)).catch(()=>h({bettingOpenUntil:0,canBet:!1,pools:{},myBet:null,betPoolTotal:0,betCount:0}))},[r,s==null?void 0:s.status]);const M0tfs=ie.useRef(0);ie.useEffect(()=>{if(!r||!s)return;const cnt=s.playerCount??0,mx=s.maxPlayers??2;if(cnt<mx)return;const waiting=s.status==="waiting"||(s.status==="playing"&&s.phase==="waiting"&&!s.topDiscard);if(!waiting)return;let cancelled=!1;const kick=async()=>{if(cancelled||Date.now()-M0tfs.current<3500)return;M0tfs.current=Date.now();try{await M0EnsureStart({matchId:r})}catch{}};kick();const iv=setInterval(kick,5000);return()=>{cancelled=!0;clearInterval(iv)}},[r,s==null?void 0:s.status,s==null?void 0:s.playerCount,s==null?void 0:s.phase,s==null?void 0:s.topDiscard]);async function $(F){',
);

apply(
  'm0t-loading-only-match',
  'if(T&&(!s||!l))return I.jsx("div",{className:"min-h-screen flex items-center justify-center text-violet-400",children:"Cargando..."});k(!1);',
  'if(T&&!s)return I.jsx("div",{className:"min-h-screen flex items-center justify-center text-violet-400",children:"Cargando..."});k(!1);if(s&&(s.status==="waiting"||s.status==="playing"&&s.phase==="waiting"&&!s.topDiscard))return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-6 px-6",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("span",{className:"text-5xl animate-pulse",children:"⏳"}),I.jsx("h2",{className:"text-xl font-black text-white",children:(s.playerCount??0)>=(s.maxPlayers??2)?"Iniciando partida…":"Esperando jugadores…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[s.playerCount,"/",s.maxPlayers," jugadores"]}),I.jsx("button",{type:"button",onClick:e,className:"px-6 py-2 rounded-xl border border-violet-600 text-violet-300 text-sm font-bold",children:"Volver"})]});',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-start-spectator.js done');
