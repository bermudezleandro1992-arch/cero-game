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

// Safe hand sort — undefined card.color crashed React (black screen)
apply(
  'pk-safe-color-sort',
  'return T!==k?T-k:_.color.localeCompare(w.color)});',
  'return T!==k?T-k:(_.color||"").localeCompare(w.color||"")});',
);

// Ensure match is started before entering from lobby "Continuar"
apply(
  'ik-continue-ensure-start',
  'function f(_){try{sessionStorage.setItem("cero_active_match",_)}catch{}l(_)}',
  'async function f(_){try{sessionStorage.setItem("cero_active_match",_)}catch{}try{await M0EnsureStart({matchId:_})}catch{}l(_)}',
);

// vk: kick ensureMatchStarted on mount (rejoin / continue paths)
apply(
  'vk-mount-ensure-start',
  'ie.useEffect(()=>{M0pubCfgFn()().then(ne=>setM0wcfg(ne)).catch(()=>{})},[]);',
  'ie.useEffect(()=>{M0pubCfgFn()().then(ne=>setM0wcfg(ne)).catch(()=>{})},[]),ie.useEffect(()=>{if(!r)return;M0EnsureStart({matchId:r}).catch(()=>{})},[r]);',
);

// Sync overlay: only block when status is explicitly unknown (not missing/transient)
apply(
  'vk-sync-overlay-safe',
  '!(o.status==="waiting"||o.status==="playing"||o.phase==="game_over"||o.status==="finished")&&I.jsxs("div",{className:"fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 z-50",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("p",{className:"text-violet-300 text-sm",children:"Sincronizando sala…"})',
  '!!(o.status&&o.status!=="waiting"&&o.status!=="playing"&&o.status!=="finished"&&o.phase!=="game_over")&&I.jsxs("div",{className:"fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 z-50",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("p",{className:"text-violet-300 text-sm",children:"Sincronizando sala…"})',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-continue-room-v25.js done');
