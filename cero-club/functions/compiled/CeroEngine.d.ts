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
export type CardColor = 'magenta' | 'gold' | 'blue' | 'green' | 'wild';
export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
export type CardType = 'number' | 'special' | 'wild';
export type GamePhase = 'waiting' | 'my_turn' | 'opp_turn' | 'color_pick' | 'game_over';
export interface Card {
    readonly id: number;
    readonly color: CardColor;
    readonly value: CardValue;
    readonly type: CardType;
}
export interface Player {
    readonly id: number;
    readonly name: string;
}
export interface GameSnapshot {
    readonly phase: GamePhase;
    readonly current: number;
    readonly direction: 1 | -1;
    readonly drawStack: number;
    readonly chosenColor: CardColor | null;
    readonly pendingTurn: number | null;
    readonly winner: number | null;
    readonly topDiscard: Card | null;
    readonly deckLeft: number;
    readonly hands: ReadonlyArray<ReadonlyArray<Card>>;
    readonly handCounts: ReadonlyArray<number>;
    readonly players: ReadonlyArray<Player>;
    readonly ceroCalled: ReadonlyArray<number>;
    readonly deck?: ReadonlyArray<Card>;
    readonly discardPile?: ReadonlyArray<Card>;
}
export type ActionResult = {
    readonly ok: true;
    readonly snapshot: GameSnapshot;
    readonly ceroViolation?: boolean;
} | {
    readonly ok: false;
    readonly error: string;
};
export type DrawResult = {
    readonly ok: true;
    readonly drawn: ReadonlyArray<Card>;
    readonly canPlayDrawn: boolean;
    readonly snapshot: GameSnapshot;
} | {
    readonly ok: false;
    readonly error: string;
};
export declare const COLORS: readonly CardColor[];
export declare function isWild(card: Card): boolean;
/**
 * null → jugada legal; string → motivo del rechazo.
 */
export declare function blockReason(card: Card, top: Card | null, chosen: CardColor | null, stack: number, hand: ReadonlyArray<Card>): string | null;
export declare function canPlayCard(card: Card, top: Card | null, chosen: CardColor | null, stack: number, hand: ReadonlyArray<Card>): boolean;
export declare class CeroEngine {
    readonly players: ReadonlyArray<Player>;
    readonly handSize: number;
    private _deck;
    private _discard;
    private _hands;
    private _current;
    private _direction;
    private _drawStack;
    private _chosenColor;
    private _pendingTurn;
    private _phase;
    private _winner;
    private _ceroCalled;
    constructor(opts: {
        playerCount: number;
        names?: string[];
        handSize?: number;
    });
    get phase(): GamePhase;
    get current(): number;
    get topDiscard(): Card | null;
    get deckLeft(): number;
    deal(): ActionResult;
    play(playerIdx: number, cardId: number): ActionResult;
    penalizeCero(targetIdx: number): ActionResult;
    draw(playerIdx: number): DrawResult;
    pickColor(playerIdx: number, color: CardColor): ActionResult;
    declareCero(playerIdx: number): ActionResult;
    playableCards(playerIdx: number): ReadonlyArray<Card>;
    whyBlocked(playerIdx: number, cardId: number): string | null;
    /**
     * Exporta el estado privado completo (deck + manos + descarte entero).
     * Solo debe guardarse en una subcolección protegida en el servidor.
     */
    toFullSnapshot(): FullSnapshot;
    /**
     * Reconstruye el motor desde un `FullSnapshot` guardado en Firestore.
     */
    static fromFullSnapshot(s: FullSnapshot): CeroEngine;
    private _snapshot;
    private _drawCards;
    private _applyPatch;
    private _fail;
}
export interface FullSnapshot extends GameSnapshot {
    readonly deck: ReadonlyArray<Card>;
    readonly discardPile: ReadonlyArray<Card>;
}
