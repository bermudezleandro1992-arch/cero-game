/**
 * Torneos semanales CERO — inscripción, bracket 8 jugadores, premio en CN
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { startMatch } from './game';

const BRACKET_SIZE = 8;
const ENTRY_FEE = 50;
const PRIZE_POOL = 400;
const REGION = 'us-central1';

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

type BracketPair = {
  slot: number;
  p1: string;
  p2: string;
  matchId: string | null;
  winnerUid: string | null;
};

function weekKey(d = new Date()): string {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function tournamentDocId(wk: string): string {
  return `weekly-${wk}`;
}

async function assertAdmin(uid: string): Promise<void> {
  const snap = await getFirestore().doc(`admins/${uid}`).get();
  guard(snap.exists, 'permission-denied', 'Solo operadores');
}

async function ensureWeeklyDoc(wk: string) {
  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentDocId(wk));
  const snap = await ref.get();
  if (snap.exists) return ref;
  const now = Date.now();
  await ref.set({
    name: `Torneo semanal ${wk}`,
    type: 'weekly',
    weekKey: wk,
    status: 'registration',
    entryFee: ENTRY_FEE,
    prizePool: PRIZE_POOL,
    bracketSize: BRACKET_SIZE,
    participants: [],
    bracket: [],
    currentRound: 0,
    championUid: null,
    createdAt: now,
    startAt: now + 60_000,
    lockAt: now + 7 * 24 * 60 * 60 * 1000,
    updatedAt: now,
  });
  return ref;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

async function createTournamentMatch(
  p1: string,
  p2: string,
  tournamentId: string,
  tournamentRound: number,
  bracketSlot: number,
): Promise<string> {
  const db = getFirestore();
  const [u1, u2] = await Promise.all([
    db.doc(`users/${p1}`).get(),
    db.doc(`users/${p2}`).get(),
  ]);

  const matchData = {
    status: 'waiting' as const,
    mode: 'classic' as const,
    players: [
      { uid: p1, name: u1.data()?.displayName ?? 'Jugador', index: 0 },
      { uid: p2, name: u2.data()?.displayName ?? 'Jugador', index: 1 },
    ],
    playerIds: [p1, p2],
    playerCount: 2,
    maxPlayers: 2,
    stakeCC: 0,
    turn: 0,
    phase: 'waiting' as const,
    current: null,
    direction: null,
    drawStack: null,
    chosenColor: null,
    topDiscard: null,
    handCounts: null,
    winner: null,
    pendingTurn: null,
    createdAt: FieldValue.serverTimestamp(),
    startedAt: null,
    finishedAt: null,
    lastAction: null,
    tournamentId,
    tournamentRound,
    bracketSlot,
  };

  const ref = await db.collection('matches').add(matchData);
  await startMatch(db, ref, matchData);
  return ref.id;
}

export async function seedBracket(tournamentId: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const t = snap.data()!;
  if (t.status !== 'registration') return;

  let participants = [...((t.participants as string[]) || [])];
  while (participants.length < BRACKET_SIZE) {
    participants.push(`__bye__${participants.length}`);
  }
  participants = shuffle(participants).slice(0, BRACKET_SIZE);

  const round1: BracketPair[] = [];
  for (let i = 0; i < BRACKET_SIZE / 2; i++) {
    round1.push({
      slot: i,
      p1: participants[i * 2]!,
      p2: participants[i * 2 + 1]!,
      matchId: null,
      winnerUid: null,
    });
  }

  await ref.update({
    status: 'active',
    participants,
    bracket: [round1],
    currentRound: 1,
    updatedAt: Date.now(),
  });

  await createRoundMatches(tournamentId, 0);
}

async function createRoundMatches(tournamentId: string, roundIndex: number): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentId);
  const snap = await ref.get();
  const t = snap.data()!;
  const bracket = JSON.parse(JSON.stringify(t.bracket)) as BracketPair[][];
  const round = bracket[roundIndex];
  if (!round) return;

  const updatedRound = [...round];
  for (let i = 0; i < updatedRound.length; i++) {
    const pair = updatedRound[i]!;
    if (pair.matchId || pair.winnerUid) continue;

    const { p1, p2 } = pair;
    if (p1.startsWith('__bye__') && p2.startsWith('__bye__')) continue;
    if (p1.startsWith('__bye__')) {
      updatedRound[i] = { ...pair, winnerUid: p2 };
      continue;
    }
    if (p2.startsWith('__bye__')) {
      updatedRound[i] = { ...pair, winnerUid: p1 };
      continue;
    }

    const matchId = await createTournamentMatch(
      p1, p2, tournamentId, roundIndex + 1, pair.slot,
    );
    updatedRound[i] = { ...pair, matchId };
  }

  bracket[roundIndex] = updatedRound;
  await ref.update({ bracket, updatedAt: Date.now() });
  await resolveByesAndAdvance(tournamentId);
}

export async function onTournamentMatchFinished(
  matchId: string,
  winnerUid: string | null,
): Promise<void> {
  if (!winnerUid) return;
  const db = getFirestore();
  const matchSnap = await db.collection('matches').doc(matchId).get();
  if (!matchSnap.exists) return;
  const tournamentId = matchSnap.data()?.tournamentId as string | undefined;
  if (!tournamentId) return;

  const ref = db.collection('tournaments').doc(tournamentId);
  const tSnap = await ref.get();
  if (!tSnap.exists) return;
  const t = tSnap.data()!;
  if (t.status !== 'active') return;

  const bracket = JSON.parse(JSON.stringify(t.bracket)) as BracketPair[][];
  let found = false;
  for (let ri = 0; ri < bracket.length && !found; ri++) {
    for (let si = 0; si < (bracket[ri]?.length ?? 0); si++) {
      if (bracket[ri]![si]!.matchId === matchId) {
        bracket[ri]![si]!.winnerUid = winnerUid;
        found = true;
        break;
      }
    }
  }
  if (!found) return;

  await ref.update({ bracket, updatedAt: Date.now() });
  await resolveByesAndAdvance(tournamentId);
}

async function resolveByesAndAdvance(tournamentId: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentId);
  const snap = await ref.get();
  const t = snap.data()!;
  const bracket = JSON.parse(JSON.stringify(t.bracket)) as BracketPair[][];
  const roundIndex = bracket.length - 1;
  const round = bracket[roundIndex];
  if (!round) return;

  const allDone = round.every(
    (p) => p.winnerUid != null || (p.p1.startsWith('__bye__') && p.p2.startsWith('__bye__')),
  );
  if (!allDone) return;

  const winners = round.map((p) => p.winnerUid).filter(Boolean) as string[];
  if (winners.length === 1) {
    await awardTournamentWinner(tournamentId, winners[0]!);
    return;
  }

  const nextRound: BracketPair[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextRound.push({
      slot: Math.floor(i / 2),
      p1: winners[i]!,
      p2: winners[i + 1] ?? `__bye__${i}`,
      matchId: null,
      winnerUid: null,
    });
  }
  bracket.push(nextRound);
  await ref.update({
    bracket,
    currentRound: bracket.length,
    updatedAt: Date.now(),
  });
  await createRoundMatches(tournamentId, bracket.length - 1);
}

async function awardTournamentWinner(tournamentId: string, championUid: string): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentId);
  const snap = await ref.get();
  const prize = (snap.data()?.prizePool as number) ?? PRIZE_POOL;
  const userRef = db.doc(`users/${championUid}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    tx.update(userRef, {
      ceroCoins: (userSnap.data()?.ceroCoins ?? 0) + prize,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      status: 'finished',
      championUid,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    });
    tx.set(db.collection('coinTransactions').doc(), {
      uid: championUid,
      type: 'tournament_prize',
      amount: prize,
      tournamentId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export const registerTournament = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  guard(uid, 'unauthenticated', 'Iniciá sesión');

  const weekKeyParam = (req.data?.weekKey as string) || weekKey();
  const ref = await ensureWeeklyDoc(weekKeyParam);
  const snap = await ref.get();
  const t = snap.data()!;
  if (t.status !== 'registration') {
    throw new HttpsError('failed-precondition', 'Inscripciones cerradas.');
  }
  if ((t.participants as string[]).includes(uid)) {
    return { ok: true, alreadyRegistered: true, tournamentId: ref.id };
  }
  if ((t.participants as string[]).length >= BRACKET_SIZE) {
    throw new HttpsError('resource-exhausted', 'Cupos completos (8 jugadores).');
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const balance = userSnap.data()?.ceroCoins ?? 0;
    if (balance < ENTRY_FEE) {
      throw new HttpsError('failed-precondition', `Necesitás ${ENTRY_FEE} Cero Coins.`);
    }
    tx.update(userRef, {
      ceroCoins: balance - ENTRY_FEE,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      participants: FieldValue.arrayUnion(uid),
      updatedAt: Date.now(),
    });
    tx.set(db.collection('coinTransactions').doc(), {
      uid,
      type: 'tournament_entry',
      amount: -ENTRY_FEE,
      tournamentId: ref.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  const after = await ref.get();
  const count = ((after.data()?.participants as string[]) || []).length;
  if (count >= BRACKET_SIZE) {
    await seedBracket(ref.id);
  }
  return { ok: true, tournamentId: ref.id, participants: count };
});

export const cancelTournamentRegistration = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  guard(uid, 'unauthenticated', 'Iniciá sesión');
  const tournamentId = req.data?.tournamentId as string;
  if (!tournamentId) throw new HttpsError('invalid-argument', 'tournamentId requerido.');

  const db = getFirestore();
  const ref = db.collection('tournaments').doc(tournamentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Torneo no encontrado.');
  const t = snap.data()!;
  if (t.status !== 'registration') {
    throw new HttpsError('failed-precondition', 'El torneo ya empezó.');
  }
  if (!(t.participants as string[]).includes(uid)) {
    throw new HttpsError('failed-precondition', 'No estás inscrito.');
  }

  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    tx.update(userRef, {
      ceroCoins: (userSnap.data()?.ceroCoins ?? 0) + ENTRY_FEE,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      participants: FieldValue.arrayRemove(uid),
      updatedAt: Date.now(),
    });
  });
  return { ok: true };
});

export const getWeeklyTournament = onCall({ region: REGION }, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Iniciá sesión');
  const wk = (req.data?.weekKey as string) || weekKey();
  const ref = await ensureWeeklyDoc(wk);
  const snap = await ref.get();
  const t = snap.data()!;
  const participants = ((t.participants as string[]) || []).filter((id) => !id.startsWith('__bye__'));
  const names: Record<string, string> = {};
  await Promise.all(participants.map(async (pid) => {
    const u = await getFirestore().doc(`users/${pid}`).get();
    names[pid] = u.data()?.displayName || pid.slice(0, 8);
  }));

  return {
    tournamentId: ref.id,
    weekKey: wk,
    status: t.status,
    entryFee: t.entryFee,
    prizePool: t.prizePool,
    participants,
    participantCount: participants.length,
    bracketSize: BRACKET_SIZE,
    bracket: t.bracket || [],
    currentRound: t.currentRound || 0,
    championUid: t.championUid || null,
    names,
  };
});

export const adminSeedWeeklyTournament = onCall({ region: REGION }, async (req) => {
  guard(req.auth?.uid, 'unauthenticated', 'Iniciá sesión');
  await assertAdmin(req.auth!.uid);
  const wk = (req.data?.weekKey as string) || weekKey();
  const ref = await ensureWeeklyDoc(wk);
  if (req.data?.forceSeed) {
    await seedBracket(ref.id);
  }
  return { ok: true, tournamentId: ref.id, weekKey: wk };
});

export const seedWeeklyTournament = onSchedule(
  { schedule: '0 12 * * 1', timeZone: 'America/Argentina/Buenos_Aires', region: REGION },
  async () => {
    await ensureWeeklyDoc(weekKey());
  },
);
