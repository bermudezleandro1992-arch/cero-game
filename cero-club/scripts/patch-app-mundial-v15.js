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

const FX_OLD =
  'st.textContent="@keyframes M0spin{to{transform:rotate(360deg)}}@keyframes M0pulseGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}"';

const FX_NEW =
  'st.textContent="@keyframes M0spin{to{transform:rotate(360deg)}}@keyframes M0pulseGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}@keyframes M0hue{to{filter:hue-rotate(360deg) brightness(1.15)}}@keyframes M0pulseRing{0%,100%{opacity:.85;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}}.M0-frame-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;z-index:0}.M0-ring-mundial{background:conic-gradient(from 0deg,#15803d,#fde047,#15803d,#fff,#15803d);animation:M0spin 3s linear infinite,M0pulseRing 2.2s ease-in-out infinite;mask:radial-gradient(circle,transparent 62%,#000 63%);-webkit-mask:radial-gradient(circle,transparent 62%,#000 63%)}.M0-ring-laser{background:conic-gradient(from 0deg,#ef4444,#eab308,#22c55e,#06b6d4,#a855f7,#ef4444);animation:M0spin 2.2s linear infinite,M0hue 5s linear infinite;mask:radial-gradient(circle,transparent 58%,#000 60%);-webkit-mask:radial-gradient(circle,transparent 58%,#000 60%)}.M0-ring-prism{background:conic-gradient(from 0deg,#f472b6,#818cf8,#34d399,#fbbf24,#f472b6);animation:M0spin 3.8s linear infinite,M0hue 6s linear infinite;mask:radial-gradient(circle,transparent 56%,#000 58%);-webkit-mask:radial-gradient(circle,transparent 56%,#000 58%)}.M0-ring-neon{background:conic-gradient(from 0deg,#22d3ee,#a78bfa,#22d3ee);animation:M0spin 4.5s linear infinite,M0pulseRing 1.8s ease-in-out infinite;mask:radial-gradient(circle,transparent 64%,#000 66%);-webkit-mask:radial-gradient(circle,transparent 64%,#000 66%)}"';

apply('fx-styles-v15', FX_OLD, FX_NEW);

const FRAME_STYLE_OLD =
  'function M0frameStyle(id){const m={frame_neon_ring:{borderColor:"#22d3ee",boxShadow:"0 0 26px rgba(34,211,238,.65)",animation:"M0spin 5s linear infinite"},frame_aurora:{borderColor:"#60a5fa",boxShadow:"0 0 34px rgba(96,165,250,.55)",animation:"M0pulseGlow 2.2s ease-in-out infinite"},frame_vip_glow:{borderColor:"#fbbf24",boxShadow:"0 0 42px rgba(245,158,11,.8)",animation:"M0pulseGlow 1.4s ease-in-out infinite"},frame_legend:{borderColor:"#f59e0b",boxShadow:"0 0 32px rgba(245,158,11,.6)"},frame_diamond:{borderColor:"#e0e7ff",boxShadow:"0 0 28px rgba(224,231,255,.5)"}};return m[id]||{borderColor:id?"#a78bfa":"#5b21b6",boxShadow:id?"0 0 28px rgba(167,139,250,.35)":void 0}}';

const FRAME_STYLE_NEW =
  'function M0frameRingCls(id){return{frame_mundial:"M0-ring-mundial",frame_laser:"M0-ring-laser",frame_prism:"M0-ring-prism",frame_neon_ring:"M0-ring-neon"}[id]||""}function M0AvatarFrame({frameId,size,className,children}){const ring=M0frameRingCls(frameId),sz=size||96;return I.jsxs("div",{className:"relative inline-flex items-center justify-center "+(className||""),style:{width:sz+(ring?14:0),height:sz+(ring?14:0)},children:[ring?I.jsx("div",{className:"M0-frame-ring "+ring,style:{width:sz+12,height:sz+12}}):null,I.jsx("div",{className:"relative z-10 rounded-full overflow-hidden flex items-center justify-center bg-violet-900/50 border-4 "+(ring?"":"ring-4 ring-violet-900/30"),style:{width:sz,height:sz,...M0frameStyle(frameId)},children:children})]})}function M0frameStyle(id){const m={frame_neon_ring:{borderColor:"transparent",boxShadow:"none"},frame_aurora:{borderColor:"#60a5fa",boxShadow:"0 0 34px rgba(96,165,250,.55)",animation:"M0pulseGlow 2.2s ease-in-out infinite"},frame_vip_glow:{borderColor:"#fbbf24",boxShadow:"0 0 42px rgba(245,158,11,.8)",animation:"M0pulseGlow 1.4s ease-in-out infinite"},frame_legend:{borderColor:"#f59e0b",boxShadow:"0 0 32px rgba(245,158,11,.6)"},frame_diamond:{borderColor:"#e0e7ff",boxShadow:"0 0 28px rgba(224,231,255,.5)"},frame_mundial:{borderColor:"transparent",boxShadow:"none"},frame_laser:{borderColor:"transparent",boxShadow:"0 0 18px rgba(239,68,68,.35)"},frame_prism:{borderColor:"transparent",boxShadow:"0 0 22px rgba(167,139,250,.45)"}};return m[id]||{borderColor:id?"#a78bfa":"#5b21b6",boxShadow:id?"0 0 28px rgba(167,139,250,.35)":void 0}}';

apply('avatar-frame-helpers-v15', FRAME_STYLE_OLD, FRAME_STYLE_NEW);

apply(
  'profile-avatar-frame-v15',
  'I.jsx("div",{className:"w-24 h-24 rounded-full flex items-center justify-center overflow-hidden text-4xl bg-violet-900/50 border-4 ring-4 ring-violet-900/30",style:M0frameStyle(t.equippedFrame),children:h?I.jsx("span",{className:"w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"}):t.photoURL?I.jsx("img",{src:t.photoURL,alt:"Avatar",className:"w-full h-full object-cover"}):t.equippedFrame?(($y.find(ee=>ee.id===t.equippedFrame))==null?void 0:$y.find(ee=>ee.id===t.equippedFrame).preview)??"🎮":"🎮"})',
  'I.jsx(M0AvatarFrame,{frameId:t.equippedFrame,size:96,className:"text-4xl",children:h?I.jsx("span",{className:"w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"}):t.photoURL?I.jsx("img",{src:t.photoURL,alt:"Avatar",className:"w-full h-full object-cover"}):t.equippedFrame?(($y.find(ee=>ee.id===t.equippedFrame))==null?void 0:$y.find(ee=>ee.id===t.equippedFrame).preview)??"🎮":"🎮"})',
);

apply(
  'cos-preview-animated-v15',
  'function M0cosPreview(r,e){const u=M0COS_IMG[r.id];return u?I.jsx("img",{src:u,alt:r.name,className:e||"w-full h-full object-cover rounded-lg"}):I.jsx("span",{className:"text-2xl",children:r.preview})}',
  'function M0cosPreview(r,e){if(r.category==="avatar_frame"&&M0frameRingCls(r.id))return I.jsx("div",{className:"w-full h-full flex items-center justify-center",children:I.jsx(M0AvatarFrame,{frameId:r.id,size:44,className:"text-lg",children:I.jsx("span",{children:r.preview})})});const u=M0COS_IMG[r.id];return u?I.jsx("img",{src:u,alt:r.name,className:e||"w-full h-full object-cover rounded-lg"}):I.jsx("span",{className:"text-2xl",children:r.preview})}',
);

apply(
  'room-bg-mundial-v15',
  'bg_arena:"radial-gradient(ellipse at 50% 20%, #1e3a5f 0%, #04030d 65%), linear-gradient(180deg,rgba(96,165,250,.1) 0%,transparent 40%)"};',
  'bg_arena:"radial-gradient(ellipse at 50% 20%, #1e3a5f 0%, #04030d 65%), linear-gradient(180deg,rgba(96,165,250,.1) 0%,transparent 40%)",bg_mundial:"radial-gradient(ellipse at 50% 22%, #0c4a6e 0%, #041018 55%, #04030d 100%), repeating-linear-gradient(0deg,rgba(21,128,61,.18) 0 48px,transparent 48px 96px)"};',
);

apply(
  'table-bg-mundial-v15',
  'table_royal:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #422006 0%, #1a0a02 100%)",border:"3px solid rgba(245,158,11,.55)",boxShadow:"0 0 70px rgba(217,119,6,.3)"}};',
  'table_royal:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #422006 0%, #1a0a02 100%)",border:"3px solid rgba(245,158,11,.55)",boxShadow:"0 0 70px rgba(217,119,6,.3)"},table_mundial:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #14532d 0%, #052e16 100%)",border:"3px solid rgba(253,224,71,.55)",boxShadow:"0 0 70px rgba(21,128,61,.35), inset 0 0 30px rgba(253,224,71,.08)"}};',
);

apply(
  'deck-bg-mundial-v15',
  'deck_neon:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(34,211,238,.55)"}};',
  'deck_neon:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(34,211,238,.55)"},deck_mundial:{background:"linear-gradient(145deg,#14532d,#0c4a6e,#052e16)",borderColor:"rgba(253,224,71,.55)"}};',
);

apply(
  'cos-img-mundial-v15',
  'deck_neon:"/app/cosmetics/decks/neon.svg"};',
  'deck_neon:"/app/cosmetics/decks/neon.svg",bg_mundial:"/app/cosmetics/rooms/mundial.svg",table_mundial:"/app/cosmetics/tables/mundial.svg",frame_mundial:"/app/cosmetics/frames/mundial.svg",deck_mundial:"/app/cosmetics/decks/mundial.svg"};',
);

apply(
  'catalog-v15',
  '{id:"deck_holo",name:"Mazo Holográfico",category:"deck_back",price:520,preview:"✨"}];function gd',
  '{id:"deck_holo",name:"Mazo Holográfico",category:"deck_back",price:520,preview:"✨"},{id:"frame_neon_ring",name:"Anillo Neón",category:"avatar_frame",price:850,preview:"💫"},{id:"frame_aurora",name:"Aurora VIP",category:"avatar_frame",price:1500,preview:"🌈"},{id:"frame_vip_glow",name:"Brillo Élite",category:"avatar_frame",price:2000,preview:"✨"},{id:"deck_flame",name:"Mazo Llama",category:"deck_back",price:480,preview:"🔥"},{id:"deck_legend",name:"Mazo Leyenda",category:"deck_back",price:720,preview:"👑"},{id:"deck_neon",name:"Mazo Neón Pro",category:"deck_back",price:580,preview:"💜"},{id:"bg_mundial",name:"Ambiente Mundial",category:"room_bg",price:680,preview:"⚽"},{id:"table_mundial",name:"Mesa Mundial",category:"table_bg",price:520,preview:"🏟️"},{id:"frame_mundial",name:"Marco Mundial",category:"avatar_frame",price:950,preview:"⚽"},{id:"frame_laser",name:"Láser RGB",category:"avatar_frame",price:1100,preview:"🔴"},{id:"frame_prism",name:"Prisma Arcoíris",category:"avatar_frame",price:1300,preview:"🌈"},{id:"deck_mundial",name:"Mazo Mundial",category:"deck_back",price:620,preview:"🃏"},{id:"skin_mundial",name:"Cartas Mundial",category:"card_skin",price:480,preview:"⚽"}];function gd',
);

apply(
  'shop-mundial-banner-v15',
  'I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-800/50 flex-wrap",children:M0CAT_TABS.map',
  'I.jsxs("div",{className:"p-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/50 via-[#0a1a12] to-emerald-950/30 flex flex-col gap-2",children:[I.jsxs("div",{className:"flex items-center gap-2",children:[I.jsx("span",{className:"text-2xl",children:"⚽"}),I.jsx("h3",{className:"text-sm font-black text-emerald-300 uppercase tracking-wider",children:"Colección Mundial"})]}),I.jsx("p",{className:"text-[0.65rem] text-emerald-200/70 leading-relaxed",children:"Fondo, mesa, mazo y marcos animados estilo GIF con CSS — edición especial."}),I.jsx("div",{className:"flex flex-wrap gap-1.5 mt-1",children:["bg_mundial","table_mundial","deck_mundial","frame_mundial","frame_laser","frame_prism","skin_mundial"].map(M0mid=>{const M0it=$y.find(M0x=>M0x.id===M0mid);return M0it?I.jsxs("button",{type:"button",onClick:()=>setM0cat(M0it.category),className:"px-2 py-1 rounded-lg text-[0.58rem] font-bold border border-emerald-600/50 text-emerald-200 bg-emerald-900/30 hover:bg-emerald-800/40",children:[M0it.preview," ",M0it.name]},M0mid):null})})]}),I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-800/50 flex-wrap",children:M0CAT_TABS.map',
);

apply(
  'cos-card-id-v15',
  'function BC({item:r,owned:e,equipped:t,balance:s,onBuy:o,onEquip:l,busy:h}){const f=s>=r.price;return I.jsxs("div",{className:["flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",t?"ring-2 ring-violet-400":""].join(" "),',
  'function BC({item:r,owned:e,equipped:t,balance:s,onBuy:o,onEquip:l,busy:h}){const f=s>=r.price;return I.jsxs("div",{id:"M0cos-"+r.id,className:["flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",t?"ring-2 ring-violet-400":""].join(" "),',
);

apply(
  'logo-mark-v15',
  'function M0Logo({sm}){return I.jsxs("div",{className:"inline-flex items-center gap-1.5",children:[I.jsx("span",{className:(sm?"text-2xl":"text-4xl")+" font-black tracking-tight text-white",children:"CERO"}),I.jsx("span",{className:(sm?"text-2xl":"text-4xl")+" font-black text-violet-400",children:"."}),I.jsx("span",{className:"text-[0.55rem] font-bold uppercase tracking-[0.25em] text-amber-400/90 ml-1",children:"Club"})]})}',
  'function M0Logo({sm}){const sz=sm?36:52;return I.jsxs("div",{className:"inline-flex items-center gap-2",children:[I.jsx("img",{src:"/app/logo/cero-club-mark.svg",alt:"",width:sz,height:sz,className:"drop-shadow-[0_0_12px_rgba(0,239,144,.45)]",style:{animation:"M0pulseGlow 2.4s ease-in-out infinite"}}),I.jsxs("div",{className:"flex items-baseline gap-0.5",children:[I.jsx("span",{className:(sm?"text-xl":"text-3xl")+" font-black tracking-tight text-white",children:"CERO"}),I.jsx("span",{className:"text-[0.55rem] font-bold uppercase tracking-[0.22em] text-emerald-400 ml-1",children:"Club"})]})]})}',
);

fs.writeFileSync(bundlePath, s);
console.log('Mundial brand v15 applied.');
