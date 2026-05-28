#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../app/cards');
fs.mkdirSync(OUT, { recursive: true });

const COLORS = {
  magenta: { name: 'Rojo', hex: '#ef4444', glow: '#fca5a5', label: 'REVERSE' },
  gold: { name: 'Amarillo', hex: '#f59e0b', glow: '#fcd34d', label: 'REVERSE' },
  blue: { name: 'Azul', hex: '#3b82f6', glow: '#93c5fd', label: 'REVERSE' },
  green: { name: 'Verde', hex: '#22c55e', glow: '#86efac', label: 'REVERSE' },
};

function frame(color, glow) {
  return `
  <rect x="4" y="4" width="152" height="216" rx="14" fill="#06050f" stroke="${color}" stroke-width="3"/>
  <rect x="10" y="10" width="140" height="204" rx="10" fill="none" stroke="${glow}" stroke-width="1.5" opacity="0.55"/>
  <path d="M4 28 H28 V4" fill="none" stroke="${color}" stroke-width="2"/>
  <path d="M156 28 H132 V4" fill="none" stroke="${color}" stroke-width="2"/>
  <path d="M4 196 H28 V220" fill="none" stroke="${color}" stroke-width="2"/>
  <path d="M156 196 H132 V220" fill="none" stroke="${color}" stroke-width="2"/>`;
}

function circuitBg() {
  return `
  <g opacity="0.18" stroke="#7c3aed" stroke-width="1">
    <path d="M20 40 H60 M100 40 H140 M20 180 H50 M110 180 H140"/>
    <path d="M40 20 V60 M120 20 V55 M35 160 V200 M125 165 V200"/>
    <circle cx="80" cy="110" r="28" fill="none"/>
  </g>`;
}

function brand() {
  return `<text x="80" y="205" text-anchor="middle" fill="#c4b5fd" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3">CERO</text>`;
}

function reverseSvg(hex, glow) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  ${frame(hex, glow)}${circuitBg()}
  <text x="80" y="28" text-anchor="middle" fill="${glow}" font-family="Arial,sans-serif" font-size="11" font-weight="800" letter-spacing="1">REVERSE</text>
  <g transform="translate(80 105)">
    <path d="M-34 0 A34 34 0 1 1 34 0" fill="none" stroke="${hex}" stroke-width="7" stroke-linecap="round"/>
    <path d="M34 0 A34 34 0 1 1 -34 0" fill="none" stroke="${glow}" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
    <polygon points="34,-8 48,0 34,8" fill="${hex}"/>
    <polygon points="-34,8 -48,0 -34,-8" fill="${glow}"/>
  </g>
  <text x="18" y="42" fill="${hex}" font-size="16">⇄</text>
  <text x="142" y="198" fill="${hex}" font-size="16" transform="rotate(180 142 198)">⇄</text>
  ${brand()}
</svg>`;
}

function skipSvg(hex, glow) {
  const icon = hex === '#ef4444'
    ? `<polygon points="80,58 104,98 56,98" fill="none" stroke="${hex}" stroke-width="5"/><rect x="62" y="72" width="36" height="22" rx="2" fill="${hex}" opacity="0.25"/>`
    : `<circle cx="80" cy="88" r="34" fill="none" stroke="${hex}" stroke-width="6"/><line x1="58" y1="66" x2="102" y2="110" stroke="${glow}" stroke-width="6" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  ${frame(hex, glow)}${circuitBg()}
  <text x="80" y="24" text-anchor="middle" fill="${glow}" font-family="Arial,sans-serif" font-size="10" font-weight="800" letter-spacing="0.5">BLOCK / SKIP</text>
  ${icon}
  <text x="18" y="42" fill="${hex}" font-size="14">⊘</text>
  <text x="142" y="198" fill="${hex}" font-size="14" transform="rotate(180 142 198)">⊘</text>
  ${brand()}
</svg>`;
}

function draw2Svg(hex, glow) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  ${frame(hex, glow)}${circuitBg()}
  <text x="80" y="28" text-anchor="middle" fill="${glow}" font-family="Arial,sans-serif" font-size="12" font-weight="800">+2</text>
  <text x="80" y="112" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="52" font-weight="900" filter="url(#g)">+2</text>
  <defs><filter id="g"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${hex}"/></filter></defs>
  ${brand()}
</svg>`;
}

function wildSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  <defs>
    <linearGradient id="wb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="152" height="216" rx="14" fill="url(#wb)" stroke="#a78bfa" stroke-width="3"/>
  <rect x="10" y="10" width="140" height="204" rx="10" fill="none" stroke="#c4b5fd" stroke-width="1.5" opacity="0.5"/>
  <text x="80" y="24" text-anchor="middle" fill="#e9d5ff" font-family="Arial,sans-serif" font-size="9" font-weight="800">WILD CHANGE COLOR</text>
  <ellipse cx="80" cy="100" rx="46" ry="34" fill="#111827" stroke="#fff" stroke-width="2"/>
  <rect x="56" y="82" width="24" height="18" fill="#ef4444"/>
  <rect x="80" y="82" width="24" height="18" fill="#22c55e"/>
  <rect x="56" y="100" width="24" height="18" fill="#f59e0b"/>
  <rect x="80" y="100" width="24" height="18" fill="#3b82f6"/>
  ${brand()}
</svg>`;
}

function wild2Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  <defs>
    <radialGradient id="w2" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#0f172a"/>
    </radialGradient>
  </defs>
  <rect x="4" y="4" width="152" height="216" rx="14" fill="url(#w2)" stroke="#c084fc" stroke-width="3"/>
  <text x="80" y="24" text-anchor="middle" fill="#e9d5ff" font-family="Arial,sans-serif" font-size="9" font-weight="800">WILD DRAW TWO</text>
  <text x="80" y="108" text-anchor="middle" fill="#fff" font-size="54" font-weight="900">+2</text>
  <ellipse cx="62" cy="138" rx="14" ry="10" fill="#ef4444" opacity="0.9"/>
  <ellipse cx="98" cy="138" rx="14" ry="10" fill="#3b82f6" opacity="0.9"/>
  ${brand()}
</svg>`;
}

function wild4Svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  <defs>
    <radialGradient id="w4" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#db2777"/><stop offset="40%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#0f172a"/>
    </radialGradient>
  </defs>
  <rect x="4" y="4" width="152" height="216" rx="14" fill="url(#w4)" stroke="#f472b6" stroke-width="3"/>
  <text x="80" y="24" text-anchor="middle" fill="#fce7f3" font-family="Arial,sans-serif" font-size="9" font-weight="800">WILD DRAW FOUR</text>
  <text x="80" y="112" text-anchor="middle" fill="#fff" font-size="54" font-weight="900">+4</text>
  ${brand()}
</svg>`;
}

function backSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 224" width="160" height="224">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0836"/><stop offset="100%" stop-color="#04030d"/>
    </linearGradient>
  </defs>
  <rect width="160" height="224" rx="14" fill="url(#bg)" stroke="#7c3aed" stroke-width="3"/>
  <g opacity="0.25" stroke="#a78bfa" stroke-width="1">
    <path d="M10 30 H150 M10 60 H150 M10 90 H150 M10 120 H150 M10 150 H150 M10 180 H150"/>
    <path d="M30 10 V214 M60 10 V214 M90 10 V214 M120 10 V214"/>
  </g>
  <circle cx="80" cy="100" r="36" fill="none" stroke="#7c3aed" stroke-width="2"/>
  <text x="80" y="108" text-anchor="middle" fill="#e9d5ff" font-family="Arial,sans-serif" font-size="22" font-weight="900" letter-spacing="4">CERO</text>
</svg>`;
}

for (const [id, c] of Object.entries(COLORS)) {
  fs.writeFileSync(path.join(OUT, `reverse-${id}.svg`), reverseSvg(c.hex, c.glow));
  fs.writeFileSync(path.join(OUT, `skip-${id}.svg`), skipSvg(c.hex, c.glow));
  fs.writeFileSync(path.join(OUT, `draw2-${id}.svg`), draw2Svg(c.hex, c.glow));
}

fs.writeFileSync(path.join(OUT, 'wild.svg'), wildSvg());
fs.writeFileSync(path.join(OUT, 'wild2.svg'), wild2Svg());
fs.writeFileSync(path.join(OUT, 'wild4.svg'), wild4Svg());
fs.writeFileSync(path.join(OUT, 'classic-back.svg'), backSvg());

console.log('Generated', fs.readdirSync(OUT).length, 'card assets in', OUT);
