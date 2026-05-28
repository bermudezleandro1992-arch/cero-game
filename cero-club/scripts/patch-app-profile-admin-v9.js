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

function applyAll(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 280));
    process.exit(1);
  }
  s = s.split(from).join(to);
  console.log(`OK: ${name}`);
}

// ── Perfil: quitar estado/callbacks de cosméticos ─────────────────────────────
apply(
  'profile-remove-cos-state',
  'function $C({userId:r,isGuest:PCg=false,guestName:PCgn=""}){var $,ne,J;const{showToast:e}=Oo(),[t,s]=ie.useState(null),[o,l]=ie.useState(!0),[h,f]=ie.useState(!1),[g,_]=ie.useState("card_skin");ie.useEffect(()=>{(async()=>{try{await or(ur,"initUserProfile")({})}catch{}Co(Ba(br,"users",r),le=>{le.exists()&&s(le.data()),l(!1)},le=>{e("Error cargando perfil: "+le.message,"error"),l(!1)})})()},[r,e]);const w=ie.useCallback(async ee=>{if(!h){f(!0);try{await or(ur,"purchaseCosmetic")({cosmeticId:ee}),e("¡Cosmético comprado!","success")}catch(le){e(le instanceof Error?le.message:"Error al comprar","error")}finally{f(!1)}}},[h,e]),T=ie.useCallback(async ee=>{if(!h){f(!0);try{await or(ur,"equipCosmetic")({cosmeticId:ee})}catch(le){e(le instanceof Error?le.message:"Error al equipar","error")}finally{f(!1)}}},[h,e]);',
  'function $C({userId:r,isGuest:PCg=false,guestName:PCgn="",onGoStore:M0goStore=null}){var $,ne,J;const{showToast:e}=Oo(),[t,s]=ie.useState(null),[o,l]=ie.useState(!0),[h,f]=ie.useState(!1);ie.useEffect(()=>{(async()=>{try{await or(ur,"initUserProfile")({})}catch{}Co(Ba(br,"users",r),le=>{le.exists()&&s(le.data()),l(!1)},le=>{e("Error cargando perfil: "+le.message,"error"),l(!1)})})()},[r,e]);',
);

apply(
  'profile-remove-cos-vars',
  'const k=(($=t.vip)==null?void 0:$.active)===!0,F=t.ownedCosmetics??[],K=$y.filter(ee=>ee.category===g),M0gp=Math.max(t.totalGamesPlayed??0,t.gamesPlayed??0)',
  'const k=(($=t.vip)==null?void 0:$.active)===!0,M0gp=Math.max(t.totalGamesPlayed??0,t.gamesPlayed??0)',
);

const cosmeticsBlock =
  'I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("h3",{className:"text-sm font-bold text-violet-300 uppercase tracking-widest",children:"Cosméticos"}),I.jsx("p",{className:"text-[0.65rem] text-violet-500 text-center",children:"Mismos ítems que en Tienda → Cosméticos CC"}),I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-800/50",children:M0CAT_TABS.map(ee=>I.jsx("button",{type:"button",onClick:()=>_(ee.id),className:["flex-1 py-1.5 sm:py-2 text-[0.55rem] sm:text-xs font-bold uppercase tracking-wide transition-all",g===ee.id?"bg-violet-900/60 text-violet-200":"text-violet-500 hover:text-violet-400"].join(" "),children:ee.label},ee.id))}),I.jsx("div",{className:"grid grid-cols-2 gap-3",children:K.map(ee=>I.jsx(BC,{item:ee,owned:F.includes(ee.id),equipped:(t[M0equipField(ee.category)]??null)===ee.id,balance:t.ceroCoins,onBuy:w,onEquip:T,busy:h},ee.id))}),I.jsx("p",{className:"text-xs text-violet-600 text-center",children:"Los cosméticos no afectan la jugabilidad — solo son visuales"})]})';

const storeLinkBlock =
  'I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-violet-700/40 bg-violet-950/25 flex flex-col gap-2 text-center",children:[I.jsx("p",{className:"text-xs font-bold text-violet-300 uppercase tracking-widest",children:"Personalización"}),I.jsx("p",{className:"text-[0.72rem] text-violet-400 leading-relaxed",children:"Skins, marcos, mesas y fondos están en la Tienda."}),M0goStore?I.jsx("button",{type:"button",onClick:M0goStore,className:"w-full py-2.5 rounded-xl font-bold text-sm border-2 border-amber-500/60 text-amber-200 bg-amber-950/30 hover:bg-amber-950/50 transition-all",children:"Ir a Tienda · Cosméticos CC →"}):I.jsx("p",{className:"text-[0.65rem] text-violet-500",children:"Andá a Tienda → Cosméticos CC"})]})';

apply('profile-remove-cosmetics-ui', cosmeticsBlock, storeLinkBlock);

// Ik: pasar callback a tienda desde perfil
apply(
  'ik-profile-go-store',
  'profile:I.jsx($C,{userId:r.uid,isGuest:r.isAnonymous===true,guestName:r.displayName??"Invitado"})',
  'profile:I.jsx($C,{userId:r.uid,isGuest:r.isAnonymous===true,guestName:r.displayName??"Invitado",onGoStore:()=>s("store")})',
);

// Tienda: texto sin referencia al perfil
apply(
  'store-desc-no-profile',
  'Skins, marcos, mesas, fondos y mazos — los mismos del Perfil. Pagás con Cero Coins y equipás acá o en tu perfil.',
  'Skins, marcos, mesas, fondos y mazos. Pagás con Cero Coins y equipás desde acá.',
);

// ── Scroll global: más padding inferior (nav + safe area) ─────────────────────
apply(
  'ik-main-scroll-padding',
  'I.jsx("main",{className:"flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-24",style:{WebkitOverflowScrolling:"touch"},children:g[t]})',
  'I.jsx("main",{className:"flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-32",style:{WebkitOverflowScrolling:"touch",paddingBottom:"max(8rem,calc(env(safe-area-inset-bottom,0px) + 5.5rem))"},children:g[t]})',
);

applyAll('tabs-bottom-padding', 'pb-28', 'pb-36');

// Pantallas bloqueadas (invitado) dentro del scroll — no usar min-h-screen
apply(
  'guest-lock-missions-scroll',
  'missions:r.isAnonymous?I.jsx("div",{className:"min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4",style:{background:"#04030d"}',
  'missions:r.isAnonymous?I.jsx("div",{className:"w-full flex flex-col items-center justify-center px-6 py-20 pb-36 text-center gap-4",style:{background:"#04030d"}',
);

apply(
  'profile-loading-scroll',
  'if(o)return I.jsx("div",{className:"min-h-screen flex items-center justify-center bg-[#04030d]"',
  'if(o)return I.jsx("div",{className:"w-full flex items-center justify-center py-24 bg-[#04030d]"',
);

const bt = '`';

apply(
  'profile-notfound-scroll',
  'if(!t)return I.jsx("div",{className:' + bt + 'min-h-screen flex items-center justify-center bg-[#04030d]',
  'if(!t)return I.jsx("div",{className:' + bt + 'w-full flex items-center justify-center py-24 bg-[#04030d]',
);

fs.writeFileSync(bundlePath, s);
console.log('Profile & admin v9 applied.');
