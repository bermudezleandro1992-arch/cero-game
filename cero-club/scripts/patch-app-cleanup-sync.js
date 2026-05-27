#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
let s = fs.readFileSync(bundlePath, 'utf8');

function apply(name, from, to) {
  if (!s.includes(from)) {
    console.error(`PATCH FAILED: ${name}`);
    console.error('Missing:', from.slice(0, 240));
    process.exit(1);
  }
  s = s.replace(from, to);
  console.log(`OK: ${name}`);
}

apply(
  'ik-cleanup-apply-result',
  'ie.useEffect(()=>{(async()=>{try{await M0CleanupRun()}catch{}try{const _=await M0l({});if(_.available)N(_)}catch{}})()},[]),',
  'ie.useEffect(()=>{(async()=>{try{const c=await M0CleanupRun();if(!c.activeMatch){N(null);try{sessionStorage.removeItem("cero_active_match")}catch{}}}catch{}try{const _=await M0l({});if(_.available)N(_);else N(null)}catch{}})()},[]),',
);

fs.writeFileSync(bundlePath, s);
console.log('patch-app-cleanup-sync.js done');
