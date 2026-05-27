#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Snippet:', from.slice(0, 100));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

apply(
  'cero-coin-logo-component',
  'function OC({userId:r,userName:e,onJoined:t}){',
  `function ZC0({size:r=14}){return I.jsx("span",{className:"inline-flex items-center justify-center rounded-full font-black shrink-0",style:{width:r,height:r,fontSize:r*.65,background:"#00EF90",color:"#041f0e",boxShadow:"0 0 8px rgba(0,239,144,.45)"},children:"0"})}
function OC({userId:r,userName:e,onJoined:t}){`,
);

apply(
  'vc-cero-coin-badge',
  'children:r.stakeCC>0?r.stakeCC+" CN":"Gratuita"',
  'children:r.stakeCC>0?I.jsxs("span",{className:"inline-flex items-center gap-1",children:[I.jsx(ZC0,{size:11}),r.stakeCC," CN"]}):"Gratuita"',
);

apply(
  'oc-50cn-toggle-logo',
  '{v:50,l:"50 CN",c:"#f59e0b"}',
  '{v:50,l:"50 CN",c:"#f59e0b",coin:!0}',
);

apply(
  'oc-toggle-render-coin',
  'children:ne.l},ne.v))}),I.jsx("button",{type:"button",disabled:g,onClick:()=>W({stakeCC:j,createNew:!0})',
  'children:ne.coin?I.jsxs("span",{className:"inline-flex items-center justify-center gap-1.5",children:[I.jsx(ZC0,{size:12}),ne.l]}):ne.l},ne.v))}),j>0&&I.jsx("p",{className:"text-[0.65rem] text-amber-500/90 text-center px-1",children:"Se descuentan 50 Cero Coins de tu billetera al crear o entrar."}),I.jsx("button",{type:"button",disabled:g,onClick:()=>W({stakeCC:j,createNew:!0})',
);

apply(
  'oc-my-room-section',
  '}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Salas abiertas"}),h?I.jsx("div",{className:"flex items-center justify-center py-8",children:I.jsx("div",{className:`w-6 h-6 border-2 border-violet-600 border-t-violet-300\r\n                              rounded-full animate-spin`})}):o.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-6",children:"No hay salas abiertas. ¡Creá la primera!"}):I.jsx("div",{className:"flex flex-col gap-2",children:o.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Unirse por código"})',
  `(()=>{const mine=o.filter(ne=>((ne.players||[]).some(P=>P.uid===r)));const open=o.filter(ne=>!((ne.players||[]).some(P=>P.uid===r)));return I.jsxs(I.Fragment,{children:[mine.length>0&&I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-emerald-400 mb-3",children:"Tu sala activa"}),I.jsx("div",{className:"flex flex-col gap-2",children:mine.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-500 mt-2 text-center",children:"Podés volver cuando quieras — la sala sigue activa."})]}),I.jsxs("section",{children:[I.jsx("h2",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400 mb-3",children:"Salas abiertas"}),h?I.jsx("div",{className:"flex items-center justify-center py-8",children:I.jsx("div",{className:"w-6 h-6 border-2 border-violet-600 border-t-violet-300 rounded-full animate-spin"})}):open.length===0?I.jsx("p",{className:"text-center text-sm text-violet-600 py-6",children:mine.length?"No hay otras salas abiertas.":"No hay salas abiertas. ¡Creá la primera!"}):I.jsx("div",{className:"flex flex-col gap-2",children:open.map(ne=>I.jsx(VC,{match:ne,onJoin:J=>W({matchId:J}),joining:g,userId:r},ne.id))})]})]})})()`,
);

apply(
  'oc-save-match-on-join',
  't(J.matchId)}catch(J){const ee=J instanceof Error?J.message:"Error al unirse"',
  'try{sessionStorage.setItem("cero_active_match",J.matchId)}catch{}t(J.matchId)}catch(J){const ee=J instanceof Error?J.message:"Error al unirse"',
);

apply(
  'xk-presence-heartbeat',
  'function xk(){const[r,e]=ie.useState(null),[t,s]=ie.useState(!0);return ie.useEffect(()=>oI(Xn,async l=>{if(!l){window.location.replace("/login.html");return}try{await or(ur,"initUserProfile")({})}catch{}e(l),s(!1)}),[]),t||!r?I.jsx(Sk,{}):I.jsx(_C,{children:I.jsx(Ik,{user:r})})}',
  `function xk(){const[r,e]=ie.useState(null),[t,s]=ie.useState(!0);return ie.useEffect(()=>{let h=null;const f=oI(Xn,async l=>{if(h&&(clearInterval(h),h=null),!l){window.location.replace("/login.html");return}try{await or(ur,"initUserProfile")({})}catch{}const g=async()=>{try{await dC(Ba(br,"presence",l.uid),{displayName:l.displayName||l.email||"Jugador",lastSeen:$d(),game:"cero_app"},{merge:!0})}catch{}};await g(),h=setInterval(g,45e3),e(l),s(!1)});return()=>{f(),h&&clearInterval(h)}},[]),t||!r?I.jsx(Sk,{}):I.jsx(_C,{children:I.jsx(Ik,{user:r})})}`,
);

apply(
  'tk-online-count',
  'function Tk({user:r,onLogout:e}){return I.jsxs("header"',
  `function Tk({user:r,onLogout:e}){const[t,s]=ie.useState(0);ie.useEffect(()=>{const o=Ye.fromMillis(Date.now()-18e4),l=jf(za(br,"presence"),cC("lastSeen",">",o));return Co(l,h=>s(h.size),()=>s(0))},[]);return I.jsxs("header"`,
);

apply(
  'tk-online-ui',
  'children:[I.jsx("span",{className:"text-xs font-semibold text-violet-400 truncate max-w-[120px]",children:r.displayName??r.email??"Jugador"}),I.jsx("button",{type:"button",onClick:e,className:"text-xs text-violet-600 hover:text-red-400 transition-colors",children:"Salir"})]})]})}function Xk(',
  'children:[I.jsxs("span",{className:"hidden sm:inline text-[0.65rem] font-bold text-emerald-400/90 whitespace-nowrap",children:[I.jsx("span",{className:"inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"}),t," en línea"]}),I.jsx("span",{className:"text-xs font-semibold text-violet-400 truncate max-w-[120px]",children:r.displayName??r.email??"Jugador"}),I.jsx("button",{type:"button",onClick:e,className:"text-xs text-violet-600 hover:text-red-400 transition-colors",children:"Salir"})]})]})}function Xk(',
);

apply(
  'ik-waiting-room-tracker',
  'function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null),[j,N]=ie.useState(null);ie.useEffect(()=>{(async()=>{try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]);if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});',
  `function Ik({user:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("home"),[o,l]=ie.useState(null),[j,N]=ie.useState(null),[A,ze]=ie.useState(null);ie.useEffect(()=>{(async()=>{try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]),ie.useEffect(()=>{if(!r.uid)return;const _=jf(za(br,"matches"),cC("playerIds","array-contains",r.uid),cC("status","==","waiting"));return Co(_,w=>{const T=w.docs.map(k=>({id:k.id,...k.data()})).find(k=>(k.playerCount??1)<(k.maxPlayers??2));ze(T?{matchId:T.id,stakeCC:T.stakeCC??0}:null)},()=>ze(null))},[r.uid]);if(o)return I.jsx(vk,{matchId:o,onExit:()=>l(null)});`,
);

apply(
  'ik-floating-room-button',
  'function f(_){l(_)}const g={home:',
  `function f(_){try{sessionStorage.setItem("cero_active_match",_)}catch{}l(_)}const et=A&&!o?I.jsx("button",{type:"button",onClick:()=>f(A.matchId),className:"fixed right-3 top-20 z-50 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-lg border border-emerald-500/50",style:{background:"rgba(6,78,59,.92)"},children:A.stakeCC>0?"🎮 Tu sala · "+A.stakeCC+" CN":"🎮 Tu sala gratuita"}):null,g={home:`,
);

apply(
  'ik-waiting-banner',
  'return I.jsxs("div",{className:"flex flex-col min-h-screen",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),j&&I.jsxs("div"',
  'return I.jsxs("div",{className:"flex flex-col min-h-screen",style:{background:"#04030d"},children:[I.jsx(Tk,{user:r,onLogout:h}),et,A&&!o&&!j&&I.jsxs("div",{className:"mx-4 mt-3 p-3 rounded-xl border border-violet-500/40 bg-violet-950/40 flex flex-wrap items-center justify-between gap-2",children:[I.jsxs("p",{className:"text-sm text-violet-200",children:["Tenés una sala esperando rival",A.stakeCC>0?" · "+A.stakeCC+" CN":""]}),I.jsx("button",{type:"button",onClick:()=>f(A.matchId),className:"px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold",children:"Volver a mi sala"})]}),j&&I.jsxs("div"',
);

try {
  new Function(s);
  console.log('Syntax OK');
} catch (err) {
  console.error('Syntax error after patches:', err.message);
  process.exit(1);
}

fs.writeFileSync(bundlePath, s);
console.log('Lobby v2 patches applied.');
