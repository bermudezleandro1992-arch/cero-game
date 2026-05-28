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

// ── 1. Callables v5 ───────────────────────────────────────────────────────────
apply(
  'v5-callables',
  'function M0replayFn(){return M0replay??(M0replay=or(ur,"getReplay"))}',
  `function M0replayFn(){return M0replay??(M0replay=or(ur,"getReplay"))}
let M0pubCfg=null;
function M0pubCfgFn(){return M0pubCfg??(M0pubCfg=or(ur,"getPublicConfig"))}`,
);

// ── 2. dk compact para asientos laterales ─────────────────────────────────────
apply(
  'dk-compact',
  'function dk({count:r,name:e}){const t=Math.min(r,10);return I.jsxs("div",{className:"flex flex-col items-center gap-2",children:[I.jsx("span",{className:"text-xs text-violet-300 font-bold tracking-widest uppercase opacity-80",children:e}),I.jsx("div",{className:"flex items-end",style:{gap:`-${Math.min(t-1,9)*8}px`},children:Array.from({length:t}).map((s,o)=>I.jsx("div",{className:"transition-all",style:{marginRight:o<t-1?"-28px":void 0,zIndex:o,transform:`rotate(${(o-t/2)*4}deg)`},children:I.jsx(qf,{small:!0})},o))}),r>0&&I.jsxs("span",{className:"text-[0.65rem] text-violet-400 font-semibold",children:[r," ",r===1?"carta":"cartas"]})]})}',
  'function dk({count:r,name:e,compact:t}){const o=Math.min(r,t?6:10);return I.jsxs("div",{className:"flex flex-col items-center "+(t?"gap-1":"gap-2"),children:[I.jsx("span",{className:(t?"text-[0.55rem] max-w-[4.5rem] truncate":"text-xs")+" text-violet-300 font-bold tracking-widest uppercase opacity-80",children:e}),I.jsx("div",{className:"flex items-end",style:{gap:"-"+Math.min(o-1,t?4:9)*8+"px"},children:Array.from({length:o}).map((l,h)=>I.jsx("div",{className:"transition-all",style:{marginRight:h<o-1?(t?"-16px":"-28px"):void 0,zIndex:h,transform:"rotate("+(h-o/2)*4+"deg)"},children:I.jsx(qf,{small:!0})},h))}),r>0&&I.jsxs("span",{className:"text-[0.6rem] text-violet-400 font-semibold",children:[r," ",r===1?"carta":"cartas"]})]})}',
);

// ── 3. Mesa 4 jugadores + waiting list ────────────────────────────────────────
const fourSeats = `function M0FourSeats({match:r,uid:e}){const ps=r.players??[],hc=r.handCounts??[],others=ps.filter(p=>p.uid!==e),cnt=i=>{const x=ps.findIndex(p=>p.uid===i);return x>=0?hc[x]??0:0};if(!others.length)return I.jsx("p",{className:"text-violet-500 text-xs animate-pulse",children:"Esperando jugadores…"});if((r.maxPlayers??2)<4||others.length===1)return I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[0].uid),name:others[0].name})});return I.jsxs("div",{className:"w-full max-w-xl mx-auto px-1 shrink-0",children:[r.format==="2v2"&&I.jsx("p",{className:"text-center text-[0.55rem] text-sky-400 font-bold mb-1 uppercase tracking-widest",children:"2 vs 2 · Equipos"}),I.jsxs("div",{className:"grid grid-cols-3 gap-1 items-end min-h-[4.5rem]",children:[others[1]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[1].uid),name:others[1].name,compact:!0})}):I.jsx("div"),others[0]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[0].uid),name:others[0].name})}):I.jsx("div"),others[2]?I.jsx("div",{className:"flex justify-center",children:I.jsx(dk,{count:cnt(others[2].uid),name:others[2].name,compact:!0})}):I.jsx("div")]})]})}`;

apply(
  'four-seats-inject',
  'function M0SeasonPass({userId:r,xp:e}){',
  `${fourSeats}
function M0SeasonPass({userId:r,xp:e}){`,
);

apply(
  'vk-four-seats',
  'I.jsx("div",{className:"flex justify-center pt-1 sm:pt-2 pb-0 shrink-0",children:_?I.jsx(dk,{count:((le=o.handCounts)==null?void 0:le[o.playerIds.indexOf(_.uid)])??0,name:_.name}):I.jsx("p",{className:"text-violet-500 text-xs animate-pulse",children:"Esperando oponente…"})})',
  'I.jsx("div",{className:"flex justify-center pt-1 sm:pt-2 pb-0 shrink-0",children:I.jsx(M0FourSeats,{match:o,uid:s})})',
);

apply(
  'vk-waiting-4p',
  'children:(o.playerCount??0)>=(o.maxPlayers??2)?"Iniciando partida…":"Esperando rival…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[o.playerCount,"/",o.maxPlayers," jugadores · modo ",o.mode]}),',
  'children:(o.playerCount??0)>=(o.maxPlayers??2)?"Iniciando partida…":(o.maxPlayers??2)>=4?"Esperando jugadores…":"Esperando rival…"}),I.jsxs("p",{className:"text-sm text-violet-400",children:[o.playerCount,"/",o.maxPlayers," jugadores · ",(o.format??"1v1")," · ",o.mode]}),I.jsx("div",{className:"flex flex-wrap gap-2 justify-center mt-2",children:((o.players)??[]).map(P=>I.jsxs("span",{className:"text-[0.65rem] px-2 py-1 rounded-full border "+(P.uid===s?"border-violet-400 text-violet-200 bg-violet-900/40":"border-violet-800 text-violet-400"),children:[P.name,P.uid===s?" (vos)":""]},P.uid))}),',
);

// ── 4. Replay paso a paso ─────────────────────────────────────────────────────
const replayPlayer = `function M0ReplayPlayer({rep:r,onClose:e}){const[step,setStep]=ie.useState(0);const acts=r.actions||[];const a=acts[step];const act=a==null?void 0:a.action;return I.jsxs("div",{className:"mt-3 p-3 rounded-xl bg-black/40 border border-violet-700/40",children:[I.jsxs("div",{className:"flex justify-between items-center mb-2",children:[I.jsxs("p",{className:"text-xs font-bold text-violet-200",children:["Replay #",r.id.slice(0,8)]}),I.jsx("button",{type:"button",onClick:e,className:"text-violet-500 text-xs",children:"✕"})]}),acts.length===0?I.jsx("p",{className:"text-[0.65rem] text-violet-500",children:"Sin jugadas guardadas (partidas anteriores a v5)."}):I.jsxs(I.Fragment,{children:[I.jsxs("p",{className:"text-[0.65rem] text-violet-400 mb-2",children:["Paso ",step+1,"/",acts.length," · ",(act==null?void 0:act.type)??"?"," · fase ",a==null?void 0:a.phase]}),I.jsxs("p",{className:"text-[0.6rem] text-violet-500 mb-2 font-mono",children:["Manos: ",((a==null?void 0:a.handCounts)||[]).join(" | ")]}),a!=null&&a.topDiscard&&I.jsxs("p",{className:"text-[0.6rem] text-amber-400 mb-2",children:["Mesa: ",a.topDiscard.color," ",a.topDiscard.value]}),I.jsxs("div",{className:"flex gap-2 justify-center",children:[I.jsx("button",{type:"button",disabled:step<=0,onClick:()=>setStep(0),className:"px-2 py-1 rounded text-xs border border-violet-700 disabled:opacity-30",children:"⏮"}),I.jsx("button",{type:"button",disabled:step<=0,onClick:()=>setStep(x=>Math.max(0,x-1)),className:"px-2 py-1 rounded text-xs border border-violet-700 disabled:opacity-30",children:"◀"}),I.jsx("button",{type:"button",disabled:step>=acts.length-1,onClick:()=>setStep(x=>Math.min(acts.length-1,x+1)),className:"px-2 py-1 rounded text-xs border border-violet-700 disabled:opacity-30",children:"▶"}),I.jsx("button",{type:"button",disabled:step>=acts.length-1,onClick:()=>setStep(acts.length-1),className:"px-2 py-1 rounded text-xs border border-violet-700 disabled:opacity-30",children:"⏭"})]})]})]})}`;

apply(
  'replay-player-inject',
  'function M0PushBtn(){',
  `${replayPlayer}
function M0PushBtn(){`,
);

// Replace M0MatchHist - find function start and replace body ending
{
  const start = s.indexOf('function M0MatchHist(){');
  const end = s.indexOf('function M0Missions({', start);
  if (start < 0 || end < 0) {
    console.error('M0MatchHist replace failed');
    process.exit(1);
  }
  const newHist = `function M0MatchHist(){const[hist,setHist]=ie.useState([]);const[rep,setRep]=ie.useState(null);ie.useEffect(()=>{try{setHist(JSON.parse(localStorage.getItem("cero_match_hist")||"[]"))}catch{setHist([])}},[]);const load=async id=>{try{const d=await Rc(M0replayFn(),{matchId:id});setRep({id,actions:d.actions||[]})}catch{setRep({id,actions:[]})}};if(!hist.length)return null;return I.jsxs("div",{className:"w-full max-w-md p-4 rounded-2xl border border-violet-800/40 bg-violet-950/20",children:[I.jsx("p",{className:"text-xs font-bold text-violet-300 mb-2",children:"Historial de partidas"}),I.jsx("div",{className:"flex flex-col gap-1 max-h-36 overflow-y-auto",children:hist.slice(0,8).map(h=>I.jsxs("button",{type:"button",onClick:()=>load(h.id),className:"flex justify-between text-left text-[0.65rem] px-2 py-1.5 rounded-lg hover:bg-violet-900/40 "+(rep&&rep.id===h.id?"bg-violet-900/50 ring-1 ring-violet-600":""),children:[I.jsxs("span",{className:"text-white",children:[h.won?"🏆":"💀"," vs ",h.rival]}),I.jsx("span",{className:"text-violet-500",children:new Date(h.at).toLocaleDateString("es-AR")})]},h.id))}),rep&&I.jsx(M0ReplayPlayer,{rep:rep,onClose:()=>setRep(null)})]})}
`;
  s = s.slice(0, start) + newHist + s.slice(end);
  console.log('OK: match-hist-replay');
}

// ── 5. Push — VAPID desde servidor ────────────────────────────────────────────
apply(
  'push-fetch-vapid',
  'function M0PushBtn(){const{showToast:r}=Oo(),[e,t]=ie.useState(!1),[s,o]=ie.useState(!1);const l=ie.useCallback(async()=>{if(!("Notification"in window)){r("Tu navegador no soporta notificaciones","error");return}t(!0);try{const h=await Notification.requestPermission();if(h!=="granted"){r("Permiso denegado","error");return}const{getMessaging:getMsg,getToken:isSupported}=await import("firebase/messaging");const appMod=await import("firebase/app");if(!(await isSupported())){r("Push no disponible en este dispositivo","error");return}const apps=appMod.getApps();const app=apps[0];if(!app){r("Firebase no inicializado","error");return}const msg=getMsg(app);const reg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");const token=await getToken(msg,{...(window.__CERO_VAPID__?{vapidKey:window.__CERO_VAPID__}:{}),serviceWorkerRegistration:reg});',
  'function M0PushBtn(){const{showToast:r}=Oo(),[e,t]=ie.useState(!1),[s,o]=ie.useState(!1);ie.useEffect(()=>{Rc(M0pubCfgFn(),{}).then(c=>{if(c.vapidKey)window.__CERO_VAPID__=c.vapidKey}).catch(()=>{})},[]);const l=ie.useCallback(async()=>{if(!("Notification"in window)){r("Tu navegador no soporta notificaciones","error");return}t(!0);try{const cfg=await Rc(M0pubCfgFn(),{}).catch(()=>({}));const vapid=cfg.vapidKey||window.__CERO_VAPID__||"";if(!vapid){r("Push aún no configurado en el servidor","error");return}window.__CERO_VAPID__=vapid;const h=await Notification.requestPermission();if(h!=="granted"){r("Permiso denegado","error");return}const{getMessaging:getMsg,getToken:isSupported}=await import("firebase/messaging");const appMod=await import("firebase/app");if(!(await isSupported())){r("Push no disponible en este dispositivo","error");return}const apps=appMod.getApps();const app=apps[0];if(!app){r("Firebase no inicializado","error");return}const msg=getMsg(app);const reg=await navigator.serviceWorker.register("/firebase-messaging-sw.js");const token=await getToken(msg,{vapidKey:vapid,serviceWorkerRegistration:reg});',
);

fs.writeFileSync(bundlePath, s);
console.log('Roadmap v5 patch applied.');
