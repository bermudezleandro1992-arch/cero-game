#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const dir = path.join(__dirname);
const patches = [
  'patch-app-gameplay-layout.js',
  'patch-app-cosmetics-v2.js',
  'patch-app-roadmap-v3.js',
  'patch-app-roadmap-v4.js',
  'patch-app-roadmap-v5.js',
  'patch-app-scroll-fix-v6.js',
];

for (const p of patches) {
  console.log('\n---', p, '---');
  execSync(`node "${path.join(dir, p)}"`, { stdio: 'inherit' });
}

execSync(`node "${path.join(dir, 'verify-bundle.js')}"`, { stdio: 'inherit' });
console.log('\nAll patches applied and verified.');
