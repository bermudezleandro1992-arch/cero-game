'use strict';

/**
 * CERO Engine — versión Node.js para Cloud Functions
 * Misma lógica que el Módulo 1 standalone; sin test runner ni window.
 *
 * Exportado como módulo CommonJS para ser usado en cero-match.js.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const COLORS   = ['magenta', 'gold', 'blue', 'green'];
const SPECIALS = ['skip', 'reverse', 'draw2'];
const COLOR_LABEL = {
  magenta: 'Magenta', gold: 'Dorado', blue: 'Azul', green: 'Verde', wild: 'Comodín',
};

const PHASE = {
  WAITING:    'waiting',
  MY_TURN:    'my_turn',
  OPP_TURN:   'opp_turn',
  COLOR_PICK: 'color_pick',
  GAME_OVER:  'game_over',
};

// ─────────────────────────────────────────────────────────────────────────────
// Carta helpers
// ─────────────────────────────────────────────────────────────────────────────

function isWild(card) {
  return card && card.color === 'wild';
}

function cardLabel(card) {
  if (!card) return '—';
  const valMap = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4★' };
  const v = valMap[card.value] ?? card.value;
  return `${COLOR_LABEL[card.color] ?? card.color} ${v}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mazo (108 cartas)
// ─────────────────────────────────────────────────────────────────────────────

function createDeck() {
  let nextId = 0;
  const card = (color, value, type) => ({ id: nextId++, color, value, type });
  const deck = [];

  for (const color of COLORS) {
    deck.push(card(color, '0', 'number'));
    for (let n = 1; n <= 9; n++) {
      deck.push(card(color, String(n), 'number'));
      deck.push(card(color, String(n), 'number'));
    }
    for (const sp of SPECIALS) {
      deck.push(card(color, sp, 'special'));
      deck.push(card(color, sp, 'special'));
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push(card('wild', 'wild',  'wild'));
    deck.push(card('wild', 'wild4', 'wild'));
  }

  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de validación
// ─────────────────────────────────────────────────────────────────────────────

function activeColor(topCard, chosenColor) {
  if (!topCard) return chosenColor || 'blue';
  if (topCard.color !== 'wild') return topCard.color;
  return chosenColor || 'blue';
}

function canStack(card, topCard) {
  if (!card || !topCard) return false;
  if (card.value === 'draw2' && topCard.value === 'draw2') return true;
  if (card.value === 'wild4' && (topCard.value === 'draw2' || topCard.value === 'wild4')) return true;
  return false;
}

/**
 * Devuelve null si la jugada es legal; un string con la razón si no lo es.
 *
 * @param {object} card
 * @param {object} topCard       - Carta visible en el descarte
 * @param {string} chosenColor   - Color en juego si el descarte es comodín
 * @param {number} drawStack     - Pila de robos acumulada (+2/+4)
 * @param {object[]} hand        - Mano completa del jugador (para validar +4)
 * @param {object}  opts
 * @param {boolean} opts.mustDeclareCero - True si tiene 1 carta y no dijo CERO
 * @returns {string|null}
 */
function blockReason(card, topCard, chosenColor, drawStack, hand, opts = {}) {
  if (!card) return 'Carta inválida';

  if (!topCard) return isWild(card) ? '¡No podés empezar con comodín!' : null;

  if (drawStack > 0) {
    return canStack(card, topCard)
      ? null
      : `Tenés que robar ${drawStack} cartas o apilar otro +2/+4`;
  }

  const active = activeColor(topCard, chosenColor);

  if (card.value === 'wild4') {
    const hasColor = (hand || []).some(c => !isWild(c) && c.color === active);
    if (hasColor) {
      return `El +4 solo si no tenés cartas ${COLOR_LABEL[active] || active}`;
    }
    return null;
  }

  if (isWild(card)) return null;
  if (card.color === active) return null;
  if (card.value === topCard.value) return null;

  return `Necesitás coincidir con ${cardLabel(topCard)}: mismo color o número`;
}

function canPlay(card, topCard, chosenColor, drawStack, hand) {
  return blockReason(card, topCard, chosenColor, drawStack, hand) === null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Efectos de cartas
// ─────────────────────────────────────────────────────────────────────────────

function _nextTurn(current, direction, n) {
  return (current + direction + n * 10) % n;
}

/**
 * Calcula el parche de estado tras jugar `card`.
 * No muta nada; devuelve un objeto con las propiedades que cambian.
 */
function applyCardEffect(state, card, newHandSize) {
  const n  = state.players.length;
  const me = state.current;

  if (newHandSize === 0) {
    return { phase: PHASE.GAME_OVER, winner: me };
  }

  if (isWild(card)) {
    const nextStack = card.value === 'wild4'
      ? (state.drawStack || 0) + 4
      : state.drawStack || 0;
    return { phase: PHASE.COLOR_PICK, drawStack: nextStack, pendingTurn: me };
  }

  let dir   = state.direction;
  let stack = state.drawStack || 0;
  let next;

  switch (card.value) {
    case 'reverse':
      dir *= -1;
      next = n === 2 ? me : _nextTurn(me, dir, n);
      break;
    case 'skip':
      next = (me + dir * 2 + n * 10) % n;
      break;
    case 'draw2':
      stack += 2;
      next = _nextTurn(me, dir, n);
      break;
    default:
      next = _nextTurn(me, dir, n);
  }

  return {
    phase:     next === me ? PHASE.MY_TURN : PHASE.OPP_TURN,
    current:   next,
    direction: dir,
    drawStack: stack,
  };
}

function applyColorPick(state, color) {
  const n    = state.players.length;
  const me   = state.pendingTurn ?? state.current;
  const dir  = state.direction;
  const next = _nextTurn(me, dir, n);
  return {
    phase:       next === me ? PHASE.MY_TURN : PHASE.OPP_TURN,
    current:     next,
    chosenColor: color,
    pendingTurn: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CeroEngine — motor principal
// ─────────────────────────────────────────────────────────────────────────────

class CeroEngine {
  /**
   * @param {object} opts
   * @param {number}   opts.playerCount
   * @param {string[]} [opts.names]
   * @param {number}   [opts.handSize]   default 7
   */
  constructor(opts = {}) {
    const count   = Math.max(2, Math.min(8, opts.playerCount || 2));
    this.handSize = opts.handSize || 7;
    this.players  = Array.from({ length: count }, (_, i) => ({
      id:   i,
      name: (opts.names && opts.names[i]) || (i === 0 ? 'Jugador' : `CPU ${i}`),
    }));

    this.deck        = [];
    this.discard     = [];
    this.hands       = Array.from({ length: count }, () => []);
    this.current     = 0;
    this.direction   = 1;
    this.drawStack   = 0;
    this.chosenColor = null;
    this.pendingTurn = null;
    this.phase       = PHASE.WAITING;
    this.winner      = null;
    this.ceroCalled  = new Set();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  deal() {
    this.deck = createDeck();

    for (let i = 0; i < this.handSize; i++) {
      for (let p = 0; p < this.players.length; p++) {
        this.hands[p].push(this.deck.pop());
      }
    }

    // Primera carta: nunca Wild+4
    let first;
    do {
      first = this.deck.pop();
      if (first.value === 'wild4') this.deck.unshift(first);
    } while (first.value === 'wild4');

    this.discard = [first];
    this.chosenColor = isWild(first) ? null : first.color;

    if (isWild(first)) {
      this.phase = PHASE.COLOR_PICK;
    } else {
      const patch = applyCardEffect(
        { players: this.players, current: -1, direction: 1, drawStack: 0 },
        first, this.handSize
      );
      this._applyPatch(patch);
      this.phase = PHASE.MY_TURN;
    }

    return this.snapshot();
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  play(playerIdx, cardId) {
    if (this.phase === PHASE.GAME_OVER)  return this._fail('La partida terminó');
    if (this.phase === PHASE.COLOR_PICK) return this._fail('Elegí color primero');
    if (playerIdx !== this.current)      return this._fail('No es tu turno');

    const hand    = this.hands[playerIdx];
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return this._fail('Esa carta no está en tu mano');

    const card    = hand[cardIdx];
    const topCard = this._topDiscard();

    const reason = blockReason(card, topCard, this.chosenColor, this.drawStack, hand);
    if (reason) return this._fail(reason);

    hand.splice(cardIdx, 1);
    this.discard.push(card);
    this.ceroCalled.delete(playerIdx);

    const patch = applyCardEffect(
      { players: this.players, current: playerIdx, direction: this.direction, drawStack: this.drawStack },
      card, hand.length
    );
    this._applyPatch(patch);
    if (!isWild(card)) this.chosenColor = card.color;

    return { ok: true, snapshot: this.snapshot() };
  }

  draw(playerIdx) {
    if (playerIdx !== this.current)     return this._fail('No es tu turno');
    if (this.phase === PHASE.GAME_OVER) return this._fail('La partida terminó');

    const count  = this.drawStack > 0 ? this.drawStack : 1;
    const drawn  = this._drawCards(count);
    this.hands[playerIdx].push(...drawn);
    this.drawStack = 0;

    const topCard    = this._topDiscard();
    const lastDrawn  = drawn[drawn.length - 1];
    const canPlayDrawn = count === 1 &&
      canPlay(lastDrawn, topCard, this.chosenColor, 0, this.hands[playerIdx]);

    if (!canPlayDrawn) {
      this.current = _nextTurn(this.current, this.direction, this.players.length);
      this.phase   = PHASE.OPP_TURN;
    }

    return { ok: true, drawn, canPlayDrawn, snapshot: this.snapshot() };
  }

  pickColor(playerIdx, color) {
    if (this.phase !== PHASE.COLOR_PICK) return this._fail('No hay comodín activo');
    if (!COLORS.includes(color))         return this._fail(`Color inválido: ${color}`);

    const patch = applyColorPick(
      { players: this.players, current: this.current, direction: this.direction, pendingTurn: this.pendingTurn },
      color
    );
    this.chosenColor = color;
    this._applyPatch(patch);

    return { ok: true, snapshot: this.snapshot() };
  }

  declareCero(playerIdx) {
    if (this.hands[playerIdx].length <= 1) {
      this.ceroCalled.add(playerIdx);
      return { ok: true };
    }
    return this._fail('Solo podés declarar CERO cuando te queda 1 carta');
  }

  playableCards(playerIdx) {
    if (playerIdx !== this.current) return [];
    const hand    = this.hands[playerIdx];
    const topCard = this._topDiscard();
    return hand.filter(c => canPlay(c, topCard, this.chosenColor, this.drawStack, hand));
  }

  // ── Serialización (Firestore ↔ Engine) ────────────────────────────────────

  /**
   * Exporta el estado completo (para guardarlo en Firestore, colección privada).
   */
  snapshot() {
    return {
      phase:       this.phase,
      current:     this.current,
      direction:   this.direction,
      drawStack:   this.drawStack,
      chosenColor: this.chosenColor,
      pendingTurn: this.pendingTurn ?? null,
      winner:      this.winner,
      topDiscard:  this._topDiscard(),
      discardPile: [...this.discard],
      deck:        [...this.deck],
      hands:       this.hands.map(h => [...h]),
      handCounts:  this.hands.map(h => h.length),
      players:     this.players.map(p => ({ ...p })),
      ceroCalled:  [...this.ceroCalled],
    };
  }

  /**
   * Reconstruye un engine desde un snapshot guardado en Firestore.
   * @param {object} snap - Valor de snapshot() guardado previamente
   * @returns {CeroEngine}
   */
  static fromSnapshot(snap) {
    const engine = new CeroEngine({ playerCount: snap.players.length });
    engine.players     = snap.players.map(p => ({ ...p }));
    engine.deck        = [...(snap.deck || [])];
    engine.discard     = [...(snap.discardPile || [])];
    engine.hands       = snap.hands.map(h => [...h]);
    engine.current     = snap.current;
    engine.direction   = snap.direction;
    engine.drawStack   = snap.drawStack ?? 0;
    engine.chosenColor = snap.chosenColor ?? null;
    engine.pendingTurn = snap.pendingTurn ?? null;
    engine.phase       = snap.phase;
    engine.winner      = snap.winner ?? null;
    engine.ceroCalled  = new Set(snap.ceroCalled || []);
    return engine;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _topDiscard() {
    return this.discard[this.discard.length - 1] ?? null;
  }

  _drawCards(n) {
    while (this.deck.length < n && this.discard.length > 1) {
      const top = this.discard.pop();
      this.deck.push(...shuffle(this.discard));
      this.discard = [top];
    }
    return this.deck.splice(Math.max(0, this.deck.length - n), n);
  }

  _applyPatch(patch) {
    for (const key of ['phase', 'current', 'direction', 'drawStack', 'winner', 'pendingTurn', 'chosenColor']) {
      if (patch[key] !== undefined) this[key] = patch[key];
    }
  }

  _fail(error) {
    return { ok: false, error };
  }
}

module.exports = { CeroEngine, createDeck, shuffle, blockReason, canPlay, canStack, activeColor, COLORS, PHASE };
