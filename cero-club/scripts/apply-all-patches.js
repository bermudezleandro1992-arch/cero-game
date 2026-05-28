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
  'patch-app-gameplay-fixes-v7.js',
  'patch-app-profile-lobby-v8.js',
  'patch-app-profile-admin-v9.js',
  'patch-app-gameplay-fixes-v10.js',
  'patch-app-full-v11.js',
  'patch-app-rooms-economy-v12.js',
  'patch-app-quickmatch-fix-v13.js',
  'patch-app-lobby-ux-v14.js',
  'patch-app-mundial-v15.js',
];

for (const p of patches) {
  console.log('\n---', p, '---');
  execSync(`node "${path.join(dir, p)}"`, { stdio: 'inherit' });
}

execSync(`node "${path.join(dir, 'verify-bundle.js')}"`, { stdio: 'inherit' });
console.log('\nAll patches applied and verified.');
