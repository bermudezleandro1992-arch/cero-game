/**
 * Depósitos manuales con comprobante — anti-fraude
 *
 *   getDepositMethods     — catálogo de métodos (Prex, bancos, próximamente Binance/PayPal)
 *   submitDepositRequest  — usuario sube comprobante + metadata de dispositivo
 *   adminListDeposits     — cola para operadores
 *   adminReviewDeposit    — aprobar / rechazar con un clic (acredita CN)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';

const REGION = 'us-central1';

const MIN_DEPOSIT_CN = 100;
const MAX_DEPOSIT_CN = 100_000;
const MAX_RECEIPT_BYTES = 900_000;
const MAX_PENDING_PER_USER = 3;

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

async function assertAdmin(uid: string): Promise<void> {
  const snap = await getFirestore().doc(`admins/${uid}`).get();
  guard(snap.exists, 'permission-denied', 'Solo operadores');
}

function clientIp(raw: { ip?: string | undefined; headers?: Record<string, string | string[] | undefined> } | undefined): string {
  const fwd = raw?.headers?.['x-forwarded-for'];
  const ip  = raw?.ip ?? (Array.isArray(fwd) ? fwd[0] : fwd) ?? 'desconocida';
  return String(ip).split(',')[0]!.trim().slice(0, 80);
}

/** Métodos de ingreso — solo el servidor define alias/cuentas */
export const DEPOSIT_METHODS = {
  prex_ars: {
    id:          'prex_ars',
    label:       'Prex / Bancos y billeteras',
    subtitle:    'Transferencia en pesos argentinos',
    currency:    'ARS',
    destination: 'ceroclub.sk',
    destinationType: 'alias',
    enabled:     true,
    manualReview: true,
  },
  prex_usd: {
    id:          'prex_usd',
    label:       'Prex — Cuenta en dólares',
    subtitle:    'Transferencia USD',
    currency:    'USD',
    destination: 'PREXUSD',
    destinationType: 'alias',
    enabled:     true,
    manualReview: true,
  },
  prex_account: {
    id:          'prex_account',
    label:       'Otras cuentas Prex',
    subtitle:    'Por número de cuenta Prex',
    currency:    'ARS/USD',
    destination: '25782517',
    destinationType: 'account',
    enabled:     true,
    manualReview: true,
  },
  mercadopago_auto: {
    id:          'mercadopago_auto',
    label:       'Mercado Pago',
    subtitle:    'Pago automático con tarjeta / MP',
    currency:    'ARS',
    destination: null,
    enabled:     true,
    manualReview: false,
  },
  binance: {
    id:          'binance',
    label:       'Binance',
    subtitle:    'Próximamente',
    currency:    'USDT',
    destination: null,
    enabled:     false,
    manualReview: true,
    comingSoon:  true,
  },
  paypal: {
    id:          'paypal',
    label:       'PayPal',
    subtitle:    'Próximamente',
    currency:    'USD',
    destination: null,
    enabled:     false,
    manualReview: true,
    comingSoon:  true,
  },
} as const;

type MethodId = keyof typeof DEPOSIT_METHODS;

interface DeviceFingerprint {
  deviceId?:      string;
  userAgent?:       string;
  platform?:        string;
  os?:              string;
  deviceType?:      string;
  screen?:          string;
  language?:        string;
  isMobile?:        boolean;
  hardwareConcurrency?: number;
  deviceMemory?:    number;
  timezone?:        string;
}

function validateReceipt(dataUrl: string): { mime: string; size: number } {
  guard(typeof dataUrl === 'string' && dataUrl.length > 100, 'invalid-argument', 'Comprobante inválido');
  const match = dataUrl.match(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,(.+)$/);
  guard(match, 'invalid-argument', 'Formato inválido. Usá JPG, PNG, WEBP o PDF.');
  const b64 = match[3] ?? '';
  guard(b64.length < MAX_RECEIPT_BYTES, 'invalid-argument', 'Comprobante demasiado grande (máx. ~800 KB)');
  return { mime: match[1]!, size: b64.length };
}

// ─────────────────────────────────────────────────────────────────────────────

export const getDepositMethods = onCall(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const methods = Object.values(DEPOSIT_METHODS).map(m => ({
      id:              m.id,
      label:           m.label,
      subtitle:        m.subtitle,
      currency:        m.currency,
      destination:     m.destination,
      destinationType: 'destinationType' in m ? (m as { destinationType: string }).destinationType : null,
      enabled:         m.enabled,
      manualReview:    m.manualReview,
      comingSoon:      'comingSoon' in m ? m.comingSoon : false,
    }));
    return { ok: true, methods };
  },
);

interface SubmitDepositRequest {
  methodId:       string;
  coinsRequested: number;
  amountPaid?:    number;
  currency?:      string;
  receiptBase64:  string;
  receiptName?:   string;
  payerReference?: string;
  device?:          DeviceFingerprint;
}

export const submitDepositRequest = onCall<SubmitDepositRequest>(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');

    const uid     = request.auth!.uid;
    const email   = request.auth!.token.email ?? '';
    const name    = request.auth!.token.name  ?? 'Jugador';
    const data    = request.data;
    const methodId = data.methodId as MethodId;

    guard(Object.prototype.hasOwnProperty.call(DEPOSIT_METHODS, methodId),
      'invalid-argument', 'Método de pago inválido');

    const method = DEPOSIT_METHODS[methodId];
    guard(method.enabled, 'failed-precondition', 'Este método aún no está habilitado');
    guard(method.manualReview, 'invalid-argument',
      'Este método es automático — usá Mercado Pago en la tienda');

    const coins = Number(data.coinsRequested);
    guard(Number.isInteger(coins) && coins >= MIN_DEPOSIT_CN && coins <= MAX_DEPOSIT_CN,
      'invalid-argument', `Monto inválido (${MIN_DEPOSIT_CN}–${MAX_DEPOSIT_CN} CN)`);

    const receipt = validateReceipt(data.receiptBase64);
    const ip      = clientIp(request.rawRequest);
    const device  = data.device ?? {};

    const db = getFirestore();

    const pendingSnap = await db.collection('deposit_requests')
      .where('uid', '==', uid)
      .where('status', 'in', ['pending', 'reviewing'])
      .get();
    guard(pendingSnap.size < MAX_PENDING_PER_USER, 'resource-exhausted',
      'Tenés demasiados depósitos pendientes. Esperá la revisión.');

    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.data() ?? {};

    const docRef = db.collection('deposit_requests').doc();
    await docRef.set({
      uid,
      email,
      displayName:    name,
      methodId,
      methodLabel:    method.label,
      currency:       data.currency ?? method.currency,
      amountPaid:     typeof data.amountPaid === 'number' ? data.amountPaid : coins,
      coinsRequested: coins,
      receiptMime:    receipt.mime,
      receiptName:    String(data.receiptName ?? 'comprobante').slice(0, 120),
      receiptDataUrl: data.receiptBase64.slice(0, MAX_RECEIPT_BYTES + 200),
      payerReference: String(data.payerReference ?? '').slice(0, 120),
      status:         'pending',
      security: {
        clientIp:            ip,
        userAgent:           String(device.userAgent ?? '').slice(0, 500),
        platform:            String(device.platform ?? 'unknown').slice(0, 40),
        os:                  String(device.os ?? 'unknown').slice(0, 60),
        deviceType:          String(device.deviceType ?? 'unknown').slice(0, 30),
        screen:              String(device.screen ?? '').slice(0, 30),
        language:            String(device.language ?? '').slice(0, 20),
        timezone:            String(device.timezone ?? '').slice(0, 60),
        isMobile:            !!device.isMobile,
        deviceId:            String(device.deviceId ?? '').slice(0, 64),
        hardwareConcurrency: Number(device.hardwareConcurrency) || 0,
        deviceMemory:        Number(device.deviceMemory) || 0,
        submittedAt:         FieldValue.serverTimestamp(),
      },
      userHistory: {
        lastSessionIp:       userData['lastSessionIp'] ?? null,
        lastPlatform:        userData['lastPlatform'] ?? null,
        lastDeviceType:      userData['lastDeviceType'] ?? null,
        totalGamesPlayed:    userData['totalGamesPlayed'] ?? 0,
        accountCreatedAt:    userData['createdAt'] ?? null,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.doc('meta/admin_alerts').set({
      pendingDeposits:     FieldValue.increment(1),
      lastDepositAt:       FieldValue.serverTimestamp(),
      lastDepositUid:      uid,
      lastDepositEmail:    email,
      lastDepositCoins:    coins,
      lastDepositMethod:   methodId,
    }, { merge: true });

    return {
      ok: true,
      depositId: docRef.id,
      status:    'pending',
      message:   'Comprobante recibido. Un operador lo revisará en 24–48 h hábiles.',
    };
  },
);

export const adminListDeposits = onCall<{ status?: string; limit?: number }>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const status = request.data?.status ?? 'pending';
    const limit  = Math.min(request.data?.limit ?? 30, 50);
    const db     = getFirestore();

    let q = db.collection('deposit_requests').orderBy('createdAt', 'desc').limit(limit);
    if (status !== 'all') {
      q = db.collection('deposit_requests')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snap = await q.get();
    const deposits = snap.docs.map(d => {
      const x = d.data();
      return {
        id:             d.id,
        uid:            x['uid'],
        email:          x['email'],
        displayName:    x['displayName'],
        methodId:       x['methodId'],
        methodLabel:    x['methodLabel'],
        currency:       x['currency'],
        amountPaid:     x['amountPaid'],
        coinsRequested: x['coinsRequested'],
        coinsCredited:  x['coinsCredited'] ?? null,
        receiptMime:    x['receiptMime'],
        receiptName:    x['receiptName'],
        receiptDataUrl: x['receiptDataUrl'],
        payerReference: x['payerReference'],
        status:         x['status'],
        security:       x['security'] ?? {},
        userHistory:    x['userHistory'] ?? {},
        adminNote:      x['adminNote'] ?? null,
        reviewedBy:     x['reviewedBy'] ?? null,
        createdAt:      (x['createdAt'] as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? null,
        reviewedAt:     (x['reviewedAt'] as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? null,
      };
    });

    const alertsSnap = await db.doc('meta/admin_alerts').get();
    const alerts = alertsSnap.data() ?? {};

    return { ok: true, deposits, alerts: {
      pendingDeposits: alerts['pendingDeposits'] ?? 0,
      lastDepositAt:   (alerts['lastDepositAt'] as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? null,
      lastDepositEmail: alerts['lastDepositEmail'] ?? null,
    }};
  },
);

interface ReviewDepositRequest {
  depositId:     string;
  action:        'approve' | 'reject';
  adminNote?:    string;
  coinsToCredit?: number;
}

export const adminReviewDeposit = onCall<ReviewDepositRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const adminUid = request.auth!.uid;
    await assertAdmin(adminUid);

    const { depositId, action, adminNote } = request.data;
    guard(typeof depositId === 'string' && depositId, 'invalid-argument', 'Falta depositId');
    guard(action === 'approve' || action === 'reject', 'invalid-argument', 'Acción inválida');

    const db  = getFirestore();
    const ref = db.doc(`deposit_requests/${depositId}`);

    let credited = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      guard(snap.exists, 'not-found', 'Depósito no encontrado');

      const dep = snap.data()!;
      const st  = dep['status'] as string;
      guard(st === 'pending' || st === 'reviewing', 'failed-precondition',
        `Depósito ya procesado (${st})`);

      if (action === 'reject') {
        tx.update(ref, {
          status:     'rejected',
          adminNote:  String(adminNote ?? '').slice(0, 300),
          reviewedBy: adminUid,
          reviewedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const coins = typeof request.data.coinsToCredit === 'number'
        ? request.data.coinsToCredit
        : (dep['coinsRequested'] as number);
      guard(coins > 0 && coins <= MAX_DEPOSIT_CN, 'invalid-argument', 'Monto a acreditar inválido');

      const uid     = dep['uid'] as string;
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await tx.get(userRef);
      guard(userSnap.exists, 'not-found', 'Usuario no encontrado');

      tx.update(userRef, { ceroCoins: FieldValue.increment(coins) });
      tx.update(ref, {
        status:        'approved',
        coinsCredited: coins,
        adminNote:     String(adminNote ?? 'Aprobado').slice(0, 300),
        reviewedBy:    adminUid,
        reviewedAt:    FieldValue.serverTimestamp(),
      });
      credited = coins;
    });

    const depSnap = await ref.get();
    const dep     = depSnap.data()!;

    if (action === 'approve' && credited > 0) {
      await db.collection('coin_ledger').add({
        uid:       dep['uid'],
        amount:    credited,
        type:      'deposit_approved',
        depositId,
        methodId:  dep['methodId'],
        grantedBy: adminUid,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(`users/${dep['uid']}/notifications`).doc().set({
        type:      'deposit_approved',
        title:     'Depósito acreditado',
        body:      `Se acreditaron ${credited} Cero Coins a tu cuenta.`,
        coins:     credited,
        read:      false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await db.doc('meta/admin_alerts').set({
      pendingDeposits: FieldValue.increment(-1),
    }, { merge: true });

    return {
      ok: true,
      depositId,
      action,
      coinsCredited: action === 'approve' ? credited : 0,
    };
  },
);
