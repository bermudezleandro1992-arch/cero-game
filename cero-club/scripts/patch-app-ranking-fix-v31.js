#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 320));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

// Firestore INTERNAL ASSERTION (direction "=="): composite query anon+orderBy rompe el SDK.
// Volvemos a query simple + filtro client-side (como pre-v19).
apply(
  'ranking-query-no-composite',
  'const W=jf(za(br,"users"),zf("anon","==",!1),zf(fld,"desc"),p0(100));return Co(W,ne=>{const J=ne.docs.map(le=>({uid:le.id,displayName:le.data().displayName??"Jugador",weeklyWins:le.data().weeklyWins??0,monthlyWins:le.data().monthlyWins??0,equippedFrame:le.data().equippedFrame??null,countryCode:le.data().countryCode??null,vipActive:((le.data().vip)==null?void 0:le.data().vip.active)===!0,photoURL:le.data().photoURL??null,playRatingSum:le.data().playRatingSum??0,playRatingCount:le.data().playRatingCount??0}));s(J);',
  'const W=jf(za(br,"users"),zf(fld,"desc"),p0(100));return Co(W,ne=>{try{const J=ne.docs.filter(le=>le.data().anon!==true).map(le=>({uid:le.id,displayName:le.data().displayName??"Jugador",weeklyWins:le.data().weeklyWins??0,monthlyWins:le.data().monthlyWins??0,equippedFrame:le.data().equippedFrame??null,countryCode:le.data().countryCode??null,vipActive:((le.data().vip)==null?void 0:le.data().vip.active)===!0,photoURL:le.data().photoURL??null,playRatingSum:le.data().playRatingSum??0,playRatingCount:le.data().playRatingCount??0}));s(J);',
);

apply(
  'ranking-snapshot-try-catch',
  'const ee=J.findIndex(le=>le.uid===r);f(ee>=0?ee+1:null),l(!1)},ne=>{e("Error cargando el ranking: "+ne.message,"error"),l(!1)})},[r,e,tab,JCg]);',
  'const ee=J.findIndex(le=>le.uid===r);f(ee>=0?ee+1:null),l(!1)}catch(ex){e("Error cargando el ranking: "+(ex.message||ex),"error"),l(!1)}},ne=>{e("Error cargando el ranking: "+ne.message,"error"),l(!1)})},[r,e,tab,JCg]);',
);

// M0VkErr decía "No se pudo cargar la partida" y dejaba Firestore corrupto al cambiar tabs
apply(
  'remove-ranking-vkerr-wrapper',
  'ranking:I.jsx(M0VkErr,{onExit:()=>s("home"),children:I.jsx(jC,{currentUid:r.uid,isGuest:r.isAnonymous===true})})',
  'ranking:I.jsx(jC,{currentUid:r.uid,isGuest:r.isAnonymous===true})',
);

// Perfil: listener sin cleanup → leaks + pantalla negra al cambiar tabs
apply(
  'profile-listener-cleanup',
  'ie.useEffect(()=>{(async()=>{try{await or(ur,"initUserProfile")({})}catch{}Co(Ba(br,"users",r),le=>{le.exists()&&s(le.data()),l(!1)},le=>{e("Error cargando perfil: "+le.message,"error"),l(!1)})})()},[r,e]);',
  'ie.useEffect(()=>{let unsub=null;(async()=>{try{await or(ur,"initUserProfile")({})}catch{}unsub=Co(Ba(br,"users",r),le=>{le.exists()&&s(le.data()),l(!1)},le=>{e("Error cargando perfil: "+le.message,"error"),l(!1)})})();return()=>{unsub&&unsub()}},[r,e]);',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-ranking-fix-v31.js done');
