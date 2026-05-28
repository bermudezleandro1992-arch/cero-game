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

// React error #300: hooks after early return in Ik() when entering match (Continuar / profile tab)
apply(
  'ik-hooks-before-early-return',
  '},[r.uid]);if(S)return I.jsx(M0T,{matchId:S,onExit:()=>O(null)});',
  '},[r.uid]);const[M0lazy,setM0lazy]=ie.useState({home:!0});ie.useEffect(()=>{setM0lazy(v=>({...v,[t]:!0}))},[t]);if(S)return I.jsx(M0T,{matchId:S,onExit:()=>O(null)});',
);

apply(
  'ik-remove-duplicate-m0lazy',
  'const[M0lazy,setM0lazy]=ie.useState({home:!0});ie.useEffect(()=>{setM0lazy(v=>({...v,[t]:!0}))},[t]);const g={home:',
  'const g={home:',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-hooks-fix-v27.js done');
