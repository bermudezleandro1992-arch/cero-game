/**
 * functions/src/monetization.ts
 *
 * Monetización de CERO:
 *   · purchaseCoins        — admin: acredita Coins manualmente (bonos, refunds)
 *   · createCoinPayment    — usuario: inicia pago de Coins via Mercado Pago
 *   · activateVIP          — usuario: inicia pago del Pase VIP via Mercado Pago
 *   · mercadoPagoWebhook   — HTTP: recibe notificaciones de MP, verifica y procesa
 *   · grantMonthlyVIPCoins — Scheduler: día 1 de cada mes, acredita 500 CC a VIPs
 *
 * Variables de entorno esperadas (firebase functions:secrets:set):
 *   MERCADOPAGO_ACCESS_TOKEN  — Token de acceso (TEST-... en sandbox, APP_USR-... en prod)
 *   MERCADOPAGO_WEBHOOK_SECRET — Secret para verificar firma de webhooks
 *   APP_BASE_URL               — URL base del frontend (ej: https://cero.club)
 */

import { onCall, onRequest, HttpsError }  from 'firebase-functions/v2/https';
import { onSchedule }                     from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue }       from 'firebase-admin/firestore';
import type { Transaction }               from 'firebase-admin/firestore';
import * as crypto                        from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

const REGION = 'us-central1';
const MP_API = 'https://api.mercadopago.com';

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de productos (SOLO el servidor define precios y cantidades)
// ─────────────────────────────────────────────────────────────────────────────

export const COIN_PACKAGES = {
  pack_100:  { coins: 100,  bonusCoins: 0,   priceARS: 1490,  label: '100 Cero Coins'  },
  pack_500:  { coins: 500,  bonusCoins: 50,  priceARS: 5990,  label: '500 + 50 bonus'  },
  pack_1500: { coins: 1500, bonusCoins: 200, priceARS: 14990, label: '1500 + 200 bonus' },
  pack_4000: { coins: 4000, bonusCoins: 600, priceARS: 34990, label: '4000 + 600 bonus' },
} as const satisfies Record<string, { coins: number; bonusCoins: number; priceARS: number; label: string }>;

export const VIP_PLANS = {
  vip_monthly: { priceARS: 5990,  durationDays: 30,  label: 'Pase VIP Mensual', monthlyCoins: 500 },
  vip_annual:  { priceARS: 49990, durationDays: 365, label: 'Pase VIP Anual',   monthlyCoins: 500 },
} as const satisfies Record<string, { priceARS: number; durationDays: number; label: string; monthlyCoins: number }>;

type PackageId = keyof typeof COIN_PACKAGES;
type VIPPlanId = keyof typeof VIP_PLANS;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos Firestore
// ─────────────────────────────────────────────────────────────────────────────

interface PaymentIntent {
  uid:         string;
  type:        'coins' | 'vip';
  productId:   string;          // packageId o planId
  totalCoins:  number;          // para type='coins': coins + bonus
  status:      'pending' | 'approved' | 'failed' | 'refunded';
  mpPaymentId: string | null;
  mpPrefId:    string | null;
  createdAt:   FirebaseFirestore.FieldValue;
  processedAt: FirebaseFirestore.FieldValue | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

function mpToken(): string {
  const t = process.env['MERCADOPAGO_ACCESS_TOKEN'] ?? '';
  guard(t, 'failed-precondition', 'Pasarela de pago no configurada');
  return t;
}

function webhookSecret(): string {
  return process.env['MERCADOPAGO_WEBHOOK_SECRET'] ?? '';
}

function appBaseUrl(): string {
  return (process.env['APP_BASE_URL'] ?? 'https://cero.club').replace(/\/$/, '');
}

function isSandbox(): boolean {
  return (process.env['MERCADOPAGO_ACCESS_TOKEN'] ?? '').startsWith('TEST-');
}

async function mpPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${mpToken()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`MP ${res.status}: ${json['message'] ?? JSON.stringify(json)}`);
  return json as T;
}

async function mpGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    headers: { Authorization: `Bearer ${mpToken()}` },
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`MP ${res.status}: ${json['message'] ?? JSON.stringify(json)}`);
  return json as T;
}

/**
 * Verifica la firma HMAC-SHA256 del webhook de Mercado Pago.
 *
 * Formato de x-signature: ts=<epoch>,v1=<hmac>
 * Manifest: id:<dataId>;request-id:<requestId>;ts:<ts>;
 */
function verifyMPSignature(
  secret:    string,
  xSig:      string,
  requestId: string,
  dataId:    string,
): boolean {
  if (!secret) return true;   // sin secret configurado → entorno de prueba local

  const parts: Record<string, string> = {};
  xSig.split(',').forEach(p => {
    const [k, v] = p.trim().split('=') as [string, string];
    parts[k] = v ?? '';
  });

  const ts = parts['ts'] ?? '';
  const v1 = parts['v1'] ?? '';
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected  = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(v1.padEnd(expected.length, '0').slice(0, expected.length), 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Acredita coins a un usuario dentro de una transacción existente.
 * Si el documento de usuario no existe, lo crea con valores por defecto.
 */
async function _creditCoinsInTx(
  tx:     Transaction,
  db:     FirebaseFirestore.Firestore,
  uid:    string,
  amount: number,
): Promise<void> {
  const userRef  = db.doc(`users/${uid}`);
  const userSnap = await tx.get(userRef);

  if (userSnap.exists) {
    tx.update(userRef, { ceroCoins: FieldValue.increment(amount) });
  } else {
    tx.set(userRef, {
      ceroCoins:        amount,
      freeGamesPlayed:  0,
      totalGamesPlayed: 0,
      wins:             0,
    }, { merge: true });
  }
}

/**
 * Activa o renueva el Pase VIP de un usuario.
 */
async function _grantVIPAccess(
  db:     FirebaseFirestore.Firestore,
  uid:    string,
  planId: VIPPlanId,
): Promise<void> {
  const plan      = VIP_PLANS[planId];
  const userRef   = db.doc(`users/${uid}`);
  const userSnap  = await userRef.get();

  // Si ya tiene VIP activo, extender desde la fecha de expiración actual
  const currentExpiry =
    (userSnap.data()?.['vip'] as { active?: boolean; expiresAt?: FirebaseFirestore.Timestamp } | undefined)
      ?.expiresAt?.toMillis() ?? Date.now();
  const base      = Math.max(currentExpiry, Date.now());
  const expiresAt = new Date(base + plan.durationDays * 86_400_000);

  const now       = new Date();
  const monthKey  = now.getFullYear() * 100 + (now.getMonth() + 1);

  await userRef.set({
    vip: {
      active:            true,
      plan:              planId,
      startedAt:         userSnap.data()?.['vip']?.startedAt ?? new Date(),
      expiresAt,
      coinsGrantedMonth: 0,   // forzar entrega del mes en curso
    },
    // Coins del mes actual al activar
    ceroCoins: FieldValue.increment(plan.monthlyCoins),
    [`vipCoinsLog_${monthKey}`]: plan.monthlyCoins,
  }, { merge: true });
}

/**
 * Construye y crea una preferencia de pago en Mercado Pago.
 * Devuelve el URL de checkout (sandbox o producción).
 */
async function _createMPPreference(opts: {
  intentId:  string;
  title:     string;
  unitPrice: number;
  uid:       string;
  email:     string;
}): Promise<{ prefId: string; checkoutUrl: string }> {
  const base = appBaseUrl();
  const webhookUrl =
    `https://${REGION}-${process.env['GCLOUD_PROJECT']}.cloudfunctions.net/mercadoPagoWebhook`;

  const pref = await mpPost<{
    id: string;
    init_point: string;
    sandbox_init_point: string;
  }>('/checkout/preferences', {
    items: [{
      id:         opts.intentId,
      title:      opts.title,
      quantity:   1,
      unit_price: opts.unitPrice,
      currency_id: 'ARS',
    }],
    payer: { email: opts.email },
    external_reference: opts.intentId,
    back_urls: {
      success: `${base}/tienda/success?intent=${opts.intentId}`,
      failure: `${base}/tienda/failure?intent=${opts.intentId}`,
      pending: `${base}/tienda/pending?intent=${opts.intentId}`,
    },
    auto_return:      'approved',
    notification_url: webhookUrl,
    statement_descriptor: 'CERO CLUB',
  });

  return {
    prefId:      pref.id,
    checkoutUrl: isSandbox() ? pref.sandbox_init_point : pref.init_point,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// purchaseCoins — admin: acredita Coins manualmente
// ─────────────────────────────────────────────────────────────────────────────

interface PurchaseCoinsRequest {
  uid:     string;
  amount:  number;
  reason?: string;
}

/**
 * Acredita Coins a un usuario sin cobro (bonus, compensación, setup inicial).
 * Solo puede ser llamada por operadores registrados en /admins.
 */
export const purchaseCoins = onCall<PurchaseCoinsRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth!.uid;

    const db        = getFirestore();
    const adminSnap = await db.doc(`admins/${callerUid}`).get();
    guard(adminSnap.exists, 'permission-denied', 'Solo operadores pueden usar esta función');

    const { uid, amount, reason = 'admin_grant' } = request.data;
    guard(typeof uid === 'string' && uid,                          'invalid-argument', 'UID inválido');
    guard(typeof amount === 'number' && amount > 0 && amount <= 100_000, 'invalid-argument', 'Monto inválido (1-100000)');

    await db.runTransaction(async (tx) => {
      await _creditCoinsInTx(tx, db, uid, amount);
    });

    await db.collection('coin_ledger').add({
      uid, amount, reason,
      grantedBy:  callerUid,
      type:       'admin_grant',
      createdAt:  FieldValue.serverTimestamp(),
    });

    return { ok: true, uid, amount };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// createCoinPayment — inicia un pago de Coins via Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────

interface CreatePaymentRequest { packageId: string }
interface CreatePaymentResponse {
  intentId:    string;
  checkoutUrl: string;
  coins:       number;
  bonusCoins:  number;
  priceARS:    number;
}

export const createCoinPayment = onCall<CreatePaymentRequest, Promise<CreatePaymentResponse>>(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid      = request.auth!.uid;
    const email    = request.auth!.token.email ?? 'user@cero.club';
    const pkgId    = request.data.packageId as PackageId;

    guard(
      Object.prototype.hasOwnProperty.call(COIN_PACKAGES, pkgId),
      'invalid-argument',
      `Paquete inválido: "${pkgId}"`,
    );

    const pkg        = COIN_PACKAGES[pkgId];
    const totalCoins = pkg.coins + pkg.bonusCoins;
    const db         = getFirestore();

    // Crear intención de pago antes de contactar MP (idempotencia)
    const intentRef  = db.collection('payment_intents').doc();
    const intentDoc: PaymentIntent = {
      uid,
      type:        'coins',
      productId:   pkgId,
      totalCoins,
      status:      'pending',
      mpPaymentId: null,
      mpPrefId:    null,
      createdAt:   FieldValue.serverTimestamp(),
      processedAt: null,
    };
    await intentRef.set(intentDoc);

    // Crear preferencia en MP
    const { prefId, checkoutUrl } = await _createMPPreference({
      intentId:  intentRef.id,
      title:     pkg.label,
      unitPrice: pkg.priceARS,
      uid,
      email,
    });

    await intentRef.update({ mpPrefId: prefId });

    return {
      intentId:    intentRef.id,
      checkoutUrl,
      coins:       pkg.coins,
      bonusCoins:  pkg.bonusCoins,
      priceARS:    pkg.priceARS,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// activateVIP — inicia un pago del Pase VIP via Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────

interface ActivateVIPRequest  { planId: string }
interface ActivateVIPResponse { intentId: string; checkoutUrl: string; plan: string }

export const activateVIP = onCall<ActivateVIPRequest, Promise<ActivateVIPResponse>>(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid    = request.auth!.uid;
    const email  = request.auth!.token.email ?? 'user@cero.club';
    const planId = request.data.planId as VIPPlanId;

    guard(
      Object.prototype.hasOwnProperty.call(VIP_PLANS, planId),
      'invalid-argument',
      `Plan inválido: "${planId}"`,
    );

    const plan = VIP_PLANS[planId];
    const db   = getFirestore();

    const intentRef = db.collection('payment_intents').doc();
    const intentDoc: PaymentIntent = {
      uid,
      type:        'vip',
      productId:   planId,
      totalCoins:  0,
      status:      'pending',
      mpPaymentId: null,
      mpPrefId:    null,
      createdAt:   FieldValue.serverTimestamp(),
      processedAt: null,
    };
    await intentRef.set(intentDoc);

    const { prefId, checkoutUrl } = await _createMPPreference({
      intentId:  intentRef.id,
      title:     plan.label,
      unitPrice: plan.priceARS,
      uid,
      email,
    });

    await intentRef.update({ mpPrefId: prefId });

    return { intentId: intentRef.id, checkoutUrl, plan: planId };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// mercadoPagoWebhook — HTTP endpoint que recibe notificaciones de MP
// ─────────────────────────────────────────────────────────────────────────────

interface MPPayment {
  id:                 number;
  status:             string;           // 'approved' | 'pending' | 'rejected' | 'refunded'
  status_detail:      string;
  external_reference: string;           // intentId
  transaction_amount: number;
  payer:              { email?: string };
  date_approved:      string | null;
}

export const mercadoPagoWebhook = onRequest(
  { region: REGION, timeoutSeconds: 30 },
  async (req, res) => {
    // ── Solo aceptar POST ───────────────────────────────────────────────────
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    // ── Verificar firma MP (si hay secret configurado) ───────────────────
    const xSig       = String(req.headers['x-signature']  ?? '');
    const requestId  = String(req.headers['x-request-id'] ?? '');
    const dataId     = String((req.query as Record<string, string>)['data.id'] ?? '');

    if (webhookSecret() && !verifyMPSignature(webhookSecret(), xSig, requestId, dataId)) {
      console.warn('[MPWebhook] Firma inválida', { xSig, requestId, dataId });
      res.status(401).send('Unauthorized');
      return;
    }

    const body = req.body as { type?: string; data?: { id?: unknown } };

    // ── Solo procesar eventos de tipo 'payment' ──────────────────────────
    if (body?.type !== 'payment') {
      res.status(200).send('ok');
      return;
    }

    const paymentIdRaw = dataId || String(body?.data?.id ?? '');
    if (!paymentIdRaw || paymentIdRaw === 'undefined') {
      res.status(200).send('ok');
      return;
    }

    try {
      // ── Consultar estado del pago en MP ──────────────────────────────────
      const payment = await mpGet<MPPayment>(`/v1/payments/${paymentIdRaw}`);

      if (payment.status !== 'approved') {
        const db         = getFirestore();
        const intentRef  = db.doc(`payment_intents/${payment.external_reference}`);
        if (payment.status === 'rejected' || payment.status === 'cancelled') {
          await intentRef.update({ status: 'failed', mpPaymentId: String(payment.id) });
        }
        res.status(200).send('ok');
        return;
      }

      const db        = getFirestore();
      const intentId  = payment.external_reference;
      const intentRef = db.doc(`payment_intents/${intentId}`);

      await db.runTransaction(async (tx) => {
        const intentSnap = await tx.get(intentRef);
        if (!intentSnap.exists) throw new Error(`Intent ${intentId} no encontrado`);

        const intent = intentSnap.data() as PaymentIntent;

        // Idempotencia: si ya fue procesado, ignorar
        if (intent.status !== 'pending') return;

        tx.update(intentRef, {
          status:      'approved',
          mpPaymentId: String(payment.id),
          processedAt: FieldValue.serverTimestamp(),
        });

        if (intent.type === 'coins') {
          await _creditCoinsInTx(tx, db, intent.uid, intent.totalCoins);
        }
        // VIP se activa fuera de la transacción (no usa tx.get en _grantVIPAccess)
      });

      // VIP activation fuera de la transacción para mayor simplicidad
      const intentSnap = await intentRef.get();
      const intent     = intentSnap.data() as PaymentIntent;
      if (intent.type === 'vip' && intent.status === 'approved') {
        await _grantVIPAccess(db, intent.uid, intent.productId as VIPPlanId);
      }

      // Registrar en ledger
      await db.collection('coin_ledger').add({
        uid:           intent.uid,
        amount:        intent.type === 'coins' ? intent.totalCoins : 0,
        type:          intent.type === 'vip' ? 'vip_activation' : 'coin_purchase',
        intentId,
        mpPaymentId:   String(payment.id),
        createdAt:     FieldValue.serverTimestamp(),
      });

    } catch (err) {
      console.error('[MPWebhook] Error procesando pago:', (err as Error).message);
      // Responder 200 para que MP no reintente indefinidamente en errores de negocio
      res.status(200).send('ok');
      return;
    }

    res.status(200).send('ok');
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// grantMonthlyVIPCoins — Scheduler: 1.° de cada mes a las 00:00 UTC
// ─────────────────────────────────────────────────────────────────────────────

export const grantMonthlyVIPCoins = onSchedule(
  { schedule: '0 0 1 * *', region: REGION, timeoutSeconds: 540 },
  async () => {
    const db       = getFirestore();
    const now      = new Date();
    const monthKey = now.getFullYear() * 100 + (now.getMonth() + 1);

    const snapshot = await db.collection('users')
      .where('vip.active', '==', true)
      .get();

    const eligible = snapshot.docs.filter(d => {
      const vip = d.data()['vip'] as { active?: boolean; expiresAt?: FirebaseFirestore.Timestamp; coinsGrantedMonth?: number } | undefined;
      if (!vip?.active)                                        return false;
      if ((vip.expiresAt?.toMillis() ?? 0) < Date.now())     return false;
      if (vip.coinsGrantedMonth === monthKey)                  return false;  // ya recibió
      return true;
    });

    console.info(`[grantMonthlyVIPCoins] ${eligible.length} VIPs elegibles para ${monthKey}`);

    // Lotes de 450 (límite Firestore batch = 500)
    const BATCH_SIZE = 450;
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const docSnap of eligible.slice(i, i + BATCH_SIZE)) {
        batch.update(docSnap.ref, {
          ceroCoins:               FieldValue.increment(500),
          'vip.coinsGrantedMonth': monthKey,
        });
      }
      await batch.commit();
    }

    console.info('[grantMonthlyVIPCoins] completado');
  },
);
