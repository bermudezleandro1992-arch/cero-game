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

// Premium Cero Coin SVG
apply(
  'zc0-premium-coin',
  'function ZC0({size:r=14}){return I.jsx("span",{className:"inline-flex items-center justify-center rounded-full font-black shrink-0",style:{width:r,height:r,fontSize:r*.65,background:"#00EF90",color:"#041f0e",boxShadow:"0 0 8px rgba(0,239,144,.45)"},children:"0"})}',
  'function ZC0({size:r=14}){const e=Math.max(12,r);return I.jsxs("svg",{width:e,height:e,viewBox:"0 0 24 24",className:"shrink-0 inline-block",style:{filter:"drop-shadow(0 1px 3px rgba(245,158,11,.55))"},children:[I.jsxs("defs",{children:[I.jsxs("linearGradient",{id:"ccG",x1:"0%",y1:"0%",x2:"100%",y2:"100%",children:[I.jsx("stop",{offset:"0%",stopColor:"#fef3c7"}),I.jsx("stop",{offset:"45%",stopColor:"#fbbf24"}),I.jsx("stop",{offset:"100%",stopColor:"#b45309"})]}),I.jsxs("radialGradient",{id:"ccSh",cx:"35%",cy:"30%",r:"65%",children:[I.jsx("stop",{offset:"0%",stopColor:"#fff",stopOpacity:".45"}),I.jsx("stop",{offset:"100%",stopColor:"#fff",stopOpacity:"0"})]})]}),I.jsx("circle",{cx:"12",cy:"12",r:"10.5",fill:"url(#ccG)",stroke:"#fde68a",strokeWidth:"1.1"}),I.jsx("circle",{cx:"12",cy:"12",r:"10.5",fill:"url(#ccSh)"}),I.jsx("circle",{cx:"12",cy:"12",r:"7.2",fill:"none",stroke:"rgba(120,53,15,.25)",strokeWidth:".9"}),I.jsx("text",{x:"12",y:"16.2",textAnchor:"middle",fontSize:"11.5",fontWeight:"900",fill:"#451a03",fontFamily:"system-ui,sans-serif",children:"0"})]})}',
);

// cleanupMyRooms callable
apply(
  'cleanup-callable',
  'let M0Ensure=null;function M0EnsureG(){return M0Ensure??(M0Ensure=or(ur,"ensureMatchStarted"))}',
  'let M0Cleanup=null;function M0CleanupG(){return M0Cleanup??(M0Cleanup=or(ur,"cleanupMyRooms"))}async function M0CleanupRun(){return Rc(M0CleanupG(),{})}let M0Ensure=null;function M0EnsureG(){return M0Ensure??(M0Ensure=or(ur,"ensureMatchStarted"))}',
);

// Ik: cleanup on mount + fix sync priority + unified UI
apply(
  'ik-cleanup-mount',
  'ie.useEffect(()=>{(async()=>{try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]),',
  'ie.useEffect(()=>{(async()=>{try{await M0CleanupRun()}catch{}try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]),',
);

apply(
  'ik-sync-prefer-playing',
  'const sync=()=>{const docs=[...(wT||[]),...(pT||[])];const pick=docs.find(k=>k.status==="playing")||docs.find(k=>k.status==="waiting"&&(k.playerCount??1)<(k.maxPlayers??2));ze(pick?{matchId:pick.id,stakeCC:pick.stakeCC??0,status:pick.status}:null)};',
  'const sync=()=>{const playing=(pT||[]).map(k=>({matchId:k.id,stakeCC:k.stakeCC??0,status:k.status}));const waiting=(wT||[]).filter(k=>(k.playerCount??1)<(k.maxPlayers??2)).map(k=>({matchId:k.id,stakeCC:k.stakeCC??0,status:k.status}));const pick=playing[0]||waiting[0];ze(pick||null)};',
);

// Remove duplicate OC banner (Ik handles active room UI)
apply(
  'oc-remove-dup-banner',
  'children:[OCa&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-emerald-500/50 bg-emerald-950/40 flex flex-col gap-2 items-center text-center",children:[I.jsx("p",{className:"text-sm text-emerald-200 font-semibold",children:OCa.status==="playing"?"Tenés una partida en curso":"Tenés una sala esperando rival"}),I.jsx("button",{type:"button",onClick:()=>OCgo==null?void 0:OCgo(OCa.matchId),className:"px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold",children:"Volver a mi sala"})]}),OCg&&I.jsxs("div"',
  'children:[OCg&&I.jsxs("div"',
);

// Better floating active-room pill
apply(
  'ik-floating-pill',
  'const et=A&&!o?I.jsx("button",{type:"button",onClick:()=>f(A.matchId),className:"fixed right-3 top-20 z-50 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-lg border border-emerald-500/50",style:{background:"rgba(6,78,59,.92)"},children:A.stakeCC>0?"🎮 Tu sala · "+A.stakeCC+" CN":"🎮 Tu sala gratuita"}):null,',
  'const IkAct=j&&!o?{matchId:j.matchId,stakeCC:j.stakeCC??0,status:j.status||"playing",rejoin:!0}:A&&!o?{...A,rejoin:!1}:null;const et=IkAct?I.jsxs("button",{type:"button",onClick:()=>f(IkAct.matchId),className:"fixed right-3 top-[4.25rem] z-50 flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl text-white shadow-2xl border backdrop-blur-md transition-transform hover:scale-[1.02] active:scale-95 max-w-[11rem]",style:{background:IkAct.status==="playing"?"linear-gradient(135deg,rgba(16,185,129,.96),rgba(4,120,87,.94))":"linear-gradient(135deg,rgba(124,58,237,.96),rgba(76,29,149,.94))",borderColor:IkAct.status==="playing"?"rgba(110,231,183,.55)":"rgba(196,181,253,.45)",boxShadow:IkAct.status==="playing"?"0 10px 40px rgba(16,185,129,.35)":"0 10px 40px rgba(124,58,237,.35)"},children:[I.jsx("span",{className:"flex items-center justify-center w-9 h-9 rounded-xl text-lg shrink-0",style:{background:"rgba(0,0,0,.22)"},children:"🎮"}),I.jsxs("span",{className:"flex flex-col items-start leading-tight min-w-0",children:[I.jsx("span",{className:"text-[0.58rem] uppercase tracking-[0.14em] font-bold opacity-85 truncate w-full",children:IkAct.rejoin?"Reingresar":IkAct.status==="playing"?"Partida activa":"Sala abierta"}),I.jsx("span",{className:"text-[0.72rem] font-black truncate w-full",children:IkAct.stakeCC>0?IkAct.stakeCC+" CN · volver":"Gratuita · volver"})]})]}):null,',
);

// Single unified banner (replace duplicate violet + emerald)
apply(
  'ik-unified-banner',
  'et,A&&!o&&!j&&I.jsxs("div",{className:"mx-4 mt-3 p-3 rounded-xl border border-violet-500/40 bg-violet-950/40 flex flex-wrap items-center justify-between gap-2",children:[I.jsxs("p",{className:"text-sm text-violet-200",children:["Tenés una sala esperando rival",A.stakeCC>0?" · "+A.stakeCC+" CN":""]}),I.jsx("button",{type:"button",onClick:()=>f(A.matchId),className:"px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold",children:"Volver a mi sala"})]}),j&&I.jsxs("div",{className:"mx-4 mt-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2",children:[I.jsxs("p",{className:"text-sm text-emerald-200",children:["Partida activa — tenés ~5 min para volver ",j.stakeCC>0?"(Sala "+j.stakeCC+" CN)":""]}),I.jsx("button",{type:"button",onClick:()=>f(j.matchId),className:"px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold",children:"Volver a la partida"})]}),',
  'et,',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-lobby-ui.js done');
