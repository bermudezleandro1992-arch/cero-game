/**
 * CeroEngine — versión Node.js / Cloud Functions
 *
 * Copia autocontenida del motor para que el paquete functions/
 * sea completamente independiente (sin referencias al directorio raíz).
 *
 * Lógica idéntica al Módulo 1 (lib/CeroEngine.ts); aquí se agrega:
 *   · fromSnapshot() / toSnapshot() para serialización Firestore
 *   · Sin referencias a window ni al DOM
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos exportados
// ─────────────────────────────────────────────────────────────────────────────

export type CardColor  = 'magenta' | 'gold' | 'blue' | 'green' | 'wild';
export type CardValue  = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'
                       | 'skip'|'reverse'|'draw2'|'wild'|'wild4';
export type CardType   = 'number'|'special'|'wild';
export type GamePhase  = 'waiting'|'my_turn'|'opp_turn'|'color_pick'|'game_over';

export interface Card {
  readonly id:    number;
  readonly color: CardColor;
  readonly value: CardValue;
  readonly type:  CardType;
}

export interface Player {
  readonly id:   number;
  readonly name: string;
}

export interface GameSnapshot {
  readonly phase:       GamePhase;
  readonly current:     number;
  readonly direction:   1 | -1;
  readonly drawStack:   number;
  readonly chosenColor: CardColor | null;
  readonly pendingTurn: number | null;
  readonly winner:      number | null;
  readonly topDiscard:  Card | null;
  readonly deckLeft:    number;
  readonly hands:       ReadonlyArray<ReadonlyArray<Card>>;
  readonly handCounts:  ReadonlyArray<number>;
  readonly players:     ReadonlyArray<Player>;
  readonly ceroCalled:  ReadonlyArray<number>;
  // Campos de persistencia completa (solo para backend)
  readonly deck?:        ReadonlyArray<Card>;
  readonly discardPile?: ReadonlyArray<Card>;
}

export type ActionResult =
  | { readonly ok: true;  readonly snapshot: GameSnapshot; readonly ceroViolation?: boolean }
  | { readonly ok: false; readonly error: string };

export type DrawResult =
  | { readonly ok: true;  readonly drawn: ReadonlyArray<Card>; readonly canPlayDrawn: boolean; readonly snapshot: GameSnapshot }
  | { readonly ok: false; readonly error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS: readonly CardColor[] = ['magenta', 'gold', 'blue', 'green'];

const SPECIALS: readonly CardValue[] = ['skip', 'reverse', 'draw2'];

const COLOR_LABEL: Record<CardColor, string> = {
  magenta: 'Magenta', gold: 'Dorado', blue: 'Azul', green: 'Verde', wild: 'Comodín',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de carta
// ─────────────────────────────────────────────────────────────────────────────

export function isWild(card: Card): boolean {
  return card.color === 'wild';
}

function cardLabel(card: Card): string {
  const m: Partial<Record<CardValue, string>> = {
    skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4★',
  };
  return `${COLOR_LABEL[card.color]} ${m[card.value] ?? card.value}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mazo (108 cartas)
// ─────────────────────────────────────────────────────────────────────────────

function createDeck(): Card[] {
  let id = 0;
  const c = (color: CardColor, value: CardValue, type: CardType): Card =>
    ({ id: id++, color, value, type });
  const deck: Card[] = [];

  for (const col of COLORS) {
    deck.push(c(col, '0', 'number'));
    for (let n = 1; n <= 9; n++) {
      deck.push(c(col, String(n) as CardValue, 'number'));
      deck.push(c(col, String(n) as CardValue, 'number'));
    }
    for (const sp of SPECIALS) {
      deck.push(c(col, sp, 'special'));
      deck.push(c(col, sp, 'special'));
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push(c('wild', 'wild',  'wild'));
    deck.push(c('wild', 'wild4', 'wild'));
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas
// ─────────────────────────────────────────────────────────────────────────────

function activeColor(top: Card, chosen: CardColor | null): CardColor {
  return top.color !== 'wild' ? top.color : (chosen ?? 'blue');
}

function canStack(card: Card, top: Card): boolean {
  if (card.value === 'draw2' && top.value === 'draw2') return true;
  if (card.value === 'wild4' && (top.value === 'draw2' || top.value === 'wild4')) return true;
  return false;
}

/**
 * null → jugada legal; string → motivo del rechazo.
 */
export function blockReason(
  card:      Card,
  top:       Card | null,
  chosen:    CardColor | null,
  stack:     number,
  hand:      ReadonlyArray<Card>,
): string | null {
  if (!top) return isWild(card) ? 'No podés empezar con comodín' : null;

  if (stack > 0) {
    return canStack(card, top) ? null
      : `Debés robar ${stack} cartas o apilar otro +2/+4`;
  }

  const active = activeColor(top, chosen);

  if (card.value === 'wild4') {
    const hasColor = hand.some(c => !isWild(c) && c.color === active);
    return hasColor ? `El +4 solo si no tenés ${COLOR_LABEL[active]}` : null;
  }

  if (isWild(card)) return null;
  if (card.color === active) return null;
  if (card.value === top.value) return null;

  return `Jugada inválida — necesitás coincidir con ${cardLabel(top)} (${COLOR_LABEL[active]})`;
}

export function canPlayCard(
  card: Card, top: Card | null, chosen: CardColor | null,
  stack: number, hand: ReadonlyArray<Card>,
): boolean {
  return blockReason(card, top, chosen, stack, hand) === null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Efectos de cartas
// ─────────────────────────────────────────────────────────────────────────────

interface EngineCtx {
  players:    ReadonlyArray<Player>;
  current:    number;
  direction:  1 | -1;
  drawStack:  number;
  pendingTurn?: number | null;
}

interface Patch {
  phase?:      GamePhase;
  current?:    number;
  direction?:  1 | -1;
  drawStack?:  number;
  winner?:     number | null;
  pendingTurn?: number | null;
  chosenColor?: CardColor | null;
}

function nextIdx(cur: number, dir: 1 | -1, n: number): number {
  return (cur + dir + n * 10) % n;
}

function applyEffect(ctx: EngineCtx, card: Card, newSize: number): Patch {
  const { players, current: me, direction: dir, drawStack: stk } = ctx;
  const n = players.length;

  if (newSize === 0) return { phase: 'game_over', winner: me };

  if (isWild(card)) {
    return {
      phase:       'color_pick',
      drawStack:   card.value === 'wild4' ? stk + 4 : stk,
      pendingTurn: me,
    };
  }

  let nextDir: 1 | -1 = dir;
  let nextStk = stk;
  let next: number;

  switch (card.value) {
    case 'reverse':
      nextDir = (dir * -1) as 1 | -1;
      next = n === 2 ? me : nextIdx(me, nextDir, n);
      break;
    case 'skip':
      next = (me + dir * 2 + n * 10) % n;
      break;
    case 'draw2':
      nextStk += 2;
      next = nextIdx(me, dir, n);
      break;
    default:
      next = nextIdx(me, dir, n);
  }

  return {
    phase:     next === me ? 'my_turn' : 'opp_turn',
    current:   next,
    direction: nextDir,
    drawStack: nextStk,
  };
}

function applyColorChoice(ctx: EngineCtx, color: CardColor): Patch {
  const { players, direction: dir, pendingTurn, current } = ctx;
  const n    = players.length;
  const me   = pendingTurn ?? current;
  const next = nextIdx(me, dir, n);
  return {
    phase:       next === me ? 'my_turn' : 'opp_turn',
    current:     next,
    chosenColor: color,
    pendingTurn: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CeroEngine
// ─────────────────────────────────────────────────────────────────────────────

export class CeroEngine {
  readonly players:  ReadonlyArray<Player>;
  readonly handSize: number;

  private _deck:        Card[];
  private _discard:     Card[];
  private _hands:       Card[][];
  private _current:     number;
  private _direction:   1 | -1;
  private _drawStack:   number;
  private _chosenColor: CardColor | null;
  private _pendingTurn: number | null;
  private _phase:       GamePhase;
  private _winner:      number | null;
  private _ceroCalled:  Set<number>;

  constructor(opts: { playerCount: number; names?: string[]; handSize?: number }) {
    const n      = Math.max(2, Math.min(8, opts.playerCount));
    this.handSize = opts.handSize ?? 7;
    this.players  = Array.from({ length: n }, (_, i): Player => ({
      id:   i,
      name: opts.names?.[i] ?? (i === 0 ? 'Jugador' : `CPU ${i}`),
    }));
    this._deck        = [];
    this._discard     = [];
    this._hands       = Array.from({ length: n }, () => []);
    this._current     = 0;
    this._direction   = 1;
    this._drawStack   = 0;
    this._chosenColor = null;
    this._pendingTurn = null;
    this._phase       = 'waiting';
    this._winner      = null;
    this._ceroCalled  = new Set();
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  get phase():       GamePhase        { return this._phase; }
  get current():     number           { return this._current; }
  get topDiscard():  Card | null      { return this._discard[this._discard.length - 1] ?? null; }
  get deckLeft():    number           { return this._deck.length; }

  // ── deal() ─────────────────────────────────────────────────────────────────

  deal(): ActionResult {
    if (this._phase !== 'waiting') return this._fail('La partida ya fue repartida');

    this._deck = createDeck();
    for (let i = 0; i < this.handSize; i++)
      for (let p = 0; p < this.players.length; p++)
        this._hands[p]!.push(this._deck.pop()!);

    let first: Card;
    do {
      first = this._deck.pop()!;
      if (first.value === 'wild4') this._deck.unshift(first);
    } while (first.value === 'wild4');

    this._discard     = [first];
    this._chosenColor = isWild(first) ? null : first.color;

    if (isWild(first)) {
      this._phase = 'color_pick';
    } else {
      this._applyPatch(applyEffect(
        { players: this.players, current: -1, direction: 1, drawStack: 0 },
        first, this.handSize,
      ));
      this._phase = 'my_turn';
    }

    return { ok: true, snapshot: this._snapshot() };
  }

  // ── play() ─────────────────────────────────────────────────────────────────

  play(playerIdx: number, cardId: number): ActionResult {
    if (this._phase === 'game_over')  return this._fail('La partida terminó');
    if (this._phase === 'color_pick') return this._fail('Elegí color primero');
    if (this._phase === 'waiting')    return this._fail('La partida aún no fue repartida');
    if (playerIdx !== this._current)  return this._fail('No es tu turno');

    const hand    = this._hands[playerIdx]!;
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return this._fail('Esa carta no está en tu mano');

    const card = hand[cardIdx]!;

    const reason = blockReason(card, this.topDiscard, this._chosenColor, this._drawStack, hand);
    if (reason) return this._fail(reason);

    const forgotCero = hand.length === 1 && !this._ceroCalled.has(playerIdx);

    hand.splice(cardIdx, 1);
    const newSize = hand.length;
    this._discard.push(card);
    this._ceroCalled.delete(playerIdx);

    const effectSize = newSize === 0 && forgotCero ? 1 : newSize;

    this._applyPatch(applyEffect(
      { players: this.players, current: playerIdx, direction: this._direction, drawStack: this._drawStack, pendingTurn: this._pendingTurn },
      card, effectSize,
    ));

    if (!isWild(card)) this._chosenColor = card.color;
    return {
      ok: true,
      snapshot: this._snapshot(),
      ...(newSize === 0 && forgotCero ? { ceroViolation: true } : {}),
    };
  }

  // ── penalizeCero() — rival hace robar +2 por no declarar CERO ───────────────

  penalizeCero(targetIdx: number): ActionResult {
    const hand = this._hands[targetIdx]!;
    const drawn = this._drawCards(2);
    hand.push(...drawn);

    if (this._winner === targetIdx) this._winner = null;
    if (this._phase === 'game_over') {
      this._phase = this._current === targetIdx ? 'my_turn' : 'opp_turn';
    }
    if (this._phase === 'color_pick' && this._pendingTurn === targetIdx) {
      this._pendingTurn = null;
      this._phase = this._current === targetIdx ? 'my_turn' : 'opp_turn';
    }

    return { ok: true, snapshot: this._snapshot() };
  }

  // ── draw() ─────────────────────────────────────────────────────────────────

  draw(playerIdx: number): DrawResult {
    if (this._phase === 'game_over') return this._fail('La partida terminó') as DrawResult;
    if (this._phase === 'waiting')   return this._fail('Aún no fue repartida') as DrawResult;
    if (playerIdx !== this._current) return this._fail('No es tu turno') as DrawResult;

    const count   = this._drawStack > 0 ? this._drawStack : 1;
    const drawn   = this._drawCards(count);
    const hand    = this._hands[playerIdx]!;
    hand.push(...drawn);
    this._drawStack = 0;

    const top         = this.topDiscard;
    const last        = drawn[drawn.length - 1]!;
    const canPlayDrawn = count === 1 && top !== null
      && canPlayCard(last, top, this._chosenColor, 0, hand);

    if (!canPlayDrawn) {
      this._current = nextIdx(this._current, this._direction, this.players.length);
      this._phase   = 'opp_turn';
    }

    return { ok: true, drawn, canPlayDrawn, snapshot: this._snapshot() };
  }

  // ── pickColor() ────────────────────────────────────────────────────────────

  pickColor(playerIdx: number, color: CardColor): ActionResult {
    if (this._phase !== 'color_pick')
      return this._fail('No hay comodín activo');
    if (!COLORS.includes(color))
      return this._fail(`Color inválido: "${color}"`);

    this._applyPatch(applyColorChoice(
      { players: this.players, current: this._current, direction: this._direction, drawStack: this._drawStack, pendingTurn: this._pendingTurn },
      color,
    ));
    return { ok: true, snapshot: this._snapshot() };
  }

  // ── declareCero() ──────────────────────────────────────────────────────────

  declareCero(playerIdx: number): ActionResult {
    const handLen = this._hands[playerIdx]!.length;
    if (handLen < 1 || handLen > 2)
      return this._fail('Declará CERO con 1 o 2 cartas en la mano');
    this._ceroCalled.add(playerIdx);
    return { ok: true, snapshot: this._snapshot() };
  }

  // ── Consultas ──────────────────────────────────────────────────────────────

  playableCards(playerIdx: number): ReadonlyArray<Card> {
    if (playerIdx !== this._current) return [];
    const hand = this._hands[playerIdx]!;
    const top  = this.topDiscard;
    return hand.filter(c => canPlayCard(c, top, this._chosenColor, this._drawStack, hand));
  }

  whyBlocked(playerIdx: number, cardId: number): string | null {
    if (this._phase === 'game_over')  return 'La partida terminó';
    if (this._phase === 'color_pick') return 'Elegí color primero';
    if (this._phase === 'waiting')    return 'Partida no iniciada';
    if (playerIdx !== this._current)  return 'No es tu turno';
    const hand    = this._hands[playerIdx]!;
    const card    = hand.find(c => c.id === cardId);
    if (!card) return 'Carta no encontrada';
    return blockReason(card, this.topDiscard, this._chosenColor, this._drawStack, hand);
  }

  // ── Serialización completa (para Firestore) ───────────────────────────────

  /**
   * Exporta el estado privado completo (deck + manos + descarte entero).
   * Solo debe guardarse en una subcolección protegida en el servidor.
   */
  toFullSnapshot(): FullSnapshot {
    return {
      ...this._snapshot(),
      deck:        [...this._deck],
      discardPile: [...this._discard],
    };
  }

  /**
   * Reconstruye el motor desde un `FullSnapshot` guardado en Firestore.
   */
  static fromFullSnapshot(s: FullSnapshot): CeroEngine {
    const e = new CeroEngine({ playerCount: s.players.length, handSize: 7 });
    // @ts-expect-error – acceso a players readonly
    (e as { players: Player[] }).players = s.players.map(p => ({ ...p }));
    e._deck        = [...(s.deck        ?? [])];
    e._discard     = [...(s.discardPile ?? [])];
    e._hands       = s.hands.map(h => [...h]);
    e._current     = s.current;
    e._direction   = s.direction;
    e._drawStack   = s.drawStack;
    e._chosenColor = s.chosenColor;
    e._pendingTurn = s.pendingTurn;
    e._phase       = s.phase;
    e._winner      = s.winner;
    e._ceroCalled  = new Set(s.ceroCalled);
    return e;
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  private _snapshot(): GameSnapshot {
    return {
      phase:       this._phase,
      current:     this._current,
      direction:   this._direction,
      drawStack:   this._drawStack,
      chosenColor: this._chosenColor,
      pendingTurn: this._pendingTurn,
      winner:      this._winner,
      topDiscard:  this.topDiscard,
      deckLeft:    this._deck.length,
      hands:       this._hands.map(h => [...h]),
      handCounts:  this._hands.map(h => h.length),
      players:     [...this.players],
      ceroCalled:  [...this._ceroCalled],
    };
  }

  private _drawCards(n: number): Card[] {
    while (this._deck.length < n && this._discard.length > 1) {
      const top = this._discard.pop()!;
      this._deck.push(...shuffle([...this._discard]));
      this._discard = [top];
    }
    return this._deck.splice(Math.max(0, this._deck.length - n), n);
  }

  private _applyPatch(p: Patch): void {
    if (p.phase       !== undefined) this._phase       = p.phase;
    if (p.current     !== undefined) this._current     = p.current;
    if (p.direction   !== undefined) this._direction   = p.direction;
    if (p.drawStack   !== undefined) this._drawStack   = p.drawStack;
    if (p.winner      !== undefined) this._winner      = p.winner;
    if (p.pendingTurn !== undefined) this._pendingTurn = p.pendingTurn;
    if (p.chosenColor !== undefined) this._chosenColor = p.chosenColor;
  }

  private _fail(error: string): ActionResult {
    return { ok: false, error };
  }
}

// Tipo extendido con campos de persistencia
export interface FullSnapshot extends GameSnapshot {
  readonly deck:        ReadonlyArray<Card>;
  readonly discardPile: ReadonlyArray<Card>;
}
