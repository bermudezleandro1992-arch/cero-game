/**
 * CERO — Módulo 2: Backend (TypeScript / Cloud Functions v2)
 *
 * Garantías de seguridad:
 *   · El cliente NUNCA puede escribir en `matches/` ni en `private/server`.
 *   · Los balances de ceroCoins solo los modifica el Admin SDK dentro de una
 *     transacción Firestore — imposible de manipular desde el navegador.
 *   · El mazo y las manos ajenas jamás se exponen al cliente.
 *   · El número de turno (`turn`) actúa como llave de idempotencia:
 *     requests duplicados o retrasados son rechazados sin efecto.
 *
 * Colecciones Firestore:
 *
 *   users/{uid}
 *     email: string
 *     displayName: string
 *     ceroCoins: number          ← balance; solo escribe el servidor
 *     freeGamesPlayed: number    ← partidas gratis usadas
 *     totalGamesPlayed: number
 *     wins: number
 *     createdAt: Timestamp
 *
 *   matches/{matchId}
 *     status: 'waiting' | 'playing' | 'finished'
 *     mode: 'classic' | 'cero'
 *     players: PlayerInfo[]
 *     playerIds: string[]
 *     playerCount: number
 *     maxPlayers: number
 *     stakeCC: number            ← coins apostadas por partida
 *     turn: number               ← se incrementa en cada acción (idempotencia)
 *     phase / current / direction / drawStack / chosenColor / topDiscard /
 *     handCounts / winner / pendingTurn  ← estado público (cliente escucha con onSnapshot)
 *     lastAction: LastAction | null
 *     createdAt / startedAt / finishedAt: Timestamp
 *
 *   matches/{matchId}/private/server   ← NADIE puede leer (solo Admin SDK)
 *     deck: Card[]
 *     discardPile: Card[]
 *     hands: Card[][]             ← indexado por playerIdx
 *     ceroCalled: number[]
 *
 *   matches/{matchId}/hands/{uid}      ← solo el dueño puede leer
 *     cards: Card[]
 */
import type { Card, CardColor, GamePhase } from './CeroEngine';
interface PlayerInfo {
    uid: string;
    name: string;
    index: number;
}
interface LastAction {
    type: string;
    uid: string;
    playerIdx: number;
    card?: Partial<Card> | null;
    color?: CardColor | null;
    count?: number | undefined;
}
interface MatchDoc {
    status: 'waiting' | 'playing' | 'finished';
    mode: 'classic' | 'cero';
    players: PlayerInfo[];
    playerIds: string[];
    playerCount: number;
    maxPlayers: number;
    stakeCC: number;
    turn: number;
    phase: GamePhase;
    current: number | null;
    direction: 1 | -1 | null;
    drawStack: number | null;
    chosenColor: CardColor | null;
    topDiscard: Card | null;
    handCounts: number[] | null;
    winner: string | null;
    pendingTurn: number | null;
    lastAction: LastAction | null;
}
type EndReason = 'won' | 'forfeit' | 'timeout';
interface JoinMatchRequest {
    mode?: string;
    format?: string;
    matchId?: string;
    stakeCC?: number;
}
interface JoinMatchResponse {
    matchId: string;
    playerIndex: number;
    charged: boolean;
    coinsLeft: number;
    stakeCC: number;
}
/**
 * Verifica elegibilidad (partidas gratis o saldo), descuenta coins atómicamente
 * y une al jugador a una sala existente o crea una nueva.
 */
export declare const joinMatch: import("firebase-functions/v2/https").CallableFunction<JoinMatchRequest, Promise<JoinMatchResponse>>;
type TurnAction = 'play' | 'draw' | 'pickColor' | 'declareCero';
interface PlayTurnRequest {
    matchId: string;
    turnNumber: number;
    action: TurnAction;
    cardId?: number;
    color?: string;
}
interface PlayTurnResponse {
    ok: true;
    publicState: Partial<MatchDoc>;
    myHand: Card[];
    turn: number;
}
/**
 * Ejecuta una acción de juego dentro de una transacción Firestore.
 *
 * Flujo:
 *   1. Lee match + private/server + hands/{uid} en la misma transacción.
 *   2. Valida turno con turnNumber (idempotencia).
 *   3. Reconstruye CeroEngine desde el snapshot privado.
 *   4. Ejecuta la acción (play / draw / pickColor / declareCero).
 *   5. Si ok=true → escribe el nuevo estado atómicamente.
 *   6. Si ok=false → lanza HttpsError y la transacción hace rollback automático.
 */
export declare const playTurn: import("firebase-functions/v2/https").CallableFunction<PlayTurnRequest, Promise<PlayTurnResponse>>;
export declare const leaveMatch: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
}>>;
interface ForfeitResponse {
    ok: true;
    winnerUid: string;
}
/** Abandono voluntario: entrega la victoria al rival y devuelve el pozo. */
export declare const forfeitMatch: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<ForfeitResponse>>;
interface EndMatchRequest {
    matchId: string;
    winnerUid: string;
    reason?: EndReason;
}
/**
 * Cierra una partida en curso, calcula el pozo y acredita al ganador.
 *
 * Casos de uso:
 *   · El servidor detecta inactividad (lastSeen del jugador > TURN_SECONDS)
 *   · Un jugador se queda sin cartas y el cliente confirma manualmente
 *   · Un admin fuerza el cierre de una sala atascada
 *
 * Solo pueden llamar a esta función:
 *   · Uno de los jugadores de la partida
 *   · (El Admin SDK llama directamente a _applyMatchEndUpdates sin pasar por aquí)
 */
export declare const endMatch: import("firebase-functions/v2/https").CallableFunction<EndMatchRequest, Promise<ForfeitResponse>>;
export {};
