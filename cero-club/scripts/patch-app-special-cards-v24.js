#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 280));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Fix black screen: corrupted sk() J/ee (v22 partial merge) ─────────────────
function applyOptional(name, from, to) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${name}`);
    return;
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

applyOptional(
  'fix-sk-corrupt-j-ee',
  'M0hl=s.filter(c=>!c.ghost).length,M0cc=(e==null?void 0:e.ceroCalled)??[],J=!!(ne=!!(e&&e.status==="playing"&&e.phase==="color_pick"&&e.pendingTurn===W),J=!!($&&s.filter(c=>!c.ghost).length===1&&!((gt=(et=e==null?void 0:e.ceroCalled)==null?void 0:et.includes)!=null&&gt.call(et,W))),ee=ik(s.filter(c=>!c.ghost),e,$&&!J)&(M0hl===2||M0hl===1&&!M0cc.includes(W))),ee=ik(s.filter(c=>!c.ghost),e,$)',
  'M0hl=s.filter(c=>!c.ghost).length,M0cc=(e==null?void 0:e.ceroCalled)??[],J=!!($&&(M0hl===2||M0hl===1&&!M0cc.includes(W))),ee=ik(s.filter(c=>!c.ghost),e,$)',
);

// ── Color labels: magenta → Rojo ─────────────────────────────────────────────
apply(
  'tl-magenta-rojo',
  'magenta:{bg:"#1f0824",ink:"#e879f9",glow:"rgba(232,121,249,.55)",label:"Magenta"}',
  'magenta:{bg:"#1f0824",ink:"#ef4444",glow:"rgba(239,68,68,.55)",label:"Rojo"}',
);

// ── Card value labels + wild2 support ─────────────────────────────────────────
apply(
  'bc-wild2',
  'bC={skip:"⊘",reverse:"⇄",draw2:"+2",wild:"★",wild4:"+4"}',
  'bC={skip:"⊘",reverse:"⇄",draw2:"+2",wild:"★",wild2:"+2",wild4:"+4"}',
);

apply(
  'zc-wild2',
  'ZC=new Set(["wild","wild4"]),ek=new Set(["draw2","wild4"])',
  'ZC=new Set(["wild","wild2","wild4"]),ek=new Set(["draw2","wild2","wild4"])',
);

apply(
  'card-hint-wild2',
  'wild4:"+4: elegís color y el rival roba cuatro."}',
  'wild2:"+2 comodín: el rival roba dos. Podés cambiar color o no.",wild4:"+4: elegís color y el rival roba cuatro obligatorio."}',
);

// ── Card face image helper ────────────────────────────────────────────────────
apply(
  'm0-card-face-src',
  'function QC(r){return bC[r]??r}',
  'function M0cardFaceSrc(r,e){if(e==="reverse")return"/app/cards/reverse-"+r+".svg";if(e==="skip")return"/app/cards/skip-"+r+".svg";if(e==="draw2")return"/app/cards/draw2-"+r+".svg";if(e==="wild")return"/app/cards/wild.svg";if(e==="wild2")return"/app/cards/wild2.svg";if(e==="wild4")return"/app/cards/wild4.svg";return null}function QC(r){return bC[r]??r}',
);

// ── T0: render special card art + safe color fallback ─────────────────────────
apply(
  't0-safe-color-art',
  'function T0({color:r,value:e,isPlayable:t=!1,isSelected:s=!1,faceDown:o=!1,small:l=!1,onClick:h,className:f=""}){if(o)return I.jsx(qf,{small:l});const g=tl[r],_=QC(e),w=r==="wild",T=JC({isPlayable:t,isSelected:s,small:l,onClick:!!h});const M0sk=M0cardSkinStyle(M0skinEquipped,g,w),k={background:M0sk.background||g.bg,borderColor:t?"rgba(0,239,144,.7)":M0sk.borderColor||g.ink+"55",boxShadow:t?"0 0 0 2px rgba(0,239,144,.35), 0 8px 24px rgba(0,0,0,.6), 0 0 18px rgba(0,239,144,.2)":s?`0 0 0 2px ${g.ink}66, 0 12px 28px rgba(0,0,0,.7)`:"0 4px 14px rgba(0,0,0,.5)",color:g.ink},F=I.jsx("span",{style:{color:g.ink,textShadow:`0 0 6px ${g.ink}`},children:_});return I.jsxs("button",{type:"button",className:`${T} ${f}`,style:{...k,willChange:"transform"},onClick:h,disabled:!h,"aria-label":`Carta ${tl[r].label} ${_}`,"title":M0cardHint(r,e),"aria-pressed":s,children:[I.jsx("div",{className:"absolute top-1 left-1.5 leading-none z-10",children:F}),I.jsx(YC,{value:_,ink:g.ink,isWild:w}),I.jsx("div",{className:"absolute bottom-1 right-1.5 leading-none rotate-180 z-10",children:F})]})}',
  'function T0({color:r,value:e,isPlayable:t=!1,isSelected:s=!1,faceDown:o=!1,small:l=!1,onClick:h,className:f=""}){if(o)return I.jsx(qf,{small:l});const g=tl[r]||tl.wild,_=QC(e),w=r==="wild",M0img=M0cardFaceSrc(r,e),T=JC({isPlayable:t,isSelected:s,small:l,onClick:!!h});const M0sk=M0cardSkinStyle(M0skinEquipped,g,w),k=M0img?{backgroundImage:"url("+M0img+")",backgroundSize:"cover",backgroundPosition:"center",borderColor:t?"rgba(0,239,144,.7)":g.ink+"55",boxShadow:t?"0 0 0 2px rgba(0,239,144,.35), 0 8px 24px rgba(0,0,0,.6), 0 0 18px rgba(0,239,144,.2)":s?`0 0 0 2px ${g.ink}66, 0 12px 28px rgba(0,0,0,.7)`:"0 4px 14px rgba(0,0,0,.5)"}:{background:M0sk.background||g.bg,borderColor:t?"rgba(0,239,144,.7)":M0sk.borderColor||g.ink+"55",boxShadow:t?"0 0 0 2px rgba(0,239,144,.35), 0 8px 24px rgba(0,0,0,.6), 0 0 18px rgba(0,239,144,.2)":s?`0 0 0 2px ${g.ink}66, 0 12px 28px rgba(0,0,0,.7)`:"0 4px 14px rgba(0,0,0,.5)",color:g.ink},F=!M0img&&I.jsx("span",{style:{color:g.ink,textShadow:`0 0 6px ${g.ink}`},children:_});return I.jsxs("button",{type:"button",className:`${T} ${f}`,style:{...k,willChange:"transform"},onClick:h,disabled:!h,"aria-label":`Carta ${(tl[r]||tl.wild).label} ${_}`,"title":M0cardHint(r,e),"aria-pressed":s,children:[!M0img&&I.jsx("div",{className:"absolute top-1 left-1.5 leading-none z-10",children:F}),!M0img&&I.jsx(YC,{value:_,ink:g.ink,isWild:w}),!M0img&&I.jsx("div",{className:"absolute bottom-1 right-1.5 leading-none rotate-180 z-10",children:F})]})}',
);

// ── Color picker: optional skip for wild +2 ───────────────────────────────────
const MK_START = s.indexOf('function mk({onPick:r,busy:e})');
const MK_END = s.indexOf('function M0CeroBtn', MK_START);
if (MK_START === -1 || MK_END === -1) {
  console.error('PATCH FAILED: mk boundaries');
  process.exit(1);
}
const NEW_MK = `function mk({onPick:r,onSkip:e,busy:t,optional:s}){const o=["magenta","gold","blue","green"];return I.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm",children:I.jsxs("div",{className:"flex flex-col items-center gap-5 p-8 rounded-2xl bg-[#100828] border border-violet-700 shadow-2xl max-w-sm mx-4",children:[I.jsx("p",{className:"text-white font-bold text-lg tracking-wide text-center",children:s?"Elegí color (opcional)":"Elegí el color activo"}),I.jsx("div",{className:"grid grid-cols-2 gap-4",children:o.map(l=>{const h=tl[l];return I.jsx("button",{type:"button",disabled:t,onClick:()=>r(l),className:"w-28 h-14 rounded-xl font-bold text-sm border-2 transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-95 disabled:opacity-50",style:{background:h.bg,borderColor:h.ink,color:h.ink,boxShadow:"0 0 18px "+h.glow},children:h.label},l)})}),s&&e&&I.jsx("button",{type:"button",disabled:t,onClick:e,className:"mt-1 px-6 py-2.5 rounded-xl font-bold text-sm border-2 border-violet-500/60 text-violet-200 hover:bg-violet-900/40 disabled:opacity-50",children:"Sin cambiar color"})]})})}`;
s = s.slice(0, MK_START) + NEW_MK + s.slice(MK_END);
console.log('OK: mk-optional-skip');

// ── sk: skipColor action ──────────────────────────────────────────────────────
apply(
  'sk-skip-color',
  'P=ie.useCallback(Y=>le({action:"pickColor",color:Y}),[le]),x=ie.useCallback(()=>le({action:"declareCero"}),[le])',
  'P=ie.useCallback(Y=>le({action:"pickColor",color:Y}),[le]),M0skip=ie.useCallback(()=>le({action:"skipColor"}),[le]),x=ie.useCallback(()=>le({action:"declareCero"}),[le])',
);

apply(
  'sk-return-skip',
  'pickColor:P,declareCero:x,penalizeCero:B',
  'pickColor:P,skipColor:M0skip,declareCero:x,penalizeCero:B',
);

// ── vk: pass optional color pick to mk ────────────────────────────────────────
apply(
  'vk-mk-optional',
  'g&&I.jsx(mk,{onPick:ne=>{W(ne);M0st("🎨 Color activo: "+M0colorLbl(ne),"success")},busy:k})',
  'g&&I.jsx(mk,{onPick:ne=>{W(ne);M0st("🎨 Color activo: "+M0colorLbl(ne),"success")},onSkip:()=>{t.skipColor();M0st("Color sin cambios","success")},optional:!!o.colorPickOptional,busy:k})',
);

// ── Card FX for wild2 ─────────────────────────────────────────────────────────
apply(
  'vk-fx-wild2',
  'v==="wild4"?msg="🌈 +4":v==="wild"?msg="★ COMODÍN":null',
  'v==="wild4"?msg="🌈 +4":v==="wild2"?msg="🌈 +2":v==="wild"?msg="★ COMODÍN":null',
);

// ── Optimistic wild2 / skipColor ───────────────────────────────────────────────
apply(
  'opt-wild2',
  'const wild=card.color==="wild"||card.value==="wild"||card.value==="wild4";if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx}',
  'const wild=card.color==="wild"||card.value==="wild"||card.value==="wild2"||card.value==="wild4";if(wild)nm={...nm,phase:"color_pick",pendingTurn:myIdx,colorPickOptional:card.value==="wild2"}',
);

apply(
  'opt-skip-color',
  'if(act.action==="penalizeCero")return{match:{...match,ceroForgot:null},hand};',
  'if(act.action==="penalizeCero")return{match:{...match,ceroForgot:null},hand};if(act.action==="skipColor"){const n=(match.playerIds==null?void 0:match.playerIds.length)||2;return{match:{...match,phase:"playing",current:(myIdx+1)%n,colorPickOptional:!1,pendingTurn:null},hand}};',
);

// ── M0colorLbl: Rosa → Rojo ───────────────────────────────────────────────────
applyOptional(
  'm0colorlbl-rojo',
  'function M0colorLbl(c){return{magenta:"Rosa",gold:"Dorado",blue:"Azul",green:"Verde"}',
  'function M0colorLbl(c){return{magenta:"Rojo",gold:"Amarillo",blue:"Azul",green:"Verde"}',
);

fs.writeFileSync(bundlePath, s);
console.log('\nSpecial cards + black screen fix v24 applied.');
