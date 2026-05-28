#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

const start = s.indexOf('function M0QuickMatch(');
const end = s.indexOf('function OC(', start);
if (start === -1 || end === -1) {
  console.error('PATCH FAILED: M0QuickMatch boundaries not found', { start, end });
  process.exit(1);
}

const newFn = `function M0QuickMatch({uid:r,name:e,isGuest:guest=!1,format:fmt="1v1",onMatched:s,onError:o,onCancel:cancel}){const[status,setStatus]=ie.useState("Entrando a la cola…"),l=ie.useRef(null),h=ie.useRef(null);ie.useEffect(()=>{if(!r)return;let f=!1;const g="cero-q-public-"+fmt,_=Ba(br,"matchmaking","cero","queue",r);const to=setTimeout(()=>{if(!f){f=!0;o(new Error("Nadie se unió en 90s. Probá de nuevo."));cancel&&cancel()}},9e4);dC(_,{uid:r,name:e,stakeKey:g,stakeCC:0,active:!0,isGuest:guest,format:fmt,ts:$d()},{merge:!0}).then(()=>setStatus("Esperando rival en la cola…")).catch(er=>{if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}});const w=jf(za(br,"matchmaking","cero","queue"),cC("stakeKey","==",g),cC("active","==",!0));const T=Co(w,k=>{if(f)return;const F=k.docs.map(W=>({id:W.id,...W.data()})).filter(W=>W.uid!==r&&W.active!==!1).sort((W,$)=>((W.ts==null?void 0:W.ts.toMillis())||0)-(($.ts==null?void 0:$.ts.toMillis())||0));if(!F.length)return;const K=F[0];if(r<K.uid){if(f)return;setStatus("¡Rival encontrado! Creando sala…");kC({mode:"classic",format:fmt,stakeCC:0,createNew:!0}).then(W=>{if(f)return;f=!0;clearTimeout(to);const mid=W.matchId;dC(_,{matchId:mid,active:!1},{merge:!0});dC(Ba(br,"matchmaking","cero","queue",K.uid),{matchId:mid,active:!1},{merge:!0}).catch(()=>{});s(mid)}).catch(er=>{if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}})}else{if(l.current)return;setStatus("Esperando que "+(K.name||"rival")+" abra la sala…");l.current=Co(_,ne=>{const J=ne.data();if(f||!(J!=null&&J.matchId))return;f=!0;clearTimeout(to);setStatus("Uniendo a la partida…");kC({matchId:J.matchId}).then(()=>s(J.matchId)).catch(er=>{f=!1;if(l.current){l.current();l.current=null}o(er);cancel&&cancel()})})}},er=>{if(!f){f=!0;clearTimeout(to);o(er);cancel&&cancel()}});h.current=()=>{f=!0;clearTimeout(to);T();if(typeof l.current==="function"){l.current();l.current=null}};return()=>{f=!0;clearTimeout(to);T();if(typeof l.current==="function"){l.current();l.current=null}dC(_,{active:!1,leftAt:$d()},{merge:!0}).catch(()=>{})}},[r,e,fmt,guest,s,o,cancel]);return I.jsxs("div",{className:"w-full mt-2 p-3 rounded-xl border border-sky-600/40 bg-sky-950/40 text-center",children:[I.jsx("p",{className:"text-xs text-sky-200 font-semibold animate-pulse",children:status}),cancel&&I.jsx("button",{type:"button",onClick:cancel,className:"mt-2 text-[0.65rem] text-violet-400 underline hover:text-violet-200",children:"Cancelar búsqueda"})]})}`;

s = s.slice(0, start) + newFn + s.slice(end);
console.log('OK: M0QuickMatch-fix-v13');

// Lobby: invitados ven salas gratis públicas (mezcla invitado + registrado)
const lobbyGuestFilter = 'const guestOpen=o.filter(ne=>notMine(ne)&&vis(ne)&&(ne.stakeCC??0)===0&&ne.guestOnly);';
const lobbyGuestFix = 'const guestOpen=o.filter(ne=>notMine(ne)&&vis(ne)&&(ne.stakeCC??0)===0);';
if (s.includes(lobbyGuestFilter)) {
  s = s.replace(lobbyGuestFilter, lobbyGuestFix);
  console.log('OK: lobby-guest-free-mix');
} else if (s.includes(lobbyGuestFix)) {
  console.log('SKIP: lobby-guest-free-mix (already patched)');
} else {
  console.log('WARN: lobby-guest-free-mix pattern not found');
}

fs.writeFileSync(bundlePath, s);
console.log('Quick match fix v13 applied.');
