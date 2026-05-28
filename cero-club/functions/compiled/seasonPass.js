"use strict";
/**
 * Pase de temporada — tiers de XP con recompensas en CC.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimSeasonTier = exports.getSeasonPassStatus = exports.SEASON_TIERS = void 0;
exports.currentSeasonId = currentSeasonId;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = 'us-central1';
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
function currentSeasonId() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
exports.SEASON_TIERS = [
    { tier: 1, xp: 100, coins: 30 },
    { tier: 2, xp: 250, coins: 50 },
    { tier: 3, xp: 450, coins: 75 },
    { tier: 4, xp: 700, coins: 100 },
    { tier: 5, xp: 1000, coins: 150 },
    { tier: 6, xp: 1400, coins: 200 },
    { tier: 7, xp: 1900, coins: 250 },
    { tier: 8, xp: 2500, coins: 300 },
];
exports.getSeasonPassStatus = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.doc(`users/${uid}`).get();
    const data = snap.data() ?? {};
    const xp = data['xp'] ?? 0;
    const season = currentSeasonId();
    const claimed = data['seasonClaimedTiers'] ?? [];
    const userSeason = data['seasonId'] ?? season;
    const tiers = exports.SEASON_TIERS.map(t => ({
        ...t,
        unlocked: xp >= t.xp,
        claimed: userSeason === season && claimed.includes(t.tier),
    }));
    const nextTier = exports.SEASON_TIERS.find(t => xp < t.xp) ?? null;
    return {
        seasonId: season,
        xp,
        level: exports.SEASON_TIERS.filter(t => xp >= t.xp).length,
        nextTier: nextTier ? { tier: nextTier.tier, xpNeeded: nextTier.xp - xp } : null,
        tiers,
    };
});
exports.claimSeasonTier = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const tier = request.data?.tier;
    guard(typeof tier === 'number' && tier >= 1, 'invalid-argument', 'tier inválido');
    const def = exports.SEASON_TIERS.find(t => t.tier === tier);
    guard(def, 'not-found', 'Tier no encontrado');
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    const season = currentSeasonId();
    let coins = 0;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        guard(snap.exists, 'not-found', 'Perfil no encontrado');
        const data = snap.data();
        const xp = data['xp'] ?? 0;
        let claimed = data['seasonClaimedTiers'] ?? [];
        const userSeason = data['seasonId'] ?? season;
        if (userSeason !== season) {
            claimed = [];
        }
        guard(xp >= def.xp, 'failed-precondition', `Necesitás ${def.xp} XP (tenés ${xp})`);
        guard(!claimed.includes(tier), 'already-exists', 'Ya reclamaste este tier');
        coins = def.coins;
        tx.update(userRef, {
            seasonId: season,
            seasonClaimedTiers: [...claimed, tier],
            ceroCoins: firestore_1.FieldValue.increment(coins),
        });
    });
    await db.collection('coin_ledger').add({
        uid,
        amount: coins,
        type: 'season_pass',
        tier,
        seasonId: season,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, coins, tier };
});
//# sourceMappingURL=seasonPass.js.map