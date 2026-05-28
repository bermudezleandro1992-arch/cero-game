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

// ── FIX CRÍTICO: Rc(fn) espera getter, no fn() ───────────────────────────────
// Rc hace: (await r()(data)).data — r debe ser () => callable
const beforeRc = (s.match(/Rc\(M0[A-Za-z0-9_]+\(\)/g) || []).length;
s = s.replace(/Rc\((M0[A-Za-z0-9_]+)\(\)/g, 'Rc($1');
const afterRc = (s.match(/Rc\(M0[A-Za-z0-9_]+\(\)/g) || []).length;
console.log(`OK: fix-rc-callables (${beforeRc} → ${afterRc} remaining)`);

// or(ur,...) direct calls stay as or(ur,"x")({}) — OK

// ── Cosméticos extra estilo UNO / Mattel ───────────────────────────────────────
apply(
  'catalog-extra-cosmetics',
  '{id:"deck_cyber",name:"Mazo Cyber",category:"deck_back",price:450,preview:"🤖"}];function gd(',
  '{id:"deck_cyber",name:"Mazo Cyber",category:"deck_back",price:450,preview:"🤖"},{id:"table_felt",name:"Mesa Casino",category:"table_bg",price:380,preview:"🎰"},{id:"table_galaxy",name:"Mesa Galaxia",category:"table_bg",price:620,preview:"🌌"},{id:"table_royal",name:"Mesa Real",category:"table_bg",price:800,preview:"👑"},{id:"bg_casino",name:"Casino VIP",category:"room_bg",price:550,preview:"🎲"},{id:"bg_neon",name:"Neón Cyber",category:"room_bg",price:480,preview:"🌃"},{id:"bg_arena",name:"Arena Pro",category:"room_bg",price:650,preview:"🏟️"},{id:"skin_carbon",name:"Cartas Carbon",category:"card_skin",price:280,preview:"🖤"},{id:"skin_rainbow",name:"Cartas Arcoíris",category:"card_skin",price:420,preview:"🌈"},{id:"frame_diamond",name:"Marco Diamante",category:"avatar_frame",price:900,preview:"💎"},{id:"frame_legend",name:"Marco Leyenda",category:"avatar_frame",price:1200,preview:"🏆"},{id:"deck_holo",name:"Mazo Holográfico",category:"deck_back",price:520,preview:"✨"}];function gd(',
);

apply(
  'table-bg-extra-styles',
  'table_carbon:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #121218 0%, #020204 100%)",border:"3px solid rgba(80,80,90,.5)",boxShadow:"0 0 40px rgba(0,0,0,.8)"}};',
  'table_carbon:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #121218 0%, #020204 100%)",border:"3px solid rgba(80,80,90,.5)",boxShadow:"0 0 40px rgba(0,0,0,.8)"},table_felt:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #14532d 0%, #052e16 100%)",border:"3px solid rgba(74,222,128,.45)",boxShadow:"0 0 60px rgba(34,197,94,.25)"},table_galaxy:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #312e81 0%, #0f0720 100%)",border:"3px solid rgba(167,139,250,.5)",boxShadow:"0 0 70px rgba(139,92,246,.35)"},table_royal:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #422006 0%, #1a0a02 100%)",border:"3px solid rgba(245,158,11,.55)",boxShadow:"0 0 70px rgba(217,119,6,.3)"}};',
);

apply(
  'room-bg-extra-styles',
  'bg_football:"radial-gradient(ellipse at 50% 30%, #0f6030 0%, #04030d 68%), repeating-linear-gradient(0deg,rgba(74,222,128,.08) 0 40px,transparent 40px 80px)"};',
  'bg_football:"radial-gradient(ellipse at 50% 30%, #0f6030 0%, #04030d 68%), repeating-linear-gradient(0deg,rgba(74,222,128,.08) 0 40px,transparent 40px 80px)",bg_casino:"radial-gradient(ellipse at 50% 15%, #4a1040 0%, #04030d 65%), radial-gradient(circle at 20% 80%, rgba(245,158,11,.12) 0%, transparent 50%)",bg_neon:"radial-gradient(ellipse at 50% 10%, #0e7490 0%, #04030d 60%), repeating-linear-gradient(0deg,rgba(34,211,238,.08) 0 2px,transparent 2px 24px)",bg_arena:"radial-gradient(ellipse at 50% 20%, #1e3a5f 0%, #04030d 65%), linear-gradient(180deg,rgba(96,165,250,.1) 0%,transparent 40%)"};',
);

apply(
  'deck-bg-extra',
  'deck_cyber:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(96,165,250,.5)"}};',
  'deck_cyber:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(96,165,250,.5)"},deck_holo:{background:"linear-gradient(145deg,#4c1d95,#0f172a,#065f46)",borderColor:"rgba(167,139,250,.6)"}};',
);

// ── Tienda: tabs Ofertas + Emotes estilo UNO ───────────────────────────────────
apply(
  'store-tabs-uno',
  'I.jsx("button",{type:"button",onClick:()=>s("cosmetics"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="cosmetics"?"bg-pink-600 text-white":"text-violet-400 border border-violet-800"),children:"Cosméticos CC"})]}),t==="cosmetics"?',
  'I.jsx("button",{type:"button",onClick:()=>s("cosmetics"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="cosmetics"?"bg-pink-600 text-white":"text-violet-400 border border-violet-800"),children:"Cosméticos CC"}),I.jsx("button",{type:"button",onClick:()=>s("offers"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="offers"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"Ofertas"}),I.jsx("button",{type:"button",onClick:()=>s("emotes"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="emotes"?"bg-sky-600 text-white":"text-violet-400 border border-violet-800"),children:"Emotes"})]}),t==="offers"?I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-amber-300 text-center font-bold",children:"🔥 Ofertas destacadas — estilo UNO"}),I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-violet-950/30",children:[I.jsx("p",{className:"text-sm font-black text-white",children:"Pack Iniciante"}),I.jsx("p",{className:"text-xs text-violet-300 mt-1",children:"500 CC + Marco Fuego + Mesa Neón"}),I.jsx("p",{className:"text-lg font-black text-amber-400 mt-2",children:"$5.990 ARS"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>h("pack_500"),className:"mt-3 w-full py-2.5 rounded-xl font-bold text-sm bg-amber-600 text-white",children:"Comprar pack"})]}),I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-500/40 bg-violet-950/30",children:[I.jsx("p",{className:"text-sm font-black text-white",children:"Pase VIP + 1500 CC"}),I.jsx("p",{className:"text-xs text-violet-300 mt-1",children:"VIP mensual + monedas para salas Pro"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{s("vip")},className:"mt-3 w-full py-2.5 rounded-xl font-bold text-sm border border-violet-500 text-violet-200",children:"Ver VIP"})]})]}):t==="emotes"?I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-sky-300 text-center",children:"Emotes rápidos para partida — usalos en el chat in-game"}),I.jsx("div",{className:"grid grid-cols-4 gap-2",children:["👋","😂","🔥","👏","😎","🎉","💪","😤","🤝","👑","💀","🍅"].map(u=>I.jsxs("div",{className:"p-3 rounded-xl border border-violet-800/50 bg-violet-950/30 text-center",children:[I.jsx("span",{className:"text-2xl",children:u}),I.jsx("p",{className:"text-[0.55rem] text-violet-500 mt-1",children:"Gratis"})]},u))}),I.jsx("p",{className:"text-[0.65rem] text-violet-600 text-center",children:"Pack premium de emotes animados — próximamente en Cosméticos CC"})]}):t==="cosmetics"?',
);

apply(
  'store-desc-uno',
  'Skins, marcos, mesas, fondos y mazos. Pagás con Cero Coins y equipás desde acá.',
  'Personalizá tu mesa como en UNO: skins, marcos, fondos, mazos y más. Comprá con CC y equipá al instante.',
);

// Sonidos: mapeo con archivos del usuario
apply(
  'sfx-user-files',
  'const M0SFX={card:"/app/sounds/card.mp3",cero:"/app/sounds/cero.mp3",draw:"/app/sounds/draw.mp3",win:"/app/sounds/win.mp3",projectile:"/app/sounds/projectile.mp3",lose:"/app/sounds/lose.mp3"}',
  'const M0SFX={card:"/app/sounds/card.mp3",cero:"/app/sounds/cero.mp3",draw:"/app/sounds/draw.mp3",win:"/app/sounds/win.mp3",projectile:"/app/sounds/win.mp3",lose:"/app/sounds/draw.mp3"}',
);

fs.writeFileSync(bundlePath, s);
console.log('Full fix v11 applied.');
