#!/usr/bin/env node
'use strict';
/** Genera cartas rojas cyberpunk (SVG). Reemplazá por PNG en app/cards/red/ si tenés los assets finales. */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../app/cards/red');
fs.mkdirSync(dir, { recursive: true });

function cardSvg(label, sub) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 168" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="120" y2="168">
      <stop offset="0%" stop-color="#1a0508"/>
      <stop offset="100%" stop-color="#050204"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="120" height="168" rx="10" fill="url(#bg)" stroke="#ef4444" stroke-width="2"/>
  <circle cx="60" cy="84" r="42" stroke="#ef444455" stroke-width="1" fill="none"/>
  <circle cx="60" cy="84" r="28" stroke="#ef444433" stroke-width="1" fill="none"/>
  <text x="60" y="${sub ? 78 : 92}" text-anchor="middle" fill="#ef4444" font-family="system-ui,sans-serif" font-size="${sub ? 36 : 48}" font-weight="900" filter="url(#glow)">${label}</text>
  ${sub ? `<text x="60" y="108" text-anchor="middle" fill="#f87171" font-family="system-ui,sans-serif" font-size="22" font-weight="800">${sub}</text>` : ''}
  <text x="60" y="152" text-anchor="middle" fill="#fca5a5" font-family="system-ui,sans-serif" font-size="11" font-weight="800" letter-spacing="3">CERO</text>
</svg>`;
}

for (let n = 0; n <= 9; n++) {
  fs.writeFileSync(path.join(dir, `${n}.svg`), cardSvg(String(n), ''));
}
fs.writeFileSync(path.join(dir, 'plus2.svg'), cardSvg('+', '2'));
fs.writeFileSync(path.join(dir, 'plus4.svg'), cardSvg('+', '4'));
fs.writeFileSync(path.join(dir, 'plus1.svg'), cardSvg('+', '1'));
console.log('Red card SVGs written to app/cards/red/');
