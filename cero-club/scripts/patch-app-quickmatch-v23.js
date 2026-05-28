#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

function applyOptional(name, from, to) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${name}`);
    return;
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

apply(
  'sk-null-safe',
  'M0canPen=!!(M0cf&&M0cf!==K&&e.status==="playing")',
  'M0canPen=!!(M0cf&&M0cf!==K&&(e==null?void 0:e.status)==="playing")',
);

const vkStart = s.indexOf('return I.jsxs("div",{className:"h-[100dvh] max-h-[100dvh] grid');
const vkEnd = s.indexOf('let M0snd=null', vkStart);
if (vkStart === -1 || vkEnd === -1) {
  console.error('PATCH FAILED: vk game block boundaries');
  process.exit(1);
}

const NEW_VK_GAME = `return I.jsxs("div",{className:"relative h-[100dvh] max-h-[100dvh] select-none overflow-hidden",style:{background:M0roomStyle(M0cos==null?void 0:M0cos.equippedRoomBg)},children:[I.jsx(M0CeroBtn,{visible:M0canCero&&o.status==="playing",busy:k,onPress:()=>{M0playCero(),M0dc()}}),M0canPen&&I.jsx(M0PenalizeBtn,{busy:k,onPress:()=>{M0playCero(),M0pen()}}),I.jsxs("div",{className:"h-full grid grid-rows-[auto_auto_minmax(0,1fr)_auto]",children:[M0tu&&o.status==="playing"&&l.length>0&&I.jsx(M0Tutorial,{onDone:()=>M0tuDone(!1)}),I.jsx(M0RejoinBanner,{match:o,currentUid:s,stakeCC:o.stakeCC??0}),M0fx&&I.jsx(M0CardFx,{text:M0fx}),g&&I.jsx(mk,{onPick:ne=>{W(ne);M0st("🎨 Color activo: "+M0colorLbl(ne),"success")},busy:k}),$&&I.jsx(gk,{message:$,onClose:ne,type:"error"}),I.jsx("div",{className:"flex justify-center pt-1 sm:pt-2 pb-0 shrink-0",children:I.jsx(M0FourSeats,{match:o,uid:s,matchId:r})}),I.jsx("div",{className:"flex justify-center py-0.5 sm:py-1 shrink-0",children:I.jsx(_k,{state:t})}),I.jsx("div",{className:"flex items-center justify-center px-3 sm:px-4 min-h-0 overflow-hidden w-full",children:I.jsxs("div",{className:"relative w-full max-w-md mx-auto",children:[I.jsx("div",{className:"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,22rem)] h-[10.5rem] rounded-[50%] pointer-events-none opacity-95",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),I.jsx("div",{className:"relative z-10 py-2 sm:py-4",children:I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k,pendingDraw:t.pendingDraw})})]})}),I.jsxs("div",{className:"relative z-30 shrink-0 flex flex-col items-center gap-1 sm:gap-2 px-2 sm:px-3 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]",style:{background:"linear-gradient(to top, rgba(4,3,13,.97) 0%, rgba(4,3,13,.75) 70%, transparent 100%)"},children:[I.jsxs("div",{className:"flex items-center justify-between w-full max-w-lg gap-2",children:[I.jsx("button",{type:"button",onClick:()=>{const v=!M0muted;M0setMuted(v);setM0muted(v);M0resumeAudio();v||M0beep(.04,.05,660)},className:"shrink-0 px-2 py-1 rounded-lg text-[0.6rem] font-bold border border-violet-800/60 text-violet-400 hover:text-violet-200",title:M0muted?"Activar sonido":"Silenciar sonidos",children:M0muted?"🔇":"🔊"}),o.status==="playing"&&I.jsx(hk,{matchId:r,currentUid:s,inline:!0})]}),I.jsx(yk,{state:t}),I.jsx(pk,{cards:l,playableIds:h,isMyTurn:f,onPlay:F,busy:k,pendingCard:t.pendingCard}),I.jsxs("p",{className:"text-[0.55rem] sm:text-[0.6rem] font-bold tracking-[0.12em] uppercase text-violet-400 opacity-70",children:["Vos · ",l.length," ",l.length===1?"carta":"cartas"]})]}),!(o.status==="waiting"||o.status==="playing"||o.phase==="game_over"||o.status==="finished")&&I.jsxs("div",{className:"fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 z-50",style:{background:"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"},children:[I.jsx("p",{className:"text-violet-300 text-sm",children:"Sincronizando sala…"}),I.jsx("button",{type:"button",onClick:e,className:"px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold",children:"Volver al lobby"})]})]})]})}`;

s = s.slice(0, vkStart) + NEW_VK_GAME + s.slice(vkEnd);
console.log('OK: vk-grid-layout-fix');

const QM_START = s.indexOf('function M0QuickMatch(');
const QM_END = s.indexOf('function OC(', QM_START);
if (QM_START === -1 || QM_END === -1) {
  console.error('PATCH FAILED: M0QuickMatch boundaries');
  process.exit(1);
}

const NEW_QM = `function M0QuickMatch({uid:r,name:e,isGuest:guest=!1,format:fmt="1v1",onMatched:s,onError:o,onCancel:cancel}){const[phase,setPhase]=ie.useState("queue"),[status,setStatus]=ie.useState("Entrando a la cola…"),[rival,setRival]=ie.useState(null),l=ie.useRef(null),h=ie.useRef(null);const M0join=ie.useCallback(async mid=>{await kC({matchId:mid});s(mid)},[s]);const M0create=ie.useCallback(async()=>{try{return await kC({mode:"classic",format:fmt,stakeCC:0,createNew:!0})}catch(er){const msg=String((er==null?void 0:er.message)||"");if(msg.includes("sala")||msg.includes("partida activa")){await M0CleanupRun().catch(()=>{});return kC({mode:"classic",format:fmt,stakeCC:0,createNew:!0})}throw er}},[fmt]);ie.useEffect(()=>{if(!r)return;let f=!1;const g="cero-q-public-"+fmt,_=Ba(br,"matchmaking","cero","queue",r);const to=setTimeout(()=>{if(!f){f=!0;o(new Error("Nadie se unió en 90s. Probá de nuevo."));cancel&&cancel()}},9e4);(async()=>{try{await M0CleanupRun()}catch{}if(f)return;try{await dC(_,{uid:r,name:e,stakeKey:g,stakeCC:0,active:!0,isGuest:guest,format:fmt,ts:$d()},{merge:!0});setStatus("Esperando rival en la cola…")}catch(er){if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}}})();const w=jf(za(br,"matchmaking","cero","queue"),cC("stakeKey","==",g),cC("active","==",!0));const T=Co(w,k=>{if(f)return;const F=k.docs.map(W=>({id:W.id,...W.data()})).filter(W=>W.uid!==r&&W.active!==!1).sort((W,$)=>((W.ts==null?void 0:W.ts.toMillis())||0)-(($.ts==null?void 0:$.ts.toMillis())||0));if(!F.length)return;const K=F[0];setRival(K.name||"Rival");setPhase("found");if(r<K.uid){if(f)return;setStatus("¡Rival encontrado!");M0create().then(W=>{if(f)return;f=!0;clearTimeout(to);const mid=W.matchId;dC(_,{matchId:mid,active:!1},{merge:!0});dC(Ba(br,"matchmaking","cero","queue",K.uid),{matchId:mid,active:!1},{merge:!0}).catch(()=>{});setPhase("joining");setStatus("Entrando a la partida…");s(mid)}).catch(er=>{if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}})}else{if(l.current)return;setStatus("Esperando que "+(K.name||"rival")+" abra la sala…");l.current=Co(_,ne=>{const J=ne.data();if(f||!(J!=null&&J.matchId))return;f=!0;clearTimeout(to);setPhase("joining");setStatus("¡Rival encontrado! Entrando…");M0join(J.matchId).catch(er=>{f=!1;if(l.current){l.current();l.current=null}o(er);cancel&&cancel()})})}},er=>{if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}});h.current=()=>{f=!0;clearTimeout(to);T();if(typeof l.current==="function"){l.current();l.current=null}};return()=>{f=!0;clearTimeout(to);T();if(typeof l.current==="function"){l.current();l.current=null}dC(_,{active:!1,leftAt:$d()},{merge:!0}).catch(()=>{})}},[r,e,fmt,guest,o,cancel,M0create,M0join]);if(phase==="found"||phase==="joining")return I.jsxs("div",{className:"w-full mt-3 p-4 rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-b from-emerald-950/50 to-emerald-950/20 text-center shadow-lg shadow-emerald-900/30",children:[I.jsx("p",{className:"text-2xl mb-1",children:"🎮"}),I.jsx("p",{className:"text-sm font-black text-emerald-200 uppercase tracking-widest",children:"¡Rival encontrado!"}),rival&&I.jsxs("p",{className:"text-xs text-emerald-300/90 mt-1 font-semibold",children:["vs ",rival]}),I.jsx("p",{className:"text-[0.65rem] text-emerald-400/80 mt-2 animate-pulse",children:status})]});return I.jsxs("div",{className:"w-full mt-2 p-3 rounded-xl border border-sky-600/40 bg-sky-950/40 text-center",children:[I.jsx("p",{className:"text-xs text-sky-200 font-semibold animate-pulse",children:status}),cancel&&I.jsx("button",{type:"button",onClick:cancel,className:"mt-2 text-[0.65rem] text-violet-400 underline hover:text-violet-200",children:"Cancelar búsqueda"})]})}`;

s = s.slice(0, QM_START) + NEW_QM + s.slice(QM_END);
console.log('OK: M0QuickMatch-v23');

applyOptional(
  'lobby-qm-not-blocked',
  'disabled:g||!!OCa||M0qm',
  'disabled:g||M0qm',
);

fs.writeFileSync(bundlePath, s);
console.log('\nQuick match + black screen fix v23 applied.');
