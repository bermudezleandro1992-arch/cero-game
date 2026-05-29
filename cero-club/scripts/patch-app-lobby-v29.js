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

function replaceBlock(name, startNeedle, endNeedle, replacement) {
  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    console.error(`PATCH FAILED: ${name} (boundaries)`, start, end);
    process.exit(1);
  }
  s = s.slice(0, start) + replacement + s.slice(end);
  console.log(`OK: ${name}`);
}

const HELPERS = `const M0STK_OPTS=[{v:0,i:"🎁",l:"Gratis",s:"sin riesgo",hi:"free"},{v:30,i:"🪙",l:"30 CC",s:"casual",hi:""},{v:100,i:"🪙",l:"100 CC",s:"medio",hi:""},{v:250,i:"🪙",l:"250 CC",s:"serio",hi:""},{v:500,i:"🪙",l:"500 CC",s:"alto",hi:""},{v:1e3,i:"🪙",l:"1k CC",s:"pro",hi:""},{v:1e4,i:"🔥",l:"10k CC",s:"grande",hi:"mega"},{v:2e4,i:"🔥",l:"20k CC",s:"máximo",hi:"mega"}];function M0playAvg(sum,cnt){return cnt>0?Math.round(sum/cnt*10)/10:null}function M0init(n){return(n||"?").trim().slice(0,2).toUpperCase()}function M0stkBadge(stk){if(stk===0)return{bg:"rgba(74,222,128,.15)",fg:"#4ade80",tx:"Gratis"};if(stk>=1e4)return{bg:"rgba(245,158,11,.22)",fg:"#fbbf24",tx:(stk>=1e3?stk/1e3+"k":stk)+" CC"};return{bg:"rgba(167,139,250,.15)",fg:"#c4b5fd",tx:(stk>=1e3?stk/1e3+"k":stk)+" CC"}}`;

apply(
  'v29-helpers',
  'function M0colorLbl(c){return{magenta:"Rojo",gold:"Amarillo",blue:"Azul",green:"Verde"}[c]||((tl[c]||{}).label)||c}function M0modeLbl(m){return m==="cero"?"CERO Caótico":"CERO Clásico"}',
  HELPERS + 'function M0colorLbl(c){return{magenta:"Rojo",gold:"Amarillo",blue:"Azul",green:"Verde"}[c]||((tl[c]||{}).label)||c}function M0modeLbl(m){return m==="cero"?"CERO Caótico":"CERO Clásico"}',
);

// ── Cartas rojas (magenta) ───────────────────────────────────────────────────
apply(
  'red-card-faces',
  'function M0cardFaceSrc(r,e){if(e==="reverse")return"/app/cards/reverse-"+r+".svg";if(e==="skip")return"/app/cards/skip-"+r+".svg";if(e==="draw2")return"/app/cards/draw2-"+r+".svg";if(e==="wild")return"/app/cards/wild.svg";if(e==="wild2")return"/app/cards/wild2.svg";if(e==="wild4")return"/app/cards/wild4.svg";return null}',
  'function M0cardFaceSrc(r,e){if(r==="magenta"){if(/^[0-9]$/.test(e))return"/app/cards/red/"+e+".svg";if(e==="draw2"||e==="wild2")return"/app/cards/red/plus2.svg";if(e==="wild4")return"/app/cards/red/plus4.svg";if(e==="skip")return"/app/cards/red/plus1.svg"}if(e==="reverse")return"/app/cards/reverse-"+r+".svg";if(e==="skip")return"/app/cards/skip-"+r+".svg";if(e==="draw2")return"/app/cards/draw2-"+r+".svg";if(e==="wild")return"/app/cards/wild.svg";if(e==="wild2")return"/app/cards/wild2.svg";if(e==="wild4")return"/app/cards/wild4.svg";return null}',
);

// ── Proyectiles: whoosh + explosión (Web Audio) ───────────────────────────────
apply(
  'projectile-synth-v29',
  'function M0playProjectile(){M0beep(.06,.05,640),setTimeout(()=>M0beep(.08,.07,280),55),setTimeout(()=>M0beep(.1,.12,160),130)}',
  'function M0playProjectile(){if(M0isMuted())return;try{M0snd??=new(window.AudioContext||window.webkitAudioContext);M0snd.state==="suspended"&&M0snd.resume();const ctx=M0snd,t0=ctx.currentTime,buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.14),ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const src=ctx.createBufferSource();src.buffer=buf;const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.setValueAtTime(880,t0);bp.frequency.exponentialRampToValueAtTime(160,t0+.13);const g=ctx.createGain();g.gain.setValueAtTime(.32,t0);g.gain.exponentialRampToValueAtTime(.001,t0+.13);src.connect(bp);bp.connect(g);g.connect(ctx.destination);src.start(t0);src.stop(t0+.14);setTimeout(()=>{try{const t1=ctx.currentTime,o=ctx.createOscillator(),og=ctx.createGain();o.type="triangle";o.frequency.setValueAtTime(200,t1);o.frequency.exponentialRampToValueAtTime(55,t1+.11);og.gain.setValueAtTime(.22,t1);og.gain.exponentialRampToValueAtTime(.001,t1+.13);o.connect(og);og.connect(ctx.destination);o.start(t1);o.stop(t1+.14)}catch{}},85)}catch{M0beep(.06,.05,640),setTimeout(()=>M0beep(.08,.07,280),55),setTimeout(()=>M0beep(.1,.12,160),130)}}',
);

// ── Cero Caótico: microtexto Próximamente ────────────────────────────────────
apply(
  'chaotic-tab-soon',
  'I.jsx("button",{type:"button",disabled:!0,title:"Próximamente",className:"flex-1 py-2 text-xs font-bold uppercase tracking-wide opacity-30 cursor-not-allowed",style:{background:"transparent",color:"#64748b"},children:"CERO Caótico"})]}),I.jsx("p",{className:"text-[0.62rem] text-violet-600 text-center leading-snug",children:"Pronto habilitamos CERO Caótico con nuevos comodines."})]})',
  'I.jsxs("button",{type:"button",disabled:!0,className:"flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 opacity-35 cursor-not-allowed border-l border-violet-800/40",style:{background:"transparent",color:"#94a3b8"},children:[I.jsx("span",{className:"text-xs font-bold uppercase tracking-wide",children:"Cero caótico"}),I.jsx("span",{className:"text-[0.55rem] font-semibold text-violet-500",children:"Próximamente"})]})]})]})',
);

// ── OC: saldo del usuario ────────────────────────────────────────────────────
apply(
  'oc-balance-state',
  '[M0cfg,setM0cfg]=ie.useState(null),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{M0pubCfgFn()',
  '[M0cfg,setM0cfg]=ie.useState(null),[M0bal,setM0bal]=ie.useState(null),[k,F]=ie.useState(""),K=ie.useRef(null);ie.useEffect(()=>{if(!r||OCg)return;const u=Co(Ba(br,"users",r),d=>setM0bal(d.exists()?d.data().ceroCoins??0:0));return()=>u()},[r,OCg]);ie.useEffect(()=>{M0pubCfgFn()',
);

// ── Crear sala: grilla 4×2 + saldo + toggle público/privado ────────────────
replaceBlock(
  'create-room-grid-v29',
  '!OCg&&I.jsxs("div",{className:"p-3 rounded-xl border border-amber-500/30',
  '(()=>{const mine=o.filter',
  `!OCg&&I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-700/40 bg-gradient-to-b from-violet-950/30 to-[#0a0418]/60 flex flex-col gap-3 shadow-lg",children:[I.jsx("p",{className:"text-xs font-black text-violet-200 uppercase tracking-widest",children:"Crear sala"}),I.jsx("div",{className:"grid grid-cols-4 gap-2",children:M0STK_OPTS.map(opt=>I.jsxs("button",{type:"button",onClick:()=>setM0stk(opt.v),className:["flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all min-h-[4.25rem]",M0stk===opt.v?opt.hi==="mega"?"border-amber-400 bg-amber-950/50 shadow-[0_0_16px_rgba(245,158,11,.25)]":opt.hi==="free"?"border-emerald-400 bg-emerald-950/40":"border-violet-400 bg-violet-900/50":"border-violet-800/60 bg-[#0a0618]/60 hover:border-violet-600"].join(" "),children:[I.jsx("span",{className:"text-lg leading-none",children:opt.i}),I.jsx("span",{className:"text-[0.68rem] font-black "+(opt.hi==="mega"?"text-amber-300":"text-white"),children:opt.l}),I.jsx("span",{className:"text-[0.52rem] font-semibold text-violet-500 uppercase tracking-wide",children:opt.s})]},opt.v))}),I.jsxs("div",{className:"grid grid-cols-2 gap-2 p-1 rounded-2xl border border-violet-700/50 bg-violet-950/40",children:[I.jsxs("button",{type:"button",onClick:()=>setM0priv(!1),className:"py-3 rounded-xl flex flex-col items-center gap-1 transition-all "+(M0priv?"text-violet-500":"bg-emerald-900/35 border-2 border-emerald-500 text-emerald-100 shadow-inner"),children:[I.jsx("span",{className:"text-xl",children:"🌐"}),I.jsx("span",{className:"text-sm font-black",children:"Pública"}),I.jsx("span",{className:"text-[0.55rem] opacity-70",children:"Visible en lobby"})]}),I.jsxs("button",{type:"button",onClick:()=>setM0priv(!0),className:"py-3 rounded-xl flex flex-col items-center gap-1 transition-all "+(M0priv?"bg-amber-900/40 border-2 border-amber-400 text-amber-100 shadow-inner":"text-violet-500"),children:[I.jsx("span",{className:"text-xl",children:"🔒"}),I.jsx("span",{className:"text-sm font-black",children:"Privada"}),I.jsx("span",{className:"text-[0.55rem] opacity-70",children:"Solo con código"})]})]}),I.jsxs("div",{className:"flex items-center justify-between px-3 py-2.5 rounded-xl border border-violet-700/45 bg-[#0a0618]/70",children:[I.jsxs("div",{className:"flex items-center gap-2",children:[I.jsx("span",{className:"text-base",children:"👛"}),I.jsx("span",{className:"text-xs font-semibold text-violet-400",children:"Tu saldo"})]}),I.jsxs("span",{className:"text-base font-black text-amber-300",children:[(M0bal??0).toLocaleString()," CC"]})]}),(M0stk>0&&M0bal!=null&&M0bal<M0stk)&&I.jsx("p",{className:"text-xs font-bold text-red-400 text-center",children:"Saldo insuficiente para esta apuesta"}),I.jsx("button",{type:"button",disabled:g||!!OCa||M0stk>0&&M0bal!=null&&M0bal<M0stk,onClick:()=>W({stakeCC:M0stk,createNew:!0,format:M0fmt,isPrivate:M0priv}),className:["w-full py-3.5 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-2",g||M0stk>0&&M0bal!=null&&M0bal<M0stk?"opacity-50 cursor-not-allowed":"hover:brightness-110 active:scale-[0.98]"].join(" "),style:{background:"linear-gradient(180deg,#7c3aed,#5b21b6)",borderColor:"#a78bfa",color:"#fff",boxShadow:"0 4px 24px rgba(124,58,237,.35)"},children:g?I.jsxs(I.Fragment,{children:[I.jsx("span",{className:"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"}),"Creando…"]}):M0stk>0&&M0bal!=null&&M0bal<M0stk?"Saldo insuficiente":I.jsxs(I.Fragment,{children:["Crear sala · ",M0stk===0?"Gratis":M0stk.toLocaleString()+" CC",I.jsx("span",{className:"text-lg opacity-80",children:"→"})]})})]})]}),`,
);

// ── Salas abiertas: título unificado ─────────────────────────────────────────
apply(
  'open-rooms-title',
  'children:"Salas con Cero Coins"}',
  'children:"Salas abiertas ahora"}',
);

apply(
  'open-rooms-free-title',
  'children:"Salas públicas gratis (registrados)"}',
  'children:"Salas gratis"}',
);

// ── VC: avatar, nombre, tiempo, badge semántico ──────────────────────────────
replaceBlock(
  'vc-room-row-v29',
  'function VC({match:r,onJoin:e,joining:t,userId:s}){',
  'function ZC0(',
  `function VC({match:r,onJoin:e,joining:t,userId:s}){var g;const host=((g=r.players)==null?void 0:g[0])??{name:"Jugador",photoURL:null,uid:""};const mine=host.uid===s,stk=r.stakeCC??0,bd=M0stkBadge(stk),full=r.playerCount>=r.maxPlayers;return I.jsxs("div",{className:"flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all bg-[#0a0618]/75 hover:bg-[#12082a]/80",style:{borderColor:stk>=1e4?"rgba(245,158,11,.35)":stk>0?"rgba(124,58,237,.28)":"rgba(74,222,128,.28)"},children:[I.jsx("div",{className:"w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-black text-sm border-2 overflow-hidden bg-violet-900/50 border-violet-500/45 text-violet-100",children:host.photoURL?I.jsx("img",{src:host.photoURL,alt:"",className:"w-full h-full object-cover"}):M0init(host.name)}),I.jsxs("div",{className:"flex-1 min-w-0",children:[I.jsxs("p",{className:"text-sm font-bold text-white truncate",children:[host.name,I.jsx("span",{className:"text-violet-400 font-normal text-xs ml-1.5",children:DC(r.createdAt)})]}),I.jsxs("p",{className:"text-[0.62rem] text-violet-500 truncate",children:[(r.maxPlayers??2)>=4?"2 vs 2":"1 vs 1"," · ",M0modeLbl(r.mode),r.isPrivate?" · 🔒 privada":""]})]}),I.jsx("span",{className:"shrink-0 text-[0.65rem] font-black px-2.5 py-1 rounded-full border inline-flex items-center gap-1",style:{background:bd.bg,color:bd.fg,borderColor:bd.fg+"44"},children:stk>=1e4?"🔥 "+bd.tx:stk>0?I.jsxs(I.Fragment,{children:[I.jsx(ZC0,{size:10}),bd.tx]}):bd.tx}),I.jsx("button",{type:"button",disabled:t||full,onClick:()=>e(r.id),className:"shrink-0 px-3.5 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-40 "+(full?"":"hover:brightness-110 active:scale-95"),style:{borderColor:"#7c3aed",background:"rgba(124,58,237,.22)",color:"#e9d5ff"},children:mine?"Entrar":full?"Llena":"Unirse"})]})}`,
);

// ── Factor play en ranking ───────────────────────────────────────────────────
apply(
  'ranking-play-rating-fields',
  'photoURL:le.data().photoURL??null}));s(J);',
  'photoURL:le.data().photoURL??null,playRatingSum:le.data().playRatingSum??0,playRatingCount:le.data().playRatingCount??0}));s(J);',
);

apply(
  'ranking-play-rating-display',
  'le?I.jsxs("span",{className:"text-[0.6rem] font-bold text-amber-400",children:["+",le," CC"]}):null]})]},W.uid)})}),I.jsx("p",{className:"text-xs text-violet-600 text-center pb-4"',
  'le?I.jsxs("span",{className:"text-[0.6rem] font-bold text-amber-400",children:["+",le," CC"]}):null,(W.playRatingCount??0)>0?I.jsxs("span",{className:"text-[0.58rem] font-bold text-amber-300/90",children:["⭐ ",M0playAvg(W.playRatingSum,W.playRatingCount)]}):null]})]},W.uid)})}),I.jsx("p",{className:"text-xs text-violet-600 text-center pb-4"',
);

// ── Factor play en perfil ────────────────────────────────────────────────────
apply(
  'profile-factor-play-grid',
  'grid grid-cols-3 gap-2 w-full max-w-md",children:[I.jsx(gd,{label:"Partidas",value:M0gp}),I.jsx(gd,{label:"Victorias",value:M0gw,accent:"#4ade80"}),I.jsx(gd,{label:"Win rate",value:W+"%",accent:"#60a5fa"})]}),I.jsx(M0SeasonPass',
  'grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-md",children:[I.jsx(gd,{label:"Partidas",value:M0gp}),I.jsx(gd,{label:"Victorias",value:M0gw,accent:"#4ade80"}),I.jsx(gd,{label:"Win rate",value:W+"%",accent:"#60a5fa"}),I.jsx(gd,{label:"Factor play",value:(t.playRatingCount??0)>0?M0playAvg(t.playRatingSum,t.playRatingCount)+" ⭐":"—",accent:"#fbbf24"})]}),I.jsx(M0SeasonPass',
);

// ── Rival factor play en mesa ────────────────────────────────────────────────
apply(
  'seat-avatar-rating',
  'function M0SeatAvatar({player:r,count:e,compact:t,reaction:s}){',
  'function M0SeatAvatar({player:r,count:e,compact:t,reaction:s,rating:rt=null}){',
);

apply(
  'seat-avatar-rating-ui',
  'children:r.name})]})}function M0FourSeats',
  'children:r.name}),rt!=null&&I.jsxs("span",{className:"text-[0.5rem] text-amber-400 font-bold",children:["⭐ ",rt]})]})}function M0FourSeats',
);

apply(
  'four-seats-ratings',
  'const[s,o]=ie.useState({}),l=ie.useRef({});ie.useEffect(()=>{if(!t)return;const h=jf(za(br,"matches",t,"chat")',
  'const[s,o]=ie.useState({}),[M0rt,setM0rt]=ie.useState({}),l=ie.useRef({});ie.useEffect(()=>{others.forEach(p=>{if(!p.uid)return;Co(Ba(br,"users",p.uid),d=>{if(d.exists()){const x=d.data();const a=M0playAvg(x.playRatingSum,x.playRatingCount);setM0rt(v=>({...v,[p.uid]:a}))}})});return()=>{}},[t,others.map(p=>p.uid).join(",")]);ie.useEffect(()=>{if(!t)return;const h=jf(za(br,"matches",t,"chat")',
);

apply(
  'four-seats-pass-rating',
  'children:h(others[0],!1)});',
  'children:h(others[0],!1,M0rt[others[0].uid]??null)});',
);

apply(
  'four-seats-h-compact-rating',
  'const h=(f,g)=>I.jsx(M0SeatAvatar,{player:f,count:cnt(f.uid),compact:g,reaction:s[f.uid]});',
  'const h=(f,g,rt)=>I.jsx(M0SeatAvatar,{player:f,count:cnt(f.uid),compact:g,reaction:s[f.uid],rating:rt??M0rt[f.uid]??null});',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-lobby-v29.js done');
