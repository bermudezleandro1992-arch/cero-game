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
exports.updateRanking = exports.claimDailyReward = exports.equipCosmetic = exports.purchaseCosmetic = exports.resetMonthlyRanking = exports.resetWeeklyRanking = exports.claimDailyBonus = exports.initUserProfile = exports.COSMETIC_CATALOG = void 0;
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
function transferIdForUid(uid) {
    return 'CC-' + crypto.createHash('sha256').update('xfer:' + uid).digest('hex').slice(0, 8).toUpperCase();
}
const WEEKLY_PRIZES = {
    1: 1000,
    2: 600,
    3: 400,
    4: 75,
    5: 75,
    6: 50,
    7: 50,
    8: 50,
    9: 50,
    10: 50,
};
const MONTHLY_TOP3_PRIZES = {
    1: 5000,
    2: 3000,
    3: 1500,
};
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
const EQUIP_FIELD = {
    card_skin: 'equippedSkin',
    avatar_frame: 'equippedFrame',
    table_bg: 'equippedTableBg',
    room_bg: 'equippedRoomBg',
    deck_back: 'equippedDeckBack',
};
exports.COSMETIC_CATALOG = {
    skin_neon: { id: 'skin_neon', name: 'Neón Oscuro', category: 'card_skin', price: 200, preview: 'skins/neon' },
    skin_gold: { id: 'skin_gold', name: 'Dorado Real', category: 'card_skin', price: 350, preview: 'skins/gold' },
    skin_galaxy: { id: 'skin_galaxy', name: 'Galaxia', category: 'card_skin', price: 500, preview: 'skins/galaxy' },
    skin_minimal: { id: 'skin_minimal', name: 'Minimalista', category: 'card_skin', price: 150, preview: 'skins/minimal' },
    frame_fire: { id: 'frame_fire', name: 'Marco de Fuego', category: 'avatar_frame', price: 200, preview: 'frames/fire' },
    frame_ice: { id: 'frame_ice', name: 'Marco de Hielo', category: 'avatar_frame', price: 200, preview: 'frames/ice' },
    frame_gold: { id: 'frame_gold', name: 'Marco Dorado', category: 'avatar_frame', price: 400, preview: 'frames/gold' },
    frame_champion: { id: 'frame_champion', name: 'Campeón', category: 'avatar_frame', price: 750, preview: 'frames/champ' },
    table_neon: { id: 'table_neon', name: 'Mesa Neón', category: 'table_bg', price: 300, preview: 'tables/neon' },
    table_marble: { id: 'table_marble', name: 'Mesa Mármol', category: 'table_bg', price: 450, preview: 'tables/marble' },
    table_carbon: { id: 'table_carbon', name: 'Mesa Carbon', category: 'table_bg', price: 550, preview: 'tables/carbon' },
    bg_stadium: { id: 'bg_stadium', name: 'Estadio', category: 'room_bg', price: 400, preview: 'rooms/stadium' },
    bg_beach: { id: 'bg_beach', name: 'Playa', category: 'room_bg', price: 350, preview: 'rooms/beach' },
    bg_city: { id: 'bg_city', name: 'Ciudad Noche', category: 'room_bg', price: 400, preview: 'rooms/city' },
    bg_football: { id: 'bg_football', name: 'Cancha Fútbol', category: 'room_bg', price: 500, preview: 'rooms/football' },
    deck_classic: { id: 'deck_classic', name: 'Mazo CERO Clásico', category: 'deck_back', price: 150, preview: 'cards/classic-back' },
    deck_gold: { id: 'deck_gold', name: 'Mazo Dorado', category: 'deck_back', price: 350, preview: 'decks/gold' },
    deck_cyber: { id: 'deck_cyber', name: 'Mazo Cyber', category: 'deck_back', price: 450, preview: 'decks/cyber' },
    deck_holo: { id: 'deck_holo', name: 'Mazo Holográfico', category: 'deck_back', price: 520, preview: 'decks/cyber' },
    table_felt: { id: 'table_felt', name: 'Mesa Casino', category: 'table_bg', price: 380, preview: 'tables/neon' },
    table_galaxy: { id: 'table_galaxy', name: 'Mesa Galaxia', category: 'table_bg', price: 620, preview: 'tables/neon' },
    table_royal: { id: 'table_royal', name: 'Mesa Real', category: 'table_bg', price: 800, preview: 'tables/marble' },
    bg_casino: { id: 'bg_casino', name: 'Casino VIP', category: 'room_bg', price: 550, preview: 'rooms/stadium' },
    bg_neon: { id: 'bg_neon', name: 'Neón Cyber', category: 'room_bg', price: 480, preview: 'rooms/city' },
    bg_arena: { id: 'bg_arena', name: 'Arena Pro', category: 'room_bg', price: 650, preview: 'rooms/football' },
    skin_carbon: { id: 'skin_carbon', name: 'Cartas Carbon', category: 'card_skin', price: 280, preview: 'skins/minimal' },
    skin_rainbow: { id: 'skin_rainbow', name: 'Cartas Arcoíris', category: 'card_skin', price: 420, preview: 'skins/galaxy' },
    frame_diamond: { id: 'frame_diamond', name: 'Marco Diamante', category: 'avatar_frame', price: 900, preview: 'frames/gold' },
    frame_legend: { id: 'frame_legend', name: 'Marco Leyenda', category: 'avatar_frame', price: 1200, preview: 'frames/champ' },
    frame_neon_ring: { id: 'frame_neon_ring', name: 'Anillo Neón', category: 'avatar_frame', price: 850, preview: 'frames/neon-ring' },
    frame_aurora: { id: 'frame_aurora', name: 'Aurora VIP', category: 'avatar_frame', price: 1500, preview: 'frames/aurora' },
    frame_vip_glow: { id: 'frame_vip_glow', name: 'Brillo Élite', category: 'avatar_frame', price: 2000, preview: 'frames/vip' },
    deck_flame: { id: 'deck_flame', name: 'Mazo Llama', category: 'deck_back', price: 480, preview: 'decks/flame' },
    deck_legend: { id: 'deck_legend', name: 'Mazo Leyenda', category: 'deck_back', price: 720, preview: 'decks/legend' },
    deck_neon: { id: 'deck_neon', name: 'Mazo Neón Pro', category: 'deck_back', price: 580, preview: 'decks/neon' },
    bg_mundial: { id: 'bg_mundial', name: 'Ambiente Mundial', category: 'room_bg', price: 680, preview: 'rooms/mundial' },
    table_mundial: { id: 'table_mundial', name: 'Mesa Mundial', category: 'table_bg', price: 520, preview: 'tables/mundial' },
    frame_mundial: { id: 'frame_mundial', name: 'Marco Mundial', category: 'avatar_frame', price: 950, preview: 'frames/mundial' },
    frame_laser: { id: 'frame_laser', name: 'Láser RGB', category: 'avatar_frame', price: 1100, preview: 'frames/neon-ring' },
    frame_prism: { id: 'frame_prism', name: 'Prisma Arcoíris', category: 'avatar_frame', price: 1300, preview: 'frames/aurora' },
    deck_mundial: { id: 'deck_mundial', name: 'Mazo Mundial', category: 'deck_back', price: 620, preview: 'decks/mundial' },
    skin_mundial: { id: 'skin_mundial', name: 'Cartas Mundial', category: 'card_skin', price: 480, preview: 'skins/galaxy' },
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
    const isGuest = (request.auth.token['firebase']
        ?.sign_in_provider === 'anonymous');
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    let created = false;
    let ceroCoins = 0;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        if (snap.exists) {
            ceroCoins = snap.data()?.['ceroCoins'] ?? 0;
            const patch = {};
            if (!snap.data()?.['referralCode'])
                patch.referralCode = referralCodeForUid(uid);
            if (!snap.data()?.['transferId'])
                patch.transferId = transferIdForUid(uid);
            if (Object.keys(patch).length)
                tx.update(userRef, patch);
            return; // perfil ya existe, no tocar saldo
        }
        // Primer login: crear perfil con bonus de bienvenida (invitados sin bonus)
        created = true;
        ceroCoins = isGuest ? 0 : WELCOME_COINS;
        const referralCode = referralCodeForUid(uid);
        const transferId = transferIdForUid(uid);
        tx.set(userRef, {
            displayName: name,
            email,
            ceroCoins: isGuest ? 0 : WELCOME_COINS,
            isGuest,
            anon: isGuest,
            freeGamesPlayed: 0,
            totalGamesPlayed: 0,
            wins: 0,
            weeklyWins: 0, // ranking semanal
            monthlyWins: 0, // ranking mensual
            rankScore: 0, // puntos de ranking (wins × 10 − losses × 2)
            lastDailyClaim: null,
            ownedCosmetics: [],
            equippedSkin: null,
            equippedFrame: null,
            equippedTableBg: null,
            equippedRoomBg: null,
            equippedDeckBack: null,
            countryCode: null,
            photoURL: null,
            referralCode,
            transferId,
            referredBy: null,
            referralCount: 0,
            referralBonusClaimed: false,
            xp: 0,
            seasonId: null,
            seasonClaimedTiers: [],
            fcmTokens: [],
            pushEnabled: false,
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
// ─────────────────────────────────────────────────────────────────────────────
// resetMonthlyRanking — día 1 de cada mes 00:05 UTC — premia top 3 del mes
// ─────────────────────────────────────────────────────────────────────────────
exports.resetMonthlyRanking = (0, scheduler_1.onSchedule)({ schedule: '5 0 1 * *', region: REGION, timeoutSeconds: 540 }, async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getUTCMonth() === 0
        ? `${now.getUTCFullYear() - 1}-12`
        : `${now.getUTCFullYear()}-${String(now.getUTCMonth()).padStart(2, '0')}`;
    const topSnap = await db.collection('users')
        .orderBy('monthlyWins', 'desc')
        .limit(50)
        .get();
    const entries = topSnap.docs.map((d, i) => ({
        uid: d.id,
        name: d.data()['displayName'] ?? 'Jugador',
        monthlyWins: d.data()['monthlyWins'] ?? 0,
        position: i + 1,
    }));
    await db.doc(`ranking/${prevMonth}`).set({
        period: 'monthly',
        monthKey: prevMonth,
        generatedAt: firestore_1.FieldValue.serverTimestamp(),
        entries: entries.slice(0, 10),
    });
    const batch = db.batch();
    for (const entry of entries.slice(0, 3)) {
        const prize = MONTHLY_TOP3_PRIZES[entry.position] ?? 0;
        if (prize <= 0 || entry.monthlyWins === 0)
            continue;
        batch.update(db.doc(`users/${entry.uid}`), {
            ceroCoins: firestore_1.FieldValue.increment(prize),
        });
        batch.set(db.collection(`users/${entry.uid}/notifications`).doc(), {
            type: 'monthly_prize',
            title: `Top ${entry.position} del mes`,
            body: `Ganaste ${prize} CN por el puesto ${entry.position} en ${prevMonth}.`,
            coins: prize,
            monthKey: prevMonth,
            read: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    for (let i = 0; i < topSnap.docs.length; i += 450) {
        const resetBatch = db.batch();
        for (const d of topSnap.docs.slice(i, i + 450)) {
            resetBatch.update(d.ref, { monthlyWins: 0 });
        }
        await resetBatch.commit();
    }
    console.info(`[resetMonthlyRanking] ${prevMonth} — campeón: ${entries[0]?.name ?? 'nadie'}`);
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
        const field = EQUIP_FIELD[cosmetic.category];
        await userRef.update({ [field]: cosmeticId });
    }
    else {
        await userRef.update({
            equippedSkin: null,
            equippedFrame: null,
            equippedTableBg: null,
            equippedRoomBg: null,
            equippedDeckBack: null,
        });
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