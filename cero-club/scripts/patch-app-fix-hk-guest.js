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

// ── FIX CRÍTICO: hooks de hk rotos (ReferenceError: f is not defined) ─────────
apply(
  'hk-fix-hooks',
  'function hk({matchId:r,currentUid:e}){const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r),[Ae,we]=ie.useState(null);ie.useEffect(()=>{const P=t.filter(B=>B.type==="projectile"&&B.uid!==e);if(!P.length)return;const B=P[P.length-1];we(B.text),setTimeout(()=>we(null),950)},[t,e]),[f,g]=ie.useState(!1),[_,w]=ie.useState(""),[T,k]=ie.useState(0),F=ie.useRef(null),K=ie.useRef(0);ie.useEffect(()=>{var J;if(f)',
  'function hk({matchId:r,currentUid:e}){const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r);const[Ae,we]=ie.useState(null);const[f,g]=ie.useState(!1);const[_,w]=ie.useState("");const[T,k]=ie.useState(0);const F=ie.useRef(null);const K=ie.useRef(0);ie.useEffect(()=>{const P=t.filter(B=>B.type==="projectile"&&B.uid!==e);if(!P.length)return;const B=P[P.length-1];we(B.text),setTimeout(()=>we(null),950)},[t,e]);ie.useEffect(()=>{var J;if(f)',
);

// ── Ik: detectar sala/partida activa (waiting + playing) ─────────────────────
apply(
  'ik-active-match-query',
  'ie.useEffect(()=>{if(!r.uid)return;const _=jf(za(br,"matches"),cC("playerIds","array-contains",r.uid),cC("status","==","waiting"));return Co(_,w=>{const T=w.docs.map(k=>({id:k.id,...k.data()})).find(k=>(k.playerCount??1)<(k.maxPlayers??2));ze(T?{matchId:T.id,stakeCC:T.stakeCC??0}:null)},()=>ze(null))},[r.uid]);',
  'ie.useEffect(()=>{if(!r.uid)return;let wT=null,pT=null;const sync=()=>{const docs=[...(wT||[]),...(pT||[])];const pick=docs.find(k=>k.status==="playing")||docs.find(k=>k.status==="waiting"&&(k.playerCount??1)<(k.maxPlayers??2));ze(pick?{matchId:pick.id,stakeCC:pick.stakeCC??0,status:pick.status}:null)};const wQ=jf(za(br,"matches"),cC("playerIds","array-contains",r.uid),cC("status","==","waiting"));const pQ=jf(za(br,"matches"),cC("playerIds","array-contains",r.uid),cC("status","==","playing"));const u1=Co(wQ,q=>{wT=q.docs.map(k=>({id:k.id,...k.data()}));sync()},()=>{wT=[];sync()});const u2=Co(pQ,q=>{pT=q.docs.map(k=>({id:k.id,...k.data()}));sync()},()=>{pT=[];sync()});return()=>{u1();u2()}},[r.uid]);',
);

// ── OC: bloquear crear otra sala si ya hay activa ────────────────────────────
apply(
  'oc-active-props',
  'function OC({userId:r,userName:e,onJoined:t,isGuest:OCg=false}){',
  'function OC({userId:r,userName:e,onJoined:t,isGuest:OCg=false,activeRoom:OCa=null,onGoActive:OCgo=null}){',
);

apply(
  'oc-block-duplicate-room',
  'async function W(ne={}){if(!g){_(!0);try{const J=await kC({mode:w,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??j}),ee=!!ne.matchId;',
  'async function W(ne={}){if(OCa&&!ne.matchId){s(OCa.status==="playing"?"Ya tenés una partida en curso. Tocá «Volver a mi sala».":"Ya tenés una sala abierta. Tocá «Volver a mi sala».","error");return}if(!g){_(!0);try{const J=await kC({mode:w,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??j,createNew:ne.createNew===true&&!OCa}),ee=!!ne.matchId;',
);

apply(
  'oc-active-banner',
  'OCg&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center"',
  'OCa&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-emerald-500/50 bg-emerald-950/40 flex flex-col gap-2 items-center text-center",children:[I.jsx("p",{className:"text-sm text-emerald-200 font-semibold",children:OCa.status==="playing"?"Tenés una partida en curso":"Tenés una sala esperando rival"}),I.jsx("button",{type:"button",onClick:()=>OCgo==null?void 0:OCgo(OCa.matchId),className:"px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold",children:"Volver a mi sala"})]}),OCg&&I.jsxs("div",{className:"w-full max-w-md mb-4 p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center"',
);

apply(
  'oc-disable-create-active',
  'disabled:g,onClick:()=>W({stakeCC:OCg?0:j,createNew:!0})',
  'disabled:g||!!OCa,onClick:()=>W({stakeCC:OCg?0:j,createNew:!0})',
);

apply(
  'ik-pass-active-to-oc',
  'home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f,isGuest:r.isAnonymous===true})',
  'home:I.jsx(OC,{userId:r.uid,userName:r.displayName??"Jugador",onJoined:f,isGuest:r.isAnonymous===true,activeRoom:A&&!o?A:null,onGoActive:f})',
);

// ── Invitado: nav reducido ───────────────────────────────────────────────────
apply(
  'ek-guest-nav',
  'function Ek({active:r,onChange:e}){return I.jsx("nav"',
  'function Ek({active:r,onChange:e,isGuest:Ekg=false}){const Ekn=Ekg?wk.filter(x=>x.id==="home"||x.id==="ranking"||x.id==="profile"):wk;return I.jsx("nav"',
);

apply(
  'ek-guest-map',
  'children:wk.map(t=>{const s=t.id===r;',
  'children:Ekn.map(t=>{const s=t.id===r;',
);

apply(
  'ik-guest-nav',
  'I.jsx(Ek,{active:t,onChange:s})',
  'I.jsx(Ek,{active:t,onChange:s,isGuest:r.isAnonymous===true})',
);

// ── Invitado: ranking top 3 ──────────────────────────────────────────────────
apply(
  'jc-guest-prop',
  'function jC({currentUid:r}){',
  'function jC({currentUid:r,isGuest:JCg=false}){',
);

apply(
  'jc-guest-top3',
  '):t.map((W,$)=>{const ne=$+1,J=W.uid===r,ee=ne<=3,le=By[ne];return I.jsxs("div"',
  '):(JCg?t.slice(0,3):t).map((W,$)=>{const ne=$+1,J=W.uid===r,ee=ne<=3,le=By[ne];return I.jsxs("div"',
);

// Remove duplicate jc-guest-footer - only one map replacement needed

// Insert guest ranking lock after jC function's main return - need to find closing and add wrapper
// Simpler: prepend guest banner inside jC return after loading check
apply(
  'jc-guest-banner',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-8 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"text-center max-w-md",children:[I.jsx("h1",{className:"text-2xl font-black text-white tracking-tight",children:"Ranking semanal"})',
  'return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-8 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[JCg&&I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center mb-2",children:[I.jsx("p",{className:"text-xs text-amber-200",children:"Modo invitado — solo top 3"}),I.jsx("a",{href:"/login.html",className:"text-xs text-amber-400 underline font-bold",children:"Registrate para ver ranking completo"})]}),I.jsxs("div",{className:"text-center max-w-md",children:[I.jsx("h1",{className:"text-2xl font-black text-white tracking-tight",children:"Ranking semanal"})',
);

apply(
  'ik-guest-ranking',
  'ranking:I.jsx(jC,{currentUid:r.uid})',
  'ranking:I.jsx(jC,{currentUid:r.uid,isGuest:r.isAnonymous===true})',
);

// ── Invitado: perfil solo nick ─────────────────────────────────────────────────
apply(
  'profile-guest-component',
  'function $C({userId:r}){',
  'function M0GuestProfile({userId:r,initialName:e,showToast:t}){const[s,o]=ie.useState(e||"Invitado"),[l,h]=ie.useState(!1);return I.jsxs("div",{className:"min-h-screen flex flex-col items-center px-4 py-10 gap-6",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsxs("div",{className:"w-full max-w-md p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-center",children:[I.jsx("p",{className:"text-xs font-bold text-amber-300 uppercase tracking-widest",children:"Modo invitado"}),I.jsx("p",{className:"text-[0.7rem] text-amber-200/90 mt-1",children:"Solo podés cambiar tu nick. Registrate para desbloquear todo."})]}),I.jsx("h2",{className:"text-xl font-black text-white",children:"Tu nick"}),I.jsx("input",{type:"text",value:s,onChange:f=>o(f.target.value.slice(0,24)),maxLength:24,className:"w-full max-w-md bg-violet-950/50 border border-violet-700 rounded-xl px-4 py-3 text-white text-center font-bold"}),I.jsx("button",{type:"button",disabled:l||s.trim().length<2,onClick:async()=>{h(!0);try{await dC(Ba(br,"users",r),{displayName:s.trim()},{merge:!0}),Xn.currentUser&&await VT(Xn.currentUser,{displayName:s.trim()}),t("Nick actualizado","success")}catch(f){t((f==null?void 0:f.message)||"Error","error")}finally{h(!1)}},className:"px-8 py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50",children:l?"Guardando…":"Guardar nick"}),I.jsx("a",{href:"/login.html",className:"text-sm text-violet-400 underline",children:"Crear cuenta gratis →"})]})}
function $C({userId:r,isGuest:PCg=false}){',
);

apply(
  'profile-guest-early-return',
  'rounded-full animate-spin`})});if(!t)return I.jsx("div",{className:`min-h-screen flex items-center justify-center bg-[#04030d]\\r\n                      text-red-400 text-sm`,children:"Perfil no encontrado"});',
  'rounded-full animate-spin`})});if(PCg)return I.jsx(M0GuestProfile,{userId:r,initialName:PCgn||"Invitado",showToast:e});if(!t)return I.jsx("div",{className:`min-h-screen flex items-center justify-center bg-[#04030d]\\r\n                      text-red-400 text-sm`,children:"Perfil no encontrado"});',
);

apply(
  'ik-guest-profile',
  'profile:I.jsx($C,{userId:r.uid})',
  'profile:I.jsx($C,{userId:r.uid,isGuest:r.isAnonymous===true,guestName:r.displayName??"Invitado"})',
);

apply(
  'ik-guest-lock-tabs',
  'tournaments:I.jsx(Xk,{userId:r.uid,onJoined:f}),store:I.jsx(KC,{userId:r.uid}),',
  'tournaments:r.isAnonymous?I.jsx("div",{className:"min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4",style:{background:"#04030d"},children:[I.jsx("p",{className:"text-4xl",children:"🔒"}),I.jsx("p",{className:"text-violet-300 text-sm",children:"Torneos solo para cuentas registradas"}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm",children:"Registrarme"})]}):I.jsx(Xk,{userId:r.uid,onJoined:f}),store:r.isAnonymous?I.jsx("div",{className:"min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4",style:{background:"#04030d"},children:[I.jsx("p",{className:"text-4xl",children:"🔒"}),I.jsx("p",{className:"text-violet-300 text-sm",children:"Tienda bloqueada en modo invitado"}),I.jsx("a",{href:"/login.html",className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm",children:"Registrarme"})]}):I.jsx(KC,{userId:r.uid}),',
);

// Fix patch-app-gameplay-ux for future - update hk-projectiles-ui line in that file too
const uxPath = path.join(__dirname, 'patch-app-gameplay-ux.js');
if (fs.existsSync(uxPath)) {
  let ux = fs.readFileSync(uxPath, 'utf8');
  const bad = "'const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r),[Ae,we]=ie.useState(null);ie.useEffect(()=>{const P=t.filter(B=>B.type===\"projectile\"&&B.uid!==e);if(!P.length)return;const B=P[P.length-1];we(B.text),setTimeout(()=>we(null),950)},[t,e])'";
  const good = "'const{messages:t,sendMessage:s,sendReaction:o,sendProjectile:le,sending:l,MAX_CHARS:h}=lk(r);const[Ae,we]=ie.useState(null);const[f,g]=ie.useState(!1);const[_,w]=ie.useState(\"\");const[T,k]=ie.useState(0);const F=ie.useRef(null);const K=ie.useRef(0);ie.useEffect(()=>{const P=t.filter(B=>B.type===\"projectile\"&&B.uid!==e);if(!P.length)return;const B=P[P.length-1];we(B.text),setTimeout(()=>we(null),950)},[t,e])'";
  if (ux.includes(bad)) {
    ux = ux.replace(bad, good);
    fs.writeFileSync(uxPath, ux);
    console.log('OK: patch-app-gameplay-ux.js hk hook fix');
  }
}

fs.writeFileSync(bundlePath, s);
console.log('patch-app-fix-hk-guest.js done');
