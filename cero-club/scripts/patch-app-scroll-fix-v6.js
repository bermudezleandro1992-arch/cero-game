#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 220));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// Shell app: cadena flex completa para que <main> pueda hacer scroll interno
apply(
  'ik-scroll-shell',
  'return I.jsxs("div",{className:"flex flex-col min-h-screen",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),et,I.jsx("main",{className:"flex-1 pb-20 overflow-y-auto",children:g[t]}),I.jsx(Ek,{active:t,onChange:s,isGuest:r.isAnonymous===true})]})',
  'return I.jsxs("div",{className:"flex flex-col h-full min-h-0 overflow-hidden",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),et,I.jsx("main",{className:"flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-24",style:{WebkitOverflowScrolling:"touch"},children:g[t]}),I.jsx(Ek,{active:t,onChange:s,isGuest:r.isAnonymous===true})]})',
);

// Wrapper raíz React: llena #root (100dvh) para propagar altura al shell
apply(
  'xk-full-height',
  ':I.jsx(_C,{children:I.jsx(Ik,{user:r})})}const I0=document.getElementById("root")',
  ':I.jsx(_C,{children:I.jsx("div",{className:"h-full min-h-0 flex flex-col",children:I.jsx(Ik,{user:r})})})}const I0=document.getElementById("root")',
);

// Perfil: padding inferior extra para nav + contenido largo (pase, push, historial)
apply(
  'profile-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-8 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"flex flex-col items-center gap-3",children:[I.jsxs("div",{className:"relative",children:[I.jsx("label",{className:"cursor-pointer block",children:[I.jsx("div",{className:"w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-4xl bg-violet-900/40 border-4",style:{borderColor:t.equippedFrame?"#a78bfa":"#4c1d95",boxShadow:t.equippedFrame?"0 0 20px rgba(167,139,250,.5)":"none"},children:t.photoURL?I.jsx("img",{src:t.photoURL,alt:"",className:"w-full h-full object-cover"}):t.equippedFrame?(($y.find(ee=>ee.id===t.equippedFrame))==null?void 0:$y.find(ee=>ee.id===t.equippedFrame).preview)??"🎮":"🎮"}),I.jsx("input",{type:"file",accept:"image/jpeg,image/png,image/webp",className:"hidden",onChange:async ee=>{var P;const le=(P=ee.target.files)==null?void 0:P[0];if(!le||le.size>8',
  'return I.jsxs("div",{className:"w-full flex flex-col items-center px-4 pt-8 pb-28 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"flex flex-col items-center gap-3",children:[I.jsxs("div",{className:"relative",children:[I.jsx("label",{className:"cursor-pointer block",children:[I.jsx("div",{className:"w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-4xl bg-violet-900/40 border-4",style:{borderColor:t.equippedFrame?"#a78bfa":"#4c1d95",boxShadow:t.equippedFrame?"0 0 20px rgba(167,139,250,.5)":"none"},children:t.photoURL?I.jsx("img",{src:t.photoURL,alt:"",className:"w-full h-full object-cover"}):t.equippedFrame?(($y.find(ee=>ee.id===t.equippedFrame))==null?void 0:$y.find(ee=>ee.id===t.equippedFrame).preview)??"🎮":"🎮"}),I.jsx("input",{type:"file",accept:"image/jpeg,image/png,image/webp",className:"hidden",onChange:async ee=>{var P;const le=(P=ee.target.files)==null?void 0:P[0];if(!le||le.size>8',
);

// Misiones: mismo padding inferior
apply(
  'missions-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Misiones"})',
  'return I.jsxs("div",{className:"w-full px-4 pt-8 pb-28 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Misiones"})',
);

// Ranking: padding inferior
apply(
  'ranking-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-8 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[JCg&&I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center mb-2",children:[I.jsx("p",{className:"text-xs text-amber-200",children:"Modo invitado — solo top 3"})',
  'return I.jsxs("div",{className:"w-full flex flex-col items-center px-4 pt-8 pb-28 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[JCg&&I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center mb-2",children:[I.jsx("p",{className:"text-xs text-amber-200",children:"Modo invitado — solo top 3"})',
);

// Lobby: padding inferior
apply(
  'lobby-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-10 gap-8",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[OCg&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center",children:[I.jsx("p",{className:"text-xs font-bold text-amber-300 uppercase tracking-widest",chil',
  'return I.jsxs("div",{className:"w-full flex flex-col items-center px-4 pt-10 pb-28 gap-8",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[OCg&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center",children:[I.jsx("p",{className:"text-xs font-bold text-amber-300 uppercase tracking-widest",chil',
);

// Tienda: padding inferior
apply(
  'store-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-6 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"})',
  'return I.jsxs("div",{className:"w-full px-4 pt-8 pb-28 flex flex-col gap-6 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"})',
);

// Torneos: padding inferior
apply(
  'tournament-scroll-padding',
  'return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Torneo semanal"})',
  'return I.jsxs("div",{className:"w-full px-4 pt-8 pb-28 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Torneo semanal"})',
);

fs.writeFileSync(bundlePath, s);
console.log('Scroll fix v6 applied.');
