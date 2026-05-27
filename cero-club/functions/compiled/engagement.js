"use strict";
/**
 * functions/src/engagement.ts
 *
 * Loops de engagement de CERO:
 *
 *   initUserProfile        — callable: crea perfil con 100 CC de bienvenida
 *   claimDailyBonus        — callable: reclamar 10 CC (una vez cada 24 h)
 *   resetWeeklyRanking     — scheduler: lunes 00:00 UTC, premia top 10 y resetea
 *   purchaseCosmetic       — callable: comprar skin/marco con Coins
 *
 * Regla de oro: ningún saldo se modifica desde el cliente — solo Cloud Functions.
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
exports.updateRanking = exports.claimDailyReward = exports.equipCosmetic = exports.purchaseCosmetic = exports.resetWeeklyRanking = exports.claimDailyBonus = exports.initUserProfile = exports.COSMETIC_CATALOG = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const REGION = 'us-central1';
const WELCOME_COINS = 100;
const DAILY_BONUS_COINS = 10;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h en ms
function referralCodeForUid(uid) {
    return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 8).toUpperCase();
}
const WEEKLY_PRIZES = {
    1: 500,
    2: 300,
    3: 200,
    4: 75,
    5: 75,
    6: 50,
    7: 50,
    8: 50,
    9: 50,
    10: 50,
};
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
exports.COSMETIC_CATALOG = {
    skin_neon: { id: 'skin_neon', name: 'Neón Oscuro', category: 'card_skin', price: 200, preview: 'skins/neon' },
    skin_gold: { id: 'skin_gold', name: 'Dorado Real', category: 'card_skin', price: 350, preview: 'skins/gold' },
    skin_galaxy: { id: 'skin_galaxy', name: 'Galaxia', category: 'card_skin', price: 500, preview: 'skins/galaxy' },
    skin_minimal: { id: 'skin_minimal', name: 'Minimalista', category: 'card_skin', price: 150, preview: 'skins/minimal' },
    frame_fire: { id: 'frame_fire', name: 'Marco de Fuego', category: 'avatar_frame', price: 200, preview: 'frames/fire' },
    frame_ice: { id: 'frame_ice', name: 'Marco de Hielo', category: 'avatar_frame', price: 200, preview: 'frames/ice' },
    frame_gold: { id: 'frame_gold', name: 'Marco Dorado', category: 'avatar_frame', price: 400, preview: 'frames/gold' },
    frame_champion: { id: 'frame_champion', name: 'Campeón', category: 'avatar_frame', price: 750, preview: 'frames/champ' },
};
/**
 * Idempotente: si el perfil ya existe, devuelve los datos actuales.
 * El cliente debe llamarla una vez al hacer login.
 */
exports.initUserProfile = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const name = request.auth.token.name ?? 'Jugador';
    const email = request.auth.token.email ?? '';
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    let created = false;
    let ceroCoins = 0;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (snap.exists) {
            ceroCoins = snap.data()?.['ceroCoins'] ?? 0;
            if (!snap.data()?.['referralCode']) {
                tx.update(userRef, { referralCode: referralCodeForUid(uid) });
            }
            return; // perfil ya existe, no tocar saldo
        }
        // Primer login: crear perfil con bonus de bienvenida
        created = true;
        ceroCoins = WELCOME_COINS;
        const referralCode = referralCodeForUid(uid);
        tx.set(userRef, {
            displayName: name,
            email,
            ceroCoins: WELCOME_COINS,
            freeGamesPlayed: 0,
            totalGamesPlayed: 0,
            wins: 0,
            weeklyWins: 0, // para el ranking semanal
            rankScore: 0, // puntos de ranking (wins × 10 − losses × 2)
            lastDailyClaim: null,
            ownedCosmetics: [],
            equippedSkin: null,
            equippedFrame: null,
            referralCode,
            referredBy: null,
            referralCount: 0,
            referralBonusClaimed: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    // Registrar el bonus en el ledger
    if (created) {
        await db.collection('coin_ledger').add({
            uid,
            amount: WELCOME_COINS,
            type: 'welcome_bonus',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return { created, ceroCoins };
});
exports.claimDailyBonus = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const now = Date.now();
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    let newBalance = 0;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        guard(snap.exists, 'not-found', 'Perfil no encontrado. Iniciá sesión primero.');
        const data = snap.data();
        const lastClaimTs = data['lastDailyClaim']
            ?.toMillis() ?? 0;
        const msSinceClaim = now - lastClaimTs;
        guard(msSinceClaim >= DAILY_COOLDOWN_MS, 'resource-exhausted', `Ya reclamaste hoy. Próximo reclamo en ${Math.ceil((DAILY_COOLDOWN_MS - msSinceClaim) / 60000)} min.`);
        const currentCoins = data['ceroCoins'] ?? 0;
        newBalance = currentCoins + DAILY_BONUS_COINS;
        tx.update(userRef, {
            ceroCoins: firestore_1.FieldValue.increment(DAILY_BONUS_COINS),
            lastDailyClaim: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    await db.collection('coin_ledger').add({
        uid,
        amount: DAILY_BONUS_COINS,
        type: 'daily_bonus',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return {
        ok: true,
        coinsAwarded: DAILY_BONUS_COINS,
        nextClaimAt: now + DAILY_COOLDOWN_MS,
        newBalance,
    };
});
// ─────────────────────────────────────────────────────────────────────────────
// resetWeeklyRanking — lunes 00:00 UTC
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 1. Toma un snapshot del ranking semanal actual (top 100 por weeklyWins).
 * 2. Lo guarda en ranking/{YYYY-Www} para historiales.
 * 3. Premia a los top 10 con Coins.
 * 4. Resetea weeklyWins y rankScore a 0 para todos.
 */
exports.resetWeeklyRanking = (0, scheduler_1.onSchedule)({ schedule: '0 0 * * 1', region: REGION, timeoutSeconds: 540 }, async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date();
    // ISO week key, e.g. "2026-W22"
    const startOfYear = new Date(now.getUTCFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
    // The snapshot is for the week that JUST ended (previous week)
    const prevWeekNum = weekNum === 1 ? 52 : weekNum - 1;
    const year = weekNum === 1 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const weekKey = `${year}-W${String(prevWeekNum).padStart(2, '0')}`;
    // ── Top 100 por weeklyWins ────────────────────────────────────────────
    const topSnap = await db.collection('users')
        .orderBy('weeklyWins', 'desc')
        .limit(100)
        .get();
    const entries = topSnap.docs.map((d, i) => ({
        uid: d.id,
        name: d.data()['displayName'] ?? 'Jugador',
        weeklyWins: d.data()['weeklyWins'] ?? 0,
        position: i + 1,
    }));
    // Guardar snapshot histórico
    await db.doc(`ranking/${weekKey}`).set({
        weekKey,
        generatedAt: firestore_1.FieldValue.serverTimestamp(),
        entries,
    });
    // ── Premiar top 10 ────────────────────────────────────────────────────
    const batch = db.batch();
    for (const entry of entries.slice(0, 10)) {
        const prize = WEEKLY_PRIZES[entry.position] ?? 0;
        if (prize <= 0 || entry.weeklyWins === 0)
            continue;
        batch.update(db.doc(`users/${entry.uid}`), {
            ceroCoins: firestore_1.FieldValue.increment(prize),
        });
        // Notificación en la subcollection del usuario
        batch.set(db.collection(`users/${entry.uid}/notifications`).doc(), {
            type: 'weekly_prize',
            title: `¡Top ${entry.position} semanal!`,
            body: `Ganaste ${prize} CC por terminar en el puesto ${entry.position} esta semana.`,
            coins: prize,
            weekKey,
            read: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    // ── Resetear contadores semanales para TODOS ──────────────────────────
    // Procesar en lotes de 450
    const BATCH_SIZE = 450;
    for (let i = 0; i < topSnap.docs.length; i += BATCH_SIZE) {
        const resetBatch = db.batch();
        for (const d of topSnap.docs.slice(i, i + BATCH_SIZE)) {
            resetBatch.update(d.ref, { weeklyWins: 0, rankScore: 0 });
        }
        await resetBatch.commit();
    }
    await batch.commit();
    console.info(`[resetWeeklyRanking] ${weekKey} procesado. Top: ${entries[0]?.name ?? 'nadie'}`);
});
exports.purchaseCosmetic = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const cosmeticId = request.data.cosmeticId;
    guard(typeof cosmeticId === 'string' && cosmeticId, 'invalid-argument', 'Falta cosmeticId');
    const cosmetic = exports.COSMETIC_CATALOG[cosmeticId];
    guard(cosmetic, 'not-found', `Cosmético "${cosmeticId}" no existe`);
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    let newBalance = 0;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        guard(snap.exists, 'not-found', 'Perfil no encontrado');
        const data = snap.data();
        const balance = data['ceroCoins'] ?? 0;
        const owned = data['ownedCosmetics'] ?? [];
        guard(!owned.includes(cosmeticId), 'already-exists', `Ya tenés "${cosmetic.name}"`);
        guard(balance >= cosmetic.price, 'resource-exhausted', `Saldo insuficiente. Necesitás ${cosmetic.price} CC, tenés ${balance}.`);
        newBalance = balance - cosmetic.price;
        tx.update(userRef, {
            ceroCoins: firestore_1.FieldValue.increment(-cosmetic.price),
            ownedCosmetics: firestore_1.FieldValue.arrayUnion(cosmeticId),
        });
    });
    await db.collection('coin_ledger').add({
        uid,
        amount: -cosmetic.price,
        type: 'cosmetic_purchase',
        cosmeticId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, cosmeticId, newBalance };
});
exports.equipCosmetic = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const cosmeticId = request.data.cosmeticId; // null = desequipar
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    if (cosmeticId !== null) {
        const cosmetic = exports.COSMETIC_CATALOG[cosmeticId];
        guard(cosmetic, 'not-found', `Cosmético "${cosmeticId}" no existe`);
        const snap = await userRef.get();
        const owned = snap.data()?.['ownedCosmetics'] ?? [];
        guard(owned.includes(cosmeticId), 'permission-denied', 'No tenés este cosmético');
        const field = cosmetic.category === 'card_skin' ? 'equippedSkin' : 'equippedFrame';
        await userRef.update({ [field]: cosmeticId });
    }
    else {
        // Desequipar todo (null)
        await userRef.update({ equippedSkin: null, equippedFrame: null });
    }
    return { ok: true };
});
// ─────────────────────────────────────────────────────────────────────────────
// claimDailyReward — alias del nombre solicitado (mismo comportamiento que
// claimDailyBonus: 10 CC una vez cada 24 h)
// ─────────────────────────────────────────────────────────────────────────────
exports.claimDailyReward = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`users/${uid}`);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        guard(snap.exists, 'not-found', 'Perfil no encontrado — llamá a initUserProfile primero');
        const data = snap.data();
        const lastClaim = data['lastDailyClaim']?.toMillis() ?? 0;
        const now = Date.now();
        const elapsed = now - lastClaim;
        if (elapsed < DAILY_COOLDOWN_MS) {
            const remaining = Math.ceil((DAILY_COOLDOWN_MS - elapsed) / 1000 / 60);
            throw new https_1.HttpsError('failed-precondition', `Ya reclamaste hoy. Próximo bonus en ${remaining} min.`);
        }
        tx.update(ref, {
            ceroCoins: firestore_1.FieldValue.increment(DAILY_BONUS_COINS),
            lastDailyClaim: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, coinsAwarded: DAILY_BONUS_COINS };
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// updateRanking — callable: (re)genera el snapshot del ranking semanal y lo
// guarda en ranking/current.  Cualquier usuario autenticado puede invocarlo;
// el resultado real viene del campo weeklyWins de cada usuario.
// ─────────────────────────────────────────────────────────────────────────────
exports.updateRanking = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const db = (0, firestore_1.getFirestore)();
    const snap = await db
        .collection('users')
        .where('anon', '==', false)
        .orderBy('weeklyWins', 'desc')
        .limit(10)
        .get();
    const entries = snap.docs.map((d, i) => ({
        rank: i + 1,
        uid: d.id,
        name: d.data()['displayName'] ?? 'Jugador',
        weeklyWins: d.data()['weeklyWins'] ?? 0,
        rankScore: d.data()['rankScore'] ?? 0,
    }));
    await db.doc('ranking/current').set({ entries, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, entries };
});
//# sourceMappingURL=engagement.js.map