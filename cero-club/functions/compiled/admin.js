"use strict";
/**
 * Panel de operadores — gestión de usuarios y Cero Coins
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCleanupStaleRooms = exports.adminCloseWaitingMatch = exports.adminListWaitingMatches = exports.adminListTournaments = exports.adminUpdateUser = exports.adminSetCeroCoins = exports.adminGetUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = 'us-central1';
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
function matchCreatedMs(createdAt) {
    if (!createdAt || typeof createdAt.toMillis !== 'function') {
        return 0;
    }
    return createdAt.toMillis();
}
function matchAgeMs(data) {
    return matchCreatedMs(data.startedAt) || matchCreatedMs(data.createdAt);
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
// ─────────────────────────────────────────────────────────────────────────────
// adminListWaitingMatches — salas abiertas colgadas
// ─────────────────────────────────────────────────────────────────────────────
exports.adminListWaitingMatches = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const limit = Math.min(request.data?.limit ?? 50, 100);
    const db = (0, firestore_1.getFirestore)();
    const { isStuckMatch } = await Promise.resolve().then(() => __importStar(require('./game')));
    const [waitingSnap, playingSnap] = await Promise.all([
        db.collection('matches').where('status', '==', 'waiting').limit(limit).get(),
        db.collection('matches').where('status', '==', 'playing').limit(limit).get(),
    ]);
    const now = Date.now();
    const mapDoc = (d, status) => {
        const data = d.data();
        const createdMs = matchCreatedMs(data.createdAt);
        const ageMs = matchAgeMs(data);
        const ageMinutes = ageMs > 0 ? Math.round((now - ageMs) / 60000) : null;
        return {
            id: d.id,
            status,
            mode: data.mode ?? 'classic',
            stakeCC: data.stakeCC ?? 0,
            playerCount: data.playerCount ?? 0,
            maxPlayers: data.maxPlayers ?? 2,
            guestOnly: data.guestOnly === true,
            phase: data.phase ?? '—',
            players: (data.players ?? []).map((p) => ({
                uid: p.uid ?? '',
                name: p.name ?? 'Jugador',
            })),
            createdAt: createdMs || null,
            ageMinutes,
            stale: isStuckMatch(data, now),
        };
    };
    const matches = [
        ...waitingSnap.docs.map(d => mapDoc(d, 'waiting')),
        ...playingSnap.docs
            .map(d => mapDoc(d, 'playing'))
            .filter(m => m.stale),
    ].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit);
    return { matches };
});
exports.adminCloseWaitingMatch = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const matchId = request.data?.matchId;
    guard(typeof matchId === 'string' && matchId, 'invalid-argument', 'matchId inválido');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`matches/${matchId}`);
    const snap = await ref.get();
    guard(snap.exists, 'not-found', 'Sala no encontrada');
    const match = snap.data();
    guard(match.status === 'waiting' || (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard), 'failed-precondition', 'Solo se pueden cerrar salas en espera o partidas colgadas sin iniciar');
    const { forceCloseMatch } = await Promise.resolve().then(() => __importStar(require('./game')));
    await forceCloseMatch(db, ref, match, request.data?.reason ?? 'admin_close');
    return { ok: true, matchId };
});
exports.adminCleanupStaleRooms = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const minAgeMinutes = Math.min(Math.max(request.data?.minAgeMinutes ?? 4, 0), 60);
    const limit = Math.min(request.data?.limit ?? 100, 200);
    const cutoff = Date.now() - minAgeMinutes * 60 * 1000;
    const now = Date.now();
    const db = (0, firestore_1.getFirestore)();
    const { forceCloseMatch, isStuckMatch } = await Promise.resolve().then(() => __importStar(require('./game')));
    const [waitingSnap, playingSnap] = await Promise.all([
        db.collection('matches').where('status', '==', 'waiting').limit(limit).get(),
        db.collection('matches').where('status', '==', 'playing').limit(limit).get(),
    ]);
    let closed = 0;
    for (const docSnap of waitingSnap.docs) {
        const match = docSnap.data();
        const ageMs = matchCreatedMs(match.createdAt);
        if (minAgeMinutes === 0 || ageMs === 0 || ageMs <= cutoff) {
            await forceCloseMatch(db, docSnap.ref, match, 'admin_cleanup_stale');
            closed++;
        }
    }
    for (const docSnap of playingSnap.docs) {
        const match = docSnap.data();
        if (!isStuckMatch(match, now))
            continue;
        const ageMs = matchAgeMs(match);
        if (minAgeMinutes === 0 || ageMs === 0 || ageMs <= cutoff) {
            await forceCloseMatch(db, docSnap.ref, match, 'admin_cleanup_stuck_playing');
            closed++;
        }
    }
    return { ok: true, closed, minAgeMinutes };
});
//# sourceMappingURL=admin.js.map