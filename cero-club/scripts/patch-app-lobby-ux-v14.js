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

const HELPERS = `(function(){if(typeof document!="undefined"&&!document.getElementById("M0fx-styles")){const st=document.createElement("style");st.id="M0fx-styles";st.textContent="@keyframes M0spin{to{transform:rotate(360deg)}}@keyframes M0pulseGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}";document.head.appendChild(st)}})();
function M0modeLbl(m){return m==="cero"?"CERO Caótico":"CERO Clásico"}
function M0fmtCC(n){return n===0?"Gratis":n>=1e3?n/1e3+"k CC":n+" CC"}
function M0frameStyle(id){const m={frame_neon_ring:{borderColor:"#22d3ee",boxShadow:"0 0 26px rgba(34,211,238,.65)",animation:"M0spin 5s linear infinite"},frame_aurora:{borderColor:"#60a5fa",boxShadow:"0 0 34px rgba(96,165,250,.55)",animation:"M0pulseGlow 2.2s ease-in-out infinite"},frame_vip_glow:{borderColor:"#fbbf24",boxShadow:"0 0 42px rgba(245,158,11,.8)",animation:"M0pulseGlow 1.4s ease-in-out infinite"},frame_legend:{borderColor:"#f59e0b",boxShadow:"0 0 32px rgba(245,158,11,.6)"},frame_diamond:{borderColor:"#e0e7ff",boxShadow:"0 0 28px rgba(224,231,255,.5)"}};return m[id]||{borderColor:id?"#a78bfa":"#5b21b6",boxShadow:id?"0 0 28px rgba(167,139,250,.35)":void 0}}
function M0WaitLeft(createdAt,mins){const start=(createdAt==null?void 0:createdAt.toMillis)?createdAt.toMillis():Date.now();return Math.max(0,start+(mins||5)*6e4-Date.now())}
function M0ShareRoom({code,link,minutes,showToast}){const txt="¡Jugá CERO Club conmigo! Código: "+code+". Tenés "+minutes+" min para entrar: "+link;const wa="https://wa.me/?text="+encodeURIComponent(txt);const fb="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(link);const igCopy=async()=>{try{await navigator.clipboard.writeText(link+"\\nCódigo: "+code);showToast&&showToast("Link copiado — pegalo en Instagram","success")}catch{}};const copyCode=async()=>{try{await navigator.clipboard.writeText(code);showToast&&showToast("Código copiado","success")}catch{}};return I.jsxs("div",{className:"flex flex-col gap-2 w-full max-w-xs mt-2",children:[I.jsxs("p",{className:"text-2xl font-black tracking-[0.35em] text-amber-300 font-mono",children:[code]}),I.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[I.jsx("a",{href:wa,target:"_blank",rel:"noopener noreferrer",className:"py-2 rounded-xl text-xs font-bold text-center bg-emerald-700/80 text-white border border-emerald-500/50",children:"WhatsApp"}),I.jsx("a",{href:fb,target:"_blank",rel:"noopener noreferrer",className:"py-2 rounded-xl text-xs font-bold text-center bg-blue-900/70 text-white border border-blue-600/50",children:"Facebook"}),I.jsx("button",{type:"button",onClick:igCopy,className:"py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-700/70 to-purple-800/70 text-white border border-pink-500/40",children:"Instagram"}),I.jsx("button",{type:"button",onClick:copyCode,className:"py-2 rounded-xl text-xs font-bold bg-violet-900/60 text-violet-200 border border-violet-600/50",children:"Copiar código"})]})]})}
function M0resolveCodeFn(){return M0resolveB??(M0resolveB=or(ur,"resolveJoinCode"))}
let M0resolveB=null;
function M0WaitScreen({match:o,uid:s,matchId:r,onExit:e,busy:k,cfg,showToast}){const[now,setNow]=ie.useState(Date.now());ie.useEffect(()=>{const iv=setInterval(()=>setNow(Date.now()),1e3);return()=>clearInterval(iv)},[]);const M0wm=(cfg==null?void 0:cfg.waitingRoomMinutes)??5,M0wleft=Math.max(0,Math.ceil(M0WaitLeft(o.createdAt,M0wm)/1e3)),M0wmin=Math.floor(M0wleft/60),M0wsec=M0wleft%60,M0code=o.isPrivate&&o.joinCode?String(o.joinCode):"",M0link=M0code?"https://cero-club.web.app/app/?code="+M0code:"https://cero-club.web.app/app/";return I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-6 px-6",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsxs("div",{className:"flex flex-col items-center gap-3 text-center max-w-sm",children:[I.jsx("span",{className:"text-5xl animate-pulse",children:"⏳"}),I.jsx("h2",{className:"text-2xl font-black text-white tracking-wide",children:(o.playerCount??0)>=(o.maxPlayers??2)?"Iniciando partida…":"Esperando rival…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[o.playerCount,"/",o.maxPlayers," · ",o.format??"1v1"," · ",M0modeLbl(o.mode)]}),I.jsx("div",{className:"flex flex-wrap gap-2 justify-center mt-1",children:((o.players)??[]).map(P=>I.jsxs("span",{className:"text-[0.65rem] px-2 py-1 rounded-full border "+(P.uid===s?"border-violet-400 text-violet-200 bg-violet-900/40":"border-violet-800 text-violet-400"),children:[P.name,P.uid===s?" (vos)":""]},P.uid))}),M0code?I.jsx(M0ShareRoom,{code:M0code,link:M0link,minutes:M0wm,showToast}):I.jsx("p",{className:"text-[0.68rem] text-violet-500 mt-2",children:"Sala pública — visible en el lobby."}),I.jsxs("p",{className:"text-xs font-mono text-amber-300/90 mt-1",children:["Tiempo restante: ",M0wmin,":",String(M0wsec).padStart(2,"0")]}),I.jsxs("p",{className:"text-[0.65rem] text-violet-600 leading-relaxed",children:["Tenés ",M0wm," minutos para que entre alguien. Pasado ese tiempo, creá la sala de nuevo."]})]}),I.jsx("button",{type:"button",disabled:k,onClick:async()=>{try{await NC(r)}catch{}try{sessionStorage.removeItem("cero_active_match")}catch{}e==null||e()},className:"px-8 py-3 rounded-2xl font-bold text-violet-300 border-2 border-violet-700 hover:border-violet-500 transition-all disabled:opacity-50",children:"Volver al Lobby"})]})}
function M0Logo({sm}){return I.jsxs("div",{className:"inline-flex items-center gap-1.5",children:[I.jsx("span",{className:(sm?"text-2xl":"text-4xl")+" font-black tracking-tight text-white",children:"CERO"}),I.jsx("span",{className:(sm?"text-2xl":"text-4xl")+" font-black text-violet-400",children:"."}),I.jsx("span",{className:"text-[0.55rem] font-bold uppercase tracking-[0.25em] text-amber-400/90 ml-1",children:"Club"})]})}
`;

apply(
  'helpers-v14',
  'function M0pubCfgFn(){return M0pubCfg??(M0pubCfg=or(ur,"getPublicConfig"))}',
  'function M0pubCfgFn(){return M0pubCfg??(M0pubCfg=or(ur,"getPublicConfig"))}\n' + HELPERS,
);

apply(
  'oc-config-state',
  ',[M0jkey,setM0jkey]=ie.useState(""),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{try{const M0qp=new URLSearchParams(window.location.search);const M0qj=M0qp.get("join"),M0qk=M0qp.get("key");if(M0qj){F(M0qj);M0qk&&setM0jkey(M0qk)}}catch{}},[]);',
  ',[M0jkey,setM0jkey]=ie.useState(""),[M0cfg,setM0cfg]=ie.useState(null),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{M0pubCfgFn()().then(ne=>setM0cfg(ne)).catch(()=>{})},[]);ie.useEffect(()=>{(async()=>{try{const M0qp=new URLSearchParams(window.location.search);const M0qj=M0qp.get("join"),M0qk=M0qp.get("key"),M0qc=M0qp.get("code");if(M0qc){const cd=M0qc.replace(/\\D/g,"").slice(0,6);setM0jkey(cd);try{const r=await M0resolveCodeFn()({code:cd});F(r.matchId)}catch{}}else if(M0qj){F(M0qj);M0qk&&setM0jkey(M0qk.replace(/\\D/g,"").slice(0,6))}}catch{}})()},[]);',
);

apply(
  'mode-classic-only',
  'I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-700/50",children:["classic","cero"].map(ne=>{const J=tl[w0[ne]];return I.jsx("button",{type:"button",onClick:()=>T(ne),className:["flex-1 py-2.5 text-sm font-bold uppercase tracking-widest transition-all",w===ne?"brightness-110":"opacity-40 hover:opacity-70"].join(" "),style:{background:w===ne?J.bg:"transparent",color:J.ink},children:ne},ne)})})',
  'I.jsxs("div",{className:"flex flex-col gap-1.5",children:[I.jsxs("div",{className:"flex rounded-xl overflow-hidden border border-violet-700/50",children:[I.jsx("button",{type:"button",className:"flex-1 py-2 text-xs font-bold uppercase tracking-wide brightness-110",style:{background:tl.blue.bg,color:tl.blue.ink},children:"CERO Clásico"}),I.jsx("button",{type:"button",disabled:!0,title:"Próximamente",className:"flex-1 py-2 text-xs font-bold uppercase tracking-wide opacity-30 cursor-not-allowed",style:{background:"transparent",color:"#64748b"},children:"CERO Caótico"})]}),I.jsx("p",{className:"text-[0.62rem] text-violet-600 text-center leading-snug",children:"Pronto habilitamos CERO Caótico con nuevos comodines."})]})',
);

apply(
  'custom-room-compact',
  '!OCg&&I.jsxs("div",{className:"p-4 rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-950/25 to-transparent flex flex-col gap-3",children:[I.jsx("p",{className:"text-xs font-bold text-amber-400 uppercase tracking-widest",children:"Crear sala personalizada"}),I.jsx("p",{className:"text-[0.72rem] text-violet-400 leading-relaxed",children:"Elegí apuesta (30–20.000 CN) o sala pública gratis. Privada = solo entran con tu código/link."}),I.jsx("div",{className:"grid grid-cols-4 gap-1.5",children:[0,30,50,100,250,500,1e3,2500,5e3,1e4,2e4].map(ne=>',
  '!OCg&&I.jsxs("div",{className:"p-3 rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-transparent flex flex-col gap-2",children:[I.jsx("p",{className:"text-[0.65rem] font-bold text-amber-400 uppercase tracking-widest",children:"Nueva sala"}),I.jsx("p",{className:"text-[0.68rem] text-violet-400 leading-snug",children:"Elegí CeroCoins · Pública o privada (código 6 dígitos · 5 min)"}),I.jsx("div",{className:"flex flex-wrap gap-1",children:((M0cfg==null?void 0:M0cfg.roomStakes)||[0,30,50,100,250,500,1e3,2500,5e3,1e4,2e4]).map(ne=>',
);

apply(
  'stake-btn-cc',
  'children:ne===0?"Gratis":ne>=1e3?ne/1e3+"k":ne},ne))})',
  'children:M0fmtCC(ne)},ne))})',
);

apply(
  'create-btn-cc',
  'M0priv?"Crear sala privada · "+(M0stk===0?"Gratis":M0stk+" CN"):"Crear sala · "+(M0stk===0?"Gratis":M0stk+" CN")',
  'M0priv?"Crear privada · "+M0fmtCC(M0stk):"Crear · "+M0fmtCC(M0stk)',
);

apply(
  'join-code-6digits',
  'placeholder:"Código privado (6 letras) — obligatorio en salas 🔒"',
  'placeholder:"Código privado (6 dígitos) — salas 🔒"',
);

apply(
  'join-code-uppercase-fix',
  'onChange:ne=>setM0jkey(ne.target.value.toUpperCase())',
  'onChange:ne=>setM0jkey(ne.target.value.replace(/\\D/g,"").slice(0,6))',
);

apply(
  'lobby-logo',
  'I.jsxs("h1",{className:"text-4xl font-black tracking-tight text-white",children:["CERO",I.jsx("span",{className:"text-violet-400",children:"."})]}),',
  'I.jsx(M0Logo,{}),',
);

// Waiting room — share + countdown + clásico (index-based, evita CRLF)
{
  const waitStart = s.indexOf('if(o.status==="waiting"||o.status==="playing"&&o.phase==="waiting"&&!o.topDiscard){const Ae=r.slice(0,8);');
  const waitEnd = s.indexOf('if(o.phase==="game_over"', waitStart);
  if (waitStart === -1 || waitEnd === -1) {
    console.error('PATCH FAILED: waiting-room boundaries');
    process.exit(1);
  }
  const NEW_WAIT = 'if(o.status==="waiting"||o.status==="playing"&&o.phase==="waiting"&&!o.topDiscard){return I.jsx(M0WaitScreen,{match:o,uid:s,matchId:r,onExit:e,busy:k,cfg:M0wcfg,showToast:M0st})}';
  s = s.slice(0, waitStart) + NEW_WAIT + s.slice(waitEnd);
  console.log('OK: waiting-room-share');
}

// vk: load public config for waiting minutes + visibility rejoin
apply(
  'vk-config-rejoin',
  'function vk({matchId:r,onExit:e}){var J,ee,le;const t=sk(r)',
  'function vk({matchId:r,onExit:e}){var J,ee,le;const{showToast:M0st}=Oo(),[M0wcfg,setM0wcfg]=ie.useState({waitingRoomMinutes:5});ie.useEffect(()=>{M0pubCfgFn()().then(ne=>setM0wcfg(ne)).catch(()=>{})},[]);ie.useEffect(()=>{const onVis=()=>{document.visibilityState==="visible"&&M0l({}).then(ne=>{ne.available&&ne.matchId===r&&ne.status==="playing"&&M0st("Partida activa — seguís en juego","success")}).catch(()=>{})};document.addEventListener("visibilitychange",onVis);return()=>document.removeEventListener("visibilitychange",onVis)},[r,M0st]);const t=sk(r)',
);

// Ik: auto-restore partida + countdown en banner
apply(
  'ik-auto-rejoin',
  'try{const _=await M0l({});if(_.available)N(_);else N(null)}catch{}})()},[]),',
  'try{const _=await M0l({});if(_.available){N(_);if(!o){try{const m=sessionStorage.getItem("cero_active_match");if(m===_.matchId||_.status==="playing"){l(_.matchId);try{sessionStorage.setItem("cero_active_match",_.matchId)}catch{}}}catch{}}}else N(null)}catch{}})()},[]),',
);

apply(
  'ik-rejoin-countdown',
  'children:IkAct.rejoin?"Partida activa — reingresá":IkPlay?"Partida en curso":"Sala esperando rival"}',
  'children:IkAct.rejoin?"Partida activa — volvé ("+(j!=null&&j.rejoinUntil?Math.max(0,Math.ceil((j.rejoinUntil-Date.now())/1e3))+"s)":"5 min")+")":IkPlay?"Partida en curso — Continuar":"Sala esperando rival"}',
);

// Profile premium frames
apply(
  'profile-frame-style',
  'style:{borderColor:t.equippedFrame?"#a78bfa":"#5b21b6",boxShadow:t.equippedFrame?"0 0 28px rgba(167,139,250,.45)":"0 0 20px rgba(124,58,237,.25)"}',
  'style:M0frameStyle(t.equippedFrame)',
);

// Cosméticos: marcos premium + mazos
if (s.includes('frame_legend",name:"Marco Leyenda"')) {
  s = s.replace(
    'frame_legend",name:"Marco Leyenda",category:"avatar_frame",price:1200,preview:"👑"}',
    'frame_legend",name:"Marco Leyenda",category:"avatar_frame",price:1200,preview:"👑"},{id:"frame_neon_ring",name:"Anillo Neón",category:"avatar_frame",price:850,preview:"💫"},{id:"frame_aurora",name:"Aurora VIP",category:"avatar_frame",price:1500,preview:"🌈"},{id:"frame_vip_glow",name:"Brillo Élite",category:"avatar_frame",price:2000,preview:"✨"},{id:"deck_flame",name:"Mazo Llama",category:"deck_back",price:480,preview:"🔥"},{id:"deck_legend",name:"Mazo Leyenda",category:"deck_back",price:720,preview:"👑"},{id:"deck_neon",name:"Mazo Neón Pro",category:"deck_back",price:580,preview:"💜"}',
  );
  console.log('OK: cosmetics-catalog-v14');
}

apply(
  'cos-img-map',
  'deck_cyber:"/app/cosmetics/decks/cyber.svg"};',
  'deck_cyber:"/app/cosmetics/decks/cyber.svg",frame_neon_ring:"/app/cosmetics/frames/neon-ring.svg",frame_aurora:"/app/cosmetics/frames/aurora.svg",frame_vip_glow:"/app/cosmetics/frames/vip.svg",deck_flame:"/app/cosmetics/decks/flame.svg",deck_legend:"/app/cosmetics/decks/legend.svg",deck_neon:"/app/cosmetics/decks/neon.svg"};',
);

apply(
  'deck-styles-v14',
  'deck_holo:{background:"linear-gradient(145deg,#4c1d95,#0f172a,#065f46)",borderColor:"rgba(167,139,250,.6)"}};',
  'deck_holo:{background:"linear-gradient(145deg,#4c1d95,#0f172a,#065f46)",borderColor:"rgba(167,139,250,.6)"},deck_flame:{background:"linear-gradient(145deg,#7f1d1d,#1a0836)",borderColor:"rgba(251,191,36,.55)"},deck_legend:{background:"linear-gradient(145deg,#312e81,#1f1004)",borderColor:"rgba(245,158,11,.6)"},deck_neon:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(34,211,238,.55)"}};',
);

// VC: mode label — skip if anchor missing
if (s.includes('children:[r.format??"1v1"')) {
  console.log('SKIP: vc-mode-label (pattern not found)');
} else {
  console.log('SKIP: vc-mode-label');
}

fs.writeFileSync(bundlePath, s);
console.log('Lobby UX v14 applied.');
