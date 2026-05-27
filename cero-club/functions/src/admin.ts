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

async function assertAdmin(uid: string): Promise<void> {
  const db = getFirestore();
  const snap = await db.doc(`admins/${uid}`).get();
  guard(snap.exists, 'permission-denied', 'Solo operadores pueden usar el panel admin');
}

// ─────────────────────────────────────────────────────────────────────────────
// adminGetUser — buscar por uid o email
// ─────────────────────────────────────────────────────────────────────────────

interface AdminGetUserRequest { uid?: string; email?: string }

export const adminGetUser = onCall<AdminGetUserRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const db = getFirestore();
    const { uid, email } = request.data ?? {};

    let userSnap;
    if (uid) {
      userSnap = await db.doc(`users/${uid}`).get();
    } else if (email) {
      const q = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
      userSnap = q.docs[0];
    } else {
      throw new HttpsError('invalid-argument', 'Indicá uid o email');
    }

    guard(userSnap?.exists, 'not-found', 'Usuario no encontrado');
    const data = userSnap!.data()!;
    return {
      uid:              userSnap!.id,
      email:            data.email ?? '',
      displayName:      data.displayName ?? 'Jugador',
      ceroCoins:        data.ceroCoins ?? 0,
      wins:             data.wins ?? 0,
      totalGamesPlayed: data.totalGamesPlayed ?? 0,
      weeklyWins:       data.weeklyWins ?? 0,
      vip:              data.vip ?? null,
      activeRejoin:     data.activeRejoin ?? null,
    };
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
// adminUpdateUser — nick, stats menores
// ─────────────────────────────────────────────────────────────────────────────

interface AdminUpdateUserRequest {
  uid:         string;
  displayName?: string;
  weeklyWins?: number;
}

export const adminUpdateUser = onCall<AdminUpdateUserRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const { uid, displayName, weeklyWins } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');

    const patch: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim().length >= 2) {
      patch.displayName = displayName.trim().slice(0, 40);
    }
    if (typeof weeklyWins === 'number' && weeklyWins >= 0 && weeklyWins <= 9999) {
      patch.weeklyWins = weeklyWins;
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
