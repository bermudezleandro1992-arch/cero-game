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

const M0INP =
  'w-full px-3 py-2.5 rounded-xl bg-[#0e0524] border border-violet-700/60 text-sm text-violet-100 placeholder-violet-600 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-500/40 transition-colors';

// ── joinMatch payload: stakes flexibles + salas privadas ─────────────────────
apply(
  'kC-private-stake',
  'async function kC(r={}){const e={mode:r.mode??"classic",format:r.format??"1v1",stakeCC:r.stakeCC??0,createNew:!!r.createNew};return r.matchId&&(e.matchId=r.matchId),Rc(IC,e)}',
  'async function kC(r={}){const e={mode:r.mode??"classic",format:r.format??"1v1",stakeCC:r.stakeCC??0,createNew:!!r.createNew,isPrivate:!!r.isPrivate};r.joinCode&&(e.joinCode=r.joinCode);return r.matchId&&(e.matchId=r.matchId),Rc(IC,e)}',
);

// ── Lobby: snapshot incluye privacidad ───────────────────────────────────────
apply(
  'lobby-snapshot-fields',
  'return{id:Ae.id,mode:we.mode??"classic",format:we.format??"1v1",stakeCC:we.stakeCC??0,playerCount:we.playerCount??0,maxPlayers:we.maxPlayers??2,players:we.players??[],createdAt:we.createdAt??null}',
  'return{id:Ae.id,mode:we.mode??"classic",format:we.format??"1v1",stakeCC:we.stakeCC??0,playerCount:we.playerCount??0,maxPlayers:we.maxPlayers??2,players:we.players??[],createdAt:we.createdAt??null,isPrivate:we.isPrivate===!0,joinCode:we.joinCode??null,guestOnly:we.guestOnly===!0}',
);

// ── Lobby: state stake + privada + clave ─────────────────────────────────────
apply(
  'lobby-state-stake',
  ',[j,N]=ie.useState(0),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{const ne=jf(za(br,"matches")',
  `,[M0stk,setM0stk]=ie.useState(50),[M0priv,setM0priv]=ie.useState(!1),[M0jkey,setM0jkey]=ie.useState(""),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{try{const M0qp=new URLSearchParams(window.location.search);const M0qj=M0qp.get("join"),M0qk=M0qp.get("key");if(M0qj){F(M0qj);M0qk&&setM0jkey(M0qk)}}catch{}},[]);ie.useEffect(()=>{const ne=jf(za(br,"matches")`,
);

apply(
  'lobby-join-payload',
  'const J=await kC({mode:w,format:ne.format??M0fmt,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??j,createNew:ne.createNew===true&&!OCa}),ee=!!ne.matchId;s(J.charged?`Entrada: -${J.stakeCC} CN · Saldo: ${J.coinsLeft} CN`:ee?(J.stakeCC>0?"¡Te uniste! Sala "+J.stakeCC+" CN":"¡Te uniste! Sala gratuita"):(J.stakeCC>0?"Sala "+J.stakeCC+" CN creada · Esperando rival…":"Sala gratuita creada · Esperando rival…"),"success");',
  'const J=await kC({mode:w,format:ne.format??M0fmt,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??M0stk,createNew:ne.createNew===true&&!OCa,isPrivate:ne.isPrivate??M0priv,joinCode:ne.joinCode??(M0jkey.trim()||void 0)}),ee=!!ne.matchId;try{J.shareLink&&navigator.clipboard&&navigator.clipboard.writeText(J.shareLink)}catch{}const M0pm=J.isPrivate&&J.joinCode?"🔒 Privada · Código "+J.joinCode+" · ":"";s(M0pm+(J.charged?`Entrada: -${J.stakeCC} CN · Saldo: ${J.coinsLeft} CN`:ee?(J.stakeCC>0?"¡Te uniste! Sala "+J.stakeCC+" CN":"¡Te uniste! Sala gratuita"):(J.stakeCC>0?"Sala "+J.stakeCC+" CN creada · Esperando rival…":"Sala gratuita creada · Esperando rival…")),"success");',
);

apply(
  'lobby-join-form',
  'async function $(ne){ne.preventDefault();const J=k.trim();J&&(await W({matchId:J}),F(""))}',
  'async function $(ne){ne.preventDefault();const J=k.trim();J&&(await W({matchId:J,joinCode:M0jkey.trim()||void 0}),F(""),setM0jkey(""))}',
);

// ── Crear sala personalizada: selector 30–20.000 CN + privada ────────────────
apply(
  'custom-room-ui',
  '!OCg&&I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-950/25 to-transparent flex flex-col gap-2",children:[I.jsx("p",{className:"text-xs font-bold text-amber-400 uppercase tracking-widest",children:"Crear sala personalizada"}),I.jsx("p",{className:"text-[0.72rem] text-violet-400 leading-relaxed",children:"Solo con 50 Cero Coins. Creás la sala, esperás rival o compartís el código."}),I.jsx("button",{type:"button",disabled:g||!!OCa,onClick:()=>W({stakeCC:50,createNew:!0,format:M0fmt}),className:["w-full py-3.5 rounded-xl font-black text-base uppercase tracking-widest border-2 transition-all",g?"opacity-60 cursor-wait":"hover:scale-[1.02] active:scale-[0.98]"].join(" "),style:{background:"#1f1004",borderColor:"#d97706",color:"#f59e0b",boxShadow:"0 0 24px rgba(245,158,11,.18)"},children:g?I.jsxs("span",{className:"flex items-center justify-center gap-2",children:[I.jsx("span",{className:"w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"}),"Creando…"]}):"Crear sala · 50 CN"})]})',
  `!OCg&&I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-950/25 to-transparent flex flex-col gap-3",children:[I.jsx("p",{className:"text-xs font-bold text-amber-400 uppercase tracking-widest",children:"Crear sala personalizada"}),I.jsx("p",{className:"text-[0.72rem] text-violet-400 leading-relaxed",children:"Elegí apuesta (30–20.000 CN) o sala pública gratis. Privada = solo entran con tu código/link."}),I.jsx("div",{className:"grid grid-cols-4 gap-1.5",children:[0,30,50,100,250,500,1e3,2500,5e3,1e4,2e4].map(ne=>I.jsx("button",{type:"button",onClick:()=>setM0stk(ne),className:"py-1.5 rounded-lg text-[0.65rem] font-bold border transition-all "+(M0stk===ne?"bg-amber-600/30 border-amber-500 text-amber-200":"border-violet-800 text-violet-500 hover:border-violet-600"),children:ne===0?"Gratis":ne>=1e3?ne/1e3+"k":ne},ne))}),I.jsxs("div",{className:"flex gap-2",children:[I.jsx("button",{type:"button",onClick:()=>setM0priv(!1),className:"flex-1 py-2 rounded-xl text-xs font-bold border "+(M0priv?"border-violet-800 text-violet-500":"bg-emerald-900/30 border-emerald-600 text-emerald-200"),children:"Pública"}),I.jsx("button",{type:"button",onClick:()=>setM0priv(!0),className:"flex-1 py-2 rounded-xl text-xs font-bold border "+(M0priv?"bg-amber-900/40 border-amber-500 text-amber-200":"border-violet-800 text-violet-500"),children:"🔒 Privada"})]}),I.jsx("button",{type:"button",disabled:g||!!OCa,onClick:()=>W({stakeCC:M0stk,createNew:!0,format:M0fmt,isPrivate:M0priv}),className:["w-full py-3.5 rounded-xl font-black text-base uppercase tracking-widest border-2 transition-all",g?"opacity-60 cursor-wait":"hover:scale-[1.02] active:scale-[0.98]"].join(" "),style:{background:"#1f1004",borderColor:"#d97706",color:"#f59e0b",boxShadow:"0 0 24px rgba(245,158,11,.18)"},children:g?I.jsxs("span",{className:"flex items-center justify-center gap-2",children:[I.jsx("span",{className:"w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"}),"Creando…"]}):M0priv?"Crear sala privada · "+(M0stk===0?"Gratis":M0stk+" CN"):"Crear sala · "+(M0stk===0?"Gratis":M0stk+" CN")})]})`,
);

// ── Lobby: secciones salas públicas / con monedas / invitado ─────────────────
apply(
  'lobby-room-sections',
  '(()=>{const mine=o.filter(ne=>((ne.players||[]).some(P=>P.uid===r)));const open=o.filter(ne=>!((ne.players||[]).some(P=>P.uid===r))&&(OCg?(ne.stakeCC??0)===0&&ne.guestOnly!==false:!ne.guestOnly));return I.jsxs(I.Fragment,{children:[mine.length>0&&I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-emerald-400 mb-3",children:"Tu sala activa"}),I.jsx("div",{className:"flex flex-col gap-2",children:mine.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-500 mt-2 text-center",children:"Podés volver cuando quieras — la sala sigue activa."})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Salas abiertas"}),h?I.jsx("div",{className:"flex items-center justify-center py-8",children:I.jsx("div",{className:"w-6 h-6 border-2 border-violet-600 border-t-violet-300 rounded-full animate-spin"})}):open.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-6",children:mine.length?"No hay otras salas abiertas.":"No hay salas abiertas. ¡Creá la primera!"}):I.jsx("div",{className:"flex flex-col gap-2",children:open.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]})]})})()',
  `(()=>{const mine=o.filter(ne=>((ne.players||[]).some(P=>P.uid===r)));const notMine=ne=>!((ne.players||[]).some(P=>P.uid===r));const vis=ne=>!ne.isPrivate;if(OCg){const guestOpen=o.filter(ne=>notMine(ne)&&vis(ne)&&(ne.stakeCC??0)===0&&ne.guestOnly);return I.jsxs(I.Fragment,{children:[mine.length>0&&I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-emerald-400 mb-3",children:"Tu sala activa"}),I.jsx("div",{className:"flex flex-col gap-2",children:mine.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-sky-400 mb-3",children:"Salas públicas invitado (sin CN)"}),h?I.jsx("div",{className:"flex items-center justify-center py-8",children:I.jsx("div",{className:"w-6 h-6 border-2 border-violet-600 border-t-violet-300 rounded-full animate-spin"})}):guestOpen.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-6",children:"No hay salas invitado. Usá juego rápido o creá una."}):I.jsx("div",{className:"flex flex-col gap-2",children:guestOpen.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]})]})}const paidOpen=o.filter(ne=>notMine(ne)&&vis(ne)&&(ne.stakeCC??0)>0&&!ne.guestOnly);const freeOpen=o.filter(ne=>notMine(ne)&&vis(ne)&&(ne.stakeCC??0)===0&&!ne.guestOnly);return I.jsxs(I.Fragment,{children:[mine.length>0&&I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-emerald-400 mb-3",children:"Tu sala activa"}),I.jsx("div",{className:"flex flex-col gap-2",children:mine.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-amber-400 mb-3",children:"Salas con Cero Coins"}),h?I.jsx("div",{className:"flex items-center justify-center py-6",children:I.jsx("div",{className:"w-6 h-6 border-2 border-violet-600 border-t-violet-300 rounded-full animate-spin"})}):paidOpen.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-4",children:"Ninguna sala con monedas abierta. ¡Creá una!"}):I.jsx("div",{className:"flex flex-col gap-2",children:paidOpen.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-sky-400 mb-3",children:"Salas públicas gratis (registrados)"}),h?null:freeOpen.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-4",children:"Sin salas gratis — usá juego rápido."}):I.jsx("div",{className:"flex flex-col gap-2",children:freeOpen.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]})]})})()`,
);

apply(
  'join-code-title',
  'children:"Unirse por código"',
  'children:"Unirse por ID / link privado"',
);

// join form: add private code field (regex — className tiene CRLF)
{
  const joinRe = /I\.jsxs\("form",\{onSubmit:\$,className:"flex gap-2",children:\[I\.jsx\("input",\{ref:K,type:"text",value:k,onChange:ne=>F\(ne\.target\.value\),placeholder:"ID de la sala…",className:`[\s\S]*?`,autoComplete:"off",spellCheck:!1\}\),I\.jsx\("button",\{type:"submit"[\s\S]*?children:"Ir"\}\)\]\}\)/;
  const joinNew = `I.jsxs("form",{onSubmit:$,className:"flex flex-col gap-2",children:[I.jsxs("div",{className:"flex gap-2",children:[I.jsx("input",{ref:K,type:"text",value:k,onChange:ne=>F(ne.target.value),placeholder:"ID de la sala…",className:"flex-1 bg-[#0e0524] border border-violet-700/60 rounded-xl px-4 py-2.5 text-sm text-violet-100 placeholder-violet-600 focus:outline-none focus:border-violet-400 transition-colors",autoComplete:"off",spellCheck:!1}),I.jsx("button",{type:"submit",disabled:!k.trim()||g,className:"px-5 py-2.5 rounded-xl font-bold text-sm bg-violet-800 hover:bg-violet-700 text-white border border-violet-600 disabled:opacity-40 transition-all",children:"Entrar"})]}),I.jsx("input",{type:"text",value:M0jkey,onChange:ne=>setM0jkey(ne.target.value.toUpperCase()),placeholder:"Código privado (6 letras) — obligatorio en salas 🔒",className:"${M0INP}",autoComplete:"off",spellCheck:!1})]})`.replace('${M0INP}', M0INP);
  if (!joinRe.test(s)) {
    console.error('PATCH FAILED: join-code-field regex');
    process.exit(1);
  }
  s = s.replace(joinRe, joinNew);
  console.log('OK: join-code-field');
}

// ── VC: badge privada ────────────────────────────────────────────────────────
apply(
  'vc-private-badge',
  'children:r.stakeCC>0?I.jsxs("span",{className:"inline-flex items-center gap-1",children:[I.jsx(ZC0,{size:11}),r.stakeCC," CN"]}):"Gratuita"})]}),I.jsxs("p",{className:"text-sm font-s',
  'children:r.stakeCC>0?I.jsxs("span",{className:"inline-flex items-center gap-1",children:[I.jsx(ZC0,{size:11}),r.stakeCC," CN"]}):"Gratuita"}),r.isPrivate&&I.jsx("span",{className:"text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/50",children:"🔒 Privada"})]}),I.jsxs("p",{className:"text-sm font-s',
);

// ── Billetera M0W: inputs oscuros + transfer por email/nick/ID ───────────────
const oldM0W = s.match(/function M0W\(\{user:r,showToast:e\}\)\{[\s\S]*?\}function M0Dep/);
if (!oldM0W) {
  console.error('PATCH FAILED: find M0W');
  process.exit(1);
}

const newM0W = `function M0W({user:r,showToast:e}){const[t,s]=ie.useState("transfer"),[o,l]=ie.useState(""),[h,f]=ie.useState(""),[g,_]=ie.useState(""),[w,T]=ie.useState([]),[k,F]=ie.useState(!1);ie.useEffect(()=>{t==="history"&&M0H({limit:20}).then($=>T($.entries||[])).catch(()=>{})},[t]);async function K(){if(!o.trim()||!h)return;F(!0);try{const $=await M0G({toIdentifier:o.trim(),amount:parseInt(h,10),note:g||void 0});e("Transferiste "+h+" CN a "+($.toLabel||"usuario"),"success"),l(""),f(""),_("")}catch($){e(($==null?void 0:$.message)||"Error","error")}finally{F(!1)}}async function W(){if(!o.trim())return;F(!0);try{const $=await M0I({code:o.trim()});e("+"+$.coinsAwarded+" CN por referido!","success")}catch($){e(($==null?void 0:$.message)||"Codigo invalido","error")}finally{F(!1)}}const INP="${M0INP}";return I.jsxs("div",{className:"w-full max-w-md mt-4 p-4 rounded-2xl border border-violet-800/50 bg-violet-950/20 flex flex-col gap-3",children:[I.jsx("h3",{className:"text-sm font-black text-violet-300 uppercase tracking-widest",children:"Billetera"}),I.jsxs("div",{className:"flex gap-1 flex-wrap",children:[["transfer","Transferir"],["referral","Referido"],["history","Historial"]].map(([$,ne])=>I.jsx("button",{type:"button",onClick:()=>s($),className:"px-3 py-1 rounded-lg text-xs font-bold "+(t===$?"bg-violet-600 text-white":"text-violet-500 border border-violet-800"),children:ne},$))}),t==="transfer"&&I.jsxs(I.Fragment,{children:[I.jsxs("p",{className:"text-[0.65rem] text-violet-500 leading-relaxed",children:["Tu ID privado: ",I.jsx("strong",{className:"text-amber-400 font-mono",children:r.transferId||"—"})," · Compartilo solo para recibir CN"]}),I.jsx("input",{className:INP,placeholder:"Email, nombre, ID CC-… o UID",value:o,onChange:$=>l($.target.value),autoComplete:"off"}),I.jsx("input",{type:"number",className:INP,placeholder:"Monto (10-20000 CN)",value:h,onChange:$=>f($.target.value),min:10,max:20000}),I.jsx("input",{className:INP,placeholder:"Nota (opcional)",value:g,onChange:$=>_($.target.value)}),I.jsx("button",{type:"button",disabled:k,onClick:K,className:"w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-emerald-500 transition-colors",children:"Enviar Cero Coins"})]}),t==="referral"&&I.jsxs(I.Fragment,{children:[I.jsxs("p",{className:"text-xs text-violet-400",children:["Tu codigo: ",I.jsx("strong",{className:"text-amber-400 font-mono",children:r.referralCode||"—"})]}),I.jsx("input",{className:INP,placeholder:"Codigo de quien te invito",value:o,onChange:$=>l($.target.value)}),I.jsx("button",{type:"button",disabled:k||r.referredBy,onClick:W,className:"w-full py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm disabled:opacity-50",children:r.referredBy?"Ya usaste un codigo":"Canjear codigo (+50 CN)"})]}),t==="history"&&I.jsx("div",{className:"flex flex-col gap-1 max-h-40 overflow-y-auto",children:w.length===0?I.jsx("p",{className:"text-xs text-violet-600",children:"Sin movimientos"}):w.map($=>I.jsxs("div",{className:"flex justify-between text-xs text-violet-300 py-1 border-b border-violet-900/40",children:[I.jsx("span",{children:$.type}),I.jsxs("span",{className:$.amount>=0?"text-emerald-400":"text-red-400",children:[$.amount>=0?"+":"",$.amount," CN"]})]},$.id))})]})}function M0Dep`;

s = s.replace(oldM0W[0], newM0W);
console.log('OK: wallet-M0W');

// ── Tienda: tabs Packs | VIP | Depositar | Cosméticos ────────────────────────
apply(
  'store-default-tab',
  'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("cosmetics")',
  'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("packs")',
);

apply(
  'store-tabs-reorder',
  'I.jsx("button",{type:"button",onClick:()=>s("coins"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="coins"?"bg-violet-600 text-white":"text-violet-400 border border-violet-800"),children:"MP auto"}),I.jsx("button",{type:"button",onClick:()=>s("deposit"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="deposit"?"bg-emerald-600 text-white":"text-violet-400 border border-violet-800"),children:"Depositar"}),I.jsx("button",{type:"button",onClick:()=>s("vip"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="vip"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"VIP"}),I.jsx("button",{type:"button",onClick:()=>s("cosmetics"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="cosmetics"?"bg-pink-600 text-white":"text-violet-400 border border-violet-800"),children:"Cosméticos CC"}),I.jsx("button",{type:"button",onClick:()=>s("offers"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="offers"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"Ofertas"}),I.jsx("button",{type:"button",onClick:()=>s("emotes"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="emotes"?"bg-sky-600 text-white":"text-violet-400 border border-violet-800"),children:"Emotes"})]}),t==="offers"?',
  'I.jsx("button",{type:"button",onClick:()=>s("packs"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="packs"?"bg-violet-600 text-white":"text-violet-400 border border-violet-800"),children:"Packs CN"}),I.jsx("button",{type:"button",onClick:()=>s("vip"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="vip"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"VIP"}),I.jsx("button",{type:"button",onClick:()=>s("deposit"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="deposit"?"bg-emerald-600 text-white":"text-violet-400 border border-violet-800"),children:"Transferir / Prex"}),I.jsx("button",{type:"button",onClick:()=>s("cosmetics"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="cosmetics"?"bg-pink-600 text-white":"text-violet-400 border border-violet-800"),children:"Cosméticos CC"}),I.jsx("button",{type:"button",onClick:()=>s("emotes"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="emotes"?"bg-sky-600 text-white":"text-violet-400 border border-violet-800"),children:"Emotes"})]}),I.jsx("p",{className:"text-[0.65rem] text-violet-500 text-center max-w-md leading-relaxed px-2",children:"Modelo freemium: invitados juegan gratis · Registrados ganan CN en misiones · Salas premium usan Cero Coins · Pagos sujetos a términos y revisión."}),t==="packs"?',
);

apply(
  'store-packs-ui',
  't==="packs"?I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-amber-300 text-center font-bold",children:"🔥 Ofertas destacadas — estilo UNO"}',
  't==="packs"?I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-violet-300 text-center leading-relaxed",children:"Comprá Cero Coins con Mercado Pago (automático) o transferí manual vía Prex en la pestaña Transferir / Prex."}',
);

// Remove old offers block - replace offers content with packs grid
apply(
  'store-offers-to-packs',
  '}),I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-violet-950/30",children:[I.jsx("p",{className:"text-sm font-black text-white",children:"Pack Iniciante"}),I.jsx("p",{className:"text-xs text-violet-300 mt-1",children:"500 CC + Marco Fuego + Mesa Neón"}),I.jsx("p",{className:"text-lg font-black text-amber-400 mt-2",children:"$5.990 ARS"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>h("pack_500"),className:"mt-3 w-full py-2.5 rounded-xl font-bold text-sm bg-amber-600 text-white",children:"Comprar pack"})]}),I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-500/40 bg-violet-950/30",children:[I.jsx("p",{className:"text-sm font-black text-white",children:"Pase VIP + 1500 CC"}),I.jsx("p",{className:"text-xs text-violet-300 mt-1",children:"VIP mensual + monedas para salas Pro"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{s("vip")},className:"mt-3 w-full py-2.5 rounded-xl font-bold text-sm border border-violet-500 text-violet-200",children:"Ver VIP"})]})]}):t==="emotes"?',
  '}),I.jsx("div",{className:"grid grid-cols-1 gap-3",children:qC.map(f=>I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-700/50 bg-gradient-to-br from-violet-950/40 to-[#0a0418]/80 flex flex-col gap-3",children:[I.jsxs("div",{className:"flex justify-between items-start",children:[I.jsxs("div",{children:[I.jsx("p",{className:"text-2xl font-black text-amber-400",children:f.label}),I.jsxs("p",{className:"text-sm text-violet-400 mt-0.5",children:["$",f.priceARS.toLocaleString("es-AR")," ARS"]})]}),f.bonus>0&&I.jsx("span",{className:"text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",children:"+"+f.bonus+" bonus"})]}),I.jsxs("div",{className:"flex flex-col gap-2",children:[I.jsx("button",{type:"button",disabled:o,onClick:()=>h(f.id),className:"w-full py-2.5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 transition-colors",children:"💳 Mercado Pago (automático)"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>s("deposit"),className:"w-full py-2 rounded-xl font-bold text-xs border border-emerald-600/60 text-emerald-300 hover:bg-emerald-950/40 transition-colors",children:"🏦 Transferencia / Prex (manual + comprobante)"})]})]},f.id))}),I.jsx("p",{className:"text-[0.6rem] text-violet-600 text-center",children:"PayPal y Binance — próximamente"})]}):t==="emotes"?',
);

apply(
  'store-coins-tab-key',
  '):t==="coins"?I.jsx("div",{className:"grid grid-cols-2 gap-3 w-full max-w-md",children:qC.map(f=>I.jsx(WC,{pkg:f,onBuy:h,busy:o},f.id))}):t==="deposit"?',
  '):t==="deposit"?',
);

apply(
  'store-vip-note',
  '):t==="deposit"?I.jsx(M0Dep,{showToast:e}):I.jsx("div",{className:"flex flex-col gap-4 w-full max-w-md",children:HC.map(f=>I.jsx(GC,{plan:f,onBuy:_,busy:o},f.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-600 text-center max-w-sm",children:"Deposito manual con comprobante o Mercado Pago automatico"})',
  '):t==="deposit"?I.jsx(M0Dep,{showToast:e}):I.jsxs("div",{className:"flex flex-col gap-4 w-full max-w-md",children:[I.jsx("p",{className:"text-xs text-amber-300/90 text-center leading-relaxed",children:"Activá VIP con Mercado Pago abajo. También podés pagar por transferencia y subir comprobante en «Transferir / Prex»."}),HC.map(f=>I.jsx(GC,{plan:f,onBuy:_,busy:o},f.id)),I.jsx("button",{type:"button",onClick:()=>s("deposit"),className:"w-full py-2 rounded-xl text-xs font-bold border border-emerald-600/50 text-emerald-300",children:"Subir comprobante de pago VIP →"})]}),I.jsx("p",{className:"text-[0.6rem] text-violet-600 text-center max-w-sm leading-relaxed",children:"Sin comprobante no se acredita · Binance y PayPal próximamente · Sistema freemium con compras opcionales"})',
);

// ── Depositar: texto más claro ───────────────────────────────────────────────
apply(
  'deposit-copy',
  'Transferi y subi comprobante (JPG, PNG o PDF). Sin comprobante no se acredita.',
  'Transferí (Prex / bancos) y subí comprobante (JPG, PNG o PDF). Sin comprobante no se acredita. Mercado Pago automático = pestaña Packs CN.',
);

apply(
  'deposit-subtitle',
  'Binance y PayPal proximamente. Mercado Pago = tab Cero Coins.',
  'Binance y PayPal próximamente. Mercado Pago automático = Packs CN.',
);

fs.writeFileSync(bundlePath, s);
console.log('Rooms + economy v12 applied.');
