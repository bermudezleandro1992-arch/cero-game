#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (s.includes(to.slice(0, 80))) {
    console.log(`SKIP (already applied): ${name}`);
    return;
  }
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 140));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Callables wallet / espectador / apuestas / tienda ───────────────────────
apply(
  'wallet-callables',
  'async function M0p(r){return Rc(M0h,r??{})}\nconst tl=',
  `async function M0p(r){return Rc(M0h,r??{})}
let M0q=null,M0r=null,M0s=null,M0t=null,M0u=null,M0v=null,M0w=null,M0x=null;
function M0y(){return M0q??(M0q=or(ur,"transferCeroCoins"))}
function M0z(){return M0r??(M0r=or(ur,"getWalletHistory"))}
function M0A(){return M0s??(M0s=or(ur,"applyReferralCode"))}
function M0B(){return M0t??(M0t=or(ur,"createCoinPayment"))}
function M0C(){return M0u??(M0u=or(ur,"activateVIP"))}
function M0D(){return M0v??(M0v=or(ur,"placeMatchBet"))}
function M0E(){return M0w??(M0w=or(ur,"getMatchBettingInfo"))}
function M0F(){return M0x??(M0x=or(ur,"joinAsSpectator"))}
async function M0G(r){return Rc(M0y(),r)}
async function M0H(r){return Rc(M0z(),r??{})}
async function M0I(r){return Rc(M0A(),r)}
async function M0J(r){return Rc(M0B(),r)}
async function M0K(r){return Rc(M0C(),r)}
async function M0L(r){return Rc(M0D(),r)}
async function M0M(r){return Rc(M0E(),r)}
async function M0N(r){return Rc(M0F(),r)}
const tl=`,
);

// ── Tienda conectada a Mercado Pago ─────────────────────────────────────────
apply(
  'store-kc-full',
  'function KC({userId:r}){return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center px-6 py-16 gap-4 text-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("span",{className:"text-5xl",children:"🛍️"}),I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"}),I.jsx("p",{className:"text-sm text-violet-400 max-w-sm",children:"Próximamente vas a poder comprar Cero Coins y el Pase VIP acá. Por ahora probá las salas gratuitas y el bonus diario en tu perfil."})]})}',
  `function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("coins"),[o,l]=ie.useState(!1);async function h(f){l(!0);try{const g=await M0J({packageId:f,region:"AR"});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error al iniciar pago","error")}finally{l(!1)}}async function _(f){l(!0);try{const g=await M0K({planId:f});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error VIP","error")}finally{l(!1)}}return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-6 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"}),I.jsxs("div",{className:"flex gap-2",children:[I.jsx("button",{type:"button",onClick:()=>s("coins"),className:"px-4 py-2 rounded-xl text-sm font-bold "+(t==="coins"?"bg-violet-600 text-white":"text-violet-400 border border-violet-800"),children:"Cero Coins"}),I.jsx("button",{type:"button",onClick:()=>s("vip"),className:"px-4 py-2 rounded-xl text-sm font-bold "+(t==="vip"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"Pase VIP"})]}),t==="coins"?I.jsx("div",{className:"grid grid-cols-2 gap-3 w-full max-w-md",children:qC.map(f=>I.jsx(WC,{pkg:f,onBuy:h,busy:o},f.id))}):I.jsx("div",{className:"flex flex-col gap-4 w-full max-w-md",children:HC.map(f=>I.jsx(GC,{plan:f,onBuy:_,busy:o},f.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-600 text-center max-w-sm",children:"Pagos seguros vía Mercado Pago · ARS / UYU / USD"})]})}`,
);

// ── Perfil: transferir + referidos + historial ────────────────────────────────
apply(
  'profile-wallet-panel',
  'I.jsx("div",{className:"w-full max-w-md",children:I.jsx(zC,{lastClaimAt:((J=t.lastDailyClaim)==null?void 0:J.toMillis())??0,onClaimed:ee=>e(`Saldo: ${ee} CC`,"info")})}),I.jsxs("div",{className:"w-full max-w-md flex fl',
  `I.jsx("div",{className:"w-full max-w-md",children:I.jsx(zC,{lastClaimAt:((J=t.lastDailyClaim)==null?void 0:J.toMillis())??0,onClaimed:ee=>e(\`Saldo: \${ee} CC\`,"info")})}),I.jsx(M0W,{user:t,showToast:e}),I.jsxs("div",{className:"w-full max-w-md flex fl`,
);

const walletPanelFn = 'function M0W({user:r,showToast:e}){const[t,s]=ie.useState("transfer"),[o,l]=ie.useState(""),[h,f]=ie.useState(""),[g,_]=ie.useState(""),[w,T]=ie.useState([]),[k,F]=ie.useState(!1);ie.useEffect(()=>{t==="history"&&M0H({limit:20}).then($=>T($.entries||[])).catch(()=>{})},[t]);async function K(){if(!o.trim()||!h)return;F(!0);try{const $=await M0G({toUid:o.trim(),amount:parseInt(h,10),note:g||void 0});e("Transferiste "+h+" CN","success"),l(""),f(""),_("")}catch($){e(($==null?void 0:$.message)||"Error","error")}finally{F(!1)}}async function W(){if(!o.trim())return;F(!0);try{const $=await M0I({code:o.trim()});e("+"+$.coinsAwarded+" CN por referido!","success")}catch($){e(($==null?void 0:$.message)||"Codigo invalido","error")}finally{F(!1)}}return I.jsxs("div",{className:"w-full max-w-md mt-4 p-4 rounded-2xl border border-violet-800/50 bg-violet-950/20 flex flex-col gap-3",children:[I.jsx("h3",{className:"text-sm font-black text-violet-300 uppercase tracking-widest",children:"Billetera"}),I.jsxs("div",{className:"flex gap-1 flex-wrap",children:[["transfer","Transferir"],["referral","Referido"],["history","Historial"]].map(([$,ne])=>I.jsx("button",{type:"button",onClick:()=>s($),className:"px-3 py-1 rounded-lg text-xs font-bold "+(t===$?"bg-violet-600 text-white":"text-violet-500 border border-violet-800"),children:ne},$))}),t==="transfer"&&I.jsxs(I.Fragment,{children:[I.jsx("input",{className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-violet-800 text-sm text-white",placeholder:"UID del destinatario",value:o,onChange:$=>l($.target.value)}),I.jsx("input",{type:"number",className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-violet-800 text-sm text-white",placeholder:"Monto (10-5000 CN)",value:h,onChange:$=>f($.target.value)}),I.jsx("input",{className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-violet-800 text-sm text-white",placeholder:"Nota (opcional)",value:g,onChange:$=>_($.target.value)}),I.jsx("button",{type:"button",disabled:k,onClick:K,className:"w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50",children:"Enviar Cero Coins"})]}),t==="referral"&&I.jsxs(I.Fragment,{children:[I.jsxs("p",{className:"text-xs text-violet-400",children:["Tu codigo: ",I.jsx("strong",{className:"text-amber-400 font-mono",children:r.referralCode||"—"})]}),I.jsx("input",{className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-violet-800 text-sm text-white",placeholder:"Codigo de quien te invito",value:o,onChange:$=>l($.target.value)}),I.jsx("button",{type:"button",disabled:k||r.referredBy,onClick:W,className:"w-full py-2 rounded-xl bg-violet-600 text-white font-bold text-sm disabled:opacity-50",children:r.referredBy?"Ya usaste un codigo":"Canjear codigo (+50 CN)"})]}),t==="history"&&I.jsx("div",{className:"flex flex-col gap-1 max-h-40 overflow-y-auto",children:w.length===0?I.jsx("p",{className:"text-xs text-violet-600",children:"Sin movimientos"}):w.map($=>I.jsxs("div",{className:"flex justify-between text-xs text-violet-300 py-1 border-b border-violet-900/40",children:[I.jsx("span",{children:$.type}),I.jsxs("span",{className:$.amount>=0?"text-emerald-400":"text-red-400",children:[$.amount>=0?"+":"",$.amount," CN"]})]},$.id))})]})}';

if (!s.includes('function M0W(')) {
  s = s.replace('function KC({userId:r})', walletPanelFn + 'function KC({userId:r})');
  console.log('OK: wallet-panel-fn');
}

// ── Espectador: partidas en vivo en lobby ─────────────────────────────────────
apply(
  'lobby-live-matches',
  '})})(),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Unirse por código"})',
  `})})(),I.jsx(M0S,{userId:r,onSpectate:ne=>{try{sessionStorage.setItem("cero_spectate",ne)}catch{}typeof window.__ceroSpectate==="function"&&window.__ceroSpectate(ne)}}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Unirse por código"})`,
);

const spectateLobbyFn = `function M0S({userId:r,onSpectate:e}){const[t,s]=ie.useState([]);ie.useEffect(()=>{const o=jf(za(br,"matches"),cC("status","==","playing"),zf("startedAt","desc"),p0(8));return Co(o,l=>s(l.docs.map(h=>({id:h.id,...h.data()})).filter(h=>!(h.playerIds||[]).includes(r))),()=>s([]))},[r]);return t.length===0?null:I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-amber-400 mb-3",children:"En vivo — espectar y apostar"}),I.jsx("div",{className:"flex flex-col gap-2",children:t.map(o=>{var l,h;return I.jsxs("div",{className:"flex items-center justify-between px-4 py-3 rounded-xl border border-amber-800/40 bg-amber-950/20",children:[I.jsxs("div",{children:[I.jsxs("p",{className:"text-sm font-bold text-white",children:[((l=o.players)==null?void 0:l[0])&&o.players[0].name||"?"," vs ",((h=o.players)==null?void 0:h[1])&&o.players[1].name||"?"]}),I.jsxs("p",{className:"text-[0.65rem] text-amber-500",children:[o.stakeCC>0?o.stakeCC+" CN · ":"","👁 ",o.spectatorCount||0," espectadores"]})]}),I.jsx("button",{type:"button",onClick:()=>e(o.id),className:"px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold",children:"Espectar"})]},o.id)})}),I.jsx("p",{className:"text-[0.6rem] text-violet-600 mt-2 text-center",children:"Apostá en los primeros 3 min — los jugadores no pueden apostar"})]})}`;

if (!s.includes('function M0S(')) {
  s = s.replace('function OC({userId:r,userName:e,onJoined:t})', spectateLobbyFn + 'function OC({userId:r,userName:e,onJoined:t})');
  console.log('OK: spectate-lobby-fn');
}

// ── Vista espectador + apuestas ───────────────────────────────────────────────
apply(
  'ik-spectate-mode',
  'if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});',
  'if(S)return I.jsx(M0T,{matchId:S,onExit:()=>O(null)});if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});',
);

apply(
  'ik-spectate-state',
  'function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null),[j,N]=ie.useState(null),[A,ze]=ie.useState(null);',
  'function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null),[S,O]=ie.useState(null),[j,N]=ie.useState(null),[A,ze]=ie.useState(null);ie.useEffect(()=>{window.__ceroSpectate=O;try{const q=sessionStorage.getItem("cero_spectate");q&&(O(q),sessionStorage.removeItem("cero_spectate"))}catch{}},[]);',
);

const spectateViewFn = 'function M0T({matchId:r,onExit:e}){const{showToast:t}=Oo(),[s,o]=ie.useState(null),[l,h]=ie.useState(null),[f,g]=ie.useState("25"),[_,w]=ie.useState(null),[T,k]=ie.useState(!0);ie.useEffect(()=>{(async()=>{try{await M0N({matchId:r})}catch{}})();const F=Ba(br,"matches",r);return Co(F,K=>{K.exists()&&o(K.data())},()=>{})},[r]),ie.useEffect(()=>{M0M({matchId:r}).then(F=>h(F)).catch(()=>{})},[r,s==null?void 0:s.status]);async function $(F){w(F);try{await M0L({matchId:r,predictedWinnerUid:F,amount:parseInt(f,10)});t("Apostaste "+f+" CN","success"),h(await M0M({matchId:r}))}catch(K){t((K==null?void 0:K.message)||"Error","error")}finally{w(null)}}if(T&&(!s||!l))return I.jsx("div",{className:"min-h-screen flex items-center justify-center text-violet-400",children:"Cargando..."});k(!1);const ne=(s==null?void 0:s.players)||[],J=Date.now()<((l==null?void 0:l.bettingOpenUntil)||0),ee=l==null?void 0:l.myBet;return I.jsxs("div",{className:"min-h-screen flex flex-col px-4 py-6 gap-4",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"flex justify-between items-center",children:[I.jsx("h2",{className:"text-lg font-black text-amber-300",children:"Espectador"}),I.jsx("button",{type:"button",onClick:e,className:"text-violet-400 text-sm underline",children:"Volver"})]}),I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-800/50 bg-violet-950/30",children:[I.jsxs("p",{className:"text-white font-bold text-center",children:[ne[0]&&ne[0].name||"?"," vs ",ne[1]&&ne[1].name||"?"]}),I.jsxs("p",{className:"text-xs text-violet-400 text-center mt-1",children:["Cartas: ",((s==null?void 0:s.handCounts)||[]).join(" / ")," Fase: ",s==null?void 0:s.phase]})]}),I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-800/40 bg-amber-950/20 flex flex-col gap-3",children:[I.jsx("h3",{className:"text-sm font-black text-amber-300",children:"Aposta quien gana"}),ee?I.jsxs("p",{className:"text-sm text-emerald-300",children:["Tu apuesta: ",ee.amount," CN -> ",(ne.find(le=>le.uid===ee.predictedWinnerUid)||{}).name," ",ee.status]}):J?I.jsxs(I.Fragment,{children:[I.jsx("input",{type:"number",value:f,onChange:le=>g(le.target.value),className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-amber-800 text-white text-sm",placeholder:"5-500 CN"}),I.jsx("div",{className:"flex gap-2",children:ne.map(le=>I.jsx("button",{type:"button",disabled:!!_,onClick:()=>$(le.uid),className:"flex-1 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold disabled:opacity-50",children:le.name},le.uid))}),I.jsx("p",{className:"text-[0.6rem] text-violet-600",children:"Pozo parimutuel: ganas proporcional. Perdes todo si fallas."})]}):I.jsx("p",{className:"text-xs text-violet-500",children:"Apuestas cerradas (3 min)"})]}),(s==null?void 0:s.status)==="finished"&&I.jsxs("p",{className:"text-center text-amber-300 font-bold",children:["Ganador: ",(ne.find(le=>le.uid===s.winner)||{}).name]})]})}';

if (!s.includes('function M0T(')) {
  s = s.replace('function M0S({userId:r,onSpectate:e})', spectateViewFn + 'function M0S({userId:r,onSpectate:e})');
  console.log('OK: spectate-view-fn');
}

fs.writeFileSync(bundlePath, s);
console.log('Wallet + spectate bundle patched.');
