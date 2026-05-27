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

import { onCall, HttpsError }       from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction }         from 'firebase-admin/firestore';
import { CeroEngine, COLORS }       from './CeroEngine';
import type { Card, CardColor, GamePhase, FullSnapshot, Player } from './CeroEngine';

// FunctionsErrorCode explícito — evita problemas con Parameters<typeof HttpsError>
type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración del negocio
// ─────────────────────────────────────────────────────────────────────────────

const CFG = {
  FREE_GAMES_LIMIT: 2,        // partidas gratis para nuevos usuarios
  ENTRY_COST_CC:    50,       // Cero Coins por partida paga
  HAND_SIZE:        7,
  TURN_SECONDS:     30,
  MAX_PLAYERS:      2,
  REGION:           'us-central1',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos Firestore
// ─────────────────────────────────────────────────────────────────────────────

interface VIPInfo {
  active:            boolean;
  plan:              'monthly' | 'annual';
  expiresAt:         FirebaseFirestore.Timestamp;
  coinsGrantedMonth: number;   // YYYYMM
}

interface UserDoc {
  email:            string;
  displayName:      string;
  ceroCoins:        number;
  freeGamesPlayed:  number;
  totalGamesPlayed: number;
  wins:             number;
  vip?:             VIPInfo;
}

interface PlayerInfo {
  uid:   string;
  name:  string;
  index: number;
}

interface LastAction {
  type:      string;
  uid:       string;
  playerIdx: number;
  card?:     Partial<Card> | null;
  color?:    CardColor | null;
  count?:    number | undefined;
}

interface MatchDoc {
  status:      'waiting' | 'playing' | 'finished';
  mode:        'classic' | 'cero';
  players:     PlayerInfo[];
  playerIds:   string[];
  playerCount: number;
  maxPlayers:  number;
  stakeCC:     number;
  turn:        number;
  // Estado público del juego
  phase:       GamePhase;
  current:     number | null;
  direction:   1 | -1 | null;
  drawStack:   number | null;
  chosenColor: CardColor | null;
  topDiscard:  Card | null;
  handCounts:  number[] | null;
  winner:      string | null;      // UID del ganador
  pendingTurn: number | null;
  lastAction:  LastAction | null;
}

interface PrivateServerDoc {
  deck:        Card[];
  discardPile: Card[];
  hands:       Card[][];           // índice = playerIdx
  ceroCalled:  number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

function requireString(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (typeof v !== 'string' || !v) throw new HttpsError('invalid-argument', `Falta "${key}"`);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// _applyMatchEndUpdates — helper compartido por playTurn, forfeitMatch y endMatch
// ─────────────────────────────────────────────────────────────────────────────

type EndReason = 'won' | 'forfeit' | 'timeout';

/**
 * Aplica todas las escrituras necesarias para cerrar una partida.
 * Acepta un updateFn genérico para ser usado dentro de Transaction o WriteBatch.
 *
 *   · match → status=finished, winner, phase=game_over, endReason
 *   · winner → wins+1, totalGamesPlayed+1, ceroCoins += pozo (si stakeCC > 0)
 *   · loser  → totalGamesPlayed+1
 */
function _applyMatchEndUpdates(
  updateFn: (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => void,
  db:        FirebaseFirestore.Firestore,
  matchRef:  FirebaseFirestore.DocumentReference,
  match:     MatchDoc,
  winnerUid: string,
  reason:    EndReason,
  extraMatchFields: Record<string, unknown> = {},
): void {
  const prize    = match.stakeCC * match.playerIds.length;
  const loserUid = match.playerIds.find(id => id !== winnerUid) ?? null;

  updateFn(matchRef, {
    status:     'finished',
    winner:     winnerUid,
    phase:      'game_over' as GamePhase,
    finishedAt: FieldValue.serverTimestamp(),
    endReason:  reason,
    ...extraMatchFields,
  });

  updateFn(db.doc(`users/${winnerUid}`), {
    wins:             FieldValue.increment(1),
    totalGamesPlayed: FieldValue.increment(1),
    ...(prize > 0 ? { ceroCoins: FieldValue.increment(prize) } : {}),
  });

  if (loserUid) {
    updateFn(db.doc(`users/${loserUid}`), { totalGamesPlayed: FieldValue.increment(1) });
  }
}

/** Construye el objeto de estado público que el cliente puede ver en tiempo real. */
function buildPublicState(snap: FullSnapshot, playerIds: string[]): Partial<MatchDoc> {
  return {
    phase:       snap.phase,
    current:     snap.current,
    direction:   snap.direction,
    drawStack:   snap.drawStack,
    chosenColor: snap.chosenColor ?? null,
    topDiscard:  snap.topDiscard  ?? null,
    handCounts:  [...snap.handCounts],
    winner:      snap.winner !== null ? (playerIds[snap.winner] ?? null) : null,
    pendingTurn: snap.pendingTurn ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// _startMatch — helper interno (no es un endpoint)
// ─────────────────────────────────────────────────────────────────────────────

async function startMatch(
  db:      FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match:   MatchDoc,
): Promise<void> {
  const { playerIds, players } = match;
  const names   = players.map(p => p.name);
  const engine  = new CeroEngine({ playerCount: playerIds.length, names, handSize: CFG.HAND_SIZE });
  const snap    = engine.toFullSnapshot();

  const batch = db.batch();

  // Incrementar freeGamesPlayed + totalGamesPlayed para todos los jugadores
  for (const uid of playerIds) {
    batch.update(db.doc(`users/${uid}`), {
      freeGamesPlayed:  FieldValue.increment(1),
      totalGamesPlayed: FieldValue.increment(1),
    });
  }

  // Estado privado del servidor (deck + discard + todas las manos)
  const privateRef = db.doc(`matches/${matchRef.id}/private/server`);
  batch.set(privateRef, {
    deck:        [...snap.deck],
    discardPile: [...snap.discardPile],
    hands:       snap.hands.map(h => [...h]),
    ceroCalled:  [...snap.ceroCalled],
    updatedAt:   FieldValue.serverTimestamp(),
  } satisfies Omit<PrivateServerDoc, never> & { updatedAt: ReturnType<typeof FieldValue.serverTimestamp> });

  // Mano individual de cada jugador (solo él puede leer)
  for (let i = 0; i < playerIds.length; i++) {
    const uid     = playerIds[i]!;
    const handRef = db.doc(`matches/${matchRef.id}/hands/${uid}`);
    batch.set(handRef, { cards: [...snap.hands[i]!], updatedAt: FieldValue.serverTimestamp() });
  }

  // Estado público de la partida
  batch.update(matchRef, {
    status:    'playing',
    turn:      1,
    startedAt: FieldValue.serverTimestamp(),
    ...buildPublicState(snap, playerIds),
  });

  await batch.commit();
}

// ─────────────────────────────────────────────────────────────────────────────
// joinMatch
// ─────────────────────────────────────────────────────────────────────────────

interface JoinMatchRequest {
  mode?:    string;
  format?:  string;
  matchId?: string;   // si se provee, une directamente a esa sala
}

interface JoinMatchResponse {
  matchId:    string;
  playerIndex: number;
  charged:    boolean;
  coinsLeft:  number;
}

/**
 * Verifica elegibilidad (partidas gratis o saldo), descuenta coins atómicamente
 * y une al jugador a una sala existente o crea una nueva.
 */
export const joinMatch = onCall<JoinMatchRequest, Promise<JoinMatchResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid             = request.auth!.uid;
    const mode            = request.data?.mode === 'cero' ? 'cero' : 'classic';
    const requestedMatchId = typeof request.data?.matchId === 'string' && request.data.matchId.length > 0
      ? request.data.matchId
      : null;
    const db   = getFirestore();

    // ── 1. Verificar elegibilidad y descontar coins (transacción atómica) ────
    const userRef = db.doc(`users/${uid}`);
    const { charged, coinsLeft } = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        // Crear perfil en la primera partida
        tx.set(userRef, {
          email:            request.auth!.token.email ?? '',
          displayName:      request.auth!.token.name  ?? 'Jugador',
          ceroCoins:        0,
          freeGamesPlayed:  0,
          totalGamesPlayed: 0,
          wins:             0,
        } satisfies UserDoc);
        return { charged: false, coinsLeft: 0 };
      }

      const user     = snap.data() as UserDoc;
      const freeUsed = user.freeGamesPlayed ?? 0;
      const balance  = user.ceroCoins       ?? 0;

      // ── VIP: partidas gratis ilimitadas ──────────────────────────────────
      const isVIPActive = !!(
        user.vip?.active === true &&
        (user.vip.expiresAt?.toMillis() ?? 0) > Date.now()
      );
      if (isVIPActive) {
        return { charged: false, coinsLeft: balance };
      }

      // ── Cupo gratuito ───────────────────────────────────────────────────
      if (freeUsed < CFG.FREE_GAMES_LIMIT) {
        return { charged: false, coinsLeft: balance };
      }

      // ── Pago en Coins ───────────────────────────────────────────────────
      guard(
        balance >= CFG.ENTRY_COST_CC,
        'resource-exhausted',
        `Saldo insuficiente. Necesitás ${CFG.ENTRY_COST_CC} CC, tenés ${balance}.`,
      );

      tx.update(userRef, { ceroCoins: FieldValue.increment(-CFG.ENTRY_COST_CC) });
      return { charged: true, coinsLeft: balance - CFG.ENTRY_COST_CC };
    });

    // ── 2. Buscar sala: por ID específico o cualquier sala abierta del modo ──
    const matchesRef = db.collection('matches');

    let matchId     = '';
    let playerIndex = -1;

    if (requestedMatchId) {
      // Unirse a sala específica — validar que exista y esté disponible
      const specificSnap = await db.doc(`matches/${requestedMatchId}`).get();
      guard(specificSnap.exists, 'not-found', 'Sala no encontrada');
      const d = specificSnap.data() as MatchDoc;
      guard(d.status === 'waiting',               'failed-precondition', 'La sala ya comenzó o terminó');
      guard(d.playerIds.length < CFG.MAX_PLAYERS, 'failed-precondition', 'La sala está llena');
      guard(!d.playerIds.includes(uid),           'failed-precondition', 'Ya estás en esta sala');
      matchId     = requestedMatchId;
      playerIndex = d.playerIds.length;
    } else {
      // Buscar cualquier sala abierta del mismo modo
      const openSnaps = await matchesRef
        .where('status',      '==', 'waiting')
        .where('mode',        '==', mode)
        .where('playerCount', '<',  CFG.MAX_PLAYERS)
        .orderBy('playerCount')
        .orderBy('createdAt')
        .limit(5)
        .get();

      for (const docSnap of openSnaps.docs) {
        const d = docSnap.data() as MatchDoc;
        if (d.playerIds.includes(uid)) continue;   // no unirse a sala propia
        matchId     = docSnap.id;
        playerIndex = d.playerIds.length;
        break;
      }
    }

    if (matchId) {
      // ── 3a. Unirse a sala existente (transacción) ─────────────────────────
      await db.runTransaction(async (tx: Transaction) => {
        const ref  = db.doc(`matches/${matchId}`);
        const snap = await tx.get(ref);
        const d    = snap.data() as MatchDoc;
        guard(d.status === 'waiting',                  'failed-precondition', 'Sala ya no disponible');
        guard(d.playerIds.length < CFG.MAX_PLAYERS,    'failed-precondition', 'Sala llena');
        guard(!d.playerIds.includes(uid),              'failed-precondition', 'Ya estás en esta sala');

        const newPlayers:  PlayerInfo[] = [...d.players, { uid, name: request.auth!.token.name ?? 'Jugador', index: d.playerIds.length }];
        const newIds:      string[]     = [...d.playerIds, uid];
        tx.update(ref, { players: newPlayers, playerIds: newIds, playerCount: newIds.length });
      });
    } else {
      // ── 3b. Crear sala nueva ──────────────────────────────────────────────
      const newMatchData: Omit<MatchDoc, 'lastAction'> & {
        stakeCC: number; createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
        startedAt: null; finishedAt: null; lastAction: null;
      } = {
        status:      'waiting',
        mode,
        players:     [{ uid, name: request.auth!.token.name ?? 'Jugador', index: 0 }],
        playerIds:   [uid],
        playerCount: 1,
        maxPlayers:  CFG.MAX_PLAYERS,
        stakeCC:     charged ? CFG.ENTRY_COST_CC : 0,
        turn:        0,
        phase:       'waiting',
        current:     null,
        direction:   null,
        drawStack:   null,
        chosenColor: null,
        topDiscard:  null,
        handCounts:  null,
        winner:      null,
        pendingTurn: null,
        createdAt:   FieldValue.serverTimestamp(),
        startedAt:   null,
        finishedAt:  null,
        lastAction:  null,
      };

      const ref  = await matchesRef.add(newMatchData);
      matchId    = ref.id;
      playerIndex = 0;
    }

    // ── 4. Si la sala está completa, iniciar partida ──────────────────────
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    const matchData = matchSnap.data() as MatchDoc;

    if (matchData.playerIds.length >= CFG.MAX_PLAYERS && matchData.status === 'waiting') {
      await startMatch(db, matchSnap.ref, matchData);
    }

    return { matchId, playerIndex, charged, coinsLeft };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// playTurn
// ─────────────────────────────────────────────────────────────────────────────

type TurnAction = 'play' | 'draw' | 'pickColor' | 'declareCero';

interface PlayTurnRequest {
  matchId:    string;
  turnNumber: number;   // debe coincidir con matches.turn (idempotencia)
  action:     TurnAction;
  cardId?:    number;   // requerido si action = 'play'
  color?:     string;   // requerido si action = 'pickColor'
}

interface PlayTurnResponse {
  ok:          true;
  publicState: Partial<MatchDoc>;
  myHand:      Card[];
  turn:        number;
}

const VALID_ACTIONS = new Set<TurnAction>(['play', 'draw', 'pickColor', 'declareCero']);

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
export const playTurn = onCall<PlayTurnRequest, Promise<PlayTurnResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid    = request.auth!.uid;
    const data   = request.data;

    guard(data?.matchId,     'invalid-argument', 'Falta matchId');
    guard(data?.action,      'invalid-argument', 'Falta action');
    guard(
      VALID_ACTIONS.has(data.action),
      'invalid-argument',
      `Acción inválida: "${data.action}"`,
    );

    const { matchId, action, turnNumber } = data;
    const db         = getFirestore();
    const matchRef   = db.doc(`matches/${matchId}`);
    const privateRef = db.doc(`matches/${matchId}/private/server`);
    const handRef    = db.doc(`matches/${matchId}/hands/${uid}`);

    let resultPublic!: Partial<MatchDoc>;
    let resultHand!:   Card[];
    let resultTurn!:   number;

    await db.runTransaction(async (tx: Transaction) => {
      // ── Leer los tres documentos en paralelo dentro de la transacción ─────
      const [matchSnap, privateSnap] = await Promise.all([
        tx.get(matchRef),
        tx.get(privateRef),
      ]);

      guard(matchSnap.exists,   'not-found',          'Partida no encontrada');
      guard(privateSnap.exists, 'failed-precondition', 'Estado de servidor no disponible');

      const match = matchSnap.data()  as MatchDoc;
      const priv  = privateSnap.data() as PrivateServerDoc;

      guard(match.status === 'playing',      'failed-precondition', 'La partida no está en curso');
      guard(match.playerIds.includes(uid),   'permission-denied',   'No sos parte de esta partida');
      guard(
        match.turn === turnNumber,
        'failed-precondition',
        `Turno desactualizado (servidor: ${match.turn}, cliente: ${turnNumber}). Recargá el estado.`,
      );

      // ── Reconstruir el motor desde el snapshot ────────────────────────────
      const fullSnap: FullSnapshot = {
        phase:       match.phase,
        current:     match.current     ?? 0,
        direction:   match.direction   ?? 1,
        drawStack:   match.drawStack   ?? 0,
        chosenColor: match.chosenColor ?? null,
        pendingTurn: match.pendingTurn ?? null,
        winner:      null,
        topDiscard:  match.topDiscard  ?? null,
        deckLeft:    priv.deck.length,
        hands:       priv.hands.map(h => [...h]),
        handCounts:  priv.hands.map(h => h.length),
        players:     match.players.map((p): Player => ({ id: p.index, name: p.name })),
        ceroCalled:  [...priv.ceroCalled],
        deck:        [...priv.deck],
        discardPile: [...priv.discardPile],
      };

      const engine      = CeroEngine.fromFullSnapshot(fullSnap);
      const playerIndex = match.playerIds.indexOf(uid);

      // declareCero no requiere que sea el turno del jugador
      if (action !== 'declareCero') {
        guard(engine.current === playerIndex, 'failed-precondition', 'No es tu turno');
      }

      // ── Ejecutar la acción ─────────────────────────────────────────────────
      let result: ReturnType<CeroEngine['play']> | ReturnType<CeroEngine['draw']> |
                  ReturnType<CeroEngine['pickColor']> | ReturnType<CeroEngine['declareCero']>;

      switch (action) {
        case 'play': {
          guard(typeof data.cardId === 'number', 'invalid-argument', 'Falta cardId');
          result = engine.play(playerIndex, data.cardId);
          break;
        }
        case 'draw': {
          result = engine.draw(playerIndex);
          break;
        }
        case 'pickColor': {
          guard(typeof data.color === 'string', 'invalid-argument', 'Falta color');
          const color = data.color as CardColor;
          guard((COLORS as readonly string[]).includes(color), 'invalid-argument', `Color inválido: "${color}"`);
          result = engine.pickColor(playerIndex, color);
          break;
        }
        case 'declareCero': {
          result = engine.declareCero(playerIndex);
          break;
        }
      }

      // ── Rollback si el motor rechaza la acción ────────────────────────────
      if (!result.ok) {
        throw new HttpsError('failed-precondition', result.error);
      }

      const newSnap = engine.toFullSnapshot();
      const newTurn = match.turn + 1;

      // ── Escribir nuevo estado (todo dentro de la misma transacción) ───────

      // 1. Estado privado del servidor
      tx.set(privateRef, {
        deck:        [...newSnap.deck],
        discardPile: [...newSnap.discardPile],
        hands:       newSnap.hands.map(h => [...h]),
        ceroCalled:  [...newSnap.ceroCalled],
        updatedAt:   FieldValue.serverTimestamp(),
      });

      // 2. Mano de cada jugador en su subcollección individual
      for (let i = 0; i < match.playerIds.length; i++) {
        const pUid    = match.playerIds[i]!;
        const pHRef   = db.doc(`matches/${matchId}/hands/${pUid}`);
        tx.set(pHRef, { cards: [...newSnap.hands[i]!], updatedAt: FieldValue.serverTimestamp() });
      }

      // 3. Construir estado público para el cliente
      const winnerUid = newSnap.winner !== null ? (match.playerIds[newSnap.winner] ?? null) : null;
      const isFinished = newSnap.phase === 'game_over';

      const lastAction: LastAction = {
        type:      action,
        uid,
        playerIdx: playerIndex,
        card:      (action === 'play' && data.cardId !== undefined)
                     ? { id: data.cardId }
                     : null,
        color:     action === 'pickColor' ? (data.color as CardColor) : null,
        count:     'drawn' in result
                     ? (result as { drawn: ReadonlyArray<Card> }).drawn.length
                     : undefined,
      };

      const publicPatch: Partial<MatchDoc> & Record<string, unknown> = {
        ...buildPublicState(newSnap, match.playerIds),
        turn:       newTurn,
        status:     isFinished ? 'finished' : 'playing',
        winner:     winnerUid,
        lastAction,
        ...(isFinished ? { finishedAt: FieldValue.serverTimestamp() } : {}),
      };

      tx.update(matchRef, publicPatch);

      // 4. Stats de usuario cuando la partida termina.
      // publicPatch ya escribió status/winner/finishedAt en el match; aquí solo
      // actualizamos los contadores de coins y partidas de cada jugador.
      if (isFinished && winnerUid) {
        const prize    = match.stakeCC * match.playerIds.length;
        const loserUid = match.playerIds.find(id => id !== winnerUid) ?? null;

        tx.update(db.doc(`users/${winnerUid}`), {
          wins:             FieldValue.increment(1),
          totalGamesPlayed: FieldValue.increment(1),
          ...(prize > 0 ? { ceroCoins: FieldValue.increment(prize) } : {}),
        });
        if (loserUid) {
          tx.update(db.doc(`users/${loserUid}`), { totalGamesPlayed: FieldValue.increment(1) });
        }
      }

      resultPublic = publicPatch;
      resultHand   = [...newSnap.hands[playerIndex]!];
      resultTurn   = newTurn;
    });

    return { ok: true, publicState: resultPublic, myHand: resultHand, turn: resultTurn };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// leaveMatch — salir de sala en espera (sin cobrar ni penalizar)
// ─────────────────────────────────────────────────────────────────────────────

export const leaveMatch = onCall<{ matchId: string }, Promise<{ ok: true }>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();
    const ref     = db.doc(`matches/${matchId}`);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      guard(snap.exists, 'not-found', 'Partida no encontrada');

      const match = snap.data() as MatchDoc;
      guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta sala');
      guard(match.status === 'waiting', 'failed-precondition', 'La partida ya comenzó');

      const remaining = match.playerIds.filter(id => id !== uid);
      const remainingPlayers = match.players.filter(p => p.uid !== uid);

      if (remaining.length === 0) {
        tx.delete(ref);
      } else {
        tx.update(ref, {
          playerIds:   remaining,
          players:     remainingPlayers.map((p, i) => ({ ...p, index: i })),
          playerCount: remaining.length,
        });
      }
    });

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// forfeitMatch
// ─────────────────────────────────────────────────────────────────────────────

interface ForfeitResponse { ok: true; winnerUid: string }

/** Abandono voluntario: entrega la victoria al rival y devuelve el pozo. */
export const forfeitMatch = onCall<{ matchId: string }, Promise<ForfeitResponse>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();

    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists,              'not-found',           'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(match.status === 'playing',    'failed-precondition', 'La partida no está en curso');
    guard(match.playerIds.includes(uid), 'permission-denied',   'No sos parte de esta partida');

    const winnerUid = match.playerIds.find(id => id !== uid) ?? '';
    guard(winnerUid, 'internal', 'No se pudo determinar el ganador');

    const batch = db.batch();
    _applyMatchEndUpdates(
      (ref, data) => batch.update(ref, data),
      db, matchSnap.ref, match, winnerUid, 'forfeit',
      { forfeit: { loserUid: uid, winnerUid } },
    );

    await batch.commit();
    return { ok: true, winnerUid };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// endMatch — cierre explícito de una partida (inactividad / admin)
// ─────────────────────────────────────────────────────────────────────────────

interface EndMatchRequest {
  matchId:   string;
  winnerUid: string;
  reason?:   EndReason;
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
export const endMatch = onCall<EndMatchRequest, Promise<ForfeitResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid      = request.auth!.uid;
    const data     = request.data as unknown as Record<string, unknown>;
    const matchId  = requireString(data, 'matchId');
    const winnerUid = requireString(data, 'winnerUid');
    const reason   = (data['reason'] as EndReason | undefined) ?? 'won';
    const db       = getFirestore();

    guard(
      ((['won', 'forfeit', 'timeout'] as EndReason[]) as string[]).includes(reason),
      'invalid-argument',
      `Razón inválida: "${reason}"`,
    );

    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists,               'not-found',           'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(match.status === 'playing',     'failed-precondition', 'La partida no está en curso');
    guard(match.playerIds.includes(uid),  'permission-denied',   'No sos parte de esta partida');
    guard(
      match.playerIds.includes(winnerUid),
      'invalid-argument',
      'El ganador no es parte de la partida',
    );

    // Si el caller no es el ganador, solo puede invocar endMatch por inactividad
    // verificando que el rival lleva más de TURN_SECONDS sin actividad.
    if (uid !== winnerUid) {
      const presenceSnap = await db
        .doc(`matches/${matchId}/presence/${winnerUid}`)
        .get();
      // Si el ganador (rival) tiene actividad reciente, rechazar
      if (presenceSnap.exists) {
        const lastSeen = (presenceSnap.data()?.lastSeen as FirebaseFirestore.Timestamp | undefined)
          ?.toMillis() ?? 0;
        const elapsed  = Date.now() - lastSeen;
        guard(
          elapsed > (CFG.TURN_SECONDS + 10) * 1000,
          'failed-precondition',
          'El rival sigue activo; no podés reclamar inactividad todavía',
        );
      }
    }

    const batch = db.batch();
    _applyMatchEndUpdates(
      (ref, d) => batch.update(ref, d),
      db, matchSnap.ref, match, winnerUid, reason,
    );

    await batch.commit();
    return { ok: true, winnerUid };
  },
);
