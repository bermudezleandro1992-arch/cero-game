'use strict';

// ── Colors ─────────────────────────────────────────────────────────────────────
var COLORS  = ['magenta', 'gold', 'blue', 'green'];
var WILDS   = ['wild', 'wild4'];
var SPECIALS = ['skip', 'reverse', 'draw2'];

// CSS variable sets per color
var COLOR_CSS = {
  magenta: { cb: '#1f0824', cc: '#e879f9', cg: 'rgba(232,121,249,.4)', label: 'Magenta' },
  gold:    { cb: '#1f1004', cc: '#f59e0b', cg: 'rgba(245,158,11,.4)',  label: 'Dorado'  },
  blue:    { cb: '#041424', cc: '#60a5fa', cg: 'rgba(96,165,250,.4)',  label: 'Azul'    },
  green:   { cb: '#041f0e', cc: '#4ade80', cg: 'rgba(74,222,128,.4)',  label: 'Verde'   },
  wild:    { cb: '#0e0524', cc: '#a78bfa', cg: 'rgba(167,139,250,.4)', label: 'Comodín' },
};

// Display label per card value
const VALUE_DISPLAY = {
  skip:        '⊘',
  reverse:     '⇄',
  draw2:       '+2',
  wild:        '★',
  wild4:       '+4★',
  cero_total:  '⚡',
  cero_mirror: '◈',
  cero_swap:   '⇌',
  cero_star:   '✦',
};

const CARD_GUIDE = {
  draw2:       { name: 'Más dos (+2)', desc: 'El siguiente roba 2 cartas y pierde el turno. Podés apilar otro +2.' },
  wild4:       { name: 'Más cuatro (+4)', desc: 'El siguiente roba 4. Elegís color. Se puede apilar +4 o +2.' },
  skip:        { name: 'Salto (Bloqueo)', desc: 'El siguiente jugador pierde su turno.' },
  reverse:     { name: 'Reversa', desc: 'Invierte el sentido. En 1v1 volvés a jugar.' },
  wild:        { name: 'Comodín (CERO color)', desc: 'Elegís el color activo. Podés jugarla en cualquier momento.' },
  cero_total:  { name: 'TOTAL', desc: 'Modo Cero: todos roban 3. Elegís color.' },
  cero_mirror: { name: 'ESPEJO', desc: 'Modo Cero: devolvés el +2/+4 a quien lo tiró.' },
  cero_swap:   { name: 'SWAP', desc: 'Modo Cero: intercambiás mano con otro jugador.' },
  cero_star:   { name: 'CERO★', desc: 'Modo Cero: todos roban 1. Elegís color.' },
};

const CERO_SPECIALS_INFO = {
  cero_total:  { label: '⚡ TOTAL',  desc: CARD_GUIDE.cero_total.desc },
  cero_mirror: { label: '◈ ESPEJO', desc: CARD_GUIDE.cero_mirror.desc },
  cero_swap:   { label: '⇌ SWAP',   desc: CARD_GUIDE.cero_swap.desc },
  cero_star:   { label: '✦ CERO★',  desc: CARD_GUIDE.cero_star.desc },
};

let _nextId = 0;
function _card(color, value, type = 'number') {
  return { id: _nextId++, color, value, type };
}

// ── Deck factory ───────────────────────────────────────────────────────────────
function createCeroDeck(mode = 'classic') {
  _nextId = 0;
  const deck = [];

  for (const color of COLORS) {
    deck.push(_card(color, '0'));
    for (let n = 1; n <= 9; n++) {
      deck.push(_card(color, String(n)));
      deck.push(_card(color, String(n)));
    }
    for (const sp of SPECIALS) {
      deck.push(_card(color, sp, 'special'));
      deck.push(_card(color, sp, 'special'));
    }
  }

  for (let i = 0; i < 4; i++) {
    deck.push(_card('wild', 'wild',  'wild'));
    deck.push(_card('wild', 'wild4', 'wild'));
  }

  if (mode === 'cero') {
    deck.push(_card('wild', 'cero_total',  'cero_special'));
    deck.push(_card('wild', 'cero_mirror', 'cero_special'));
    deck.push(_card('wild', 'cero_swap',   'cero_special'));
    deck.push(_card('wild', 'cero_star',   'cero_special'));
  }

  return _shuffle(deck);
}

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Card helpers ───────────────────────────────────────────────────────────────
function cardDisplayValue(card) {
  return VALUE_DISPLAY[card.value] ?? card.value;
}

function isWild(card) {
  return card.type === 'wild' || card.type === 'cero_special';
}

/** Color en juego (UNO): la carta visible del descarte manda si no es comodín. */
function activeColor(topCard, chosenColor) {
  if (!topCard) return chosenColor || 'blue';
  if (topCard.color && topCard.color !== 'wild') return topCard.color;
  return chosenColor || 'blue';
}

function cardValuesMatch(a, b) {
  if (!a || !b) return false;
  return String(a.value) === String(b.value);
}

function handHasColorMatch(hand, color) {
  if (!hand?.length || !color) return false;
  return hand.some(c => !isWild(c) && c.color === color);
}

function canPlayOn(card, topCard, currentColor, drawStack, hand = null) {
  if (!card) return false;
  if (!topCard) return isWild(card);

  if (card.value === 'cero_mirror') return drawStack > 0;

  if (drawStack > 0) {
    if (card.value === 'draw2' && topCard.value === 'draw2') return true;
    if (card.value === 'wild4' && (topCard.value === 'draw2' || topCard.value === 'wild4')) return true;
    return false;
  }

  const active = activeColor(topCard, currentColor);

  if (card.value === 'wild4') {
    if (hand?.length) return !handHasColorMatch(hand, active);
    return true;
  }

  if (isWild(card)) return true;

  if (card.color === active) return true;
  if (cardValuesMatch(card, topCard)) return true;

  return false;
}

window.COLORS          = COLORS;
window.COLOR_CSS       = COLOR_CSS;
window.cardDisplayValue = cardDisplayValue;
window.isWild          = isWild;
function canStackOn(card, topCard) {
  if (!card || !topCard) return false;
  if (card.value === 'draw2' && topCard.value === 'draw2') return true;
  if (card.value === 'wild4' && (topCard.value === 'draw2' || topCard.value === 'wild4')) return true;
  return false;
}

function cardHelpText(card, chosenColor) {
  if (!card) return '';
  const g = CARD_GUIDE[card.value];
  if (g) return `${g.name}: ${g.desc}`;
  if (card.color === 'wild' && chosenColor) {
    const lbl = COLOR_CSS[chosenColor]?.label || chosenColor;
    return `Comodín · color en juego: ${lbl}`;
  }
  if (card.type === 'number') return `Número ${card.value} · color ${card.color}`;
  return `Carta ${card.value}`;
}

/** null = se puede jugar; string = motivo por el que no */
function playBlockReason(card, topCard, currentColor, drawStack, hand, opts = {}) {
  if (!card) return 'Carta inválida';
  const mustSayCero = !!opts.mustSayCero;

  if (!topCard) return isWild(card) ? null : 'Esperá a que repartan las cartas';

  if (drawStack > 0) {
    if (canStackOn(card, topCard)) return null;
    return 'Robá del mazo o apilá +2/+4 sobre la pila';
  }

  const active = activeColor(topCard, currentColor);

  if (card.value === 'wild4' && hand?.length && handHasColorMatch(hand, active)) {
    const lbl = COLOR_CSS[active]?.label || active;
    return `El +4 solo si no tenés cartas ${lbl}`;
  }

  if (!canPlayOn(card, topCard, currentColor, drawStack, hand)) {
    const topColorLbl = topCard.color === 'wild'
      ? (COLOR_CSS[active]?.label || active)
      : (COLOR_CSS[topCard.color]?.label || topCard.color);
    const topVal = cardDisplayValue(topCard);
    return `Tenés que coincidir con ${topVal} (${topColorLbl}): mismo color, número o comodín`;
  }

  if (mustSayCero) return '¡Apretá CERO! antes de tirar tu última carta';
  return null;
}

window.CARD_GUIDE = CARD_GUIDE;

window.activeColor     = activeColor;
window.cardValuesMatch = cardValuesMatch;
window.handHasColorMatch = handHasColorMatch;
window.canPlayOn       = canPlayOn;
window.canStackOn      = canStackOn;
window.cardHelpText    = cardHelpText;
window.playBlockReason = playBlockReason;
window.createCeroDeck  = createCeroDeck;
