#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 240));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// Header: online count beside logo (never overlaps right side / floating UI)
apply(
  'tk-header-layout',
  'children:[I.jsxs("span",{className:"font-black text-lg tracking-tight text-white",children:["CERO",I.jsx("span",{className:"text-violet-400",children:"."})]}),I.jsxs("div",{className:"flex items-center gap-3",children:[I.jsxs("span",{className:"hidden sm:inline text-[0.65rem] font-bold text-emerald-400/90 whitespace-nowrap",children:[I.jsx("span",{className:"inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"}),t," en línea"]}),I.jsx("span",{className:"text-xs font-semibold text-violet-400 truncate max-w-[120px]",children:r.displayName??r.email??"Jugador"}),I.jsx("button",{type:"button",onClick:e,className:"text-xs text-violet-600 hover:text-red-400 transition-colors",children:"Salir"})]})]',
  'children:[I.jsxs("div",{className:"flex items-center gap-2.5 min-w-0",children:[I.jsxs("span",{className:"font-black text-lg tracking-tight text-white shrink-0",children:["CERO",I.jsx("span",{className:"text-violet-400",children:"."})]}),I.jsxs("span",{className:"text-[0.6rem] font-bold text-emerald-400/85 whitespace-nowrap shrink-0",children:[I.jsx("span",{className:"inline-block w-1 h-1 rounded-full bg-emerald-400 mr-0.5 animate-pulse align-middle"}),t," online"]})]}),I.jsxs("div",{className:"flex items-center gap-2 shrink-0",children:[I.jsx("span",{className:"text-xs font-semibold text-violet-400 truncate max-w-[7rem] sm:max-w-[9rem]",children:r.displayName??r.email??"Jugador"}),I.jsx("button",{type:"button",onClick:e,className:"text-xs text-violet-600 hover:text-red-400 transition-colors whitespace-nowrap",children:"Salir"})]})]',
);

// Replace fixed floating pill → inline banner below header (no overlap)
apply(
  'ik-inline-active-banner',
  'const IkAct=j&&!o?{matchId:j.matchId,stakeCC:j.stakeCC??0,status:j.status||"playing",rejoin:!0}:A&&!o?{...A,rejoin:!1}:null;const et=IkAct?I.jsxs("button",{type:"button",onClick:()=>f(IkAct.matchId),className:"fixed right-3 top-[4.25rem] z-50 flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl text-white shadow-2xl border backdrop-blur-md transition-transform hover:scale-[1.02] active:scale-95 max-w-[11rem]",style:{background:IkAct.status==="playing"?"linear-gradient(135deg,rgba(16,185,129,.96),rgba(4,120,87,.94))":"linear-gradient(135deg,rgba(124,58,237,.96),rgba(76,29,149,.94))",borderColor:IkAct.status==="playing"?"rgba(110,231,183,.55)":"rgba(196,181,253,.45)",boxShadow:IkAct.status==="playing"?"0 10px 40px rgba(16,185,129,.35)":"0 10px 40px rgba(124,58,237,.35)"},children:[I.jsx("span",{className:"flex items-center justify-center w-9 h-9 rounded-xl text-lg shrink-0",style:{background:"rgba(0,0,0,.22)"},children:"🎮"}),I.jsxs("span",{className:"flex flex-col items-start leading-tight min-w-0",children:[I.jsx("span",{className:"text-[0.58rem] uppercase tracking-[0.14em] font-bold opacity-85 truncate w-full",children:IkAct.rejoin?"Reingresar":IkAct.status==="playing"?"Partida activa":"Sala abierta"}),I.jsx("span",{className:"text-[0.72rem] font-black truncate w-full",children:IkAct.stakeCC>0?IkAct.stakeCC+" CN · volver":"Gratuita · volver"})]})]}):null',
  'const IkAct=j&&!o?{matchId:j.matchId,stakeCC:j.stakeCC??0,status:j.status||"playing",rejoin:!0}:A&&!o?{...A,rejoin:!1}:null;const IkPlay=!!(IkAct&&(IkAct.rejoin||IkAct.status==="playing"));const et=IkAct?I.jsx("div",{className:"px-3 pt-2 pb-0 shrink-0",children:I.jsxs("div",{className:"flex items-center gap-2.5 px-3 py-2 rounded-xl border",style:{background:IkPlay?"rgba(6,78,59,.28)":"rgba(76,29,149,.28)",borderColor:IkPlay?"rgba(52,211,153,.3)":"rgba(167,139,250,.3)"},children:[I.jsx("span",{className:"text-sm shrink-0 leading-none",children:"🎮"}),I.jsxs("div",{className:"flex-1 min-w-0",children:[I.jsx("p",{className:"text-[0.62rem] font-bold uppercase tracking-wide truncate "+(IkPlay?"text-emerald-300":"text-violet-300"),children:IkAct.rejoin?"Partida activa — reingresá":IkPlay?"Partida en curso":"Sala esperando rival"}),I.jsx("p",{className:"text-[0.7rem] text-white/75 truncate",children:IkAct.stakeCC>0?IkAct.stakeCC+" CN":"Gratuita"})]}),I.jsx("button",{type:"button",onClick:()=>f(IkAct.matchId),className:"shrink-0 px-3 py-1.5 rounded-lg text-[0.7rem] font-bold text-white active:scale-95 transition-transform",style:{background:IkPlay?"#059669":"#7c3aed"},children:"Continuar"})]})}):null',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-lobby-banner-fix.js done');
