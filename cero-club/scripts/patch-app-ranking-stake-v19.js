#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 260));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

apply(
  'guest-nav-no-ranking-v19',
  'Ekg?wk.filter(x=>x.id==="home"||x.id==="ranking"||x.id==="profile"):wk',
  'Ekg?wk.filter(x=>x.id==="home"||x.id==="profile"):wk',
);

apply(
  'ranking-guest-block-v19',
  'function jC({currentUid:r,isGuest:JCg=false}){const{showToast:e}=Oo()',
  'function jC({currentUid:r,isGuest:JCg=false}){if(JCg)return I.jsxs("div",{className:"w-full flex flex-col items-center justify-center px-4 pt-16 pb-36 gap-4 min-h-[60vh]",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("span",{className:"text-5xl",children:"🏆"}),I.jsx("h1",{className:"text-2xl font-black text-white",children:"Ranking"}),I.jsx("p",{className:"text-sm text-violet-300 text-center max-w-sm leading-relaxed",children:"Creá una cuenta para competir en el ranking. Solo suman victorias en partidas con CeroCoins (no juego rápido gratuito)."}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors",children:"Registrarme"})]});const{showToast:e}=Oo()',
);

apply(
  'ranking-query-registered-only-v19',
  'const W=jf(za(br,"users"),zf(fld,"desc"),p0(100));',
  'const W=jf(za(br,"users"),zf("anon","==",!1),zf(fld,"desc"),p0(100));',
);

apply(
  'ranking-stake-info-v19',
  'children:tab==="monthly"?"Reset el día 1 · Top 3 ganan CC":"Reset en "+K+" · Top 10 ganan CC"',
  'children:tab==="monthly"?"Reset el día 1 · Top 3 ganan CC · Solo partidas con CeroCoins":"Reset en "+K+" · Top 10 ganan CC · Solo partidas con CeroCoins"',
);

apply(
  'remove-guest-ranking-banner-v19',
  'JCg&&I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center mb-2",children:[I.jsx("p",{className:"text-xs text-amber-200",children:"Modo invitado — solo top 3"}),I.jsx("a",{href:"/login.html",className:"text-xs text-amber-400 underline font-bold",children:"Registrate para ver ranking completo"})]}),',
  '',
);

apply(
  'remove-guest-top3-slice-v19',
  '(JCg?t.slice(0,3):t).map((W,$)=>',
  't.map((W,$)=>',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-ranking-stake-v19.js applied');
