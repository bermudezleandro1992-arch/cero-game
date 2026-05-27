"use strict";
/**
 * Panel de operadores — gestión de usuarios y Cero Coins
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminListTournaments = exports.adminUpdateUser = exports.adminSetCeroCoins = exports.adminGetUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = 'us-central1';
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
async function assertAdmin(uid) {
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.doc(`admins/${uid}`).get();
    guard(snap.exists, 'permission-denied', 'Solo operadores pueden usar el panel admin');
}
exports.adminGetUser = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const db = (0, firestore_1.getFirestore)();
    const { uid, email } = request.data ?? {};
    let userSnap;
    if (uid) {
        userSnap = await db.doc(`users/${uid}`).get();
    }
    else if (email) {
        const q = await db.collection('users').where('email', '==', email.toLowerCase().trim()).limit(1).get();
        userSnap = q.docs[0];
    }
    else {
        throw new https_1.HttpsError('invalid-argument', 'Indicá uid o email');
    }
    guard(userSnap?.exists, 'not-found', 'Usuario no encontrado');
    const data = userSnap.data();
    return {
        uid: userSnap.id,
        email: data.email ?? '',
        displayName: data.displayName ?? 'Jugador',
        ceroCoins: data.ceroCoins ?? 0,
        wins: data.wins ?? 0,
        totalGamesPlayed: data.totalGamesPlayed ?? 0,
        weeklyWins: data.weeklyWins ?? 0,
        vip: data.vip ?? null,
        activeRejoin: data.activeRejoin ?? null,
    };
});
exports.adminSetCeroCoins = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth.uid;
    await assertAdmin(callerUid);
    const { uid, ceroCoins, reason = 'admin_set' } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');
    guard(typeof ceroCoins === 'number' && ceroCoins >= 0 && ceroCoins <= 5000000, 'invalid-argument', 'Saldo inválido (0–5000000)');
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        guard(snap.exists, 'not-found', 'Usuario no encontrado');
        tx.update(userRef, { ceroCoins });
    });
    await db.collection('coin_ledger').add({
        uid,
        amount: ceroCoins,
        type: 'admin_set',
        reason,
        grantedBy: callerUid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, uid, ceroCoins };
});
exports.adminUpdateUser = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const { uid, displayName, weeklyWins } = request.data;
    guard(typeof uid === 'string' && uid, 'invalid-argument', 'UID inválido');
    const patch = {};
    if (typeof displayName === 'string' && displayName.trim().length >= 2) {
        patch.displayName = displayName.trim().slice(0, 40);
    }
    if (typeof weeklyWins === 'number' && weeklyWins >= 0 && weeklyWins <= 9999) {
        patch.weeklyWins = weeklyWins;
    }
    guard(Object.keys(patch).length > 0, 'invalid-argument', 'Nada que actualizar');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`users/${uid}`);
    guard((await ref.get()).exists, 'not-found', 'Usuario no encontrado');
    await ref.update(patch);
    return { ok: true, uid, ...patch };
});
// ─────────────────────────────────────────────────────────────────────────────
// adminListTournaments — listado para panel
// ─────────────────────────────────────────────────────────────────────────────
exports.adminListTournaments = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const limit = Math.min(request.data?.limit ?? 20, 50);
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.collection('tournaments')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return {
        tournaments: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
});
//# sourceMappingURL=admin.js.map