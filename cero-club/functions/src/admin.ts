/**
 * Panel de operadores — gestión de usuarios y Cero Coins
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';

const REGION = 'us-central1';

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

function matchCreatedMs(createdAt: unknown): number {
  if (!createdAt || typeof (createdAt as { toMillis?: () => number }).toMillis !== 'function') {
    return 0;
  }
  return (createdAt as { toMillis: () => number }).toMillis();
}

function matchAgeMs(data: { startedAt?: unknown; createdAt?: unknown }): number {
  return matchCreatedMs(data.startedAt) || matchCreatedMs(data.createdAt);
}

async function assertAdmin(uid: string): Promise<void> {
  const db = getFirestore();
  const snap = await db.doc(`admins/${uid}`).get();
  guard(snap.exists, 'permission-denied', 'Solo operadores pueden usar el panel admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// adminGetUser — buscar por uid o email
// ─────────────────────────────────────────────────────────────────────────────

interface AdminGetUserRequest { uid?: string; email?: string; displayName?: string }

function userPayload(uid: string, data: FirebaseFirestore.DocumentData) {
  const vip = data.vip as { active?: boolean; expiresAt?: FirebaseFirestore.Timestamp } | null | undefined;
  return {
    uid,
    email:            data.email ?? '',
    displayName:      data.displayName ?? 'Jugador',
    ceroCoins:        data.ceroCoins ?? 0,
    wins:             data.wins ?? 0,
    totalGamesPlayed: data.totalGamesPlayed ?? 0,
    weeklyWins:       data.weeklyWins ?? 0,
    monthlyWins:      data.monthlyWins ?? 0,
    xp:               data.xp ?? 0,
    countryCode:      data.countryCode ?? null,
    isGuest:          data.isGuest === true || data.anon === true,
    vip:              vip ?? null,
    vipActive:        vip?.active === true && (vip.expiresAt?.toMillis() ?? 0) > Date.now(),
    activeRejoin:     data.activeRejoin ?? null,
    ownedCosmetics:   data.ownedCosmetics ?? [],
  };
}

export const adminGetUser = onCall<AdminGetUserRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const db = getFirestore();
    const { uid, email, displayName } = request.data ?? {};

    let userSnap;
    if (uid) {
      userSnap = await db.doc(`users/${uid}`).get();
    } else if (email) {
      const q = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
      userSnap = q.docs[0];
    } else if (displayName) {
      const name = displayName.trim();
      guard(name.length >= 2, 'invalid-argument', 'Nombre demasiado corto');
      const exact = await db.collection('users').where('displayName', '==', name).limit(1).get();
      if (!exact.empty) {
        userSnap = exact.docs[0];
      } else {
        const prefix = await db.collection('users')
          .where('displayName', '>=', name)
          .where('displayName', '<=', name + '\uf8ff')
          .limit(1)
          .get();
        userSnap = prefix.docs[0];
      }
    } else {
      throw new HttpsError('invalid-argument', 'Indicá uid, email o nombre de usuario');
    }

    guard(userSnap?.exists, 'not-found', 'Usuario no encontrado');
    return userPayload(userSnap!.id, userSnap!.data()!);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminSearchUsers — búsqueda por nick (prefijo)
// ─────────────────────────────────────────────────────────────────────────────

interface AdminSearchUsersRequest { query?: string; limit?: number }

export const adminSearchUsers = onCall<AdminSearchUsersRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const q = (request.data?.query ?? '').trim();
    guard(q.length >= 2, 'invalid-argument', 'Escribí al menos 2 caracteres');
    const limit = Math.min(request.data?.limit ?? 20, 30);
    const db = getFirestore();

    const snap = await db.collection('users')
      .where('displayName', '>=', q)
      .where('displayName', '<=', q + '\uf8ff')
      .limit(limit)
      .get();

    const users = snap.docs.map(d => ({
      uid:         d.id,
      displayName: d.data().displayName ?? 'Jugador',
      email:       d.data().email ?? '',
      ceroCoins:   d.data().ceroCoins ?? 0,
      wins:        d.data().wins ?? 0,
    }));

    return { users };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminSetCeroCoins — establecer saldo absoluto
// ─────────────────────────────────────────────────────────────────────────────

interface AdminSetCoinsRequest {
  uid:       string;
  ceroCoins: number;
  reason?:   string;
}

export const adminSetCeroCoins = onCall<AdminSetCoinsRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth!.uid;
    await assertAdmin(callerUid);

    const { uid, ceroCoins, reason = 'admin_set' } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');
    guard(typeof ceroCoins === 'number' && ceroCoins >= 0 && ceroCoins <= 5_000_000,
      'invalid-argument', 'Saldo inválido (0–5000000)');

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      guard(snap.exists, 'not-found', 'Usuario no encontrado');
      tx.update(userRef, { ceroCoins });
    });

    await db.collection('coin_ledger').add({
      uid,
      amount:    ceroCoins,
      type:      'admin_set',
      reason,
      grantedBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, uid, ceroCoins };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminAddCeroCoins — sumar/restar monedas (pruebas, premios)
// ─────────────────────────────────────────────────────────────────────────────

interface AdminAddCoinsRequest {
  uid:    string;
  amount: number;
  reason?: string;
}

export const adminAddCeroCoins = onCall<AdminAddCoinsRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth!.uid;
    await assertAdmin(callerUid);

    const { uid, amount, reason = 'admin_add' } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');
    guard(typeof amount === 'number' && Number.isFinite(amount), 'invalid-argument', 'Monto inválido');
    guard(amount !== 0, 'invalid-argument', 'El monto no puede ser 0');

    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    let newBalance = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      guard(snap.exists, 'not-found', 'Usuario no encontrado');
      const current = (snap.data()?.ceroCoins as number | undefined) ?? 0;
      newBalance = Math.min(5_000_000, Math.max(0, current + amount));
      tx.update(userRef, { ceroCoins: newBalance });
    });

    await db.collection('coin_ledger').add({
      uid,
      amount,
      type:      amount > 0 ? 'admin_add' : 'admin_deduct',
      reason,
      grantedBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, uid, ceroCoins: newBalance, delta: amount };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminUpdateUser — nick, stats menores
// ─────────────────────────────────────────────────────────────────────────────

interface AdminUpdateUserRequest {
  uid:              string;
  displayName?:     string;
  weeklyWins?:      number;
  monthlyWins?:     number;
  wins?:            number;
  totalGamesPlayed?: number;
  xp?:              number;
  countryCode?:     string | null;
  vipActive?:       boolean;
}

export const adminUpdateUser = onCall<AdminUpdateUserRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const {
      uid, displayName, weeklyWins, monthlyWins,
      wins, totalGamesPlayed, xp, countryCode, vipActive,
    } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');

    const patch: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim().length >= 2) {
      patch.displayName = displayName.trim().slice(0, 40);
    }
    if (typeof weeklyWins === 'number' && weeklyWins >= 0 && weeklyWins <= 9999) {
      patch.weeklyWins = weeklyWins;
    }
    if (typeof monthlyWins === 'number' && monthlyWins >= 0 && monthlyWins <= 9999) {
      patch.monthlyWins = monthlyWins;
    }
    if (typeof wins === 'number' && wins >= 0 && wins <= 999999) {
      patch.wins = wins;
    }
    if (typeof totalGamesPlayed === 'number' && totalGamesPlayed >= 0 && totalGamesPlayed <= 999999) {
      patch.totalGamesPlayed = totalGamesPlayed;
    }
    if (typeof xp === 'number' && xp >= 0 && xp <= 999999) {
      patch.xp = xp;
    }
    if (countryCode === null || (typeof countryCode === 'string' && countryCode.length <= 2)) {
      patch.countryCode = countryCode || null;
    }
    if (typeof vipActive === 'boolean') {
      if (vipActive) {
        const expiresAt = new Date(Date.now() + 30 * 86_400_000);
        patch.vip = { active: true, expiresAt };
      } else {
        patch.vip = { active: false };
      }
    }
    guard(Object.keys(patch).length > 0, 'invalid-argument', 'Nada que actualizar');

    const db = getFirestore();
    const ref = db.doc(`users/${uid}`);
    guard((await ref.get()).exists, 'not-found', 'Usuario no encontrado');
    await ref.update(patch);
    return { ok: true, uid, ...patch };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminListTournaments — listado para panel
// ─────────────────────────────────────────────────────────────────────────────

export const adminListTournaments = onCall<{ limit?: number }>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const limit = Math.min(request.data?.limit ?? 20, 50);
    const db = getFirestore();
    const snap = await db.collection('tournaments')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return {
      tournaments: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminListWaitingMatches — salas abiertas colgadas
// ─────────────────────────────────────────────────────────────────────────────

export const adminListWaitingMatches = onCall<{ limit?: number }>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const limit = Math.min(request.data?.limit ?? 50, 100);
    const db    = getFirestore();
    const { isStuckMatch } = await import('./game');

    const [waitingSnap, playingSnap] = await Promise.all([
      db.collection('matches').where('status', '==', 'waiting').limit(limit).get(),
      db.collection('matches').where('status', '==', 'playing').limit(limit).get(),
    ]);

    const now = Date.now();
    const mapDoc = (d: FirebaseFirestore.QueryDocumentSnapshot, status: string) => {
      const data = d.data();
      const createdMs = matchCreatedMs(data.createdAt);
      const ageMs = matchAgeMs(data as import('./game').MatchDoc);
      const ageMinutes = ageMs > 0 ? Math.round((now - ageMs) / 60000) : null;
      return {
        id:          d.id,
        status,
        mode:        data.mode ?? 'classic',
        stakeCC:     data.stakeCC ?? 0,
        playerCount: data.playerCount ?? 0,
        maxPlayers:  data.maxPlayers ?? 2,
        guestOnly:   data.guestOnly === true,
        phase:       data.phase ?? '—',
        players:     (data.players ?? []).map((p: { uid?: string; name?: string }) => ({
          uid:  p.uid ?? '',
          name: p.name ?? 'Jugador',
        })),
        createdAt: createdMs || null,
        ageMinutes,
        stale: isStuckMatch(data as import('./game').MatchDoc, now),
      };
    };

    const matches = [
      ...waitingSnap.docs.map(d => mapDoc(d, 'waiting')),
      ...playingSnap.docs
        .map(d => mapDoc(d, 'playing'))
        .filter(m => m.stale),
    ].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit);

    return { matches };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminCloseWaitingMatch — cerrar una sala waiting
// ─────────────────────────────────────────────────────────────────────────────

interface AdminCloseWaitingRequest { matchId: string; reason?: string }

export const adminCloseWaitingMatch = onCall<AdminCloseWaitingRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const matchId = request.data?.matchId;
    guard(typeof matchId === 'string' && matchId, 'invalid-argument', 'matchId inválido');

    const db  = getFirestore();
    const ref = db.doc(`matches/${matchId}`);
    const snap = await ref.get();
    guard(snap.exists, 'not-found', 'Sala no encontrada');

    const match = snap.data() as import('./game').MatchDoc;
    guard(
      match.status === 'waiting' || (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard),
      'failed-precondition',
      'Solo se pueden cerrar salas en espera o partidas colgadas sin iniciar',
    );

    const { forceCloseMatch } = await import('./game');
    await forceCloseMatch(db, ref, match, request.data?.reason ?? 'admin_close');

    return { ok: true, matchId };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminCleanupStaleRooms — cerrar todas las waiting > minAgeMinutes
// ─────────────────────────────────────────────────────────────────────────────

interface AdminCleanupStaleRequest { minAgeMinutes?: number; limit?: number }

export const adminCleanupStaleRooms = onCall<AdminCleanupStaleRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const minAgeMinutes = Math.min(Math.max(request.data?.minAgeMinutes ?? 4, 0), 60);
    const limit         = Math.min(request.data?.limit ?? 100, 200);
    const cutoff        = Date.now() - minAgeMinutes * 60 * 1000;
    const now           = Date.now();

    const db   = getFirestore();
    const { forceCloseMatch, isStuckMatch } = await import('./game');

    const [waitingSnap, playingSnap] = await Promise.all([
      db.collection('matches').where('status', '==', 'waiting').limit(limit).get(),
      db.collection('matches').where('status', '==', 'playing').limit(limit).get(),
    ]);

    let closed = 0;

    for (const docSnap of waitingSnap.docs) {
      const match = docSnap.data() as import('./game').MatchDoc;
      const ageMs = matchCreatedMs(match.createdAt);
      if (minAgeMinutes === 0 || ageMs === 0 || ageMs <= cutoff) {
        await forceCloseMatch(db, docSnap.ref, match, 'admin_cleanup_stale');
        closed++;
      }
    }

    for (const docSnap of playingSnap.docs) {
      const match = docSnap.data() as import('./game').MatchDoc;
      if (!isStuckMatch(match, now)) continue;
      const ageMs = matchAgeMs(match);
      if (minAgeMinutes === 0 || ageMs === 0 || ageMs <= cutoff) {
        await forceCloseMatch(db, docSnap.ref, match, 'admin_cleanup_stuck_playing');
        closed++;
      }
    }

    return { ok: true, closed, minAgeMinutes };
  },
);
