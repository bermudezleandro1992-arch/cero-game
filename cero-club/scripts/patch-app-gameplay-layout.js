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

// ── Mesa centrada: grid 100dvh, mano en flujo (sin fixed) ─────────────────────
apply(
  'vk-root-grid',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col select-none overflow-hidden",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"}',
  'return I.jsxs("div",{className:"h-[100dvh] max-h-[100dvh] grid grid-rows-[auto_auto_minmax(0,1fr)_auto] select-none overflow-hidden",style:{background:M0roomStyle(M0cos==null?void 0:M0cos.equippedRoomBg)}',
);

apply(
  'vk-opponent-spacing',
  'I.jsx("div",{className:"flex justify-center pt-6 pb-2",children:_?I.jsx(dk,',
  'I.jsx("div",{className:"flex justify-center pt-1 sm:pt-2 pb-0 shrink-0",children:_?I.jsx(dk,',
);

apply(
  'vk-status-spacing',
  'I.jsx("div",{className:"flex justify-center py-3",children:I.jsx(_k,{state:t})})',
  'I.jsx("div",{className:"flex justify-center py-0.5 sm:py-1 shrink-0",children:I.jsx(_k,{state:t})})',
);

apply(
  'vk-table-area',
  'I.jsx("div",{className:"flex-1 flex items-center justify-center px-4",children:I.jsxs("div",{className:"relative w-full max-w-lg",children:[I.jsx("div",{className:"absolute inset-0 rounded-full pointer-events-none",style:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #1c0f3a 0%, #080318 100%)",border:"3px solid rgba(124,58,237,.4)",boxShadow:"0 0 60px rgba(124,58,237,.2)"}}),I.jsx("div",{className:"relative z-10 py-14",children:I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k})})]})})',
  'I.jsx("div",{className:"flex items-center justify-center px-2 sm:px-4 min-h-0 overflow-hidden",children:I.jsxs("div",{className:"relative w-full max-w-lg scale-[0.92] sm:scale-100 origin-center",children:[I.jsx("div",{className:"absolute inset-0 rounded-full pointer-events-none",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),I.jsx("div",{className:"relative z-10 py-3 sm:py-6",children:I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k})})]})})',
);

// ── Mano en flujo + chat/sound inline ─────────────────────────────────────────
{
  const handStart = s.indexOf('I.jsxs("div",{className:`fixed bottom-0 left-0 right-0 z-40 flex flex-col');
  const handEnd = s.indexOf('o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s})', handStart);
  if (handStart < 0 || handEnd < 0) {
    console.error('PATCH FAILED: vk-hand-in-flow anchor not found');
    process.exit(1);
  }
  const handFrom = s.slice(handStart, handEnd + 'o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s})'.length);
  const handTo = `I.jsxs("div",{className:"relative z-30 shrink-0 flex flex-col items-center gap-1 sm:gap-2 px-2 sm:px-3 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]",style:{background:"linear-gradient(to top, rgba(4,3,13,.97) 0%, rgba(4,3,13,.75) 70%, transparent 100%)"},children:[I.jsxs("div",{className:"flex items-center justify-between w-full max-w-lg gap-2",children:[I.jsx("button",{type:"button",onClick:()=>M0setMuted(!M0isMuted()),className:"shrink-0 px-2 py-1 rounded-lg text-[0.6rem] font-bold border border-violet-800/60 text-violet-400 hover:text-violet-200",title:"Silenciar sonidos",children:M0isMuted()?"🔇":"🔊"}),o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s,inline:!0})]}),I.jsx(yk,{state:t}),I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k}),I.jsxs("p",{className:"text-[0.55rem] sm:text-[0.6rem] font-bold tracking-[0.12em] uppercase text-violet-400 opacity-70",children:["Vos · ",l.length," ",l.length===1?"carta":"cartas"]})]})`;
  s = s.replace(handFrom, handTo);
  console.log('OK: vk-hand-in-flow');
}

// ── Chat inline (no fixed) cuando inline=true ─────────────────────────────────
apply(
  'hk-inline-mode',
  'function hk({matchId:r,currentUid:e}){const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r);',
  'function hk({matchId:r,currentUid:e,inline:hkIn=false}){const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r);',
);

apply(
  'hk-position',
  'return I.jsxs("div",{className:"fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2",children:[Ae&&I.jsx(M0Projectile,',
  'return I.jsxs("div",{className:hkIn?"relative flex flex-col items-end gap-2 ml-auto":"fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2",children:[Ae&&I.jsx(M0Projectile,',
);

fs.writeFileSync(bundlePath, s);
console.log('Gameplay layout patch applied.');
