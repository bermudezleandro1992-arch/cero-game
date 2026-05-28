#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 200));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── 1. Callables v4 ───────────────────────────────────────────────────────────
apply(
  'v4-callables',
  `function M0missChkFn(){return M0missChk??(M0missChk=or(ur,"checkMissions"))}`,
  `function M0missChkFn(){return M0missChk??(M0missChk=or(ur,"checkMissions"))}
let M0season=null,M0seasonClaim=null,M0fcmSave=null,M0fcmTest=null,M0replay=null;
function M0seasonFn(){return M0season??(M0season=or(ur,"getSeasonPassStatus"))}
function M0seasonClaimFn(){return M0seasonClaim??(M0seasonClaim=or(ur,"claimSeasonTier"))}
function M0fcmSaveFn(){return M0fcmSave??(M0fcmSave=or(ur,"saveFcmToken"))}
function M0fcmTestFn(){return M0fcmTest??(M0fcmTest=or(ur,"sendTestPush"))}
function M0replayFn(){return M0replay??(M0replay=or(ur,"getReplay"))}`,
);

// ── 2. joinMatch — format 1v1 / 2v2 ───────────────────────────────────────────
apply(
  'kC-format',
  'async function kC(r={}){const e={mode:r.mode??"classic",stakeCC:r.stakeCC??0,createNew:!!r.createNew};return r.matchId&&(e.matchId=r.matchId),Rc(IC,e)}',
  'async function kC(r={}){const e={mode:r.mode??"classic",format:r.format??"1v1",stakeCC:r.stakeCC??0,createNew:!!r.createNew};return r.matchId&&(e.matchId=r.matchId),Rc(IC,e)}',
);

// ── 3. Lobby — selector formato + pasar format ────────────────────────────────
apply(
  'lobby-format-state',
  '[M0qm,setM0qm]=ie.useState(!1),[w,T]=ie.useState("classic"),[j,N]=ie.useState(0),[k,F]=ie.useState(""),K=ie.useRef(null);',
  '[M0qm,setM0qm]=ie.useState(!1),[M0fmt,setM0fmt]=ie.useState("1v1"),[w,T]=ie.useState("classic"),[j,N]=ie.useState(0),[k,F]=ie.useState(""),K=ie.useRef(null);',
);

apply(
  'lobby-format-ui',
  'I.jsx("p",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400",children:"Tipo de sala"}),',
  'I.jsx("p",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400",children:"Formato"}),I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-700/50 mb-1",children:[{v:"1v1",l:"1 vs 1"},{v:"2v2",l:"2 vs 2"}].map(ne=>I.jsx("button",{type:"button",onClick:()=>setM0fmt(ne.v),className:["flex-1 py-2 text-sm font-bold transition-all",M0fmt===ne.v?"bg-violet-700 text-white":"text-violet-400 opacity-60"].join(" "),children:ne.l},ne.v))}),OCg&&M0fmt==="2v2"&&I.jsx("p",{className:"text-[0.65rem] text-amber-500 text-center",children:"2v2 solo para cuentas registradas"}),I.jsx("p",{className:"text-xs font-bold tracking-[0.2em] uppercase text-violet-400",children:"Tipo de sala"}),',
);

apply(
  'lobby-format-join',
  'onClick:()=>W({stakeCC:OCg?0:j,createNew:!0})',
  'onClick:()=>W({stakeCC:OCg?0:j,createNew:!0,format:OCg?"1v1":M0fmt})',
);

apply(
  'quick-match-2v2',
  'function M0QuickMatch({uid:r,name:e,stakeCC:t,onMatched:s,onError:o}){const l=ie.useRef(null),h=ie.useRef(null);ie.useEffect(()=>{if(!r)return;let f=!1;const g="cero-q-"+t,_=Ba(br,"matchmaking","cero","queue",r);',
  'function M0QuickMatch({uid:r,name:e,stakeCC:t,format:fmt="1v1",onMatched:s,onError:o}){const l=ie.useRef(null),h=ie.useRef(null);ie.useEffect(()=>{if(!r)return;let f=!1;const g="cero-q-"+t+"-"+fmt,_=Ba(br,"matchmaking","cero","queue",r);',
);

apply(
  'quick-match-props',
  'M0qm&&I.jsx(M0QuickMatch,{uid:r,name:e,stakeCC:OCg?0:j,onMatched:t,onError:ne=>{s(ne.message||"Error en cola","error"),setM0qm(!1)}})',
  'M0qm&&I.jsx(M0QuickMatch,{uid:r,name:e,stakeCC:OCg?0:j,format:OCg?"1v1":M0fmt,onMatched:t,onError:ne=>{s(ne.message||"Error en cola","error"),setM0qm(!1)}})',
);

apply(
  'lobby-kc-format',
  'const J=await kC({mode:w,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??j,createNew:ne.createNew===true&&!OCa})',
  'const J=await kC({mode:w,format:ne.format??M0fmt,matchId:ne.matchId,stakeCC:ne.matchId?void 0:ne.stakeCC??j,createNew:ne.createNew===true&&!OCa})',
);

// ── 4. Cosméticos — imágenes SVG ──────────────────────────────────────────────
const cosImgMap = `const M0COS_IMG={skin_neon:"/app/cosmetics/skins/neon.svg",skin_gold:"/app/cosmetics/skins/gold.svg",skin_galaxy:"/app/cosmetics/skins/galaxy.svg",skin_minimal:"/app/cosmetics/skins/minimal.svg",frame_fire:"/app/cosmetics/frames/fire.svg",frame_ice:"/app/cosmetics/frames/ice.svg",frame_gold:"/app/cosmetics/frames/gold.svg",frame_champion:"/app/cosmetics/frames/champ.svg",table_neon:"/app/cosmetics/tables/neon.svg",table_marble:"/app/cosmetics/tables/marble.svg",table_carbon:"/app/cosmetics/tables/carbon.svg",bg_stadium:"/app/cosmetics/rooms/stadium.svg",bg_beach:"/app/cosmetics/rooms/beach.svg",bg_city:"/app/cosmetics/rooms/city.svg",bg_football:"/app/cosmetics/rooms/football.svg",deck_classic:"/app/cosmetics/decks/classic.svg",deck_gold:"/app/cosmetics/decks/gold.svg",deck_cyber:"/app/cosmetics/decks/cyber.svg"};
function M0cosPreview(r,e){const u=M0COS_IMG[r.id];return u?I.jsx("img",{src:u,alt:r.name,className:e||"w-full h-full object-cover rounded-lg"}):I.jsx("span",{className:"text-2xl",children:r.preview})}`;

if (!s.includes('M0COS_IMG')) {
  apply(
    'cos-img-map',
    'function M0equipField(cat){',
    `${cosImgMap}
function M0equipField(cat){`,
  );
}

apply(
  'store-bc-img',
  'border border-white/10`,style:{background:"rgba(0,0,0,.3)"},children:r.preview})',
  'border border-white/10 flex items-center justify-center overflow-hidden`,style:{background:"rgba(0,0,0,.3)",minHeight:"4rem"},children:M0cosPreview(r,"w-full h-16 object-cover")})',
);

// ── 5. Pase de temporada completo + push + historial/replay ───────────────────
const seasonPushBlock = `function M0SeasonPass({userId:r,xp:e}){const{showToast:t}=Oo(),[s,o]=ie.useState(null),[l,h]=ie.useState(!1);ie.useEffect(()=>{Rc(M0seasonFn(),{}).then(o).catch(()=>{})},[e,r]);const f=ie.useCallback(async g=>{h(!0);try{const _=await Rc(M0seasonClaimFn(),{tier:g});t("+"+_.coins+" CC del pase","success"),o(await Rc(M0seasonFn(),{}))}catch(_){t(_ instanceof Error?_.message:"Error","error")}finally{h(!1)}},[t]);if(!s)return I.jsx("div",{className:"w-full max-w-md p-4 rounded-2xl border border-pink-800/40 bg-pink-950/20 text-xs text-violet-400",children:"Cargando pase…"});return I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-pink-800/40 bg-pink-950/20 flex flex-col gap-3",children:[I.jsxs("div",{className:"flex justify-between text-xs",children:[I.jsx("span",{className:"font-bold text-pink-300",children:"Pase de temporada"}),I.jsxs("span",{className:"text-violet-400",children:["Nivel ",s.level," · ",s.xp," XP"]})]}),I.jsx("div",{className:"h-2 rounded-full bg-violet-950 overflow-hidden",children:I.jsx("div",{className:"h-full bg-gradient-to-r from-violet-600 to-pink-500",style:{width:Math.min(100,s.nextTier?(s.xp%100):100)+"%"}})}),I.jsx("div",{className:"grid grid-cols-4 gap-2",children:(s.tiers||[]).map(g=>I.jsxs("div",{className:"p-2 rounded-xl border text-center text-[0.6rem] "+(g.claimed?"border-emerald-600/50 bg-emerald-950/20":g.unlocked?"border-pink-600/40 bg-pink-950/10":"border-violet-900/40 opacity-50"),children:[I.jsx("p",{className:"font-black text-white",children:g.tier}),I.jsxs("p",{className:"text-amber-400",children:["+",g.coins," CC"]}),g.unlocked&&!g.claimed?I.jsx("button",{type:"button",disabled:l,onClick:()=>f(g.tier),className:"mt-1 px-1 py-0.5 rounded bg-pink-600 text-white font-bold",children:"✓"}):g.claimed?I.jsx("span",{className:"text-emerald-400",children:"✓"}):null]},g.tier))})]})}
function M0PushBtn(){const{showToast:r}=Oo(),[e,t]=ie.useState(!1),[s,o]=ie.useState(!1);const l=ie.useCallback(async()=>{if(!("Notification"in window)){r("Tu navegador no soporta notificaciones","error");return}t(!0);try{const h=await Notification.requestPermission();if(h!=="granted"){r("Permiso denegado","error");return}const{getMessaging:getMsg,getToken:isSupported}=await import("firebase/messaging");const appMod=await import("firebase/app");if(!(await isSupported())){r("Push no disponible en este dispositivo","error");return}const apps=appMod.getApps();const app=apps[0];if(!app){r("Firebase no inicializado","error");return}const msg=getMsg(app);const reg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");const token=await getToken(msg,{...(window.__CERO_VAPID__?{vapidKey:window.__CERO_VAPID__}:{}),serviceWorkerRegistration:reg});if(!token){r("No se pudo obtener token FCM","error");return}await Rc(M0fcmSaveFn(),{token});await Rc(M0fcmTestFn(),{});o(!0);r("¡Notificaciones activadas!","success")}catch(h){r(h instanceof Error?h.message:"Error activando push","error")}finally{t(!1)}},[r]);return I.jsxs("div",{className:"w-full max-w-md p-3 rounded-xl border border-violet-800/40 flex items-center justify-between gap-3",children:[I.jsxs("div",{children:[I.jsx("p",{className:"text-xs font-bold text-violet-300",children:"🔔 Notificaciones push"}),I.jsx("p",{className:"text-[0.6rem] text-violet-500",children:s?"Activadas en este dispositivo":"Avisos de partidas y misiones"})]}),I.jsx("button",{type:"button",disabled:e||s,onClick:l,className:"px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-700 text-white disabled:opacity-40",children:e?"…":s?"✓ Activo":"Activar"})]})}
function M0MatchHist(){const[hist,setHist]=ie.useState([]);const[rep,setRep]=ie.useState(null);ie.useEffect(()=>{try{setHist(JSON.parse(localStorage.getItem("cero_match_hist")||"[]"))}catch{setHist([])}},[]);const load=async id=>{try{const d=await Rc(M0replayFn(),{matchId:id});setRep({id,actions:d.actions||[]})}catch{setRep({id,actions:[]})}};if(!hist.length)return null;return I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-violet-800/40 bg-violet-950/20",children:[I.jsx("p",{className:"text-xs font-bold text-violet-300 mb-2",children:"Historial de partidas"}),I.jsx("div",{className:"flex flex-col gap-1 max-h-40 overflow-y-auto",children:hist.slice(0,8).map(h=>I.jsxs("button",{type:"button",onClick:()=>load(h.id),className:"flex justify-between text-left text-[0.65rem] px-2 py-1.5 rounded-lg hover:bg-violet-900/40",children:[I.jsxs("span",{className:"text-white",children:[h.won?"🏆":"💀"," vs ",h.rival]}),I.jsx("span",{className:"text-violet-500",children:new Date(h.at).toLocaleDateString("es-AR")})]},h.id))}),rep&&I.jsxs("div",{className:"mt-2 p-2 rounded-lg bg-black/30 text-[0.6rem] text-violet-300 max-h-32 overflow-y-auto",children:[I.jsxs("p",{className:"font-bold text-violet-200 mb-1",children:["Replay #",rep.id.slice(0,8)," · ",rep.actions.length," jugadas"]}),rep.actions.slice(-12).map((a,i)=>I.jsxs("p",{children:[a.turn,". ",a.action&&a.action.type||"?"," ",a.phase]},i))]})]})}`;

apply(
  'season-push-inject',
  'function M0Missions({userId:r}){',
  `${seasonPushBlock}
function M0Missions({userId:r}){`,
);

apply(
  'profile-season-replace',
  'I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-pink-800/40 bg-pink-950/20",children:[I.jsxs("div",{className:"flex justify-between text-xs mb-2",children:[I.jsx("span",{className:"font-bold text-pink-300",children:"Pase de temporada"}),I.jsxs("span",{className:"text-violet-400",children:["Nivel ",Math.floor((t.xp||0)/100)+1]})]}),I.jsx("div",{className:"h-2 rounded-full bg-violet-950 overflow-hidden",children:I.jsx("div",{className:"h-full bg-gradient-to-r from-violet-600 to-pink-500",style:{width:((t.xp||0)%100)+"%"}})})]}),I.jsx("div",{className:"w-full max-w-md p-3 rounded-xl border border-violet-800/40 text-center",children:I.jsx("p",{className:"text-[0.65rem] text-violet-500",children:"🔔 Notificaciones push — próximamente"})})',
  'I.jsx(M0SeasonPass,{userId:r.uid,xp:t.xp||0}),I.jsx(M0PushBtn,{}),I.jsx(M0MatchHist,{})',
);

// ── 6. Sala lobby — badge formato ─────────────────────────────────────────────
apply(
  'vc-format-badge',
  'children:r.mode}),I.jsx("span",{className:"text-xs font-bold px-2 py-0.5 rounded-full "+(r.stakeCC>0?"text-amber-400":"text-emerald-400")',
  'children:r.mode}),I.jsx("span",{className:"text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-violet-900/60 text-violet-300",children:(r.maxPlayers??2)>=4?"2v2":"1v1"}),I.jsx("span",{className:"text-xs font-bold px-2 py-0.5 rounded-full "+(r.stakeCC>0?"text-amber-400":"text-emerald-400")',
);

apply(
  'lobby-map-format',
  'return{id:Ae.id,mode:we.mode??"classic",stakeCC:we.stakeCC??0,playerCount:we.playerCount??0,maxPlayers:we.maxPlayers??2,players:we.players??[],createdAt:we.createdAt??null}',
  'return{id:Ae.id,mode:we.mode??"classic",format:we.format??"1v1",stakeCC:we.stakeCC??0,playerCount:we.playerCount??0,maxPlayers:we.maxPlayers??2,players:we.players??[],createdAt:we.createdAt??null}',
);

fs.writeFileSync(bundlePath, s);
console.log('Roadmap v4 patch applied.');
