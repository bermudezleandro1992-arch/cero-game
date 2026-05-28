"use strict";
/**
 * Notificaciones push (FCM) — guardar tokens y enviar avisos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicConfig = exports.sendTestPush = exports.saveFcmToken = void 0;
exports.sendPushToUser = sendPushToUser;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const REGION = 'us-central1';
const MAX_TOKENS = 5;
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
exports.saveFcmToken = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const token = String(request.data?.token ?? '').trim();
    const action = request.data?.action === 'remove' ? 'remove' : 'add';
    guard(token.length > 20, 'invalid-argument', 'Token FCM inválido');
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    guard(snap.exists, 'not-found', 'Perfil no encontrado');
    const existing = snap.data()?.['fcmTokens'] ?? [];
    let next;
    if (action === 'remove') {
        next = existing.filter(t => t !== token);
    }
    else {
        next = [token, ...existing.filter(t => t !== token)].slice(0, MAX_TOKENS);
    }
    await userRef.update({
        fcmTokens: next,
        pushEnabled: next.length > 0,
        pushUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, tokenCount: next.length };
});
/** Envía push a un usuario (best-effort, no lanza). */
async function sendPushToUser(uid, title, body, data) {
    try {
        const db = (0, firestore_1.getFirestore)();
        const snap = await db.doc(`users/${uid}`).get();
        if (!snap.exists)
            return;
        const tokens = snap.data()?.['fcmTokens'] ?? [];
        if (!tokens.length)
            return;
        const messaging = (0, messaging_1.getMessaging)();
        const res = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: data ?? {},
            webpush: { fcmOptions: { link: 'https://cero-club.web.app/app/' } },
        });
        const stale = [];
        res.responses.forEach((r, i) => {
            if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
                stale.push(tokens[i]);
            }
        });
        if (stale.length) {
            const kept = tokens.filter(t => !stale.includes(t));
            await db.doc(`users/${uid}`).update({ fcmTokens: kept, pushEnabled: kept.length > 0 });
        }
    }
    catch (err) {
        console.warn('[sendPushToUser]', uid, err);
    }
}
exports.sendTestPush = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    await sendPushToUser(uid, 'CERO Club', '¡Notificaciones activadas! 🔔', { type: 'test' });
    return { ok: true };
});
/** Config pública para el cliente (VAPID key, etc.) */
exports.getPublicConfig = (0, https_1.onCall)({ region: REGION }, async () => {
    const db = (0, firestore_1.getFirestore)();
    let vapidKey = process.env.CERO_VAPID_KEY ?? '';
    if (!vapidKey) {
        try {
            const snap = await db.doc('config/public').get();
            vapidKey = snap.data()?.['vapidKey'] ?? '';
        }
        catch { /* ignore */ }
    }
    return { vapidKey, pushEnabled: !!vapidKey };
});
//# sourceMappingURL=push.js.map