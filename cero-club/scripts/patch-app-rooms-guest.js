#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 160));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Restaurar sala activa al recargar + limpiar al salir ─────────────────────
apply(
  'ik-restore-active-match',
  'ie.useEffect(()=>{window.__ceroSpectate=O;try{const q=sessionStorage.getItem("cero_spectate");q&&(O(q),sessionStorage.removeItem("cero_spectate"))}catch{}},[])',
  'ie.useEffect(()=>{window.__ceroSpectate=O;try{const q=sessionStorage.getItem("cero_spectate");q&&(O(q),sessionStorage.removeItem("cero_spectate"));const m=sessionStorage.getItem("cero_active_match");m&&l(m)}catch{}},[])',
);

apply(
  'ik-exit-clear-session',
  'if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});',
  'if(o)return I.jsx(vk,{matchId:o,onExit:()=>{try{sessionStorage.removeItem("cero_active_match")}catch{}l(null)}});',
);

// ── vk: tutorial solo cuando hay mano; fallback si estado desconocido ─────────
apply(
  'vk-tutorial-only-playing',
  'children:[M0tu&&I.jsx(M0Tutorial,{onDone:()=>M0tuDone(!1)}),I.jsx(M0RejoinBanner',
  'children:[M0tu&&o.status==="playing"&&l.length>0&&I.jsx(M0Tutorial,{onDone:()=>M0tuDone(!1)}),I.jsx(M0RejoinBanner',
);

apply(
  'vk-fallback-unknown-state',
  '}),o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s})]})}let M0snd=null;',
  `}),o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s}),!(o.status==="waiting"||o.status==="playing"||o.phase==="game_over"||o.status==="finished")&&I.jsxs("div",{className:"fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 z-50",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("p",{className:"text-violet-300 text-sm",children:"Sincronizando sala…"}),I.jsx("button",{type:"button",onClick:e,className:"px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold",children:"Volver al lobby"})]})]})}let M0snd=null;`,
);

// ── OC: modo invitado — solo salas gratuitas ─────────────────────────────────
apply(
  'oc-guest-prop',
  'function OC({userId:r,userName:e,onJoined:t}){',
  'function OC({userId:r,userName:e,onJoined:t,isGuest:OCg=false}){',
);

apply(
  'oc-guest-banner',
  'children:[I.jsxs("div",{className:"text-center",children:[I.jsxs("h1"',
  'children:[OCg&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center",children:[I.jsx("p",{className:"text-xs font-bold text-amber-300 uppercase tracking-widest",children:"Modo invitado"}),I.jsx("p",{className:"text-[0.7rem] text-amber-200/90 mt-1",children:"Solo salas gratuitas · Sin ranking · Registrate para Cero Coins y VIP"})]}),I.jsxs("div",{className:"text-center",children:[I.jsxs("h1"',
);

apply(
  'oc-hide-paid-toggle-guest',
  '[{v:0,l:"Gratuita",c:"#4ade80"},{v:50,l:"50 CN",c:"#f59e0b",coin:!0}].map(ne=>',
  '[{v:0,l:"Gratuita",c:"#4ade80"},...(OCg?[]:[{v:50,l:"50 CN",c:"#f59e0b",coin:!0}])].map(ne=>',
);

apply(
  'oc-guest-force-free-create',
  'onClick:()=>W({stakeCC:j,createNew:!0})',
  'onClick:()=>W({stakeCC:OCg?0:j,createNew:!0})',
);

apply(
  'oc-guest-filter-rooms',
  'const mine=o.filter(ne=>((ne.players||[]).some(P=>P.uid===r)));const open=o.filter(ne=>!((ne.players||[]).some(P=>P.uid===r)));',
  'const mine=o.filter(ne=>((ne.players||[]).some(P=>P.uid===r)));const open=o.filter(ne=>!((ne.players||[]).some(P=>P.uid===r))&&(OCg?(ne.stakeCC??0)===0&&ne.guestOnly!==false:!ne.guestOnly));',
);

apply(
  'ik-pass-guest-to-lobby',
  'home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f})',
  'home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f,isGuest:r.isAnonymous===true})',
);

// ── vk waiting: mensaje si expira sola ───────────────────────────────────────
apply(
  'vk-waiting-stale-hint',
  'children:"Compartí el código o esperá a que alguien se una desde el lobby"})]}),I.jsx("button",{type:"button",disabled:k,onClick:async()=>{try{await NC(r)}catch{}e==null||e()}',
  'children:"Compartí el código o esperá a que alguien se una. Si nadie entra en ~4 min la sala se cierra sola."})]}),I.jsx("button",{type:"button",disabled:k,onClick:async()=>{try{await NC(r)}catch{}try{sessionStorage.removeItem("cero_active_match")}catch{}e==null||e()}',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-rooms-guest.js done');
