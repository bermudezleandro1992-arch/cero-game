"use strict";
/**
 * Configuración global editable desde el panel admin (Firestore config/app).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetAppConfig = exports.adminGetAppConfig = exports.DEFAULT_APP_CONFIG = void 0;
exports.getAppConfig = getAppConfig;
exports.invalidateAppConfigCache = invalidateAppConfigCache;
exports.getWaitingRoomMs = getWaitingRoomMs;
exports.validateStakeAmount = validateStakeAmount;
exports.publicConfigPayload = publicConfigPayload;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = 'us-central1';
const DOC_PATH = 'config/app';
exports.DEFAULT_APP_CONFIG = {
    roomStakes: [0, 30, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000],
    stakeMin: 30,
    stakeMax: 20000,
    waitingRoomMinutes: 5,
    chaoticModeEnabled: false,
    freeRoomsEnabled: true,
};
let cached = null;
const CACHE_TTL_MS = 30000;
function normalizeConfig(raw) {
    const base = { ...exports.DEFAULT_APP_CONFIG };
    if (!raw)
        return base;
    if (Array.isArray(raw.roomStakes)) {
        base.roomStakes = raw.roomStakes
            .map(v => Math.round(Number(v)))
            .filter(v => Number.isFinite(v) && v >= 0)
            .sort((a, b) => a - b);
        if (!base.roomStakes.length)
            base.roomStakes = [...exports.DEFAULT_APP_CONFIG.roomStakes];
    }
    if (typeof raw.stakeMin === 'number')
        base.stakeMin = Math.max(0, Math.round(raw.stakeMin));
    if (typeof raw.stakeMax === 'number')
        base.stakeMax = Math.max(base.stakeMin, Math.round(raw.stakeMax));
    if (typeof raw.waitingRoomMinutes === 'number') {
        base.waitingRoomMinutes = Math.min(60, Math.max(1, Math.round(raw.waitingRoomMinutes)));
    }
    if (typeof raw.chaoticModeEnabled === 'boolean')
        base.chaoticModeEnabled = raw.chaoticModeEnabled;
    if (typeof raw.freeRoomsEnabled === 'boolean')
        base.freeRoomsEnabled = raw.freeRoomsEnabled;
    return base;
}
async function getAppConfig(db = (0, firestore_1.getFirestore)()) {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS)
        return cached.cfg;
    try {
        const snap = await db.doc(DOC_PATH).get();
        const cfg = normalizeConfig(snap.exists ? snap.data() : undefined);
        cached = { cfg, at: Date.now() };
        return cfg;
    }
    catch {
        return { ...exports.DEFAULT_APP_CONFIG };
    }
}
function invalidateAppConfigCache() {
    cached = null;
}
async function getWaitingRoomMs(db = (0, firestore_1.getFirestore)()) {
    const cfg = await getAppConfig(db);
    return Math.max(60000, cfg.waitingRoomMinutes * 60 * 1000);
}
function validateStakeAmount(stakeCC, cfg) {
    const rounded = Math.round(stakeCC);
    if (rounded <= 0)
        return 0;
    if (rounded < cfg.stakeMin || rounded > cfg.stakeMax) {
        throw new https_1.HttpsError('invalid-argument', `Apuesta inválida. Elegí entre ${cfg.stakeMin} y ${cfg.stakeMax} CeroCoins.`);
    }
    return rounded;
}
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
async function assertAdmin(uid) {
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.doc(`admins/${uid}`).get();
    guard(snap.exists, 'permission-denied', 'Solo operadores pueden usar el panel admin');
}
exports.adminGetAppConfig = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const cfg = await getAppConfig();
    return { config: cfg };
});
exports.adminSetAppConfig = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth.uid);
    const data = (request.data ?? {});
    const cfg = normalizeConfig(data);
    guard(cfg.stakeMin <= cfg.stakeMax, 'invalid-argument', 'Mínimo no puede superar al máximo');
    guard(cfg.roomStakes.every(s => s === 0 || (s >= cfg.stakeMin && s <= cfg.stakeMax)), 'invalid-argument', 'Todas las apuestas deben estar dentro del rango min/max');
    const db = (0, firestore_1.getFirestore)();
    await db.doc(DOC_PATH).set({
        ...cfg,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
    }, { merge: true });
    invalidateAppConfigCache();
    return { ok: true, config: cfg };
});
/** Payload público para el cliente (lobby, tienda, flags). */
function publicConfigPayload(cfg) {
    return {
        roomStakes: cfg.roomStakes,
        stakeMin: cfg.stakeMin,
        stakeMax: cfg.stakeMax,
        waitingRoomMinutes: cfg.waitingRoomMinutes,
        chaoticModeEnabled: cfg.chaoticModeEnabled,
        freeRoomsEnabled: cfg.freeRoomsEnabled,
    };
}
//# sourceMappingURL=appConfig.js.map