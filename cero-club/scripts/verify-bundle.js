#!/usr/bin/env node
'use strict';
/** Valida sintaxis del bundle antes de deploy. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bundle = path.join(__dirname, '../app/assets/index-CEoU91fI.js');
try {
  execSync(`node --check "${bundle}"`, { stdio: 'pipe' });
  console.log('Bundle syntax OK');
} catch (e) {
  console.error('BUNDLE SYNTAX ERROR — no desplegar hasta corregir');
  console.error(String(e.stderr || e.stdout || e.message));
  process.exit(1);
}

const s = fs.readFileSync(bundle, 'utf8');
const dup = [...s.matchAll(/let (M0\w+)=null/g)].map(m => m[1])
  .reduce((a, x) => { a[x] = (a[x] || 0) + 1; return a; }, {});
const bad = Object.entries(dup).filter(([, c]) => c > 1);
if (bad.length) {
  console.error('Duplicate M0 declarations:', bad.map(([k, c]) => `${k}×${c}`).join(', '));
  process.exit(1);
}
console.log('No duplicate M0 declarations');
