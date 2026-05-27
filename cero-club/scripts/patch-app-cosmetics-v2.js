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

// ── Helpers cosméticos, banderas, sonidos ─────────────────────────────────────
apply(
  'cosmetics-helpers',
  'const $y=[{id:"skin_neon"',
  `function M0flag(c){if(!c||String(c).length!==2)return"";const a=String(c).toUpperCase();try{return String.fromCodePoint(...[...a].map(x=>127397+x.charCodeAt(0)))}catch{return""}}
const M0ROOM_BG={bg_stadium:"radial-gradient(ellipse at 50% 35%, #1a4a20 0%, #04030d 72%)",bg_beach:"radial-gradient(ellipse at 50% 15%, #1a5080 0%, #04030d 68%)",bg_city:"radial-gradient(ellipse at 50% 25%, #2a1050 0%, #04030d 70%)",bg_football:"radial-gradient(ellipse at 50% 40%, #0a4020 0%, #04030d 72%)"};
const M0TABLE_BG={table_neon:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #1c0f3a 0%, #080318 100%)",border:"3px solid rgba(124,58,237,.55)",boxShadow:"0 0 70px rgba(124,58,237,.35)"},table_marble:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #2a2830 0%, #0a0a12 100%)",border:"3px solid rgba(200,200,210,.35)",boxShadow:"0 0 50px rgba(180,180,200,.15)"},table_carbon:{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #121218 0%, #020204 100%)",border:"3px solid rgba(80,80,90,.5)",boxShadow:"0 0 40px rgba(0,0,0,.8)"}};
const M0DECK_BG={deck_classic:{background:"#12082a",borderColor:"rgba(167,139,250,.4)"},deck_gold:{background:"linear-gradient(145deg,#3d2a00,#1a1200)",borderColor:"rgba(245,158,11,.55)"},deck_cyber:{background:"linear-gradient(145deg,#0a2040,#12082a)",borderColor:"rgba(96,165,250,.5)"}};
function M0roomStyle(id){return M0ROOM_BG[id]||"radial-gradient(ellipse at 50% 30%, #1a0836 0%, #04030d 70%)"}
function M0tableStyle(id){return M0TABLE_BG[id]||{background:"radial-gradient(ellipse 80% 70% at 50% 50%, #1c0f3a 0%, #080318 100%)",border:"3px solid rgba(124,58,237,.4)",boxShadow:"0 0 60px rgba(124,58,237,.2)"}}
function M0deckStyle(id){return M0DECK_BG[id]||M0DECK_BG.deck_classic}
function M0equipField(cat){return cat==="card_skin"?"equippedSkin":cat==="avatar_frame"?"equippedFrame":cat==="table_bg"?"equippedTableBg":cat==="room_bg"?"equippedRoomBg":cat==="deck_back"?"equippedDeckBack":null}
const M0CAT_TABS=[{id:"card_skin",label:"🃏 Cartas"},{id:"avatar_frame",label:"🖼 Marco"},{id:"table_bg",label:"🎱 Mesa"},{id:"room_bg",label:"🌆 Fondo"},{id:"deck_back",label:"📚 Mazo"}];
const M0COUNTRIES=[{c:"AR",n:"Argentina"},{c:"UY",n:"Uruguay"},{c:"PY",n:"Paraguay"},{c:"CL",n:"Chile"},{c:"BR",n:"Brasil"},{c:"CO",n:"Colombia"},{c:"MX",n:"México"},{c:"PE",n:"Perú"},{c:"BO",n:"Bolivia"},{c:"EC",n:"Ecuador"},{c:"VE",n:"Venezuela"},{c:"ES",n:"España"},{c:"US",n:"Estados Unidos"}];
let M0deckEquipped=null;
function M0isMuted(){try{return localStorage.getItem("cero_mute")==="1"}catch{return!1}}
function M0setMuted(v){try{localStorage.setItem("cero_mute",v?"1":"0")}catch{}}
let M0modAv=null;function M0modAvFn(){return M0modAv??(M0modAv=or(ur,"moderateAvatar"))}
const $y=[{id:"skin_neon"`,
);

// ── Catálogo ampliado ─────────────────────────────────────────────────────────
apply(
  'cosmetics-catalog',
  '{id:"frame_champion",name:"Campeón",category:"avatar_frame",price:750,preview:"👑"}];function gd(',
  '{id:"frame_champion",name:"Campeón",category:"avatar_frame",price:750,preview:"👑"},{id:"table_neon",name:"Mesa Neón",category:"table_bg",price:300,preview:"💜"},{id:"table_marble",name:"Mesa Mármol",category:"table_bg",price:450,preview:"🪨"},{id:"table_carbon",name:"Mesa Carbon",category:"table_bg",price:550,preview:"⬛"},{id:"bg_stadium",name:"Estadio",category:"room_bg",price:400,preview:"🏟️"},{id:"bg_beach",name:"Playa",category:"room_bg",price:350,preview:"🏖️"},{id:"bg_city",name:"Ciudad Noche",category:"room_bg",price:400,preview:"🌃"},{id:"bg_football",name:"Cancha Fútbol",category:"room_bg",price:500,preview:"⚽"},{id:"deck_classic",name:"Mazo Clásico",category:"deck_back",price:150,preview:"🃏"},{id:"deck_gold",name:"Mazo Dorado",category:"deck_back",price:350,preview:"🥇"},{id:"deck_cyber",name:"Mazo Cyber",category:"deck_back",price:450,preview:"🤖"}];function gd(',
);

// ── Sonidos: mute + win/lose ──────────────────────────────────────────────────
apply(
  'sounds-mute-wrap',
  'function M0beep(r,e=.08,t=440){try{M0snd??=new(window.AudioContext||window.webkitAudioContext);',
  'function M0beep(r,e=.08,t=440){if(M0isMuted())return;try{M0snd??=new(window.AudioContext||window.webkitAudioContext);',
);

apply(
  'sounds-win-lose',
  'function M0playCard(){M0beep(.05,.05,660)}',
  `function M0playCard(){M0beep(.05,.05,660)}
function M0playWin(){M0beep(.15,.12,880),setTimeout(()=>M0beep(.12,.1,1175),100),setTimeout(()=>M0beep(.1,.15,1480),220)}
function M0playLose(){M0beep(.08,.2,220)}`,
);

// ── Mazo personalizado en qf ──────────────────────────────────────────────────
apply(
  'qf-deck-style',
  'function qf({small:r}){return I.jsxs("div",{className:["relative select-none rounded-xl border-2 flex items-center justify-center","font-extrabold overflow-hidden transition-all duration-200 ease-out cursor-default",r?"w-12 h-[4.5rem] text-[0.6rem]":"w-16 h-24 text-[0.65rem]"].join(" "),style:{background:"#12082a",borderColor:"rgba(167,139,250,.4)",boxShadow:"0 2px 12px rgba(0,0,0,.6)"}',
  'function qf({small:r}){const ds=M0deckStyle(M0deckEquipped);return I.jsxs("div",{className:["relative select-none rounded-xl border-2 flex items-center justify-center","font-extrabold overflow-hidden transition-all duration-200 ease-out cursor-default",r?"w-12 h-[4.5rem] text-[0.6rem]":"w-16 h-24 text-[0.65rem]"].join(" "),style:{background:ds.background,borderColor:ds.borderColor,boxShadow:"0 2px 12px rgba(0,0,0,.6)"}',
);

// ── vk: cargar cosméticos + sonido victoria/derrota ───────────────────────────
apply(
  'vk-cosmetics-state',
  '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,actionError:$,clearActionError:ne}=t;const[M0tu,M0tuDone]',
  '{match:o,myHand:l,playableIds:h,isMyTurn:f,needsColorPick:g,opponent:_,loading:w,error:T,busy:k,play:F,draw:K,pickColor:W,actionError:$,clearActionError:ne}=t;const[M0cos,setM0cos]=ie.useState(null);const M0winRef=ie.useRef(!1);ie.useEffect(()=>{if(!s)return;const u=Co(Ba(br,"users",s),d=>{if(d.exists()){const x=d.data();setM0cos(x),M0deckEquipped=x.equippedDeckBack||null}});return()=>u()},[s]);ie.useEffect(()=>{if(!o||M0winRef.current)return;const done=o.phase==="game_over"||o.status==="finished";if(!done)return;M0winRef.current=!0;o.winner===s?M0playWin():M0playLose()},[o==null?void 0:o.phase,o==null?void 0:o.status,o==null?void 0:o.winner,s]);const[M0tu,M0tuDone]',
);

// ── Perfil: tabs ampliados + equip multi-categoría ────────────────────────────
apply(
  'profile-tabs',
  'children:["card_skin","avatar_frame"].map(ee=>I.jsx("button",{type:"button",onClick:()=>_(ee),className:["flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",g===ee?"bg-violet-900/60 text-violet-200":"text-violet-500 hover:text-violet-400"].join(" "),children:ee==="card_skin"?"🃏 Skins":"🖼 Marcos"},ee))})',
  'children:M0CAT_TABS.map(ee=>I.jsx("button",{type:"button",onClick:()=>_(ee.id),className:["flex-1 py-1.5 sm:py-2 text-[0.55rem] sm:text-xs font-bold uppercase tracking-wide transition-all",g===ee.id?"bg-violet-900/60 text-violet-200":"text-violet-500 hover:text-violet-400"].join(" "),children:ee.label},ee.id))})',
);

apply(
  'profile-equip-check',
  'equipped:ee.category==="card_skin"?t.equippedSkin===ee.id:t.equippedFrame===ee.id,balance:t.ceroCoins',
  'equipped:(t[M0equipField(ee.category)]??null)===ee.id,balance:t.ceroCoins',
);

// ── Perfil: avatar con foto + país + subir foto ───────────────────────────────
{
  const start = s.indexOf('I.jsxs("div",{className:"relative",children:[I.jsx("div",{className:`w-20 h-20');
  const endMarker = 'I.jsx("h2",{className:"text-xl font-black text-white",children:t.displayName})';
  const end = s.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    console.error('PATCH FAILED: profile-avatar-photo anchor not found');
    process.exit(1);
  }
  const from = s.slice(start, end + endMarker.length);
  const to = `I.jsxs("div",{className:"relative",children:[I.jsx("label",{className:"cursor-pointer block",children:[I.jsx("div",{className:"w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-4xl bg-violet-900/40 border-4",style:{borderColor:t.equippedFrame?"#a78bfa":"#4c1d95",boxShadow:t.equippedFrame?"0 0 20px rgba(167,139,250,.5)":"none"},children:t.photoURL?I.jsx("img",{src:t.photoURL,alt:"",className:"w-full h-full object-cover"}):t.equippedFrame?(($y.find(ee=>ee.id===t.equippedFrame))==null?void 0:$y.find(ee=>ee.id===t.equippedFrame).preview)??"🎮":"🎮"}),I.jsx("input",{type:"file",accept:"image/jpeg,image/png,image/webp",className:"hidden",onChange:async ee=>{var P;const le=(P=ee.target.files)==null?void 0:P[0];if(!le||le.size>800000)return;f(!0);try{const B=await new Promise((Q,R)=>{const U=new FileReader;U.onload=()=>Q(U.result),U.onerror=R,U.readAsDataURL(le)}),H=await Rc(M0modAvFn,{imageBase64:B});H.status==="approved"?(e("¡Foto actualizada!","success"),s(Q=>({...Q,photoURL:H.photoURL}))):e("La imagen no fue aprobada","error")}catch(B){e(B instanceof Error?B.message:"Error al subir foto","error")}finally{f(!1),ee.target.value=""}}})]}),k&&I.jsx("span",{className:"absolute -top-1 -right-1 text-lg",title:"VIP",children:"👑"})]}),I.jsxs("h2",{className:"text-xl font-black text-white flex items-center gap-2",children:[M0flag(t.countryCode),t.displayName,k&&I.jsx("span",{className:"text-amber-400 text-sm",children:"VIP"})]}),I.jsxs("select",{value:t.countryCode||"",onChange:async ee=>{const le=ee.target.value||null;try{await dC(Ba(br,"users",r),{countryCode:le},{merge:!0}),s(P=>({...P,countryCode:le}))}catch(P){e("No se pudo guardar el país","error")}},className:"mt-1 px-3 py-1.5 rounded-lg text-xs bg-violet-950/60 border border-violet-800 text-violet-200",children:[I.jsx("option",{value:"",children:"🌍 Elegí tu país"}),M0COUNTRIES.map(ee=>I.jsxs("option",{value:ee.c,children:[M0flag(ee.c)," ",ee.n]},ee.c))]})`;
  s = s.replace(from, to);
  console.log('OK: profile-avatar-photo');
}

// ── Ranking: bandera, VIP, marco ──────────────────────────────────────────────
apply(
  'ranking-fields',
  'const J=ne.docs.map(le=>({uid:le.id,displayName:le.data().displayName??"Jugador",weeklyWins:le.data().weeklyWins??0,equippedFrame:le.data().equippedFrame??null}));',
  'const J=ne.docs.map(le=>({uid:le.id,displayName:le.data().displayName??"Jugador",weeklyWins:le.data().weeklyWins??0,equippedFrame:le.data().equippedFrame??null,countryCode:le.data().countryCode??null,vipActive:((le.data().vip)==null?void 0:le.data().vip.active)===!0,photoURL:le.data().photoURL??null}));',
);

apply(
  'ranking-row-display',
  'I.jsxs("p",{className:["flex-1 text-sm font-semibold truncate",J?"text-violet-300":"text-white"].join(" "),children:[W.displayName,J&&I.jsx("span",{className:"ml-2 text-xs text-violet-400",children:"(vos)"})]})',
  'I.jsxs("div",{className:"flex-1 flex items-center gap-2 min-w-0",children:[W.photoURL?I.jsx("img",{src:W.photoURL,alt:"",className:"w-7 h-7 rounded-full object-cover shrink-0 border border-violet-700"}):I.jsx("span",{className:"w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm bg-violet-900/50 border border-violet-700",children:(($y.find(x=>x.id===W.equippedFrame))==null?void 0:$y.find(x=>x.id===W.equippedFrame).preview)??"🎮"}),I.jsxs("p",{className:["text-sm font-semibold truncate",J?"text-violet-300":"text-white"].join(" "),children:[M0flag(W.countryCode),W.vipActive&&I.jsx("span",{className:"mr-0.5",title:"VIP",children:"👑"}),W.displayName,J&&I.jsx("span",{className:"ml-1 text-xs text-violet-400",children:"(vos)"})]})]})',
);

// ── Tienda: tab cosméticos ────────────────────────────────────────────────────
apply(
  'store-cosmetics-tab',
  'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("coins"),[o,l]=ie.useState(!1);',
  'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("coins"),[o,l]=ie.useState(!1),[M0prof,setM0prof]=ie.useState(null),[M0cat,setM0cat]=ie.useState("room_bg"),[M0busy,setM0busy]=ie.useState(!1);ie.useEffect(()=>{if(!r)return;const u=Co(Ba(br,"users",r),d=>{d.exists()&&setM0prof(d.data())});return()=>u()},[r]);const M0buy=async u=>{setM0busy(!0);try{await or(ur,"purchaseCosmetic")({cosmeticId:u}),e("¡Comprado!","success")}catch(d){e(d instanceof Error?d.message:"Error","error")}finally{setM0busy(!1)}},M0equip=async u=>{setM0busy(!0);try{await or(ur,"equipCosmetic")({cosmeticId:u})}catch(d){e(d instanceof Error?d.message:"Error","error")}finally{setM0busy(!1)}};',
);

apply(
  'store-tab-button',
  'children:"VIP"})]}),t==="coins"?',
  'children:"VIP"}),I.jsx("button",{type:"button",onClick:()=>s("cosmetics"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="cosmetics"?"bg-pink-600 text-white":"text-violet-400 border border-violet-800"),children:"Cosméticos CC"})]}),t==="cosmetics"?I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-violet-400 text-center",children:"Mesas, fondos, mazos y más — pagás con Cero Coins"}),I.jsx("div",{className:"flex rounded-xl overflow-hidden border border-violet-800/50 flex-wrap",children:M0CAT_TABS.map(u=>I.jsx("button",{type:"button",onClick:()=>setM0cat(u.id),className:"flex-1 min-w-[4.5rem] py-2 text-[0.55rem] font-bold "+(M0cat===u.id?"bg-violet-900/60 text-violet-200":"text-violet-500"),children:u.label},u.id))}),I.jsx("div",{className:"grid grid-cols-2 gap-3",children:(M0prof?$y.filter(u=>u.category===M0cat):[]).map(u=>I.jsx(BC,{item:u,owned:((M0prof==null?void 0:M0prof.ownedCosmetics)||[]).includes(u.id),equipped:((M0prof==null?void 0:M0prof[M0equipField(u.category)])??null)===u.id,balance:(M0prof==null?void 0:M0prof.ceroCoins)??0,onBuy:M0buy,onEquip:M0equip,busy:M0busy},u.id))})]}):t==="coins"?',
);

fs.writeFileSync(bundlePath, s);
console.log('Cosmetics v2 patch applied.');
