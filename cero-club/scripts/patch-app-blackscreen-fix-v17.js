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

// v14 usó tl.classic pero tl solo tiene blue|magenta|gold|green|wild — crashea el lobby
apply(
  'fix-tl-classic-crash-v17',
  'style:{background:tl.classic.bg,color:tl.classic.ink},children:"CERO Clásico"',
  'style:{background:tl.blue.bg,color:tl.blue.ink},children:"CERO Clásico"',
);

fs.writeFileSync(bundlePath, s);
console.log('Black screen fix v17 applied.');
