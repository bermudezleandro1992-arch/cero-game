#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing snippet:', from.slice(0, 120));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

apply(
  'callables-rejoin-tournament',
  'async function NC(r){if(!r)throw new TypeError("leaveMatch: falta matchId");return Rc(AC,{matchId:r})}const tl=',
  `async function NC(r){if(!r)throw new TypeError("leaveMatch: falta matchId");return Rc(AC,{matchId:r})}
let M0a=null,M0b=null,M0c=null,M0d=null,M0e=null;
function M0f(){return M0a??(M0a=or(ur,"temporaryLeaveMatch"))}
function M0g(){return M0b??(M0b=or(ur,"getRejoinStatus"))}
function M0h(){return M0c??(M0c=or(ur,"getWeeklyTournament"))}
function M0i(){return M0d??(M0d=or(ur,"registerTournament"))}
function M0j(){return M0e??(M0e=or(ur,"cancelTournamentRegistration"))}
async function M0k(r){return Rc(M0f,{matchId:r})}
async function M0l(r){return Rc(M0g,r??{})}
async function M0m(r){return Rc(M0i,r??{})}
async function M0n(r){return Rc(M0j,{tournamentId:r})}
async function M0p(r){return Rc(M0h,r??{})}
const tl=`,
);

apply(
  'wild-card-4-colors',
  'function YC({value:r,ink:e,isWild:t}){return I.jsxs("div",{className:"absolute inset-0 flex items-center justify-center","aria-hidden":"true",children:[I.jsx("div",{className:"absolute rounded-full rotate-[-30deg]",style:{width:"115%",height:"60%",background:t?"conic-gradient(#e879f9 0deg, #f59e0b 90deg, #60a5fa 180deg, #4ade80 270deg, #e879f9 360deg)":e,opacity:.18}}),I.jsx("span",{className:"relative z-10 leading-none drop-shadow-lg",style:{fontSize:r.length>2?"1.4em":"1.8em",color:e,textShadow:`0 0 12px ${e}`},children:r})]})}',
  'function YC({value:r,ink:e,isWild:t}){return I.jsxs("div",{className:"absolute inset-0 flex items-center justify-center","aria-hidden":"true",children:[t?I.jsxs("div",{style:{position:"absolute",inset:"10%",display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",borderRadius:"10px",overflow:"hidden",boxShadow:"0 0 0 2px rgba(255,255,255,.25)"},children:[I.jsx("div",{style:{background:"#e879f9"}}),I.jsx("div",{style:{background:"#f59e0b"}}),I.jsx("div",{style:{background:"#60a5fa"}}),I.jsx("div",{style:{background:"#4ade80"}})]}):I.jsx("div",{className:"absolute rounded-full rotate-[-30deg]",style:{width:"115%",height:"60%",background:e,opacity:.18}}),I.jsx("span",{className:"relative z-10 leading-none drop-shadow-lg font-black",style:{fontSize:r.length>2?"1.4em":"1.8em",color:t?"#fff":e,textShadow:t?"0 2px 8px rgba(0,0,0,.8)":`0 0 12px ${e}`},children:r})]})}',
);

apply(
  'nav-tournaments-tab',
  'wk=[{id:"home",label:"Inicio",icon:"🏠"},{id:"store",label:"Tienda",icon:"🛍️"},{id:"ranking",label:"Ranking",icon:"🏆"},{id:"profile",label:"Perfil",icon:"👤"}];function Ek(',
  'wk=[{id:"home",label:"Inicio",icon:"🏠"},{id:"tournaments",label:"Torneos",icon:"🏅"},{id:"store",label:"Tienda",icon:"🛍️"},{id:"ranking",label:"Ranking",icon:"🏆"},{id:"profile",label:"Perfil",icon:"👤"}];function Ek(',
);

const tournamentScreen = `function Xk({userId:r,onJoined:e}){const{showToast:t}=Oo(),[s,o]=ie.useState(null),[l,h]=ie.useState(!0),[f,g]=ie.useState(!1);ie.useEffect(()=>{(async()=>{try{o(await M0p({}))}catch(_){t(_.message||"Error","error")}finally{h(!1)}})()},[t]);async function _(w){g(!0);try{w==="register"?await M0m({}):await M0n(s.tournamentId),o(await M0p({})),t(w==="register"?"¡Inscripto!":"Inscripción cancelada","success")}catch(T){t(T.message||"Error","error")}finally{g(!1)}}if(l)return I.jsx("div",{className:"p-10 text-center text-violet-400",children:"Cargando torneo…"});const u=(s.participants||[]).includes(r),d=s.status==="registration",m=(s.bracket||[]).flat();return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Torneo semanal"}),I.jsxs("p",{className:"text-sm text-violet-300 text-center",children:["Premio ",I.jsx("span",{className:"text-amber-400 font-bold",children:(s.prizePool||0)+" CN"})," · Inscripción ",s.entryFee," CN"]}),I.jsxs("p",{className:"text-xs text-violet-500",children:[s.participantCount,"/",s.bracketSize," jugadores · ",s.weekKey]}),d&&!u&&I.jsx("button",{type:"button",disabled:f,onClick:()=>_("register"),className:"px-8 py-3 rounded-xl font-bold bg-violet-600 text-white disabled:opacity-50",children:"Inscribirse (50 CN)"}),d&&u&&I.jsx("button",{type:"button",disabled:f,onClick:()=>_("cancel"),className:"px-8 py-3 rounded-xl font-bold border border-red-500 text-red-400 disabled:opacity-50",children:"Cancelar inscripción"}),s.status==="active"&&I.jsx("div",{className:"w-full max-w-md flex flex-col gap-2",children:m.map((w,T)=>I.jsxs("div",{className:"p-3 rounded-xl border border-violet-800/60 bg-violet-950/30 text-xs text-violet-200",children:[(s.names&&s.names[w.p1])||String(w.p1).slice(0,8)," vs ",(s.names&&s.names[w.p2])||String(w.p2).slice(0,8),w.winnerUid?I.jsxs("span",{className:"text-amber-300 font-bold",children:[" → 🏆 ",(s.names&&s.names[w.winnerUid])||""]}):w.matchId&&(w.p1===r||w.p2===r)?I.jsx("button",{type:"button",onClick:()=>e(w.matchId),className:"ml-2 text-emerald-400 underline",children:"Entrar a partida"}):null]},T))}),s.championUid&&I.jsxs("p",{className:"text-amber-300 font-bold",children:["Campeón: ",(s.names&&s.names[s.championUid])||s.championUid]})]})}
function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null),[j,N]=ie.useState(null);ie.useEffect(()=>{(async()=>{try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]);if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});`;

apply(
  'tournament-screen',
  'function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null);if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});',
  tournamentScreen,
);

apply(
  'rejoin-banner',
  'const g={home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f}),store:I.jsx(KC,{userId:r.uid}),ranking:I.jsx(jC,{currentUid:r.uid}),profile:I.jsx($C,{userId:r.uid})};return I.jsxs("div",{className:"flex flex-col min-h-screen",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),I.jsx("main",{className:"flex-1 pb-20 overflow-y-auto",children:g[t]}),I.jsx(Ek,{active:t,onChange:s})]})}',
  'const g={home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f}),tournaments:I.jsx(Xk,{userId:r.uid,onJoined:f}),store:I.jsx(KC,{userId:r.uid}),ranking:I.jsx(jC,{currentUid:r.uid}),profile:I.jsx($C,{userId:r.uid})};return I.jsxs("div",{className:"flex flex-col min-h-screen",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),j&&I.jsxs("div",{className:"mx-4 mt-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 flex flex-wrap items-center justify-between gap-2",children:[I.jsxs("p",{className:"text-sm text-emerald-200",children:["Partida activa — tenés ~5 min para volver ",j.stakeCC>0?"(Sala "+j.stakeCC+" CN)":""]}),I.jsx("button",{type:"button",onClick:()=>f(j.matchId),className:"px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold",children:"Volver a la partida"})]}),I.jsx("main",{className:"flex-1 pb-20 overflow-y-auto",children:g[t]}),I.jsx(Ek,{active:t,onChange:s})]})}',
);

const oldYk = s.slice(s.indexOf('function yk('), s.indexOf('function _k({state:r})'));
const newYk = `function yk({state:r}){const{match:e,isMyTurn:t,mustDeclareCero:s,busy:o,draw:l,declareCero:h,forfeit:f,myHand:g}=r,w=(e==null?void 0:e.phase)??"waiting",T=(e==null?void 0:e.drawStack)??0,k=(g==null?void 0:g.length)??0,F=s||k===2;return w==="game_over"||w==="waiting"?null:I.jsxs("div",{className:"flex items-center justify-center gap-3 flex-wrap",children:[(s||k===2)&&I.jsx("button",{type:"button",disabled:o,onClick:h,className:\`font-black text-white border shadow-lg active:scale-95 disabled:opacity-50 \${F?"px-8 py-4 rounded-2xl text-xl animate-pulse bg-pink-600 border-pink-300":"px-5 py-2 rounded-xl text-sm bg-pink-600 border-pink-400"}\`,children:"¡CERO!"}),t&&I.jsx("button",{type:"button",disabled:o,onClick:l,className:\`px-5 py-2 rounded-xl font-bold text-sm bg-violet-700 hover:bg-violet-600 active:scale-95 text-white border border-violet-500 shadow-lg disabled:opacity-50 transition-all\`,children:T>0?\`Robar \${T} cartas (+stack)\`:"Robar carta"}),I.jsx("button",{type:"button",disabled:o,onClick:()=>{window.confirm("¿Abandonar la partida? Tu rival ganará.")&&f()},className:\`px-3 py-2 rounded-xl font-semibold text-xs bg-transparent hover:bg-red-900/40 active:scale-95 text-red-400 border border-red-800/60 disabled:opacity-40 transition-all\`,children:"Abandonar"})]})}`;

if (!s.includes('function yk(')) {
  console.error('PATCH FAILED: yk not found');
  process.exit(1);
}
s = s.replace(oldYk, newYk);
console.log('OK: action-bar-yk-no-leave');

fs.writeFileSync(bundlePath, s);
console.log('Bundle patched successfully.');
