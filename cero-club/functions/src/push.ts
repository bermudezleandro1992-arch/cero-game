/**
 * Notificaciones push (FCM) — guardar tokens y enviar avisos.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const REGION = 'us-central1';
const MAX_TOKENS = 5;

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

export const saveFcmToken = onCall<{ token: string; action?: 'add' | 'remove' }>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid    = request.auth!.uid;
    const token  = String(request.data?.token ?? '').trim();
    const action = request.data?.action === 'remove' ? 'remove' : 'add';
    guard(token.length > 20, 'invalid-argument', 'Token FCM inválido');

    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    const snap    = await userRef.get();
    guard(snap.exists, 'not-found', 'Perfil no encontrado');

    const existing = (snap.data()?.['fcmTokens'] as string[] | undefined) ?? [];
    let next: string[];

    if (action === 'remove') {
      next = existing.filter(t => t !== token);
    } else {
      next = [token, ...existing.filter(t => t !== token)].slice(0, MAX_TOKENS);
    }

    await userRef.update({
      fcmTokens:        next,
      pushEnabled:      next.length > 0,
      pushUpdatedAt:    FieldValue.serverTimestamp(),
    });

    return { ok: true, tokenCount: next.length };
  },
);

/** Envía push a un usuario (best-effort, no lanza). */
export async function sendPushToUser(
  uid:   string,
  title: string,
  body:  string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    const db   = getFirestore();
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) return;

    const tokens = (snap.data()?.['fcmTokens'] as string[] | undefined) ?? [];
    if (!tokens.length) return;

    const messaging = getMessaging();
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data ?? {},
      webpush: { fcmOptions: { link: 'https://cero-club.web.app/app/' } },
    });

    const stale: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        stale.push(tokens[i]!);
      }
    });

    if (stale.length) {
      const kept = tokens.filter(t => !stale.includes(t));
      await db.doc(`users/${uid}`).update({ fcmTokens: kept, pushEnabled: kept.length > 0 });
    }
  } catch (err) {
    console.warn('[sendPushToUser]', uid, err);
  }
}

export const sendTestPush = onCall<Record<string, never>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid = request.auth!.uid;
    await sendPushToUser(uid, 'CERO Club', '¡Notificaciones activadas! 🔔', { type: 'test' });
    return { ok: true };
  },
);

/** Config pública para el cliente (VAPID key, etc.) */
export const getPublicConfig = onCall<Record<string, never>>(
  { region: REGION },
  async () => {
    const db   = getFirestore();
    let vapidKey = process.env.CERO_VAPID_KEY ?? '';

    if (!vapidKey) {
      try {
        const snap = await db.doc('config/public').get();
        vapidKey = (snap.data()?.['vapidKey'] as string | undefined) ?? '';
      } catch { /* ignore */ }
    }

    return { vapidKey, pushEnabled: !!vapidKey };
  },
);
