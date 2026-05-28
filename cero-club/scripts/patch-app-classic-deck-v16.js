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

apply(
  'deck-classic-img-v16',
  'deck_classic:"/app/cosmetics/decks/classic.svg"',
  'deck_classic:"/app/cards/classic-back.png"',
);

apply(
  'qf-deck-back-image-v16',
  'function qf({small:r}){const ds=M0deckStyle(M0deckEquipped);return I.jsxs("div",{className:["relative select-none rounded-xl border-2 flex items-center justify-center","font-extrabold overflow-hidden transition-all duration-200 ease-out cursor-default",r?"w-12 h-[4.5rem] text-[0.6rem]":"w-16 h-24 text-[0.65rem]"].join(" "),style:{background:ds.background,borderColor:ds.borderColor,boxShadow:"0 2px 12px rgba(0,0,0,.6)"},"aria-hidden":"true",children:[I.jsx("div",{className:"absolute inset-0 opacity-20",style:{backgroundImage:"repeating-linear-gradient(45deg,#a78bfa 0,#a78bfa 1px,transparent 0,transparent 50%)",backgroundSize:"8px 8px"}}),I.jsx("span",{className:"relative z-10 tracking-widest text-violet-300 font-black",children:"CERO"})]})}',
  'function qf({small:r}){const did=M0deckEquipped||"deck_classic",ds=M0deckStyle(did),img=M0COS_IMG[did]||M0COS_IMG.deck_classic;return I.jsx("div",{className:["relative select-none rounded-xl border-2 overflow-hidden transition-all duration-200 ease-out cursor-default flex items-center justify-center",r?"w-12 h-[4.5rem]":"w-16 h-24"].join(" "),style:img?{backgroundImage:"url("+img+")",backgroundSize:"cover",backgroundPosition:"center",borderColor:ds.borderColor||"rgba(124,58,237,.5)",boxShadow:"0 2px 14px rgba(0,0,0,.65)"}:{background:ds.background,borderColor:ds.borderColor,boxShadow:"0 2px 12px rgba(0,0,0,.6)"},"aria-hidden":"true",children:!img&&I.jsxs("div",{className:"absolute inset-0 flex items-center justify-center font-extrabold",children:[I.jsx("div",{className:"absolute inset-0 opacity-20",style:{backgroundImage:"repeating-linear-gradient(45deg,#a78bfa 0,#a78bfa 1px,transparent 0,transparent 50%)",backgroundSize:"8px 8px"}}),I.jsx("span",{className:"relative z-10 tracking-widest text-violet-300 font-black text-[0.65rem]",children:"CERO"})]})})}',
);

apply(
  'deck-classic-catalog-label-v16',
  '{id:"deck_classic",name:"Mazo Clásico",category:"deck_back",price:150,preview:"🃏"}',
  '{id:"deck_classic",name:"Mazo CERO Clásico",category:"deck_back",price:150,preview:"🃏"}',
);

fs.writeFileSync(bundlePath, s);
console.log('Classic deck card v16 applied.');
