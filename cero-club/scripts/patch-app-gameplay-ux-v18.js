#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 260));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

function replaceBlock(name, startNeedle, endNeedle, replacement) {
  const start = s.indexOf(startNeedle);
  const end = s.indexOf(endNeedle, start);
  if (start === -1 || end === -1) {
    console.error(`PATCH FAILED: ${name} (block boundaries)`);
    process.exit(1);
  }
  s = s.slice(0, start) + replacement + s.slice(end);
  console.log(`OK: ${name}`);
}

apply(
  'color-label-helper-v18',
  'function M0modeLbl(m){return m==="cero"?"CERO Caótico":"CERO Clásico"}',
  'function M0colorLbl(c){return{magenta:"Rosa",gold:"Dorado",blue:"Azul",green:"Verde"}[c]||((tl[c]||{}).label)||c}function M0modeLbl(m){return m==="cero"?"CERO Caótico":"CERO Clásico"}',
);

replaceBlock(
  'table3d-center-v18',
  'function M0Table3D(){',
  'const M0TABLE_BG=',
  'function M0Table3D(){return I.jsx("div",{className:"absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 w-full flex justify-center",children:I.jsx("div",{className:"rounded-[50%] border border-violet-400/25",style:{width:"min(88vw,20rem)",height:"8.75rem",background:"radial-gradient(ellipse at 50% 28%, rgba(109,40,217,.55) 0%, rgba(30,10,60,.35) 45%, rgba(4,3,13,.15) 78%)",boxShadow:"0 18px 48px rgba(124,58,237,.35), inset 0 4px 28px rgba(196,181,253,.15), inset 0 -8px 20px rgba(0,0,0,.45)",transform:"perspective(520px) rotateX(14deg)"}})})}',
);

replaceBlock(
  'fk-mobile-center-v18',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s}){',
  'function pk({cards:r,playableIds:e,isMyTurn:t,onPlay:s,busy:o',
  'function fk({match:r,isMyTurn:e,onDraw:t,busy:s}){const o=(r==null?void 0:r.topDiscard)??null,l=(r==null?void 0:r.drawStack)??0,M0cc=o&&o.color==="wild"&&(r==null?void 0:r.chosenColor)?r.chosenColor:null;return I.jsxs("div",{className:"relative w-full max-w-[18rem] mx-auto min-h-[10.5rem] flex items-center justify-center px-1",children:[I.jsx(M0Table3D,{}),I.jsxs("div",{className:"relative z-10 grid grid-cols-[1fr_auto_1fr] items-end gap-1 sm:gap-3 w-full",children:[I.jsxs("div",{className:"flex flex-col items-center gap-1 justify-self-center",children:[I.jsx("span",{className:"text-[0.6rem] text-violet-400 font-semibold uppercase tracking-widest",children:"Mazo"}),I.jsxs("button",{type:"button",disabled:!e||s,onClick:t,className:["relative transition-all duration-75",e&&!s?"hover:-translate-y-1 hover:scale-105 cursor-pointer ring-2 ring-emerald-400/50 rounded-xl":"cursor-default opacity-70"].join(" "),title:e?"Robar carta":void 0,children:[e&&!s&&I.jsx("span",{className:"absolute -top-7 left-1/2 -translate-x-1/2 text-xl pointer-events-none animate-bounce z-30",style:{filter:"drop-shadow(0 0 6px rgba(0,239,144,.8))"},children:"👆"}),I.jsx(qf,{small:!1}),I.jsxs("span",{className:"absolute -top-1.5 -right-1.5 bg-violet-700 text-white text-[0.55rem] font-bold rounded-full w-4 h-4 flex items-center justify-center z-20 border border-violet-400",children:[40,"+"]})]}),e&&I.jsx("span",{className:"text-[0.58rem] text-emerald-400 font-semibold animate-pulse text-center",children:"Tocá para robar"})]}),I.jsxs("div",{className:"flex flex-col items-center gap-1 self-center pb-6",children:[I.jsx("span",{className:"text-lg text-violet-400",title:"Dirección: "+((r==null?void 0:r.direction)===1?"→":"←"),children:(r==null?void 0:r.direction)===1?"↻":"↺"}),l>0&&I.jsxs("span",{className:"bg-red-600 text-white text-xs font-black rounded-full px-2 py-0.5 animate-bounce shadow-lg",children:["+",l]})]}),I.jsxs("div",{className:"flex flex-col items-center gap-1 justify-self-center",children:[I.jsx("span",{className:"text-[0.6rem] text-violet-400 font-semibold uppercase tracking-widest",children:"Descarte"}),o?I.jsxs("div",{className:"relative flex flex-col items-center",children:[I.jsx(T0,{color:M0cc||o.color,value:o.value,small:!1}),M0cc&&I.jsxs("span",{className:"mt-1 text-[0.52rem] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap",style:{color:tl[M0cc].ink,borderColor:tl[M0cc].ink+"99",background:tl[M0cc].bg},children:["→ ",M0colorLbl(M0cc)]})]}):I.jsx("div",{className:"w-16 h-24 rounded-xl border-2 border-dashed border-violet-700 flex items-center justify-center text-violet-600 text-xs",children:"—"})]})]})]})}',
);

apply(
  'vk-table-wrap-v18',
  'I.jsx("div",{className:"flex items-center justify-center px-2 sm:px-4 min-h-0 overflow-hidden",children:I.jsxs("div",{className:"relative w-full max-w-lg scale-[0.92] sm:scale-100 origin-center",children:[I.jsx("div",{className:"absolute inset-[-8%] rounded-[50%] pointer-events-none opacity-95",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),I.jsx("div",{className:"relative z-10 py-3 sm:py-6",children:I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k})})]})})',
  'I.jsx("div",{className:"flex items-center justify-center px-3 sm:px-4 min-h-0 overflow-hidden w-full",children:I.jsxs("div",{className:"relative w-full max-w-md mx-auto",children:[I.jsx("div",{className:"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,22rem)] h-[10.5rem] rounded-[50%] pointer-events-none opacity-95",style:M0tableStyle(M0cos==null?void 0:M0cos.equippedTableBg)}),I.jsx("div",{className:"relative z-10 py-2 sm:py-4",children:I.jsx(fk,{match:o,isMyTurn:f,onDraw:K,busy:k})})]})})',
);

apply(
  'wild-color-toast-v18',
  'g&&I.jsx(mk,{onPick:W,busy:k})',
  'g&&I.jsx(mk,{onPick:ne=>{W(ne);M0st("🎨 Color activo: "+M0colorLbl(ne),"success")},busy:k})',
);

apply(
  'wild-color-fx-v18',
  'const[M0fx,setM0fx]=ie.useState(null);const M0fxT=ie.useRef(0);ie.useEffect(()=>{if(!o||o.status!=="playing")return;const td=o.topDiscard,v=td==null?void 0:td.value;let msg=null;v==="skip"?msg="⏭️ SALTO":v==="reverse"?msg="🔄 REVERSO":v==="draw2"?msg="➕ DOS CARTAS":v==="wild4"?msg="🌈 +4":v==="wild"?msg="★ COMODÍN":null;if(msg&&Date.now()-M0fxT.current>400){M0fxT.current=Date.now(),setM0fx(msg),setTimeout(()=>setM0fx(null),850)}},[o==null?void 0:o.topDiscard,o==null?void 0:o.turn,o==null?void 0:o.status]);',
  'const[M0fx,setM0fx]=ie.useState(null);const M0fxT=ie.useRef(0);const M0clrRef=ie.useRef(null);ie.useEffect(()=>{if(!o||o.status!=="playing")return;const td=o.topDiscard,v=td==null?void 0:td.value;let msg=null;v==="skip"?msg="⏭️ SALTO":v==="reverse"?msg="🔄 REVERSO":v==="draw2"?msg="➕ DOS CARTAS":v==="wild4"?msg="🌈 +4":v==="wild"?msg="★ COMODÍN":null;if(msg&&Date.now()-M0fxT.current>400){M0fxT.current=Date.now(),setM0fx(msg),setTimeout(()=>setM0fx(null),700)}},[o==null?void 0:o.topDiscard,o==null?void 0:o.turn,o==null?void 0:o.status]);ie.useEffect(()=>{if(!o||!o.chosenColor)return;const c=o.chosenColor,td=o.topDiscard;if(c===M0clrRef.current)return;if(td&&(td.color==="wild"||td.value==="wild"||td.value==="wild4")){const lbl=M0colorLbl(c);M0st("🎨 Cambió a color "+lbl,"success"),setM0fx("🎨 "+lbl.toUpperCase()),setTimeout(()=>setM0fx(null),1100)}M0clrRef.current=c},[o==null?void 0:o.chosenColor,o==null?void 0:o.topDiscard,M0st]);',
);

apply(
  'speed-card-play-v18',
  'setTimeout(()=>h(T=>T===_?null:T),350)',
  'setTimeout(()=>h(T=>T===_?null:T),250)',
);

apply(
  'mk-labels-friendly-v18',
  'children:"Elegí el color activo"',
  'children:"Elegí el color activo (ej. Azul, Rosa…)"',
);

fs.writeFileSync(bundlePath, s);
console.log('Gameplay UX v18 applied.');
