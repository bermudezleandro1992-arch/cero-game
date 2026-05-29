#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 320));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// React #300: jC llamaba hooks solo para usuarios registrados (early return invitado antes de hooks)
apply(
  'jC-hooks-before-guest-ui',
  'function jC({currentUid:r,isGuest:JCg=false}){if(JCg)return I.jsxs("div",{className:"w-full flex flex-col items-center justify-center px-4 pt-16 pb-36 gap-4 min-h-[60vh]",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("span",{className:"text-5xl",children:"🏆"}),I.jsx("h1",{className:"text-2xl font-black text-white",children:"Ranking"}),I.jsx("p",{className:"text-sm text-violet-300 text-center max-w-sm leading-relaxed",children:"Creá una cuenta para competir en el ranking. Solo suman victorias en partidas con CeroCoins (no juego rápido gratuito)."}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors",children:"Registrarme"})]});const{showToast:e}=Oo(),[t,s]=ie.useState([]),[o,l]=ie.useState(!0),[h,f]=ie.useState(null),[tab,setTab]=ie.useState("weekly");ie.useEffect(()=>{const fld=tab==="monthly"?"monthlyWins":"weeklyWins";const W=jf(za(br,"users"),zf("anon","==",!1),zf(fld,"desc"),p0(100));return Co(W,ne=>{',
  'function jC({currentUid:r,isGuest:JCg=false}){const{showToast:e}=Oo(),[t,s]=ie.useState([]),[o,l]=ie.useState(!0),[h,f]=ie.useState(null),[tab,setTab]=ie.useState("weekly");ie.useEffect(()=>{if(JCg){s([]);f(null);l(!1);return}const fld=tab==="monthly"?"monthlyWins":"weeklyWins";const W=jf(za(br,"users"),zf("anon","==",!1),zf(fld,"desc"),p0(100));return Co(W,ne=>{',
);

apply(
  'jC-guest-ui-after-hooks',
  'const prize=tab==="monthly"?M0Monthly:By;const topN=tab==="monthly"?3:10;return I.jsxs("div",{className:"w-full flex flex-col items-center px-4 pt-8 pb-36 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"text-center",children:[I.jsx("h1",{className:"text-3xl font-black text-white tracking-tight",children:tab==="monthly"?"Ranking Mensual":"Ranking Semanal"})',
  'const prize=tab==="monthly"?M0Monthly:By;const topN=tab==="monthly"?3:10;if(JCg)return I.jsxs("div",{className:"w-full flex flex-col items-center justify-center px-4 pt-16 pb-36 gap-4 min-h-[60vh]",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("span",{className:"text-5xl",children:"🏆"}),I.jsx("h1",{className:"text-2xl font-black text-white",children:"Ranking"}),I.jsx("p",{className:"text-sm text-violet-300 text-center max-w-sm leading-relaxed",children:"Creá una cuenta para competir en el ranking. Solo suman victorias en partidas con CeroCoins (no juego rápido gratuito)."}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-colors",children:"Registrarme"})]});return I.jsxs("div",{className:"w-full flex flex-col items-center px-4 pt-8 pb-36 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"text-center",children:[I.jsx("h1",{className:"text-3xl font-black text-white tracking-tight",children:tab==="monthly"?"Ranking Mensual":"Ranking Semanal"})',
);

apply(
  'jC-effect-deps-guest',
  '},[r,e,tab]);const g=new Date,w=(8-g.getUTCDay())%7||7,T=new Date(g);T.setUTCDate(g.getUTCDate()+w),T.setUTCHours(0,0,0,0);const k=T.getTime()-g.getTime(),F=Math.floor(k/36e5),K=F>=24?Math.floor(F/24)+"d "+F%24+"h":F+"h";const prize=tab==="monthly"?M0Monthly:By;const topN=tab==="monthly"?3:10;if(JCg)return',
  '},[r,e,tab,JCg]);const g=new Date,w=(8-g.getUTCDay())%7||7,T=new Date(g);T.setUTCDate(g.getUTCDate()+w),T.setUTCHours(0,0,0,0);const k=T.getTime()-g.getTime(),F=Math.floor(k/36e5),K=F>=24?Math.floor(F/24)+"d "+F%24+"h":F+"h";const prize=tab==="monthly"?M0Monthly:By;const topN=tab==="monthly"?3:10;if(JCg)return',
);

// Evita pantalla negra total si jC lanza en runtime
apply(
  'ranking-error-boundary',
  'ranking:I.jsx(jC,{currentUid:r.uid,isGuest:r.isAnonymous===true})',
  'ranking:I.jsx(M0VkErr,{onExit:()=>s("home"),children:I.jsx(jC,{currentUid:r.uid,isGuest:r.isAnonymous===true})})',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-ranking-fix-v30.js done');
