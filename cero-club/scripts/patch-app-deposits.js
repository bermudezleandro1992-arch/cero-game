#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (to && s.includes(to.slice(0, Math.min(60, to.length)))) {
    console.log(`SKIP: ${name}`);
    return;
  }
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

if (!s.includes('M0O=')) {
  apply(
    'deposit-callables',
    'async function M0N(r){return Rc(M0F(),r)}\nconst tl=',
    `async function M0N(r){return Rc(M0F(),r)}
let M0O=null,M0P=null;
function M0Q(){return M0O??(M0O=or(ur,"getDepositMethods"))}
function M0R(){return M0P??(M0P=or(ur,"submitDepositRequest"))}
async function M0S2(){return Rc(M0Q(),{})}
async function M0T2(r){return Rc(M0R(),r)}
function M0U(){let i=localStorage.getItem("cero_device_id");if(!i){i=Math.random().toString(36).slice(2)+Date.now().toString(36);try{localStorage.setItem("cero_device_id",i)}catch{}}return{deviceId:i,userAgent:navigator.userAgent,platform:navigator.platform,os:navigator.userAgent,deviceType:/Mobi|Android/i.test(navigator.userAgent)?"mobile":"desktop",screen:typeof screen!=="undefined"?screen.width+"x"+screen.height:"",language:navigator.language,timezone:typeof Intl!=="undefined"?Intl.DateTimeFormat().resolvedOptions().timeZone:"",isMobile:/Mobi|Android/i.test(navigator.userAgent),hardwareConcurrency:navigator.hardwareConcurrency||0,deviceMemory:navigator.deviceMemory||0}}
const tl=`,
  );
}

const depositUiFn = 'function M0Dep({showToast:r}){const[e,t]=ie.useState([]),[s,o]=ie.useState(null),[l,h]=ie.useState("500"),[f,g]=ie.useState(null),[_,w]=ie.useState(!1),[T,k]=ie.useState(!1);ie.useEffect(()=>{M0S2().then(x=>t(x.methods||[])).catch(()=>{})},[]);async function F(x){const C=x.target.files&&x.target.files[0];if(!C)return;if(C.size>850000){r("Archivo muy grande (max 800KB)","error");return}const D=new FileReader;D.onload=()=>g({dataUrl:D.result,name:C.name,mime:C.type}),D.readAsDataURL(C)}async function K(){if(!s||!f)return;k(!0);try{await M0T2({methodId:s.id,coinsRequested:parseInt(l,10),amountPaid:parseInt(l,10),currency:s.currency,receiptBase64:f.dataUrl,receiptName:f.name,device:M0U()}),r("Comprobante enviado. Revision manual 24-48h.","success"),o(null),g(null)}catch(x){r((x==null?void 0:x.message)||"Error","error")}finally{k(!1)}}return I.jsxs("div",{className:"w-full max-w-md flex flex-col gap-4",children:[I.jsx("p",{className:"text-xs text-violet-400 text-center",children:"Transferi y subi comprobante (JPG, PNG o PDF). Sin comprobante no se acredita."}),I.jsx("div",{className:"flex flex-col gap-2",children:e.map(x=>I.jsxs("button",{type:"button",disabled:!x.enabled,onClick:()=>!x.comingSoon&&x.manualReview&&o(x),className:"text-left px-4 py-3 rounded-xl border "+(s&&s.id===x.id?"border-emerald-500 bg-emerald-950/30":"border-violet-800/50 bg-violet-950/20")+" "+(x.enabled?"":"opacity-40"),children:[I.jsxs("div",{className:"flex justify-between items-center",children:[I.jsx("span",{className:"text-sm font-bold text-white",children:x.label}),I.jsx("span",{className:"text-[0.6rem] px-2 py-0.5 rounded-full bg-violet-800 text-violet-200",children:x.currency})]}),I.jsx("p",{className:"text-[0.65rem] text-violet-500 mt-1",children:x.comingSoon?"Proximamente":x.subtitle}),x.destination&&I.jsxs("p",{className:"text-xs text-amber-400 font-mono mt-1",children:["Destino: ",x.destination]})]},x.id))}),s&&I.jsxs(I.Fragment,{children:[I.jsx("input",{type:"number",value:l,onChange:x=>h(x.target.value),className:"w-full px-3 py-2 rounded-xl bg-black/30 border border-violet-800 text-white text-sm",placeholder:"CN solicitados (100+)"}),I.jsx("input",{type:"file",accept:"image/jpeg,image/png,image/webp,application/pdf",onChange:F,className:"text-xs text-violet-400"}),f&&I.jsx("p",{className:"text-xs text-emerald-400",children:"Listo: "+f.name}),I.jsx("button",{type:"button",disabled:T||!f,onClick:K,className:"w-full py-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50",children:T?"Enviando...":"Enviar comprobante"})]}),I.jsx("p",{className:"text-[0.6rem] text-violet-600 text-center",children:"Binance y PayPal proximamente. Mercado Pago = tab Cero Coins."})]})}';

if (!s.includes('function M0Dep(')) {
  s = s.replace('function KC({userId:r})', depositUiFn + 'function KC({userId:r})');
  console.log('OK: deposit-ui-fn');
}

const oldKc = 'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("coins"),[o,l]=ie.useState(!1);async function h(f){l(!0);try{const g=await M0J({packageId:f,region:"AR"});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error al iniciar pago","error")}finally{l(!1)}}async function _(f){l(!0);try{const g=await M0K({planId:f});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error VIP","error")}finally{l(!1)}}return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-6 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"}),I.jsxs("div",{className:"flex gap-2",children:[I.jsx("button",{type:"button",onClick:()=>s("coins"),className:"px-4 py-2 rounded-xl text-sm font-bold "+(t==="coins"?"bg-violet-600 text-white":"text-violet-400 border border-violet-800"),children:"Cero Coins"}),I.jsx("button",{type:"button",onClick:()=>s("vip"),className:"px-4 py-2 rounded-xl text-sm font-bold "+(t==="vip"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"Pase VIP"})]}),t==="coins"?I.jsx("div",{className:"grid grid-cols-2 gap-3 w-full max-w-md",children:qC.map(f=>I.jsx(WC,{pkg:f,onBuy:h,busy:o},f.id))}):I.jsx("div",{className:"flex flex-col gap-4 w-full max-w-md",children:HC.map(f=>I.jsx(GC,{plan:f,onBuy:_,busy:o},f.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-600 text-center max-w-sm",children:"Pagos seguros vía Mercado Pago · ARS / UYU / USD"})]})}';

const newKc = 'function KC({userId:r}){const{showToast:e}=Oo(),[t,s]=ie.useState("coins"),[o,l]=ie.useState(!1);async function h(f){l(!0);try{const g=await M0J({packageId:f,region:"AR"});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error al iniciar pago","error")}finally{l(!1)}}async function _(f){l(!0);try{const g=await M0K({planId:f});window.location.href=g.checkoutUrl}catch(g){e((g==null?void 0:g.message)||"Error VIP","error")}finally{l(!1)}}return I.jsxs("div",{className:"min-h-screen px-4 py-8 flex flex-col gap-6 items-center",style:{background:"radial-gradient(ellipse at 50% 20%, #1a0836 0%, #04030d 65%)"},children:[I.jsx("h1",{className:"text-2xl font-black text-white",children:"Tienda"}),I.jsxs("div",{className:"flex gap-2 flex-wrap justify-center",children:[I.jsx("button",{type:"button",onClick:()=>s("coins"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="coins"?"bg-violet-600 text-white":"text-violet-400 border border-violet-800"),children:"MP auto"}),I.jsx("button",{type:"button",onClick:()=>s("deposit"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="deposit"?"bg-emerald-600 text-white":"text-violet-400 border border-violet-800"),children:"Depositar"}),I.jsx("button",{type:"button",onClick:()=>s("vip"),className:"px-3 py-2 rounded-xl text-xs font-bold "+(t==="vip"?"bg-amber-600 text-white":"text-violet-400 border border-violet-800"),children:"VIP"})]}),t==="coins"?I.jsx("div",{className:"grid grid-cols-2 gap-3 w-full max-w-md",children:qC.map(f=>I.jsx(WC,{pkg:f,onBuy:h,busy:o},f.id))}):t==="deposit"?I.jsx(M0Dep,{showToast:e}):I.jsx("div",{className:"flex flex-col gap-4 w-full max-w-md",children:HC.map(f=>I.jsx(GC,{plan:f,onBuy:_,busy:o},f.id))}),I.jsx("p",{className:"text-[0.65rem] text-violet-600 text-center max-w-sm",children:"Deposito manual con comprobante o Mercado Pago automatico"})]})}';

if (s.includes(oldKc)) {
  s = s.replace(oldKc, newKc);
  console.log('OK: kc-deposit-tab');
}

apply(
  'ranking-top3-prizes',
  'const By={1:500,2:300,3:200,4:75',
  'const By={1:1000,2:600,3:400,4:75',
);

fs.writeFileSync(bundlePath, s);
console.log('Deposits bundle patched.');
