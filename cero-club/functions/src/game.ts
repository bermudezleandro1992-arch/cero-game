/**
 * CERO ‚?? M√≥dulo 2: Backend (TypeScript / Cloud Functions v2)
 *
 * Garant√≠as de seguridad:
 *   ¬∑ El cliente NUNCA puede escribir en `matches/` ni en `private/server`.
 *   ¬∑ Los balances de ceroCoins solo los modifica el Admin SDK dentro de una
 *     transacci√≥n Firestore ‚?? imposible de manipular desde el navegador.
 *   ¬∑ El mazo y las manos ajenas jam√°s se exponen al cliente.
 *   ¬∑ El n√∫mero de turno (`turn`) act√∫a como llave de idempotencia:
 *     requests duplicados o retrasados son rechazados sin efecto.
 *
 * Colecciones Firestore:
 *
 *   users/{uid}
 *     email: string
 *     displayName: string
 *     ceroCoins: number          ‚?ê balance; solo escribe el servidor
 *     freeGamesPlayed: number    ‚?ê partidas gratis usadas
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
 *     stakeCC: number            ‚?ê coins apostadas por partida
 *     turn: number               ‚?ê se incrementa en cada acci√≥n (idempotencia)
 *     phase / current / direction / drawStack / chosenColor / topDiscard /
 *     handCounts / winner / pendingTurn  ‚?ê estado p√∫blico (cliente escucha con onSnapshot)
 *     lastAction: LastAction | null
 *     createdAt / startedAt / finishedAt: Timestamp
 *
 *   matches/{matchId}/private/server   ‚?ê NADIE puede leer (solo Admin SDK)
 *     deck: Card[]
 *     discardPile: Card[]
 *     hands: Card[][]             ‚?ê indexado por playerIdx
 *     ceroCalled: number[]
 *
 *   matches/{matchId}/hands/{uid}      ‚?ê solo el due√±o puede leer
 *     cards: Card[]
 */

import { onCall, HttpsError }       from 'firebase-functions/v2/https';
import { onSchedule }               from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Transaction }         from 'firebase-admin/firestore';
import { CeroEngine, COLORS }       from './CeroEngine';
import type { Card, CardColor, GamePhase, FullSnapshot, Player } from './CeroEngine';
import { trackMissionAction }       from './missions';
import { sendPushToUser }           from './push';
import { getAppConfig, getWaitingRoomMs, validateStakeAmount } from './appConfig';

// FunctionsErrorCode expl√≠cito ‚?? evita problemas con Parameters<typeof HttpsError>
type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// Configuraci√≥n del negocio
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

const CFG = {
  FREE_GAMES_LIMIT: 2,        // partidas gratis para nuevos usuarios
  STAKE_MIN_CC:     30,       // apuesta mÌnima en salas personalizadas
  STAKE_MAX_CC:     20_000,   // apuesta m·xima en salas personalizadas
  HAND_SIZE:        7,
  TURN_SECONDS:     18,
  MAX_PLAYERS:      2,        // default 1v1
  REGION:           'us-central1',
  REJOIN_MS:        5 * 60 * 1000,   // 5 minutos para reingresar
  WAITING_ROOM_MS:  5 * 60 * 1000,   // default; override vÌa config/app (panel admin)
} as const;

type MatchFormat = '1v1' | '2v2';

function parseFormat(format: unknown): MatchFormat {
  return format === '2v2' ? '2v2' : '1v1';
}

function maxPlayersForFormat(format: MatchFormat): number {
  return format === '2v2' ? 4 : CFG.MAX_PLAYERS;
}

function matchMaxPlayers(match: MatchDoc): number {
  return match.maxPlayers ?? CFG.MAX_PLAYERS;
}

function resolveTeamOutcome(
  match: MatchDoc,
  winnerUid: string,
): { winnerUids: string[]; loserUids: string[] } {
  const ids    = uniquePlayerIds(match.playerIds);
  const format = match.format ?? '1v1';

  if (format !== '2v2' || ids.length < 4) {
    return {
      winnerUids: [winnerUid],
      loserUids:  ids.filter(id => id !== winnerUid),
    };
  }

  const winIdx     = ids.indexOf(winnerUid);
  const partnerIdx = winIdx >= 0 ? (winIdx + 2) % 4 : -1;
  const partnerUid = partnerIdx >= 0 ? ids[partnerIdx] : undefined;
  const winnerUids = partnerUid ? [winnerUid, partnerUid] : [winnerUid];

  return {
    winnerUids,
    loserUids: ids.filter(id => !winnerUids.includes(id)),
  };
}

function primaryWinnerForForfeit(match: MatchDoc, forfeiterUid: string): string {
  const ids    = uniquePlayerIds(match.playerIds);
  const format = match.format ?? '1v1';

  if (format !== '2v2' || ids.length < 4) {
    return ids.find(id => id !== forfeiterUid) ?? '';
  }

  const idx  = ids.indexOf(forfeiterUid);
  const team = idx >= 0 ? idx % 2 : 0;
  return ids[team === 0 ? 1 : 0] ?? ids.find(id => id !== forfeiterUid) ?? '';
}

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// Tipos Firestore
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

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
  uid:       string;
  name:      string;
  index:     number;
  isGuest?:  boolean;
  photoURL?: string | null;
}

interface LastAction {
  type:      string;
  uid:       string;
  playerIdx: number;
  card?:     Partial<Card> | null;
  color?:    CardColor | null;
  count?:    number | undefined;
}

export interface MatchDoc {
  status:      'waiting' | 'playing' | 'finished';
  mode:        'classic' | 'cero';
  format?:     MatchFormat;
  players:     PlayerInfo[];
  playerIds:   string[];
  playerCount: number;
  maxPlayers:  number;
  stakeCC:     number;
  turn:        number;
  // Estado p√∫blico del juego
  phase:       GamePhase;
  current:     number | null;
  direction:   1 | -1 | null;
  drawStack:   number | null;
  chosenColor: CardColor | null;
  topDiscard:  Card | null;
  handCounts:  number[] | null;
  winner:      string | null;      // UID del ganador
  pendingTurn: number | null;
  ceroCalled?: number[] | null;
  ceroForgot?: string | null;
  lastAction:  LastAction | null;
  absences?:   Record<string, { rejoinUntil: FirebaseFirestore.Timestamp; leftAt: FirebaseFirestore.Timestamp }>;
  rejoinBanner?: {
    absentUid:   string;
    absentName:  string;
    rejoinUntil: FirebaseFirestore.Timestamp;
  } | null;
  tournamentId?:    string | null;
  tournamentRound?: number | null;
  bracketSlot?:     number | null;
  guestOnly?:       boolean;
  isPrivate?:       boolean;
  joinCode?:        string | null;
  createdAt?:       FirebaseFirestore.Timestamp | ReturnType<typeof FieldValue.serverTimestamp>;
  startedAt?:       FirebaseFirestore.Timestamp | null;
  closedReason?:    string;
}

interface PrivateServerDoc {
  deck:        Card[];
  discardPile: Card[];
  hands:       Record<string, Card[]>;  // √≠ndice string ‚?? mano (Firestore no permite arrays anidados)
  ceroCalled:  number[];
}

function uniquePlayerIds(ids: string[] | undefined): string[] {
  return [...new Set((ids || []).filter(Boolean))];
}

function canRejoinMatch(match: MatchDoc, uid: string): boolean {
  if (!match.playerIds.includes(uid)) return false;
  const abs = match.absences?.[uid];
  if (!abs?.rejoinUntil) return match.status === 'waiting';
  return abs.rejoinUntil.toMillis() > Date.now();
}

async function clearPlayerAbsence(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  uid: string,
): Promise<void> {
  await matchRef.update({
    [`absences.${uid}`]: FieldValue.delete(),
    rejoinBanner:      FieldValue.delete(),
  });
  await db.doc(`users/${uid}`).set({ activeRejoin: FieldValue.delete() }, { merge: true });
}

async function expireAbsentPlayers(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match: MatchDoc,
): Promise<string | null> {
  const now = Date.now();
  for (const uid of match.playerIds) {
    const abs = match.absences?.[uid];
    if (!abs?.rejoinUntil || abs.rejoinUntil.toMillis() > now) continue;
    const winnerUid = match.playerIds.find(id => id !== uid);
    if (!winnerUid) continue;
    const batch = db.batch();
    _applyMatchEndUpdates(
      (ref, data) => batch.update(ref, data),
      db, matchRef, match, winnerUid, 'timeout',
      { forfeit: { loserUid: uid, winnerUid, reason: 'rejoin_expired' }, rejoinBanner: FieldValue.delete() },
    );
    await batch.commit();

    await _onMatchFinishedHooks(matchRef.id, winnerUid);

    return winnerUid;
  }
  return null;
}

function handsToStorage(hands: ReadonlyArray<ReadonlyArray<Card>>): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  hands.forEach((hand, i) => { out[String(i)] = [...hand]; });
  return out;
}

function handsFromStorage(raw: unknown, count: number): Card[][] {
  if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
    return (raw as Card[][]).map(h => [...h]);
  }
  const map = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Card[]>;
  return Array.from({ length: count }, (_, i) => [...(map[String(i)] || [])]);
}

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// Helpers
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

/** Hooks post-partida: torneos + liquidaci√≥n de apuestas de espectadores. */
async function _onMatchFinishedHooks(matchId: string, winnerUid: string): Promise<void> {
  try {
    const { onTournamentMatchFinished } = await import('./tournaments');
    await onTournamentMatchFinished(matchId, winnerUid);
  } catch (err) {
    console.error('[onMatchFinished] tournament hook:', err);
  }
  try {
    const { settleMatchBets } = await import('./wallet');
    await settleMatchBets(getFirestore(), matchId, winnerUid);
  } catch (err) {
    console.error('[onMatchFinished] bet settlement:', err);
  }
}

function requireString(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (typeof v !== 'string' || !v) throw new HttpsError('invalid-argument', `Falta "${key}"`);
  return v;
}

function isGuestAuth(auth: { token: Record<string, unknown> }): boolean {
  const firebase = auth.token['firebase'] as { sign_in_provider?: string } | undefined;
  return firebase?.sign_in_provider === 'anonymous';
}

function isGuestUserData(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return data?.['isGuest'] === true || data?.['anon'] === true;
}

async function userIsGuest(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<boolean> {
  const snap = await db.doc(`users/${uid}`).get();
  return isGuestUserData(snap.data());
}

function matchCreatedMs(createdAt: MatchDoc['createdAt']): number {
  if (!createdAt || typeof (createdAt as FirebaseFirestore.Timestamp).toMillis !== 'function') {
    return 0;
  }
  return (createdAt as FirebaseFirestore.Timestamp).toMillis();
}

function matchAgeMs(match: MatchDoc): number {
  const started = match.startedAt ? matchCreatedMs(match.startedAt) : 0;
  return started || matchCreatedMs(match.createdAt);
}

/** Sala/partida colgada: waiting vieja o playing que nunca arrancÛ del todo. */
export function isStuckMatch(match: MatchDoc, now = Date.now(), waitingMs = CFG.WAITING_ROOM_MS): boolean {
  const ageMs = matchAgeMs(match);
  const oldEnough = ageMs === 0 || now - ageMs >= waitingMs;
  if (!oldEnough) return false;
  if (match.status === 'waiting') return true;
  if (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard) return true;
  return false;
}

async function clearActiveRejoinForPlayers(
  db: FirebaseFirestore.Firestore,
  playerIds: string[],
): Promise<void> {
  const batch = db.batch();
  for (const uid of playerIds) {
    batch.set(db.doc(`users/${uid}`), { activeRejoin: FieldValue.delete() }, { merge: true });
  }
  await batch.commit();
}

/** Cierra waiting (delete) o playing colgada (finished + reembolso). */
export async function forceCloseMatch(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match: MatchDoc,
  reason: string,
): Promise<void> {
  if (match.status === 'waiting') {
    await closeWaitingRoom(db, matchRef, match, reason);
    await clearActiveRejoinForPlayers(db, match.playerIds);
    return;
  }

  if (match.status !== 'playing') return;

  const batch = db.batch();
  const stake = match.stakeCC ?? 0;
  for (const uid of match.playerIds) {
    const upd: Record<string, unknown> = { activeRejoin: FieldValue.delete() };
    if (stake > 0) upd.ceroCoins = FieldValue.increment(stake);
    batch.set(db.doc(`users/${uid}`), upd, { merge: true });
  }
  batch.update(matchRef, {
    status:       'finished',
    phase:        'game_over',
    winner:       null,
    finishedAt:   FieldValue.serverTimestamp(),
    closedReason: reason,
    rejoinBanner: FieldValue.delete(),
  });
  await batch.commit();

  await db.collection('coin_ledger').add({
    matchId:   matchRef.id,
    type:      'match_admin_closed',
    reason,
    playerIds: match.playerIds,
    stakeCC:   stake,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

function playerIsGuest(match: MatchDoc, uid: string): boolean {
  const p = match.players.find(x => x.uid === uid);
  return p?.isGuest === true;
}

async function assertCanJoinWaitingRoom(
  db: FirebaseFirestore.Firestore,
  uid: string,
  match: MatchDoc,
  joiningUserIsGuest: boolean,
): Promise<void> {
  if (joiningUserIsGuest) {
    guard(
      match.stakeCC === 0,
      'permission-denied',
      'Como invitado solo podÈs entrar a salas gratuitas (0 CN). Cre· cuenta para jugar por premios.',
    );
  }

  // Salas gratuitas (0 CN): invitados y registrados pueden jugar juntos (juego r·pido).
  if ((match.stakeCC ?? 0) === 0) return;

  const otherIds = match.playerIds.filter(id => id !== uid);
  if (otherIds.length === 0) return;

  const flags = await Promise.all(otherIds.map(async id => ({
    id,
    guest: await userIsGuest(db, id),
  })));

  if (joiningUserIsGuest) {
    guard(
      flags.every(f => f.guest),
      'permission-denied',
      'Esta sala tiene jugadores registrados. Cre√° una sala invitado o registrate para m√°s opciones.',
    );
    return;
  }

  guard(
    !match.guestOnly,
    'permission-denied',
    'Sala exclusiva para invitados. Eleg√≠ otra sala abierta.',
  );
  guard(
    flags.every(f => !f.guest),
    'permission-denied',
    'Hay un invitado en esta sala. Unite a otra sala gratuita.',
  );
}

/** Cierra una sala en espera, devuelve stake y la elimina del lobby. */
export async function closeWaitingRoom(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match: MatchDoc,
  reason: string,
): Promise<void> {
  const batch = db.batch();

  if (match.stakeCC > 0) {
    for (const uid of match.playerIds) {
      batch.update(db.doc(`users/${uid}`), {
        ceroCoins: FieldValue.increment(match.stakeCC),
      });
    }
  }

  batch.delete(matchRef);
  await batch.commit();

  await db.collection('coin_ledger').add({
    matchId:   matchRef.id,
    type:      'waiting_room_closed',
    reason,
    playerIds: match.playerIds,
    stakeCC:   match.stakeCC ?? 0,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => { /* no bloquear */ });
}

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// _applyMatchEndUpdates ‚?? helper compartido por playTurn, forfeitMatch y endMatch
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

type EndReason = 'won' | 'forfeit' | 'timeout';

/**
 * Aplica todas las escrituras necesarias para cerrar una partida.
 * Acepta un updateFn gen√©rico para ser usado dentro de Transaction o WriteBatch.
 *
 *   ¬∑ match ‚?? status=finished, winner, phase=game_over, endReason
 *   ¬∑ winner ‚?? wins+1, totalGamesPlayed+1, ceroCoins += pozo (si stakeCC > 0)
 *   ¬∑ loser  ‚?? totalGamesPlayed+1
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
  const prize = match.stakeCC * match.playerIds.length;
  const { winnerUids, loserUids } = resolveTeamOutcome(match, winnerUid);
  const coinRecipient = winnerUids[0] ?? winnerUid;

  updateFn(matchRef, {
    status:     'finished',
    winner:     winnerUid,
    phase:      'game_over' as GamePhase,
    finishedAt: FieldValue.serverTimestamp(),
    endReason:  reason,
    winningTeam: winnerUids,
    ...extraMatchFields,
  });

  for (const wUid of winnerUids) {
    if (playerIsGuest(match, wUid)) continue;
    updateFn(db.doc(`users/${wUid}`), {
      wins:             FieldValue.increment(1),
      totalGamesPlayed: FieldValue.increment(1),
      xp:               FieldValue.increment(25),
      ...(wUid === coinRecipient && prize > 0 ? { ceroCoins: FieldValue.increment(prize) } : {}),
    });
  }

  for (const lUid of loserUids) {
    if (playerIsGuest(match, lUid)) continue;
    updateFn(db.doc(`users/${lUid}`), { totalGamesPlayed: FieldValue.increment(1) });
  }
}

/** Construye el objeto de estado p√∫blico que el cliente puede ver en tiempo real. */
function buildPublicState(snap: FullSnapshot, playerIds: string[]): Partial<MatchDoc> {
  return {
    phase:       snap.phase,
    current:     snap.current,
    direction:   snap.direction,
    drawStack:   snap.drawStack,
    chosenColor: snap.chosenColor ?? null,
    topDiscard:  snap.topDiscard  ?? null,
    handCounts:  [...snap.handCounts],
    ceroCalled:  [...snap.ceroCalled],
    winner:      snap.winner !== null ? (playerIds[snap.winner] ?? null) : null,
    pendingTurn: snap.pendingTurn ?? null,
  };
}

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// _startMatch ‚?? helper interno (no es un endpoint)
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export async function startMatch(
  db:      FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match:   MatchDoc,
): Promise<void> {
  const freshSnap = await matchRef.get();
  if (freshSnap.exists) {
    const fresh = freshSnap.data() as MatchDoc;
    if (fresh.status === 'playing' && fresh.topDiscard) {
      return;
    }
  }

  const { playerIds, players } = match;
  const uniqueIds = uniquePlayerIds(playerIds);
  guard(
    uniqueIds.length >= matchMaxPlayers(match),
    'failed-precondition',
    'Faltan jugadores para iniciar la partida',
  );

  const names   = players.filter(p => uniqueIds.includes(p.uid)).map(p => p.name);
  const engine  = new CeroEngine({ playerCount: uniqueIds.length, names, handSize: CFG.HAND_SIZE });
  const dealt   = engine.deal();
  guard(dealt.ok, 'internal', dealt.ok ? 'ok' : (dealt as { ok: false; error: string }).error);

  const snap    = engine.toFullSnapshot();

  const batch = db.batch();

  // Incrementar freeGamesPlayed + totalGamesPlayed (solo jugadores registrados)
  for (const uid of uniqueIds) {
    if (playerIsGuest(match, uid)) continue;
    batch.set(db.doc(`users/${uid}`), {
      freeGamesPlayed:  FieldValue.increment(1),
      totalGamesPlayed: FieldValue.increment(1),
    }, { merge: true });
  }

  // Estado privado del servidor (deck + discard + todas las manos)
  const privateRef = db.doc(`matches/${matchRef.id}/private/server`);
  batch.set(privateRef, {
    deck:        [...snap.deck],
    discardPile: [...snap.discardPile],
    hands:       handsToStorage(snap.hands),
    ceroCalled:  [...snap.ceroCalled],
    updatedAt:   FieldValue.serverTimestamp(),
  } satisfies Omit<PrivateServerDoc, never> & { updatedAt: ReturnType<typeof FieldValue.serverTimestamp> });

  // Mano individual de cada jugador (solo √©l puede leer)
  for (let i = 0; i < uniqueIds.length; i++) {
    const uid     = uniqueIds[i]!;
    const handRef = db.doc(`matches/${matchRef.id}/hands/${uid}`);
    batch.set(handRef, { cards: [...snap.hands[i]!], updatedAt: FieldValue.serverTimestamp() });
  }

  const { bettingOpenUntilTimestamp } = await import('./wallet');

  // Estado p√∫blico de la partida
  batch.update(matchRef, {
    status:            'playing',
    turn:              1,
    startedAt:         FieldValue.serverTimestamp(),
    bettingOpenUntil:  bettingOpenUntilTimestamp(),
    betPoolTotal:      0,
    betCount:          0,
    spectatorCount:    0,
    playerIds:         uniqueIds,
    playerCount:       uniqueIds.length,
    ...buildPublicState(snap, uniqueIds),
  });

  await batch.commit();
}

function matchNeedsStart(match: MatchDoc): boolean {
  const ids = uniquePlayerIds(match.playerIds);
  return ids.length >= matchMaxPlayers(match) &&
    (match.status === 'waiting' ||
      (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard));
}

async function notifyMatchPlayers(
  playerIds: string[],
  title:     string,
  body:      string,
  data:      Record<string, string>,
  exceptUid?: string,
): Promise<void> {
  await Promise.allSettled(
    playerIds
      .filter(id => id && id !== exceptUid)
      .map(id => sendPushToUser(id, title, body, data)),
  );
}

async function tryStartMatchIfReady(
  db: FirebaseFirestore.Firestore,
  matchRef: FirebaseFirestore.DocumentReference,
  match: MatchDoc,
): Promise<boolean> {
  const ids = uniquePlayerIds(match.playerIds);
  const normalized = { ...match, playerIds: ids, playerCount: ids.length };
  if (!matchNeedsStart(normalized)) return false;
  await startMatch(db, matchRef, normalized);
  return true;
}

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// ensureMatchStarted ? cliente/spectator puede forzar inicio si la sala quedÛ colgada
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export const ensureMatchStarted = onCall<{ matchId: string }, Promise<{ ok: true; started: boolean; status: string }>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'TenÈs que iniciar sesiÛn');

    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();
    const ref     = db.doc(`matches/${matchId}`);
    const snap    = await ref.get();
    guard(snap.exists, 'not-found', 'Partida no encontrada');

    const match = snap.data() as MatchDoc;
    const started = await tryStartMatchIfReady(db, ref, match);
    const after   = (await ref.get()).data() as MatchDoc;
    return { ok: true, started, status: after.status };
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// joinMatch
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

interface JoinMatchRequest {
  mode?:      string;
  format?:    string;
  matchId?:   string;   // si se provee, une directamente a esa sala
  stakeCC?:   number;   // 0 = gratuita; 30?20_000 = sala con Cero Coins (solo al crear)
  createNew?: boolean;  // true = forzar sala nueva (no reutilizar waiting propia)
  isPrivate?: boolean;  // sala privada ? requiere joinCode para entrar
  joinCode?:  string;    // clave al unirse a sala privada
}

interface JoinMatchResponse {
  matchId:     string;
  playerIndex: number;
  charged:     boolean;
  coinsLeft:   number;
  stakeCC:     number;
  joinCode?:   string | null;
  isPrivate?:  boolean;
  shareLink?:  string | null;
}

/** CÛdigo numÈrico de 6 dÌgitos para salas privadas (f·cil de compartir). */
function makeJoinCode(): string {
  return String(100_000 + Math.floor(Math.random() * 900_000));
}

async function parseRequestedStake(stakeCC: unknown, db: FirebaseFirestore.Firestore): Promise<number> {
  const n = typeof stakeCC === 'number' ? stakeCC : Number(stakeCC);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const cfg = await getAppConfig(db);
  return validateStakeAmount(Math.round(n), cfg);
}

function assertPrivateJoinAllowed(
  match: MatchDoc,
  uid: string,
  joinCode: unknown,
  alreadyInRoom: boolean,
): void {
  if (!match.isPrivate || alreadyInRoom) return;
  const code = typeof joinCode === 'string' ? joinCode.trim().replace(/\D/g, '') : '';
  const expected = String(match.joinCode ?? '').trim();
  guard(
    code.length > 0 && code === expected,
    'permission-denied',
    'Sala privada. Necesit·s el cÛdigo de 6 dÌgitos o el link del creador.',
  );
}

async function chargeEntryStake(
  db: FirebaseFirestore.Firestore,
  uid: string,
  auth: { token: { email?: string; name?: string } },
  stakeCC: number,
): Promise<{ charged: boolean; coinsLeft: number }> {
  if (stakeCC <= 0) {
    const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
    return { charged: false, coinsLeft: bal };
  }

  return db.runTransaction(async (tx: Transaction) => {
    const userRef = db.doc(`users/${uid}`);
    const snap    = await tx.get(userRef);

    if (!snap.exists) {
      tx.set(userRef, {
        email:            auth.token.email ?? '',
        displayName:      auth.token.name  ?? 'Jugador',
        ceroCoins:        0,
        freeGamesPlayed:  0,
        totalGamesPlayed: 0,
        wins:             0,
      } satisfies UserDoc);
      guard(false, 'resource-exhausted', `Saldo insuficiente. Necesit√°s ${stakeCC} CN, ten√©s 0.`);
    }

    const user = snap.data() as UserDoc;
    const balance = user.ceroCoins ?? 0;

    const isVIPActive = !!(
      user.vip?.active === true &&
      (user.vip.expiresAt?.toMillis() ?? 0) > Date.now()
    );
    if (isVIPActive) {
      return { charged: false, coinsLeft: balance };
    }

    guard(
      balance >= stakeCC,
      'resource-exhausted',
      `Saldo insuficiente. Necesit√°s ${stakeCC} CN, ten√©s ${balance}.`,
    );

    tx.update(userRef, { ceroCoins: FieldValue.increment(-stakeCC) });
    return { charged: true, coinsLeft: balance - stakeCC };
  });
}

async function findActiveMatchForUser(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<{ id: string; data: MatchDoc } | null> {
  for (const status of ['playing', 'waiting'] as const) {
    const snap = await db.collection('matches')
      .where('status', '==', status)
      .where('playerIds', 'array-contains', uid)
      .limit(5)
      .get();
    if (!snap.empty) {
      const doc = snap.docs[0]!;
      return { id: doc.id, data: doc.data() as MatchDoc };
    }
  }
  return null;
}

/** Cierra salas waiting huÈrfanas/colgadas del jugador (p. ej. quedÛ una waiting + una playing). */
export async function cleanupOrphanRoomsForUser(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<{ closedWaiting: number; clearedRejoin: boolean }> {
  let closedWaiting = 0;
  let clearedRejoin = false;
  const waitingMs = await getWaitingRoomMs(db);

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const activeRejoin = userSnap.data()?.activeRejoin as {
    matchId?: string;
    rejoinUntil?: FirebaseFirestore.Timestamp;
  } | undefined;

  if (activeRejoin?.matchId) {
    const rejoinSnap = await db.doc(`matches/${activeRejoin.matchId}`).get();
    const untilMs = activeRejoin.rejoinUntil?.toMillis?.() ?? 0;
    const rejoinValid = rejoinSnap.exists
      && untilMs > Date.now()
      && canRejoinMatch(rejoinSnap.data() as MatchDoc, uid);
    if (!rejoinValid) {
      await userRef.set({ activeRejoin: FieldValue.delete() }, { merge: true });
      clearedRejoin = true;
    }
  }

  const [waitingSnap, playingSnap] = await Promise.all([
    db.collection('matches')
      .where('status', '==', 'waiting')
      .where('playerIds', 'array-contains', uid)
      .get(),
    db.collection('matches')
      .where('status', '==', 'playing')
      .where('playerIds', 'array-contains', uid)
      .get(),
  ]);

  const hasPlaying = !playingSnap.empty;
  const now = Date.now();

  for (const docSnap of waitingSnap.docs) {
    const match = docSnap.data() as MatchDoc;
    const createdMs = matchCreatedMs(match.createdAt);
    const stale = createdMs > 0 && now - createdMs >= waitingMs;
    const orphan = hasPlaying;

    if (orphan || stale) {
      await forceCloseMatch(db, docSnap.ref, match, orphan ? 'orphan_waiting' : 'waiting_expired');
      closedWaiting++;
    }
  }

  for (const docSnap of playingSnap.docs) {
    const match = docSnap.data() as MatchDoc;
    if (!isStuckMatch(match, now, waitingMs)) continue;
    await tryStartMatchIfReady(db, docSnap.ref, match);
    const fresh = (await docSnap.ref.get()).data() as MatchDoc | undefined;
    if (fresh && isStuckMatch(fresh, now, waitingMs)) {
      await forceCloseMatch(db, docSnap.ref, fresh, 'stuck_playing_cleanup');
      closedWaiting++;
    }
  }

  return { closedWaiting, clearedRejoin };
}

export const cleanupMyRooms = onCall<Record<string, never>, Promise<{
  ok: true;
  closedWaiting: number;
  clearedRejoin: boolean;
  activeMatch: { matchId: string; status: string; stakeCC: number } | null;
}>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'TenÈs que iniciar sesiÛn');

    const uid = request.auth!.uid;
    const db  = getFirestore();

    const { closedWaiting, clearedRejoin } = await cleanupOrphanRoomsForUser(db, uid);
    const active = await findActiveMatchForUser(db, uid);

    return {
      ok: true,
      closedWaiting,
      clearedRejoin,
      activeMatch: active
        ? { matchId: active.id, status: active.data.status, stakeCC: active.data.stakeCC ?? 0 }
        : null,
    };
  },
);

/**
 * Verifica elegibilidad (partidas gratis o saldo), descuenta coins at√≥micamente
 * y une al jugador a una sala existente o crea una nueva.
 */
export const joinMatch = onCall<JoinMatchRequest, Promise<JoinMatchResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid             = request.auth!.uid;
    const callerIsGuest   = isGuestAuth(request.auth!);
    const db              = getFirestore();
    const appCfg          = await getAppConfig(db);
    const requestedMode   = request.data?.mode === 'cero' ? 'cero' : 'classic';
    guard(
      requestedMode !== 'cero' || appCfg.chaoticModeEnabled,
      'failed-precondition',
      'CERO CaÛtico estar· disponible pronto. Por ahora jug· CERO Cl·sico.',
    );
    const mode            = requestedMode;
    const createFormat    = parseFormat(request.data?.format);
    const createMaxPlayers = maxPlayersForFormat(createFormat);
    const requestedMatchId = typeof request.data?.matchId === 'string' && request.data.matchId.length > 0
      ? request.data.matchId
      : null;
    const forceCreate = request.data?.createNew === true;

    await cleanupOrphanRoomsForUser(db, uid);

    const existingActive = await findActiveMatchForUser(db, uid);

    const finishJoin = async (
      matchId: string,
      playerIndex: number,
      charged: boolean,
      coinsLeft: number,
      stakeCC: number,
      notifyJoin = false,
    ): Promise<JoinMatchResponse> => {
      const matchSnap = await db.doc(`matches/${matchId}`).get();
      const matchData = matchSnap.data() as MatchDoc | undefined;
      const wasWaiting = matchData?.status === 'waiting';
      if (matchData) {
        const started = await tryStartMatchIfReady(db, matchSnap.ref, matchData);
        const fresh = (await db.doc(`matches/${matchId}`).get()).data() as MatchDoc | undefined;
        if (fresh) {
          const joinerName = request.auth!.token.name ?? 'Jugador';
          if (notifyJoin && wasWaiting && fresh.status === 'waiting') {
            void notifyMatchPlayers(
              uniquePlayerIds(fresh.playerIds),
              'CERO Club',
              `${joinerName} se uniÛ (${fresh.playerCount}/${fresh.maxPlayers})`,
              { type: 'player_joined', matchId },
              uid,
            );
          }
          if (started || (wasWaiting && fresh.status === 'playing')) {
            void notifyMatchPlayers(
              uniquePlayerIds(fresh.playerIds),
              'CERO Club',
              '°La partida empezÛ! Entr· a jugar.',
              { type: 'match_started', matchId },
            );
          }
        }
      }
      const finalSnap = await db.doc(`matches/${matchId}`).get();
      const finalData = finalSnap.data() as MatchDoc | undefined;
      const joinCode = finalData?.joinCode ?? null;
      const isPrivate = finalData?.isPrivate === true;
      const shareLink = isPrivate && joinCode
        ? `https://cero-club.web.app/app/?code=${joinCode}`
        : null;
      return { matchId, playerIndex, charged, coinsLeft, stakeCC, joinCode, isPrivate, shareLink };
    };

    // ‚??‚?? 0. Reingreso a sala propia (sin cobrar de nuevo) ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
    if (requestedMatchId) {
      if (existingActive && existingActive.id !== requestedMatchId) {
        guard(false, 'failed-precondition',
          'Ya tenÈs una sala o partida activa. VolvÈ a ella antes de unirte a otra.');
      }
      const pre = await db.doc(`matches/${requestedMatchId}`).get();
      if (pre.exists) {
        const d = pre.data() as MatchDoc;
        const ids = uniquePlayerIds(d.playerIds);
        if (ids.includes(uid)) {
          const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
          guard(canRejoinMatch(d, uid), 'failed-precondition',
            d.status === 'playing'
              ? 'El plazo de 5 minutos para reingresar expir√≥'
              : 'No pod√©s reingresar a esta sala');
          if (d.status === 'playing') {
            await clearPlayerAbsence(db, pre.ref, uid);
          }
          return finishJoin(requestedMatchId, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
        }
      }
    } else if (!forceCreate && existingActive) {
      const d = existingActive.data;
      const ids = uniquePlayerIds(d.playerIds);
      const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
      if (d.status === 'playing' && canRejoinMatch(d, uid)) {
        await clearPlayerAbsence(db, db.doc(`matches/${existingActive.id}`), uid);
        return finishJoin(existingActive.id, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
      }
      if (d.status === 'waiting' && ids.length < matchMaxPlayers(d)) {
        return finishJoin(existingActive.id, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
      }
    } else if (forceCreate && existingActive) {
      guard(false, 'failed-precondition',
        'Ya tenÈs una sala o partida activa. VolvÈ a ella antes de crear otra.');
    }

    const matchesRef = db.collection('matches');

    let matchId     = '';
    let playerIndex = -1;
    let entryStake  = 0;

    if (requestedMatchId) {
      const specificSnap = await db.doc(`matches/${requestedMatchId}`).get();
      guard(specificSnap.exists, 'not-found', 'Sala no encontrada');
      const d = specificSnap.data() as MatchDoc;
      const ids = uniquePlayerIds(d.playerIds);
      guard(d.status === 'waiting',               'failed-precondition', 'La sala ya comenz√≥ o termin√≥');
      guard(ids.length < matchMaxPlayers(d),         'failed-precondition', 'La sala est· llena');
      guard(!ids.includes(uid),                   'failed-precondition', 'Ya est√°s en esta sala');
      assertPrivateJoinAllowed(d, uid, request.data?.joinCode, false);
      await assertCanJoinWaitingRoom(db, uid, d, callerIsGuest || await userIsGuest(db, uid));
      matchId     = requestedMatchId;
      playerIndex = ids.length;
      entryStake  = d.stakeCC ?? 0;
    } else {
      guard(!existingActive, 'failed-precondition',
        'Ya tenÈs una sala o partida activa. VolvÈ a ella antes de crear otra.');
      entryStake = callerIsGuest ? 0 : await parseRequestedStake(request.data?.stakeCC, db);
      guard(!callerIsGuest || entryStake === 0, 'permission-denied',
        'Como invitado solo pod√©s crear salas gratuitas (0 CeroCoins).');
      guard(appCfg.freeRoomsEnabled !== false || entryStake > 0, 'failed-precondition',
        'Las salas gratis est·n desactivadas. ElegÌ una apuesta en CeroCoins.');
    }

    const createPrivate = request.data?.isPrivate === true && !callerIsGuest;

    const { charged, coinsLeft } = await chargeEntryStake(
      db, uid, request.auth!, entryStake,
    );

    const joiningUserIsGuest = callerIsGuest || await userIsGuest(db, uid);

    if (matchId) {
      // ‚??‚?? 3a. Unirse a sala existente (transacci√≥n) ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
      await db.runTransaction(async (tx: Transaction) => {
        const ref  = db.doc(`matches/${matchId}`);
        const snap = await tx.get(ref);
        const d    = snap.data() as MatchDoc;
        const ids  = uniquePlayerIds(d.playerIds);
        guard(d.status === 'waiting',                  'failed-precondition', 'Sala ya no disponible');
        guard(ids.length < matchMaxPlayers(d),            'failed-precondition', 'Sala llena');
        guard(!ids.includes(uid),                      'failed-precondition', 'Ya est√°s en esta sala');
        assertPrivateJoinAllowed(d, uid, request.data?.joinCode, false);

        const userSnap = await tx.get(db.doc(`users/${uid}`));
        const photoURL = (userSnap.data()?.photoURL as string | null | undefined) ?? null;

        const newPlayers:  PlayerInfo[] = [...d.players, {
          uid,
          name: request.auth!.token.name ?? 'Jugador',
          index: ids.length,
          isGuest: joiningUserIsGuest,
          photoURL,
        }];
        const newIds:      string[]     = [...ids, uid];
        tx.update(ref, { players: newPlayers, playerIds: newIds, playerCount: newIds.length });
      });
    } else {
      // ‚??‚?? 3b. Crear sala nueva ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
      const createIsGuest = callerIsGuest || await userIsGuest(db, uid);
      const roomJoinCode  = createPrivate ? makeJoinCode() : null;
      const creatorSnap   = await db.doc(`users/${uid}`).get();
      const creatorPhoto  = (creatorSnap.data()?.photoURL as string | null | undefined) ?? null;
      const newMatchData: Omit<MatchDoc, 'lastAction'> & {
        stakeCC: number; createdAt: ReturnType<typeof FieldValue.serverTimestamp>;
        startedAt: null; finishedAt: null; lastAction: null;
      } = {
        status:      'waiting',
        mode,
        format:      createFormat,
        players:     [{
          uid,
          name: request.auth!.token.name ?? 'Jugador',
          index: 0,
          isGuest: createIsGuest,
          photoURL: creatorPhoto,
        }],
        playerIds:   [uid],
        playerCount: 1,
        maxPlayers:  createMaxPlayers,
        stakeCC:     entryStake,
        guestOnly:   false,
        isPrivate:   createPrivate,
        joinCode:    roomJoinCode,
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

    return finishJoin(matchId, playerIndex, charged, coinsLeft, entryStake, true);
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// playTurn
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

type TurnAction = 'play' | 'draw' | 'pickColor' | 'declareCero' | 'penalizeCero';

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

const VALID_ACTIONS = new Set<TurnAction>(['play', 'draw', 'pickColor', 'declareCero', 'penalizeCero']);

/**
 * Ejecuta una acci√≥n de juego dentro de una transacci√≥n Firestore.
 *
 * Flujo:
 *   1. Lee match + private/server + hands/{uid} en la misma transacci√≥n.
 *   2. Valida turno con turnNumber (idempotencia).
 *   3. Reconstruye CeroEngine desde el snapshot privado.
 *   4. Ejecuta la acci√≥n (play / draw / pickColor / declareCero).
 *   5. Si ok=true ‚?? escribe el nuevo estado at√≥micamente.
 *   6. Si ok=false ‚?? lanza HttpsError y la transacci√≥n hace rollback autom√°tico.
 */
export const playTurn = onCall<PlayTurnRequest, Promise<PlayTurnResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid    = request.auth!.uid;
    const data   = request.data;

    guard(data?.matchId,     'invalid-argument', 'Falta matchId');
    guard(data?.action,      'invalid-argument', 'Falta action');
    guard(
      VALID_ACTIONS.has(data.action),
      'invalid-argument',
      `Acci√≥n inv√°lida: "${data.action}"`,
    );

    const { matchId, action, turnNumber } = data;
    const db         = getFirestore();
    const matchRef   = db.doc(`matches/${matchId}`);
    const privateRef = db.doc(`matches/${matchId}/private/server`);
    const handRef    = db.doc(`matches/${matchId}/hands/${uid}`);

    const preMatchSnap = await matchRef.get();
    if (preMatchSnap.exists) {
      const preMatch = preMatchSnap.data() as MatchDoc;
      const expiredWinner = await expireAbsentPlayers(db, matchRef, preMatch);
      if (expiredWinner) {
        throw new HttpsError('failed-precondition', 'La partida termin√≥ por abandono del rival');
      }
    }

    let resultPublic!: Partial<MatchDoc>;
    let resultHand!:   Card[];
    let resultTurn!:   number;
    let finishedWinner: string | null = null;
    let trackWild = false;
    let trackCero = false;
    let ceroForgotUid: string | null = null;
    const replayBox: { entry: {
      turn: number;
      action: LastAction;
      handCounts: number[];
      topDiscard: Card | null;
      phase: GamePhase;
      current: number | null;
    } | null } = { entry: null };

    await db.runTransaction(async (tx: Transaction) => {
      const [matchSnap, privateSnap] = await Promise.all([
        tx.get(matchRef),
        tx.get(privateRef),
      ]);

      guard(matchSnap.exists,   'not-found',          'Partida no encontrada');
      guard(privateSnap.exists, 'failed-precondition', 'Estado de servidor no disponible');

      const match = matchSnap.data()  as MatchDoc;
      const priv  = privateSnap.data() as PrivateServerDoc;

      guard(match.status === 'playing',      'failed-precondition', 'La partida no est√° en curso');
      guard(match.playerIds.includes(uid),   'permission-denied',   'No sos parte de esta partida');

      // Si el jugador volvi√≥ de una desconexi√≥n temporal, limpiar ausencia.
      if (match.absences?.[uid]) {
        tx.update(matchRef, {
          [`absences.${uid}`]: FieldValue.delete(),
          rejoinBanner:        FieldValue.delete(),
        });
        tx.set(db.doc(`users/${uid}`), { activeRejoin: FieldValue.delete() }, { merge: true });
      }

      guard(
        match.turn === turnNumber,
        'failed-precondition',
        `Turno desactualizado (servidor: ${match.turn}, cliente: ${turnNumber}). Recarg√° el estado.`,
      );

      const privHands = handsFromStorage(priv.hands, match.playerIds.length);

      // ‚??‚?? Reconstruir el motor desde el snapshot ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
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
        hands:       privHands.map(h => [...h]),
        handCounts:  privHands.map(h => h.length),
        players:     match.players.map((p): Player => ({ id: p.index, name: p.name })),
        ceroCalled:  [...priv.ceroCalled],
        deck:        [...priv.deck],
        discardPile: [...priv.discardPile],
      };

      const engine      = CeroEngine.fromFullSnapshot(fullSnap);
      const playerIndex = match.playerIds.indexOf(uid);

      // declareCero / penalizeCero no requieren que sea el turno del jugador
      if (action !== 'declareCero' && action !== 'penalizeCero') {
        guard(engine.current === playerIndex, 'failed-precondition', 'No es tu turno');
      }

      // ‚??‚?? Ejecutar la acci√≥n ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
      let result: ReturnType<CeroEngine['play']> | ReturnType<CeroEngine['draw']> |
                  ReturnType<CeroEngine['pickColor']> | ReturnType<CeroEngine['declareCero']> |
                  ReturnType<CeroEngine['penalizeCero']>;

      switch (action) {
        case 'play': {
          guard(typeof data.cardId === 'number', 'invalid-argument', 'Falta cardId');
          const playedCard = privHands[playerIndex]?.find(c => c.id === data.cardId);
          result = engine.play(playerIndex, data.cardId);
          if (result.ok && result.ceroViolation) {
            ceroForgotUid = uid;
          }
          if (result.ok && playedCard?.color === 'wild') {
            trackWild = true;
          }
          break;
        }
        case 'draw': {
          result = engine.draw(playerIndex);
          break;
        }
        case 'pickColor': {
          guard(typeof data.color === 'string', 'invalid-argument', 'Falta color');
          const color = data.color as CardColor;
          guard((COLORS as readonly string[]).includes(color), 'invalid-argument', `Color inv√°lido: "${color}"`);
          result = engine.pickColor(playerIndex, color);
          break;
        }
        case 'declareCero': {
          result = engine.declareCero(playerIndex);
          if (result.ok) trackCero = true;
          break;
        }
        case 'penalizeCero': {
          guard(match.ceroForgot, 'failed-precondition', 'Nadie olvidÛ declarar CERO');
          guard(match.ceroForgot !== uid, 'failed-precondition', 'No podÈs penalizarte');
          const targetIdx = match.playerIds.indexOf(match.ceroForgot);
          guard(targetIdx >= 0, 'failed-precondition', 'Jugador infractor no encontrado');
          result = engine.penalizeCero(targetIdx);
          ceroForgotUid = null;
          break;
        }
      }

      // ‚??‚?? Rollback si el motor rechaza la acci√≥n ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
      if (!result.ok) {
        throw new HttpsError('failed-precondition', result.error);
      }

      const newSnap = engine.toFullSnapshot();
      const newTurn = match.turn + 1;

      // ‚??‚?? Escribir nuevo estado (todo dentro de la misma transacci√≥n) ‚??‚??‚??‚??‚??‚??‚??

      // 1. Estado privado del servidor
      tx.set(privateRef, {
        deck:        [...newSnap.deck],
        discardPile: [...newSnap.discardPile],
        hands:       handsToStorage(newSnap.hands),
        ceroCalled:  [...newSnap.ceroCalled],
        updatedAt:   FieldValue.serverTimestamp(),
      });

      // 2. Mano de cada jugador en su subcollecci√≥n individual
      for (let i = 0; i < match.playerIds.length; i++) {
        const pUid    = match.playerIds[i]!;
        const pHRef   = db.doc(`matches/${matchId}/hands/${pUid}`);
        tx.set(pHRef, { cards: [...newSnap.hands[i]!], updatedAt: FieldValue.serverTimestamp() });
      }

      // 3. Construir estado p√∫blico para el cliente
      const winnerUid = newSnap.winner !== null && !ceroForgotUid
        ? (match.playerIds[newSnap.winner] ?? null)
        : null;
      const isFinished = newSnap.phase === 'game_over' && !ceroForgotUid;

      const lastAction: LastAction = {
        type:      action,
        uid,
        playerIdx: playerIndex,
        card:      (action === 'play' && data.cardId !== undefined)
                     ? { id: data.cardId }
                     : null,
        color:     action === 'pickColor' ? (data.color as CardColor) : null,
        ...(action === 'draw' && 'drawn' in result
          ? { count: (result as { drawn: ReadonlyArray<Card> }).drawn.length }
          : {}),
      };

      const publicPatch: Partial<MatchDoc> & Record<string, unknown> = {
        ...buildPublicState(newSnap, match.playerIds),
        turn:       newTurn,
        status:     isFinished ? 'finished' : 'playing',
        winner:     winnerUid,
        lastAction,
        ...(ceroForgotUid !== null ? { ceroForgot: ceroForgotUid } : {}),
        ...(action === 'penalizeCero' ? { ceroForgot: null } : {}),
        ...(action === 'declareCero' && match.ceroForgot === uid ? { ceroForgot: null } : {}),
        ...(isFinished ? { finishedAt: FieldValue.serverTimestamp() } : {}),
      };

      tx.update(matchRef, publicPatch);

      // 4. Stats de usuario cuando la partida termina.
      if (isFinished && winnerUid) {
        const prize = match.stakeCC * match.playerIds.length;
        const { winnerUids, loserUids } = resolveTeamOutcome(match, winnerUid);
        const coinRecipient = winnerUids[0] ?? winnerUid;

        for (const wUid of winnerUids) {
          if (playerIsGuest(match, wUid)) continue;
          tx.update(db.doc(`users/${wUid}`), {
            wins:             FieldValue.increment(1),
            totalGamesPlayed: FieldValue.increment(1),
            xp:               FieldValue.increment(25),
            ...(wUid === coinRecipient && prize > 0 ? { ceroCoins: FieldValue.increment(prize) } : {}),
          });
        }
        for (const lUid of loserUids) {
          if (playerIsGuest(match, lUid)) continue;
          tx.update(db.doc(`users/${lUid}`), { totalGamesPlayed: FieldValue.increment(1) });
        }
      }

      resultPublic = publicPatch;
      resultHand   = [...newSnap.hands[playerIndex]!];
      resultTurn   = newTurn;
      if (isFinished && winnerUid) finishedWinner = winnerUid;

      replayBox.entry = {
        turn:       newTurn,
        action:     lastAction,
        handCounts: [...newSnap.handCounts],
        topDiscard: newSnap.topDiscard ?? null,
        phase:      newSnap.phase,
        current:    newSnap.current,
      };
    });

    if (replayBox.entry) {
      try {
        const entry = replayBox.entry;
        await db.collection(`matches/${matchId}/replay`).add({
          turn:       entry.turn,
          action:     entry.action,
          handCounts: entry.handCounts,
          topDiscard: entry.topDiscard,
          phase:      entry.phase,
          current:    entry.current,
          ts:         FieldValue.serverTimestamp(),
        });
      } catch { /* replay no bloquea la jugada */ }
    }

    if (finishedWinner) {
      await _onMatchFinishedHooks(matchId, finishedWinner);
    }

    try {
      if (trackWild) await trackMissionAction(db, uid, 'play_wild');
      if (trackCero) await trackMissionAction(db, uid, 'declare_cero');
    } catch { /* misiones no bloquean la jugada */ }

    return { ok: true, publicState: resultPublic, myHand: resultHand, turn: resultTurn };
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// leaveMatch ‚?? salir de sala en espera (sin cobrar ni penalizar)
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export const leaveMatch = onCall<{ matchId: string }, Promise<{ ok: true }>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();
    const ref     = db.doc(`matches/${matchId}`);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      guard(snap.exists, 'not-found', 'Partida no encontrada');

      const match = snap.data() as MatchDoc;
      guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta sala');
      guard(match.status === 'waiting', 'failed-precondition', 'La partida ya comenz√≥');

      const remaining = match.playerIds.filter(id => id !== uid);
      const remainingPlayers = match.players.filter(p => p.uid !== uid);

      if (match.stakeCC > 0) {
        tx.update(db.doc(`users/${uid}`), {
          ceroCoins: FieldValue.increment(match.stakeCC),
        });
      }

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

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// temporaryLeaveMatch ‚?? salir sin abandonar (5 min para volver)
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export const temporaryLeaveMatch = onCall<{ matchId: string }, Promise<{ ok: true; rejoinUntil: number }>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();
    const ref     = db.doc(`matches/${matchId}`);
    const rejoinUntilMs = Date.now() + CFG.REJOIN_MS;
    const rejoinUntil   = Timestamp.fromMillis(rejoinUntilMs);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      guard(snap.exists, 'not-found', 'Partida no encontrada');

      const match = snap.data() as MatchDoc;
      guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
      guard(match.status === 'playing' || match.status === 'waiting', 'failed-precondition', 'La partida ya termin√≥');

      const playerName = match.players.find(p => p.uid === uid)?.name ?? 'Jugador';

      tx.update(ref, {
        [`absences.${uid}`]: {
          rejoinUntil,
          leftAt: FieldValue.serverTimestamp(),
        },
        rejoinBanner: {
          absentUid:   uid,
          absentName:  playerName,
          rejoinUntil,
        },
      });
      tx.set(db.doc(`users/${uid}`), {
        activeRejoin: { matchId, rejoinUntil, status: match.status },
      }, { merge: true });
    });

    return { ok: true, rejoinUntil: rejoinUntilMs };
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// checkMatchRejoinExpiry ‚?? polling cliente para expirar reconexi√≥n
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export const checkMatchRejoinExpiry = onCall<{ matchId: string }, Promise<{
  ok: true;
  expired: boolean;
  winnerUid?: string;
}>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();
    const ref     = db.doc(`matches/${matchId}`);

    const snap = await ref.get();
    guard(snap.exists, 'not-found', 'Partida no encontrada');

    const match = snap.data() as MatchDoc;
    guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');

    const winnerUid = await expireAbsentPlayers(db, ref, match);
    if (winnerUid) {
      return { ok: true, expired: true, winnerUid };
    }

    return { ok: true, expired: false };
  },
);

/** Escanea partidas en curso con reconexi√≥n vencida (cada minuto). */
export const expireRejoinMatches = onSchedule(
  { schedule: 'every 1 minutes', region: CFG.REGION, timeZone: 'America/Montevideo' },
  async () => {
    const db  = getFirestore();
    const now = Date.now();

    const playing = await db.collection('matches')
      .where('status', '==', 'playing')
      .limit(200)
      .get();

    for (const docSnap of playing.docs) {
      const match = docSnap.data() as MatchDoc;
      const hasExpired = match.playerIds.some(uid => {
        const abs = match.absences?.[uid];
        return abs?.rejoinUntil && abs.rejoinUntil.toMillis() <= now;
      });
      if (hasExpired) {
        await expireAbsentPlayers(db, docSnap.ref, match);
      }
    }
  },
);

/** Cierra salas waiting colgadas sin rival y partidas playing atascadas. */
export const expireStaleWaitingMatches = onSchedule(
  { schedule: 'every 1 minutes', region: CFG.REGION, timeZone: 'America/Montevideo' },
  async () => {
    const db        = getFirestore();
    const now       = Date.now();
    const waitingMs = await getWaitingRoomMs(db);
    const cutoff    = now - waitingMs;

    const [waiting, playing] = await Promise.all([
      db.collection('matches').where('status', '==', 'waiting').limit(200).get(),
      db.collection('matches').where('status', '==', 'playing').limit(200).get(),
    ]);

    for (const docSnap of waiting.docs) {
      const match = docSnap.data() as MatchDoc;
      const createdMs = matchCreatedMs(match.createdAt);
      if (createdMs > 0 && createdMs <= cutoff) {
        await forceCloseMatch(db, docSnap.ref, match, 'waiting_expired');
      }
    }

    for (const docSnap of playing.docs) {
      const match = docSnap.data() as MatchDoc;
      if (isStuckMatch(match, now, waitingMs)) {
        await tryStartMatchIfReady(db, docSnap.ref, match);
        const fresh = (await docSnap.ref.get()).data() as MatchDoc | undefined;
        if (fresh && isStuckMatch(fresh, now, waitingMs)) {
          await forceCloseMatch(db, docSnap.ref, fresh, 'stuck_playing_expired');
        }
      }
    }
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// getRejoinStatus ‚?? consultar si hay partida para reingresar
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

export const getRejoinStatus = onCall<Record<string, never>, Promise<{
  available: boolean;
  matchId?: string;
  rejoinUntil?: number;
  status?: string;
  stakeCC?: number;
}>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');
    const uid = request.auth!.uid;
    const db  = getFirestore();

    const userSnap = await db.doc(`users/${uid}`).get();
    const active = userSnap.data()?.activeRejoin as {
      matchId?: string; rejoinUntil?: FirebaseFirestore.Timestamp; status?: string;
    } | undefined;

    if (!active?.matchId || !active.rejoinUntil) {
      return { available: false };
    }

    const untilMs = active.rejoinUntil.toMillis?.() ?? active.rejoinUntil as unknown as number;
    if (untilMs <= Date.now()) {
      await db.doc(`users/${uid}`).set({ activeRejoin: FieldValue.delete() }, { merge: true });
      return { available: false };
    }

    const matchSnap = await db.doc(`matches/${active.matchId}`).get();
    if (!matchSnap.exists) {
      return { available: false };
    }

    const match = matchSnap.data() as MatchDoc;
    const waitingMs = await getWaitingRoomMs(db);
    if (!canRejoinMatch(match, uid) || match.status === 'finished' || isStuckMatch(match, Date.now(), waitingMs)) {
      await db.doc(`users/${uid}`).set({ activeRejoin: FieldValue.delete() }, { merge: true });
      return { available: false };
    }

    return {
      available: true,
      matchId:   active.matchId,
      rejoinUntil: untilMs,
      status:    match.status,
      stakeCC:   match.stakeCC ?? 0,
    };
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// forfeitMatch
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

interface ForfeitResponse { ok: true; winnerUid: string }

/** Abandono voluntario: entrega la victoria al rival y devuelve el pozo. */
export const forfeitMatch = onCall<{ matchId: string }, Promise<ForfeitResponse>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();

    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists,              'not-found',           'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(match.status === 'playing',    'failed-precondition', 'La partida no est√° en curso');
    guard(match.playerIds.includes(uid), 'permission-denied',   'No sos parte de esta partida');

    const winnerUid = primaryWinnerForForfeit(match, uid);
    guard(winnerUid, 'internal', 'No se pudo determinar el ganador');

    const batch = db.batch();
    _applyMatchEndUpdates(
      (ref, data) => batch.update(ref, data),
      db, matchSnap.ref, match, winnerUid, 'forfeit',
      { forfeit: { loserUid: uid, winnerUid } },
    );

    await batch.commit();

    await _onMatchFinishedHooks(matchId, winnerUid);

    return { ok: true, winnerUid };
  },
);

// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??
// endMatch ‚?? cierre expl√≠cito de una partida (inactividad / admin)
// ‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??‚??

interface EndMatchRequest {
  matchId:   string;
  winnerUid: string;
  reason?:   EndReason;
}

/**
 * Cierra una partida en curso, calcula el pozo y acredita al ganador.
 *
 * Casos de uso:
 *   ¬∑ El servidor detecta inactividad (lastSeen del jugador > TURN_SECONDS)
 *   ¬∑ Un jugador se queda sin cartas y el cliente confirma manualmente
 *   ¬∑ Un admin fuerza el cierre de una sala atascada
 *
 * Solo pueden llamar a esta funci√≥n:
 *   ¬∑ Uno de los jugadores de la partida
 *   ¬∑ (El Admin SDK llama directamente a _applyMatchEndUpdates sin pasar por aqu√≠)
 */
export const endMatch = onCall<EndMatchRequest, Promise<ForfeitResponse>>(
  { region: CFG.REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten√©s que iniciar sesi√≥n');

    const uid      = request.auth!.uid;
    const data     = request.data as unknown as Record<string, unknown>;
    const matchId  = requireString(data, 'matchId');
    const winnerUid = requireString(data, 'winnerUid');
    const reason   = (data['reason'] as EndReason | undefined) ?? 'won';
    const db       = getFirestore();

    guard(
      ((['won', 'forfeit', 'timeout'] as EndReason[]) as string[]).includes(reason),
      'invalid-argument',
      `Raz√≥n inv√°lida: "${reason}"`,
    );

    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists,               'not-found',           'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(match.status === 'playing',     'failed-precondition', 'La partida no est√° en curso');
    guard(match.playerIds.includes(uid),  'permission-denied',   'No sos parte de esta partida');
    guard(
      match.playerIds.includes(winnerUid),
      'invalid-argument',
      'El ganador no es parte de la partida',
    );

    // Si el caller no es el ganador, solo puede invocar endMatch por inactividad
    // verificando que el rival lleva m√°s de TURN_SECONDS sin actividad.
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
          'El rival sigue activo; no pod√©s reclamar inactividad todav√≠a',
        );
      }
    }

    const batch = db.batch();
    _applyMatchEndUpdates(
      (ref, d) => batch.update(ref, d),
      db, matchSnap.ref, match, winnerUid, reason,
    );

    await batch.commit();

    await _onMatchFinishedHooks(matchId, winnerUid);

    return { ok: true, winnerUid };
  },
);

export const getReplay = onCall<{ matchId: string }, Promise<{ ok: true; actions: unknown[] }>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'TenÈs que iniciar sesiÛn');

    const uid     = request.auth!.uid;
    const matchId = requireString(request.data as Record<string, unknown>, 'matchId');
    const db      = getFirestore();

    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(
      match.playerIds.includes(uid) || match.status === 'finished',
      'permission-denied',
      'No podÈs ver este replay',
    );

    const snap = await db.collection(`matches/${matchId}/replay`)
      .orderBy('turn', 'asc')
      .limit(200)
      .get();

    return {
      ok: true,
      actions: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  },
);

// ?????????????????????????????????????????????????????????????????????????????
// sendMatchChat ? chat / reacciones / proyectiles (evita permisos del cliente)
// ?????????????????????????????????????????????????????????????????????????????

interface SendMatchChatRequest {
  matchId: string;
  type:    'text' | 'reaction' | 'projectile';
  text:    string;
}

export const sendMatchChat = onCall<SendMatchChatRequest, Promise<{ ok: true }>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'TenÈs que iniciar sesiÛn');

    const uid     = request.auth!.uid;
    const data    = request.data ?? ({} as SendMatchChatRequest);
    const matchId = requireString(data as unknown as Record<string, unknown>, 'matchId');
    const type    = data.type;
    const text    = String(data.text ?? '').trim();

    guard(['text', 'reaction', 'projectile'].includes(type), 'invalid-argument', 'Tipo inv·lido');
    guard(text.length > 0 && text.length <= 200, 'invalid-argument', 'Mensaje inv·lido (1?200 chars)');

    const db        = getFirestore();
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');

    const match = matchSnap.data() as MatchDoc;
    guard(match.playerIds.includes(uid), 'permission-denied', 'No sos jugador de esta partida');

    const name = match.players.find(p => p.uid === uid)?.name
      ?? (request.auth!.token.name as string | undefined)
      ?? 'Jugador';

    await db.collection(`matches/${matchId}/chat`).add({
      uid,
      name,
      type,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  },
);

// ?? Buscar sala privada por cÛdigo de 6 dÌgitos ?????????????????????????????

export const resolveJoinCode = onCall<{ code?: string }, Promise<{
  matchId: string;
  stakeCC: number;
  isPrivate: boolean;
}>>(
  { region: CFG.REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'TenÈs que iniciar sesiÛn');
    const raw = typeof request.data?.code === 'string' ? request.data.code.trim().replace(/\D/g, '') : '';
    guard(/^\d{6}$/.test(raw), 'invalid-argument', 'Ingres· un cÛdigo de 6 dÌgitos.');

    const db = getFirestore();
    const q  = await db.collection('matches')
      .where('joinCode', '==', raw)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();

    guard(!q.empty, 'not-found', 'No hay sala activa con ese cÛdigo. Puede haber expirado (5 min).');

    const doc = q.docs[0]!;
    const d   = doc.data() as MatchDoc;
    return {
      matchId:   doc.id,
      stakeCC:   d.stakeCC ?? 0,
      isPrivate: d.isPrivate === true,
    };
  },
);
