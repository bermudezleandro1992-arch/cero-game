/**
 * CERO �?? Módulo 2: Backend (TypeScript / Cloud Functions v2)
 *
 * Garantías de seguridad:
 *   · El cliente NUNCA puede escribir en `matches/` ni en `private/server`.
 *   · Los balances de ceroCoins solo los modifica el Admin SDK dentro de una
 *     transacción Firestore �?? imposible de manipular desde el navegador.
 *   · El mazo y las manos ajenas jamás se exponen al cliente.
 *   · El número de turno (`turn`) actúa como llave de idempotencia:
 *     requests duplicados o retrasados son rechazados sin efecto.
 *
 * Colecciones Firestore:
 *
 *   users/{uid}
 *     email: string
 *     displayName: string
 *     ceroCoins: number          �?� balance; solo escribe el servidor
 *     freeGamesPlayed: number    �?� partidas gratis usadas
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
 *     stakeCC: number            �?� coins apostadas por partida
 *     turn: number               �?� se incrementa en cada acción (idempotencia)
 *     phase / current / direction / drawStack / chosenColor / topDiscard /
 *     handCounts / winner / pendingTurn  �?� estado público (cliente escucha con onSnapshot)
 *     lastAction: LastAction | null
 *     createdAt / startedAt / finishedAt: Timestamp
 *
 *   matches/{matchId}/private/server   �?� NADIE puede leer (solo Admin SDK)
 *     deck: Card[]
 *     discardPile: Card[]
 *     hands: Card[][]             �?� indexado por playerIdx
 *     ceroCalled: number[]
 *
 *   matches/{matchId}/hands/{uid}      �?� solo el dueño puede leer
 *     cards: Card[]
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { Card, CardColor, GamePhase } from './CeroEngine';
type MatchFormat = '1v1' | '2v2';
interface PlayerInfo {
    uid: string;
    name: string;
    index: number;
    isGuest?: boolean;
}
interface LastAction {
    type: string;
    uid: string;
    playerIdx: number;
    card?: Partial<Card> | null;
    color?: CardColor | null;
    count?: number | undefined;
}
export interface MatchDoc {
    status: 'waiting' | 'playing' | 'finished';
    mode: 'classic' | 'cero';
    format?: MatchFormat;
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
    ceroCalled?: number[] | null;
    lastAction: LastAction | null;
    absences?: Record<string, {
        rejoinUntil: FirebaseFirestore.Timestamp;
        leftAt: FirebaseFirestore.Timestamp;
    }>;
    rejoinBanner?: {
        absentUid: string;
        absentName: string;
        rejoinUntil: FirebaseFirestore.Timestamp;
    } | null;
    tournamentId?: string | null;
    tournamentRound?: number | null;
    bracketSlot?: number | null;
    guestOnly?: boolean;
    isPrivate?: boolean;
    joinCode?: string | null;
    createdAt?: FirebaseFirestore.Timestamp | ReturnType<typeof FieldValue.serverTimestamp>;
    startedAt?: FirebaseFirestore.Timestamp | null;
    closedReason?: string;
}
/** Sala/partida colgada: waiting vieja o playing que nunca arranc� del todo. */
export declare function isStuckMatch(match: MatchDoc, now?: number): boolean;
/** Cierra waiting (delete) o playing colgada (finished + reembolso). */
export declare function forceCloseMatch(db: FirebaseFirestore.Firestore, matchRef: FirebaseFirestore.DocumentReference, match: MatchDoc, reason: string): Promise<void>;
/** Cierra una sala en espera, devuelve stake y la elimina del lobby. */
export declare function closeWaitingRoom(db: FirebaseFirestore.Firestore, matchRef: FirebaseFirestore.DocumentReference, match: MatchDoc, reason: string): Promise<void>;
type EndReason = 'won' | 'forfeit' | 'timeout';
export declare function startMatch(db: FirebaseFirestore.Firestore, matchRef: FirebaseFirestore.DocumentReference, match: MatchDoc): Promise<void>;
export declare const ensureMatchStarted: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
    started: boolean;
    status: string;
}>>;
interface JoinMatchRequest {
    mode?: string;
    format?: string;
    matchId?: string;
    stakeCC?: number;
    createNew?: boolean;
    isPrivate?: boolean;
    joinCode?: string;
}
interface JoinMatchResponse {
    matchId: string;
    playerIndex: number;
    charged: boolean;
    coinsLeft: number;
    stakeCC: number;
    joinCode?: string | null;
    isPrivate?: boolean;
    shareLink?: string | null;
}
/** Cierra salas waiting hu�rfanas/colgadas del jugador (p. ej. qued� una waiting + una playing). */
export declare function cleanupOrphanRoomsForUser(db: FirebaseFirestore.Firestore, uid: string): Promise<{
    closedWaiting: number;
    clearedRejoin: boolean;
}>;
export declare const cleanupMyRooms: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, Promise<{
    ok: true;
    closedWaiting: number;
    clearedRejoin: boolean;
    activeMatch: {
        matchId: string;
        status: string;
        stakeCC: number;
    } | null;
}>>;
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
 *   5. Si ok=true �?? escribe el nuevo estado atómicamente.
 *   6. Si ok=false �?? lanza HttpsError y la transacción hace rollback automático.
 */
export declare const playTurn: import("firebase-functions/v2/https").CallableFunction<PlayTurnRequest, Promise<PlayTurnResponse>>;
export declare const leaveMatch: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
}>>;
export declare const temporaryLeaveMatch: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
    rejoinUntil: number;
}>>;
export declare const checkMatchRejoinExpiry: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
    expired: boolean;
    winnerUid?: string;
}>>;
/** Escanea partidas en curso con reconexión vencida (cada minuto). */
export declare const expireRejoinMatches: import("firebase-functions/v2/scheduler").ScheduleFunction;
/** Cierra salas waiting colgadas sin rival (~4 min) y partidas playing atascadas. */
export declare const expireStaleWaitingMatches: import("firebase-functions/v2/scheduler").ScheduleFunction;
export declare const getRejoinStatus: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, Promise<{
    available: boolean;
    matchId?: string;
    rejoinUntil?: number;
    status?: string;
    stakeCC?: number;
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
export declare const getReplay: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, Promise<{
    ok: true;
    actions: unknown[];
}>>;
interface SendMatchChatRequest {
    matchId: string;
    type: 'text' | 'reaction' | 'projectile';
    text: string;
}
export declare const sendMatchChat: import("firebase-functions/v2/https").CallableFunction<SendMatchChatRequest, Promise<{
    ok: true;
}>>;
export {};
