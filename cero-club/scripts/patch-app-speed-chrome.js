#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 140));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// ── Chrome mobile: localStorage antes que IndexedDB (evita cuelgue auth) ───────
apply(
  'auth-persistence-order',
  'persistence:[TI,cI,R_]',
  'persistence:[cI,TI,R_]',
);

// ── Boot con timeout + pantalla de recuperación ───────────────────────────────
const newXk = `function M0recoverBoot(){try{const e=[];for(let t=0;t<localStorage.length;t++){const n=localStorage.key(t);n&&n.indexOf("firebase:")===0&&e.push(n)}e.forEach(t=>localStorage.removeItem(t)),typeof indexedDB<"u"&&indexedDB.databases&&indexedDB.databases().then(t=>(t||[]).forEach(n=>{n.name&&(n.name.indexOf("firebase")>=0||n.name.indexOf("firestore")>=0)&&indexedDB.deleteDatabase(n.name)}))}catch{}location.reload()}
function xk(){const[r,e]=ie.useState(null),[t,s]=ie.useState(!0),[o,l]=ie.useState(!1);return ie.useEffect(()=>{let h=null,f=setTimeout(()=>l(!0),1e4);const g=oI(Xn,async _=>{clearTimeout(f),l(!1),h&&(clearInterval(h),h=null);if(!_){window.location.replace("/login.html");return}try{await Promise.race([or(ur,"initUserProfile")({}),new Promise((w,T)=>setTimeout(()=>T(new Error("timeout")),8e3))])}catch{}const w=async()=>{try{await dC(Ba(br,"presence",_.uid),{displayName:_.displayName||_.email||"Jugador",lastSeen:$d(),game:"cero_app"},{merge:!0})}catch{}};await w(),h=setInterval(w,45e3),e(_),s(!1),typeof window.__ceroClearBootTimer=="function"&&window.__ceroClearBootTimer()});return()=>{g(),h&&clearInterval(h),clearTimeout(f)}},[]),o?I.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center",style:{background:"#04030d",fontFamily:"'Space Grotesk', sans-serif"},children:[I.jsx("p",{className:"text-4xl",children:"⚠️"}),I.jsx("p",{className:"text-white font-bold text-lg",children:"La app tardó en cargar"}),I.jsx("p",{className:"text-violet-400 text-sm max-w-xs",children:"En Chrome a veces pasa por caché vieja. Tocá limpiar y reintentar."}),I.jsx("button",{type:"button",onClick:M0recoverBoot,className:"px-6 py-3 rounded-xl bg-violet-600 text-white font-bold",children:"Limpiar caché y reintentar"}),I.jsx("button",{type:"button",onClick:()=>location.reload(),className:"text-violet-500 text-sm underline",children:"Solo recargar"})]}):t||!r?I.jsx(Sk,{}):I.jsx(_C,{children:I.jsx(Ik,{user:r})})}`;

apply(
  'boot-chrome-recovery',
  'function xk(){const[r,e]=ie.useState(null),[t,s]=ie.useState(!0);return ie.useEffect(()=>{let h=null;const f=oI(Xn,async l=>{if(h&&(clearInterval(h),h=null),!l){window.location.replace("/login.html");return}try{await or(ur,"initUserProfile")({})}catch{}const g=async()=>{try{await dC(Ba(br,"presence",l.uid),{displayName:l.displayName||l.email||"Jugador",lastSeen:$d(),game:"cero_app"},{merge:!0})}catch{}};await g(),h=setInterval(g,45e3),e(l),s(!1)});return()=>{f(),h&&clearInterval(h)}},[]),t||!r?I.jsx(Sk,{}):I.jsx(_C,{children:I.jsx(Ik,{user:r})})}',
  newXk,
);

// ── Tutorial v2: más pasos + mano en cada zona ────────────────────────────────
const oldTutorial = s.match(/function M0Tutorial\(\{onDone:r\}\)\{[^]*?\}\s*function hk\(/);
if (!oldTutorial) {
  console.error('PATCH FAILED: M0Tutorial block not found');
  process.exit(1);
}

const newTutorial = `function M0Tutorial({onDone:r}){const[e,t]=ie.useState(0),s=[{t:"¡Bienvenido a CERO Club! En 30 segundos aprendés lo esencial.",h:null},{t:"Las cartas con brillo verde las podés jugar. Tocá una.",h:{left:"50%",bottom:"14%",transform:"translateX(-50%)"}},{t:"¿Ninguna te sirve? Tocá el MAZO para robar.",h:{left:"30%",bottom:"42%"}},{t:"Carta Salto ⏭: saltás el turno del rival.",h:{left:"50%",bottom:"50%",transform:"translateX(-50%)"}},{t:"Reverso ↺: invierte el sentido del juego.",h:{left:"50%",bottom:"50%",transform:"translateX(-50%)"}},{t:"+2 / +4: el rival roba cartas (vos elegís color en +4).",h:{left:"50%",bottom:"50%",transform:"translateX(-50%)"}},{t:"Comodín 🎨: elegís el color activo.",h:{left:"50%",bottom:"50%",transform:"translateX(-50%)"}},{t:"Con 1 carta declará ¡CERO! antes de jugar la última.",h:{left:"50%",bottom:"22%",transform:"translateX(-50%)"}},{t:"Con 2 cartas aparece el botón CERO grande — usalo al tirar una.",h:{left:"50%",bottom:"22%",transform:"translateX(-50%)"}},{t:"Chat 💬 abajo a la derecha: escribí o mandá emojis (¡tortas!).",h:{right:"12%",bottom:"22%"}},{t:"¡Listo! A ganar Cero Coins. Podés repetir esto desde Perfil.",h:null}],o=s[e],l=o==null?void 0:o.h,h=()=>{try{localStorage.setItem("cero_tutorial_v2","1")}catch{}r()};return I.jsxs("div",{className:"fixed inset-0 z-[55] flex items-end justify-center pb-28 px-4",style:{background:"rgba(0,0,0,.6)"},children:[l&&I.jsx("span",{className:"fixed text-5xl animate-bounce pointer-events-none z-[56]",style:l,children:"👆"}),I.jsxs("div",{className:"max-w-sm w-full p-5 rounded-2xl border border-violet-500 bg-[#12082a]/95 text-center relative z-[57]",children:[I.jsxs("p",{className:"text-[0.65rem] text-violet-500 mb-2",children:["Paso ",e+1,"/",s.length]}),I.jsx("p",{className:"text-white text-sm font-semibold mb-4 min-h-[3rem] flex items-center justify-center",children:o.t}),I.jsxs("div",{className:"flex gap-2 justify-center",children:[I.jsx("button",{type:"button",onClick:h,className:"px-4 py-2 text-xs text-violet-400",children:"Saltar"}),I.jsx("button",{type:"button",onClick:()=>{e>=s.length-1?h():t(e+1)},className:"px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold",children:e>=s.length-1?"¡A jugar!":"Siguiente"})]})]})]})}
function hk(`;

s = s.replace(oldTutorial[0], newTutorial);
console.log('OK: tutorial-v2-expanded');

s = s.split('localStorage.getItem("cero_tutorial_v1")').join('localStorage.getItem("cero_tutorial_v2")');
s = s.split('localStorage.setItem("cero_tutorial_v1","1")').join('localStorage.setItem("cero_tutorial_v2","1")');
console.log('OK: tutorial-key-v2');

// ── Velocidad UI ──────────────────────────────────────────────────────────────
apply(
  'speed-card-transition',
  'transition:"all 0.12s ease"',
  'transition:"all 0.08s ease"',
);

apply(
  'speed-shake',
  'setTimeout(()=>h(T=>T===_?null:T),600)',
  'setTimeout(()=>h(T=>T===_?null:T),350)',
);

apply(
  'speed-toast',
  'const s=setTimeout(e,3500)',
  'const s=setTimeout(e,2200)',
);

apply(
  'speed-projectile',
  'duration-[850ms]',
  'duration-[600ms]',
);

apply(
  'speed-rejoin-poll',
  'M0s(r).catch(()=>{})},15e3)',
  'M0s(r).catch(()=>{})},12e3)',
);

fs.writeFileSync(bundlePath, s);
console.log('Speed + Chrome patch applied.');
