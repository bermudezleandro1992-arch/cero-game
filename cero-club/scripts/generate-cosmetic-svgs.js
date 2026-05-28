#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../app/cosmetics');

const ITEMS = {
  'skins/neon.svg':    { bg: '#1f0824', accent: '#e879f9', label: 'NEON' },
  'skins/gold.svg':    { bg: '#1f1004', accent: '#f59e0b', label: 'GOLD' },
  'skins/galaxy.svg':  { bg: '#0e0524', accent: '#818cf8', label: '★' },
  'skins/minimal.svg': { bg: '#0c0c12', accent: '#ffffff', label: '—' },
  'frames/fire.svg':   { bg: '#1f0a04', accent: '#f97316', label: '🔥' },
  'frames/ice.svg':    { bg: '#041424', accent: '#60a5fa', label: '❄' },
  'frames/gold.svg':   { bg: '#1f1004', accent: '#fbbf24', label: '👑' },
  'frames/champ.svg':  { bg: '#1a0836', accent: '#fde68a', label: '🏆' },
  'tables/neon.svg':   { bg: '#1c0f3a', accent: '#7c3aed', label: 'MESA' },
  'tables/marble.svg': { bg: '#2a2830', accent: '#d4d4d8', label: 'MESA' },
  'tables/carbon.svg': { bg: '#121218', accent: '#71717a', label: 'MESA' },
  'rooms/stadium.svg': { bg: '#1a5030', accent: '#4ade80', label: '🏟' },
  'rooms/beach.svg':   { bg: '#2a6090', accent: '#60a5fa', label: '🏖' },
  'rooms/city.svg':    { bg: '#3a1860', accent: '#a78bfa', label: '🌃' },
  'rooms/football.svg':{ bg: '#0d5028', accent: '#86efac', label: '⚽' },
  'decks/classic.svg': { bg: '#12082a', accent: '#a78bfa', label: '0' },
  'decks/gold.svg':    { bg: '#3d2a00', accent: '#fbbf24', label: '0' },
  'decks/cyber.svg':   { bg: '#0a2040', accent: '#60a5fa', label: '0' },
};

function svg({ bg, accent, label }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" stop-opacity=".9"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="16" fill="url(#g)"/>
  <rect x="8" y="8" width="104" height="104" rx="12" fill="none" stroke="${accent}" stroke-opacity=".45" stroke-width="2"/>
  <text x="60" y="68" text-anchor="middle" font-size="28" font-weight="800" fill="${accent}" font-family="system-ui,sans-serif">${label}</text>
</svg>`;
}

for (const [rel, cfg] of Object.entries(ITEMS)) {
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, svg(cfg));
}

console.log(`Generated ${Object.keys(ITEMS).length} cosmetic SVGs in app/cosmetics/`);
