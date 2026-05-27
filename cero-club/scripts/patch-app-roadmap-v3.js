#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 180));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── 1. Skins de cartas in-game ────────────────────────────────────────────────
if (!s.includes('M0CARD_SKIN')) {
  apply(
    'card-skin-helpers',
    'let M0deckEquipped=null;',
    `let M0deckEquipped=null,M0skinEquipped=null;
const M0CARD_SKIN={skin_neon:(g,w)=>({background:w?g.bg:\`linear-gradient(145deg,\${g.bg},#060010)\`,boxShadow:\`0 0 14px \${g.ink}55\`}),skin_gold:(g,w)=>({background:\`linear-gradient(145deg,#3d2800,\${g.bg})\`,borderColor:"#f59e0b99",boxShadow:"0 0 16px rgba(245,158,11,.35)"}),skin_galaxy:(g,w)=>({background:\`radial-gradient(circle at 25% 20%,#6366f166,\${g.bg})\`,borderColor:"#818cf899"}),skin_minimal:(g,w)=>({background:"#0c0c12",borderColor:"#ffffff28",boxShadow:"none"})};
function M0cardSkinStyle(sid,g,w){return(M0CARD_SKIN[sid]||(()=>({})))(g,w)}`,
  );
}
if (!s.includes('M0skinEquipped=x.equippedSkin')) {
  apply(
    'vk-load-skin',
    'M0deckEquipped=x.equippedDeckBack||null',
    'M0deckEquipped=x.equippedDeckBack||null,M0skinEquipped=x.equippedSkin||null',
  );
}
apply(
  't0-skin-apply',
  'T=JC({isPlayable:t,isSelected:s,small:l,onClick:!!h}),k={background:g.bg,borderColor:t?"rgba(0,239,144,.7)":g.ink+"55"',
  'T=JC({isPlayable:t,isSelected:s,small:l,onClick:!!h});const M0sk=M0cardSkinStyle(M0skinEquipped,g,w),k={background:M0sk.background||g.bg,borderColor:t?"rgba(0,239,144,.7)":M0sk.borderColor||g.ink+"55"',
);

// ── 2. Fondos/mesas con más detalle visual ────────────────────────────────────
apply(
  'room-bg-upgrade',
  'const M0ROOM_BG={bg_stadium:"radial-gradient(ellipse at 50% 35%, #1a4a20 0%, #04030d 72%)",bg_beach:"radial-gradient(ellipse at 50% 15%, #1a5080 0%, #04030d 68%)",bg_city:"radial-gradient(ellipse at 50% 25%, #2a1050 0%, #04030d 70%)",bg_football:"radial-gradient(ellipse at 50% 40%, #0a4020 0%, #04030d 72%)"};',
  'const M0ROOM_BG={bg_stadium:"radial-gradient(ellipse at 50% 30%, #1a5030 0%, #04030d 70%), repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 2px,transparent 2px 40px)",bg_beach:"radial-gradient(ellipse at 50% 10%, #2a6090 0%, #04030d 65%), linear-gradient(180deg,rgba(96,165,250,.08) 0%,transparent 40%)",bg_city:"radial-gradient(ellipse at 50% 20%, #3a1860 0%, #04030d 68%), repeating-linear-gradient(0deg,rgba(167,139,250,.04) 0 1px,transparent 1px 24px)",bg_football:"radial-gradient(ellipse at 50% 35%, #0d5028 0%, #04030d 72%), repeating-linear-gradient(0deg,rgba(74,222,128,.06) 0 48px,transparent 48px 96px)"};',
);

// ── 3. Sonido proyectiles + animaciones carta ─────────────────────────────────
apply(
  'projectile-sound',
  'function M0playLose(){M0beep(.08,.2,220)}',
  `function M0playLose(){M0beep(.08,.2,220)}
function M0playProjectile(){M0beep(.07,.05,520),setTimeout(()=>M0beep(.05,.04,780),70)}
function M0CardFx({text:r}){return r?I.jsx("div",{className:"fixed inset-0 z-[45] pointer-events-none flex items-center justify-center",children:I.jsx("div",{className:"text-4xl sm:text-5xl font-black text-white animate-pulse px-6 py-3 rounded-2xl border-2 border-violet-400/60",style:{background:"rgba(4,3,13,.75)",textShadow:"0 0 24px rgba(167,139,250,.8)",animation:"M0fxPop .85s ease-out forwards"},children:r})}):null}`,
);

apply(
  'hk-projectile-sound',
  'J==="🥧"||J==="🎂"||J==="💩"||J==="🍅"||J==="💣"?le(J):o(J)}',
  'J==="🥧"||J==="🎂"||J==="💩"||J==="🍅"||J==="💣"?(M0playProjectile(),le(J)):o(J)}',
);

// ── 4. Efectos visuales en partida (lastAction / topDiscard) ──────────────────
apply(
  'vk-card-fx',
  'const[M0tu,M0tuDone]=ie.useState(()=>{try{return!localStorage.getItem("cero_tutorial_v2")}catch{return!1}}),M0left=ie.useRef(!1);',
  'const[M0fx,setM0fx]=ie.useState(null);const M0fxT=ie.useRef(0);ie.useEffect(()=>{if(!o||o.status!=="playing")return;const td=o.topDiscard,v=td==null?void 0:td.value;let msg=null;v==="skip"?msg="⏭️ SALTO":v==="reverse"?msg="🔄 REVERSO":v==="draw2"?msg="➕ DOS CARTAS":v==="wild4"?msg="🌈 +4":v==="wild"?msg="★ COMODÍN":null;if(msg&&Date.now()-M0fxT.current>400){M0fxT.current=Date.now(),setM0fx(msg),setTimeout(()=>setM0fx(null),850)}},[o==null?void 0:o.topDiscard,o==null?void 0:o.turn,o==null?void 0:o.status]);const[M0tu,M0tuDone]=ie.useState(()=>{try{return!localStorage.getItem("cero_tutorial_v2")}catch{return!1}}),M0left=ie.useRef(!1);',
);

apply(
  'vk-fx-render',
  'I.jsx(M0RejoinBanner,{match:o,currentUid:s,stakeCC:o.stakeCC??0}),g&&I.jsx(mk,{onPick:W,busy:k})',
  'I.jsx(M0RejoinBanner,{match:o,currentUid:s,stakeCC:o.stakeCC??0}),M0fx&&I.jsx(M0CardFx,{text:M0fx}),g&&I.jsx(mk,{onPick:W,busy:k})',
);

// ── 5. Historial + checkMissions al terminar ──────────────────────────────────
apply(
  'mission-callables',
  'let M0modAv=null;function M0modAvFn(){return M0modAv??(M0modAv=or(ur,"moderateAvatar"))}',
  `let M0modAv=null,M0miss=null,M0missChk=null;
function M0modAvFn(){return M0modAv??(M0modAv=or(ur,"moderateAvatar"))}
function M0missFn(){return M0miss??(M0miss=or(ur,"claimMissionReward"))}
function M0missChkFn(){return M0missChk??(M0missChk=or(ur,"checkMissions"))}`,
);

apply(
  'vk-history-missions',
  'M0winRef.current=!0;o.winner===s?M0playWin():M0playLose()},[o==null?void 0:o.phase,o==null?void 0:o.status,o==null?void 0:o.winner,s])',
  `M0winRef.current=!0;o.winner===s?M0playWin():M0playLose();try{const hist=JSON.parse(localStorage.getItem("cero_match_hist")||"[]");hist.unshift({id:r,won:o.winner===s,rival:(_==null?void 0:_.name)||"Rival",stake:o.stakeCC??0,at:Date.now()});localStorage.setItem("cero_match_hist",JSON.stringify(hist.slice(0,25)))}catch{}Rc(M0missChkFn(),{matchId:r}).catch(()=>{})},[o==null?void 0:o.phase,o==null?void 0:o.status,o==null?void 0:o.winner,s,r,_==null?void 0:_.name,o==null?void 0:o.stakeCC])`,
);

// ── 6. Ranking mensual — tabs via reemplazo completo de jC al final ───────────
apply(
  'ranking-monthly-prizes',
  'const By={1:1000,2:600,3:400,4:75,5:75,6:50,7:50,8:50,9:50,10:50},LC={1:"🥇",2:"🥈",3:"🥉"};',
  'const By={1:1000,2:600,3:400,4:75,5:75,6:50,7:50,8:50,9:50,10:50},M0Monthly={1:5000,2:3000,3:1500},LC={1:"🥇",2:"🥈",3:"🥉"};',
);

// ranking tabs: applied via post-process below

// ── 7. Bracket visual torneos ─────────────────────────────────────────────────
apply(
  'tournament-bracket-ui',
  's.status==="active"&&I.jsx("div",{className:"w-full max-w-md flex flex-col gap-2",children:m.map((w,T)=>I.jsxs("div",{className:"p-3 rounded-xl border border-violet-800/60 bg-violet-950/30 text-xs text-violet-200",children:[(s.names&&s.names[w.p1])||String(w.p1).slice(0,8)," vs ",(s.names&&s.names[w.p2])||String(w.p2).slice(0,8),w.winnerUid?I.jsxs("span",{className:"text-amber-300 font-bold",children:[" → 🏆 ",(s.names&&s.names[w.winnerUid])||""]}):w.matchId&&(w.p1===r||w.p2===r)?I.jsx("button",{type:"button",onClick:()=>e(w.matchId),className:"ml-2 text-emerald-400 underline",children:"Entrar a partida"}):null]},T))})',
  's.status==="active"&&I.jsx("div",{className:"w-full max-w-lg flex flex-col gap-4",children:(s.bracket||[]).map((rd,ri)=>I.jsxs("div",{children:[I.jsx("p",{className:"text-[0.65rem] font-bold uppercase tracking-widest text-violet-400 mb-2",children:ri===(s.bracket||[]).length-1?"🏆 Final":ri===(s.bracket||[]).length-2?"Semifinal":"Ronda "+(ri+1)}),I.jsx("div",{className:"flex flex-col gap-2",children:(rd||[]).map((w,T)=>{const n1=(s.names&&s.names[w.p1])||String(w.p1||"").slice(0,8),n2=(s.names&&s.names[w.p2])||String(w.p2||"").slice(0,8),mine=w.p1===r||w.p2===r;return I.jsxs("div",{className:"p-3 rounded-xl border flex flex-col gap-1 "+(mine?"border-emerald-500/50 bg-emerald-950/20":"border-violet-800/60 bg-violet-950/30"),children:[I.jsxs("div",{className:"flex justify-between text-xs",children:[I.jsx("span",{className:w.winnerUid===w.p1?"text-amber-300 font-bold":"text-violet-200",children:n1}),I.jsx("span",{className:"text-violet-600",children:"vs"}),I.jsx("span",{className:w.winnerUid===w.p2?"text-amber-300 font-bold":"text-violet-200",children:n2})]}),w.winnerUid?I.jsxs("p",{className:"text-[0.6rem] text-amber-400 font-bold",children:["Ganador: ",(s.names&&s.names[w.winnerUid])||""]}):w.matchId&&mine?I.jsx("button",{type:"button",onClick:()=>e(w.matchId),className:"text-emerald-400 underline text-xs font-bold self-start",children:"Entrar a partida →"}):I.jsx("p",{className:"text-[0.6rem] text-violet-600",children:"Pendiente"})]},T)})})]},ri))})',
);

// ── 8. Matchmaking rápido en lobby ────────────────────────────────────────────
apply(
  'quick-match-module',
  'function OC({userId:r,userName:e,onJoined:t,isGuest:OCg=false,activeRoom:OCa=null,onGoActive:OCgo=null}){const{showToast:s}=Oo(),[o,l]=ie.useState([]),[h,f]=ie.useState(!0),[g,_]=ie.useState(!1),[w,T]=ie.useState("classic"),[j,N]=ie.useState(0),[k,F]=ie.useState(""),K=ie.useRef(null);',
  `function M0QuickMatch({uid:r,name:e,stakeCC:t,onMatched:s,onError:o}){const l=ie.useRef(null),h=ie.useRef(null);ie.useEffect(()=>{if(!r)return;let f=!1;const g="cero-q-"+t,_=Ba(br,"matchmaking","cero","queue",r);dC(_,{uid:r,name:e,stakeKey:g,stakeCC:t,active:!0,ts:$d()},{merge:!0}).catch(()=>{});const w=jf(za(br,"matchmaking","cero","queue"),cC("stakeKey","==",g),cC("active","==",!0));const T=Co(w,k=>{if(f)return;const F=k.docs.map(W=>({id:W.id,...W.data()})).filter(W=>W.uid!==r).sort((W,$)=>((W.ts==null?void 0:W.ts.toMillis())||0)-(($.ts==null?void 0:$.ts.toMillis())||0));if(!F.length)return;const K=F[0];if(r<K.uid){kC({mode:"classic",stakeCC:t,createNew:!0}).then(W=>{f=!0,dC(_,{matchId:W.matchId,active:!1},{merge:!0}),s(W.matchId)}).catch(o)}else{const W=Co(_,ne=>{const J=ne.data();J!=null&&J.matchId&&!f&&(f=!0,s(J.matchId))});l.current=()=>W()}},()=>{});h.current=()=>{f=!0,T(),l.current&&l.current()};return()=>{f=!0,T(),l.current&&l.current(),dC(_,{active:!1,leftAt:$d()},{merge:!0}).catch(()=>{})}},[r,e,t,s,o]);return null}
function OC({userId:r,userName:e,onJoined:t,isGuest:OCg=false,activeRoom:OCa=null,onGoActive:OCgo=null}){const{showToast:s}=Oo(),[o,l]=ie.useState([]),[h,f]=ie.useState(!0),[g,_]=ie.useState(!1),[M0qm,setM0qm]=ie.useState(!1),[w,T]=ie.useState("classic"),[j,N]=ie.useState(0),[k,F]=ie.useState(""),K=ie.useRef(null);`,
);

apply(
  'quick-match-button',
  'children:g?I.jsxs("span",{className:"flex items-center justify-center gap-2",children:[I.jsx("span",{className:"w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"}),"Creando…"]}):j>0?"Crear sala 50 CN":"Crear sala gratuita"})]}),(()=>{const mine=o.filter',
  'children:g?I.jsxs("span",{className:"flex items-center justify-center gap-2",children:[I.jsx("span",{className:"w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"}),"Creando…"]}):j>0?"Crear sala 50 CN":"Crear sala gratuita"}),I.jsx("button",{type:"button",disabled:g||!!OCa||M0qm,onClick:()=>setM0qm(!0),className:"w-full py-3 rounded-xl font-black text-sm border-2 border-sky-500/60 text-sky-300 hover:bg-sky-950/40 transition-all disabled:opacity-40",children:M0qm?"🔍 Buscando rival…":"⚡ Juego rápido (matchmaking)"}),M0qm&&I.jsx(M0QuickMatch,{uid:r,name:e,stakeCC:OCg?0:j,onMatched:t,onError:ne=>{s(ne.message||"Error en cola","error"),setM0qm(!1)}})]}),(()=>{const mine=o.filter',
);

// ── 9. Pantalla Misiones + nav ────────────────────────────────────────────────
const missionsScreen = `function M0Missions({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState([]),[o,l]=ie.useState([]),[h,f]=ie.useState(!0),[g,_]=ie.useState(!1);ie.useEffect(()=>{const k=Co(jf(za(br,"missions")),F=>{s(F.docs.map(K=>({id:K.id,...K.data()})).sort((K,W)=>(K.order||0)-(W.order||0))),f(!1)});const w=Co(jf(za(br,"users",r,"mission_progress")),F=>{l(F.docs.map(K=>({id:K.id,...K.data()})))});return()=>{k(),w()}},[r]);const j=ie.useCallback(async w=>{_(!0);try{const T=await Rc(M0missFn(),{missionId:w});e("+"+T.coins+" CC · +"+(T.xp||0)+" XP","success")}catch(T){e(T instanceof Error?T.message:"Error","error")}finally{_(!1)}},[e]);return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-5 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Misiones"}),I.jsx("p",{className:"text-xs text-violet-400 text-center max-w-sm",children:"Completá desafíos diarios, semanales y permanentes para ganar Cero Coins y XP."}),h?I.jsx("p",{className:"text-violet-500",children:"Cargando…"}):I.jsx("div",{className:"w-full max-w-md flex flex-col gap-3",children:t.filter(w=>w.active!==false).map(w=>{const T=o.find(k=>k.id===w.id),k=(T==null?void 0:T.progress)??0,F=(T==null?void 0:T.goal)??w.requirement.count,K=!!(T==null?void 0:T.completed),W=!!(T==null?void 0:T.rewardClaimed),$=Math.min(100,Math.round(k/F*100));return I.jsxs("div",{className:"p-4 rounded-2xl border border-violet-800/50 bg-violet-950/30",children:[I.jsxs("div",{className:"flex justify-between gap-2 mb-1",children:[I.jsx("p",{className:"text-sm font-bold text-white",children:w.title}),I.jsx("span",{className:"text-[0.6rem] uppercase font-bold text-violet-500",children:w.type})]}),I.jsx("p",{className:"text-xs text-violet-400 mb-2",children:w.description}),I.jsx("div",{className:"h-1.5 rounded-full bg-violet-950 mb-2 overflow-hidden",children:I.jsx("div",{className:"h-full bg-violet-500",style:{width:$+"%"}})}),I.jsxs("div",{className:"flex justify-between items-center",children:[I.jsxs("span",{className:"text-xs text-violet-300",children:[k,"/",F," · +",w.reward.coins," CC"]}),K&&!W?I.jsx("button",{type:"button",disabled:g,onClick:()=>j(w.id),className:"px-3 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold",children:"Reclamar"}):W?I.jsx("span",{className:"text-xs text-emerald-400 font-bold",children:"✓ Reclamado"}):I.jsx("span",{className:"text-xs text-violet-600",children:"En progreso"})]})]},w.id)})})]})}`;

apply(
  'missions-screen-inject',
  'function Xk({userId:r,onJoined:e}){',
  `${missionsScreen}
function Xk({userId:r,onJoined:e}){`,
);

apply(
  'nav-missions-tab',
  'wk=[{id:"home",label:"Inicio",icon:"🏠"},{id:"tournaments",label:"Torneos",icon:"🏅"},{id:"store",label:"Tienda",icon:"🛍️"},{id:"ranking",label:"Ranking",icon:"🏆"},{id:"profile",label:"Perfil",icon:"👤"}];',
  'wk=[{id:"home",label:"Inicio",icon:"🏠"},{id:"missions",label:"Misiones",icon:"🎯"},{id:"tournaments",label:"Torneos",icon:"🏅"},{id:"store",label:"Tienda",icon:"🛍️"},{id:"ranking",label:"Ranking",icon:"🏆"},{id:"profile",label:"Perfil",icon:"👤"}];',
);

apply(
  'guest-nav-missions',
  'Ekn=Ekg?wk.filter(x=>x.id==="home"||x.id==="ranking"||x.id==="profile"):wk;',
  'Ekn=Ekg?wk.filter(x=>x.id==="home"||x.id==="ranking"||x.id==="profile"):wk;',
);

apply(
  'ik-missions-route',
  'tournaments:r.isAnonymous?I.jsx("div"',
  'missions:r.isAnonymous?I.jsx("div",{className:"min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4",style:{background:"#04030d"},children:[I.jsx("p",{className:"text-4xl",children:"🔒"}),I.jsx("p",{className:"text-violet-300 text-sm",children:"Misiones solo para cuentas registradas"}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm",children:"Registrarme"})]}):I.jsx(M0Missions,{userId:r.uid}),tournaments:r.isAnonymous?I.jsx("div"',
);

// ── 10. Pase de temporada + historial en perfil ───────────────────────────────
apply(
  'profile-season-xp',
  'I.jsx(gd,{label:"Win rate",value:`${W}%`,accent:"#60a5fa"})]}),I.jsx("div",{className:"w-full max-w-md",children:I.jsx(zC,{lastClaimAt:',
  'I.jsx(gd,{label:"Win rate",value:`${W}%`,accent:"#60a5fa"})]}),I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-pink-800/40 bg-pink-950/20",children:[I.jsxs("div",{className:"flex justify-between text-xs mb-2",children:[I.jsx("span",{className:"font-bold text-pink-300",children:"Pase de temporada"}),I.jsxs("span",{className:"text-violet-400",children:["Nivel ",Math.floor((t.xp||0)/100)+1]})]}),I.jsx("div",{className:"h-2 rounded-full bg-violet-950 overflow-hidden",children:I.jsx("div",{className:"h-full bg-gradient-to-r from-violet-600 to-pink-500",style:{width:((t.xp||0)%100)+"%"}})})]}),I.jsx("div",{className:"w-full max-w-md p-3 rounded-xl border border-violet-800/40 text-center",children:I.jsx("p",{className:"text-[0.65rem] text-violet-500",children:"🔔 Notificaciones push — próximamente"})}),I.jsx("div",{className:"w-full max-w-md",children:I.jsx(zC,{lastClaimAt:',
);

// ── 11. CSS animación fx en index.html via style tag in bundle ────────────────
apply(
  'fx-keyframes-inline',
  'function M0CardFx({text:r}){return r?I.jsx("div"',
  'if(typeof document!=="undefined"&&!document.getElementById("m0fx-css")){const el=document.createElement("style");el.id="m0fx-css";el.textContent="@keyframes M0fxPop{0%{opacity:0;transform:scale(.6)}20%{opacity:1;transform:scale(1.08)}100%{opacity:0;transform:scale(1.2)}}";document.head.appendChild(el)}function M0CardFx({text:r}){return r?I.jsx("div"',
);

// ── Post: ranking mensual (reemplazo seguro de jC) ────────────────────────────
{
  const js = `
function jC({currentUid:r,isGuest:JCg=false}){const{showToast:e}=Oo(),[t,s]=ie.useState([]),[o,l]=ie.useState(!0),[h,f]=ie.useState(null),[tab,setTab]=ie.useState("weekly");ie.useEffect(()=>{const fld=tab==="monthly"?"monthlyWins":"weeklyWins";const W=jf(za(br,"users"),zf(fld,"desc"),p0(100));return Co(W,ne=>{const J=ne.docs.map(le=>({uid:le.id,displayName:le.data().displayName??"Jugador",weeklyWins:le.data().weeklyWins??0,monthlyWins:le.data().monthlyWins??0,equippedFrame:le.data().equippedFrame??null,countryCode:le.data().countryCode??null,vipActive:((le.data().vip)==null?void 0:le.data().vip.active)===!0,photoURL:le.data().photoURL??null}));s(J);const ee=J.findIndex(le=>le.uid===r);f(ee>=0?ee+1:null),l(!1)},ne=>{e("Error cargando el ranking: "+ne.message,"error"),l(!1)})},[r,e,tab]);const g=new Date,w=(8-g.getUTCDay())%7||7,T=new Date(g);T.setUTCDate(g.getUTCDate()+w),T.setUTCHours(0,0,0,0);const k=T.getTime()-g.getTime(),F=Math.floor(k/36e5),K=F>=24?Math.floor(F/24)+"d "+F%24+"h":F+"h";const prize=tab==="monthly"?M0Monthly:By;const topN=tab==="monthly"?3:10;return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-8 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[JCg&&I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center mb-2",children:[I.jsx("p",{className:"text-xs text-amber-200",children:"Modo invitado — solo top 3"}),I.jsx("a",{href:"/login.html",className:"text-xs text-amber-400 underline font-bold",children:"Registrate para ver ranking completo"})]}),I.jsxs("div",{className:"text-center",children:[I.jsx("h1",{className:"text-3xl font-black text-white tracking-tight",children:tab==="monthly"?"Ranking Mensual":"Ranking Semanal"}),I.jsxs("div",{className:"flex gap-2 mt-3 justify-center",children:[I.jsx("button",{type:"button",onClick:()=>setTab("weekly"),className:"px-4 py-1.5 rounded-lg text-xs font-bold "+(tab==="weekly"?"bg-violet-600 text-white":"border border-violet-800 text-violet-400"),children:"Semanal"}),I.jsx("button",{type:"button",onClick:()=>setTab("monthly"),className:"px-4 py-1.5 rounded-lg text-xs font-bold "+(tab==="monthly"?"bg-pink-600 text-white":"border border-violet-800 text-violet-400"),children:"Mensual"})]}),I.jsx("p",{className:"text-xs text-violet-400 mt-1",children:tab==="monthly"?"Reset el día 1 · Top 3 ganan CC":"Reset en "+K+" · Top 10 ganan CC"})]}),h!==null&&I.jsxs("div",{className:"w-full max-w-md px-4 py-3 rounded-xl border text-sm font-semibold text-center",style:{background:"rgba(167,139,250,.1)",borderColor:"#7c3aed",color:"#c4b5fd"},children:["Tu posición: #",h,h<=topN?" · Premio: "+(prize[h]??0)+" CC al cierre":" · Seguí ganando para entrar al top "+topN]}),I.jsx("div",{className:"w-full max-w-md flex flex-col gap-1.5",children:o?I.jsx("div",{className:"flex justify-center py-12",children:I.jsx("div",{className:"w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"})}):t.length===0?I.jsx("p",{className:"text-center text-violet-600 text-sm py-8",children:"Nadie jugó todavía. ¡Sé el primero!"}):(JCg?t.slice(0,3):t).map((W,$)=>{const ne=$+1,J=W.uid===r,ee=ne<=3,le=prize[ne];return I.jsxs("div",{className:"flex items-center gap-3 px-4 py-3 rounded-xl border "+(J?"ring-2 ring-violet-500":""),style:{background:ee?"rgba(124,58,237,.08)":"rgba(255,255,255,.03)",borderColor:J?"rgba(124,58,237,.4)":"rgba(255,255,255,.07)"},children:[I.jsx("div",{className:"w-8 flex justify-center shrink-0",children:I.jsx(MC,{pos:ne})}),I.jsxs("div",{className:"flex-1 flex items-center gap-2 min-w-0",children:[W.photoURL?I.jsx("img",{src:W.photoURL,alt:"",className:"w-7 h-7 rounded-full object-cover shrink-0 border border-violet-700"}):I.jsx("span",{className:"w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm bg-violet-900/50 border border-violet-700",children:"🎮"}),I.jsxs("p",{className:"text-sm font-semibold truncate text-white",children:[M0flag(W.countryCode),W.vipActive?"👑":"",W.displayName,J?" (vos)":""]})]}),I.jsxs("div",{className:"flex flex-col items-end shrink-0",children:[I.jsxs("span",{className:"text-sm font-black text-white",children:[tab==="monthly"?W.monthlyWins:W.weeklyWins,I.jsx("span",{className:"text-xs font-normal text-violet-400 ml-1",children:"wins"})]}),le?I.jsxs("span",{className:"text-[0.6rem] font-bold text-amber-400",children:["+",le," CC"]}):null]})]},W.uid)})}),I.jsx("p",{className:"text-xs text-violet-600 text-center pb-4",children:tab==="monthly"?"Ranking mensual · Premios el día 1 de cada mes":"El ranking resetea cada lunes · Los premios se acreditan automáticamente"})]})}
`.trim();
  const a = s.indexOf('function jC(');
  const b = s.indexOf('const FC=', a);
  if (a < 0 || b < 0) { console.error('jC replace failed'); process.exit(1); }
  s = s.slice(0, a) + js + s.slice(b);
  console.log('OK: ranking-jc-replace');
}

fs.writeFileSync(bundlePath, s);
console.log('Roadmap v3 patch applied.');
