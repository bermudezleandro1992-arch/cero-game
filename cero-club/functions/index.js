'use strict';

const crypto = require('crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const vision = require('@google-cloud/vision').v1;

initializeApp();

// ── Módulo 2: Motor de partidas (TypeScript compilado) ────────────────────────
// Fuente: src/game.ts  →  npm run build  →  compiled/game.js
// Compilar antes de desplegar: npm run build (en functions/)
// ── Módulo: partidas ──────────────────────────────────────────────────────────
const gameModule = require('./compiled/game');
exports.joinMatch    = gameModule.joinMatch;
exports.playTurn     = gameModule.playTurn;
exports.leaveMatch   = gameModule.leaveMatch;
exports.forfeitMatch = gameModule.forfeitMatch;
exports.endMatch     = gameModule.endMatch;
exports.temporaryLeaveMatch = gameModule.temporaryLeaveMatch;
exports.getRejoinStatus     = gameModule.getRejoinStatus;

// ── Módulo: monetización + Mercado Pago ──────────────────────────────────────
const monetModule = require('./compiled/monetization');
exports.purchaseCoins       = monetModule.purchaseCoins;
exports.createCoinPayment   = monetModule.createCoinPayment;
exports.getPaymentCatalog   = monetModule.getPaymentCatalog;
exports.activateVIP         = monetModule.activateVIP;
exports.mercadoPagoWebhook  = monetModule.mercadoPagoWebhook;
exports.grantMonthlyVIPCoins = monetModule.grantMonthlyVIPCoins;

// ── Módulo: torneos ───────────────────────────────────────────────────────────
const tournModule = require('./compiled/tournaments');
exports.registerTournament            = tournModule.registerTournament;
exports.cancelTournamentRegistration  = tournModule.cancelTournamentRegistration;
exports.getWeeklyTournament           = tournModule.getWeeklyTournament;
exports.adminSeedWeeklyTournament     = tournModule.adminSeedWeeklyTournament;
exports.seedWeeklyTournament          = tournModule.seedWeeklyTournament;

// ── Módulo: admin panel ───────────────────────────────────────────────────────
const adminModule = require('./compiled/admin');
exports.adminGetUser          = adminModule.adminGetUser;
exports.adminSetCeroCoins     = adminModule.adminSetCeroCoins;
exports.adminUpdateUser       = adminModule.adminUpdateUser;
exports.adminListTournaments  = adminModule.adminListTournaments;

// ── Módulo: misiones ──────────────────────────────────────────────────────────
const missModule = require('./compiled/missions');
exports.claimMissionReward  = missModule.claimMissionReward;
exports.checkMissions       = missModule.checkMissions;       // callable post-partida
exports.onMatchFinished     = missModule.onMatchFinished;
exports.resetDailyMissions  = missModule.resetDailyMissions;
exports.resetWeeklyMissions = missModule.resetWeeklyMissions;
exports.seedMissions        = missModule.seedMissions;

// ── Módulo: engagement (onboarding, daily bonus, ranking, cosméticos) ─────────
const engModule = require('./compiled/engagement');
exports.initUserProfile    = engModule.initUserProfile;
exports.claimDailyBonus    = engModule.claimDailyBonus;
exports.claimDailyReward   = engModule.claimDailyReward;     // alias del nombre pedido
exports.updateRanking      = engModule.updateRanking;         // snapshot manual del ranking
exports.resetWeeklyRanking = engModule.resetWeeklyRanking;
exports.purchaseCosmetic   = engModule.purchaseCosmetic;
exports.equipCosmetic      = engModule.equipCosmetic;

// ── Módulo: billetera (P2P, referidos, apuestas, espectadores) ────────────────
const walletModule = require('./compiled/wallet');
exports.transferCeroCoins   = walletModule.transferCeroCoins;
exports.getWalletHistory    = walletModule.getWalletHistory;
exports.applyReferralCode   = walletModule.applyReferralCode;
exports.placeMatchBet       = walletModule.placeMatchBet;
exports.getMatchBettingInfo = walletModule.getMatchBettingInfo;
exports.joinAsSpectator     = walletModule.joinAsSpectator;

let _visionClient = null;
function getVisionClient() {
  if (!_visionClient) {
    _visionClient = new vision.ImageAnnotatorClient();
  }
  return _visionClient;
}

const BLOCK_LEVELS = new Set(['LIKELY', 'VERY_LIKELY']);

function isUnsafeAnnotation(safe) {
  if (!safe) return true;
  return ['adult', 'violence', 'racy', 'medical'].some(
    (k) => BLOCK_LEVELS.has(safe[k])
  );
}

/**
 * Moderación de avatar sin Firebase Storage.
 * El cliente envía JPEG en base64; Vision API revisa; se guarda data-URL en Firestore.
 */
exports.moderateAvatar = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión');
    }

    const uid = request.auth.uid;
    const b64 = String(request.data?.imageBase64 || '').replace(/^data:image\/\w+;base64,/, '');
    if (!b64 || b64.length < 100) {
      throw new HttpsError('invalid-argument', 'Imagen inválida');
    }
    if (b64.length > 900_000) {
      throw new HttpsError('invalid-argument', 'Imagen demasiado grande');
    }

    const buffer = Buffer.from(b64, 'base64');
    const db = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    try {
      const [result] = await getVisionClient().safeSearchDetection({
        image: { content: buffer },
      });
      const safe = result.safeSearchAnnotation;

      if (isUnsafeAnnotation(safe)) {
        await userRef.set(
          {
            avatarStatus: 'rejected',
            avatarRejectReason: 'La imagen no cumple las normas de la comunidad.',
            avatarReviewedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { ok: false, status: 'rejected' };
      }

      const photoURL = `data:image/jpeg;base64,${b64}`;
      await userRef.set(
        {
          photoURL,
          avatarStatus: 'approved',
          avatarRejectReason: FieldValue.delete(),
          avatarReviewedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { ok: true, status: 'approved', photoURL };
    } catch (err) {
      console.error('[moderateAvatar]', uid, err.message);
      await userRef.set(
        {
          avatarStatus: 'pending',
          avatarRejectReason: 'Revisión automática no disponible. Probá más tarde.',
        },
        { merge: true }
      );
      throw new HttpsError('internal', 'No se pudo revisar la foto. Intentá de nuevo.');
    }
  }
);

/**
 * Registra sesión de dispositivo/IP para centro de mando (admin).
 */
exports.recordSecuritySession = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Iniciá sesión');
    }
    const uid = request.auth.uid;
    const d = request.data || {};
    const ip =
      request.rawRequest?.ip ||
      (request.rawRequest?.headers && request.rawRequest.headers['x-forwarded-for']) ||
      'desconocida';
    const db = getFirestore();
    const sessionRef = db.collection('users').doc(uid).collection('security_sessions').doc();

    await sessionRef.set({
      uid,
      ip: String(ip).slice(0, 80),
      userAgent: String(d.userAgent || '').slice(0, 500),
      platform: String(d.platform || 'unknown').slice(0, 40),
      os: String(d.os || 'unknown').slice(0, 60),
      deviceType: String(d.deviceType || 'unknown').slice(0, 30),
      screen: String(d.screen || '').slice(0, 30),
      language: String(d.language || '').slice(0, 20),
      isMobile: !!d.isMobile,
      hardwareConcurrency: Number(d.hardwareConcurrency) || 0,
      deviceMemory: Number(d.deviceMemory) || 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection('users').doc(uid).set(
      {
        lastSessionIp: String(ip).slice(0, 80),
        lastSessionAt: FieldValue.serverTimestamp(),
        lastPlatform: String(d.platform || 'unknown').slice(0, 40),
        lastOs: String(d.os || 'unknown').slice(0, 60),
        lastDeviceType: String(d.deviceType || 'unknown').slice(0, 30),
        lastUserAgent: String(d.userAgent || '').slice(0, 300),
      },
      { merge: true }
    );

    return { ok: true, sessionId: sessionRef.id };
  }
);

const BOOTSTRAP_OPERATOR_UIDS = [
  { uid: 'OHeLWGg5mkULPvhIS0Z5xI2CNwI3', email: 'bermudezleandro1992@gmail.com' },
  { uid: 'wSEUZWVUsRTfh5rx0FcjqnGacL53', email: 'javim4n92@gmail.com' },
  { uid: 'WW1bex8JNwe6IABzsfNpCrIuctO2', email: 'somoslfasoporte@gmail.com' },
];

/**
 * Setup único: crea admins/{uid} y rellena wallet_queue para pedidos viejos.
 * POST con header x-setup-key (ver docs/ADMIN_SETUP.md).
 */
exports.ceroClubSetup = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 },
  async (req, res) => {
    const key = String(req.get('x-setup-key') || '');
    const expected = process.env.CERO_SETUP_KEY || 'cero-club-setup-2026';
    if (key !== expected) {
      res.status(403).send('Forbidden');
      return;
    }

    const db = getFirestore();
    const results = { admins: [], walletQueue: { created: 0, skipped: 0, error: null } };

    for (const op of BOOTSTRAP_OPERATOR_UIDS) {
      await db.collection('admins').doc(op.uid).set(
        {
          role: 'operator',
          email: op.email,
          grantedAt: FieldValue.serverTimestamp(),
          grantedBy: 'ceroClubSetup',
        },
        { merge: true }
      );
      results.admins.push(op.uid);
    }

    try {
      const pending = await db
        .collectionGroup('coin_requests')
        .where('status', '==', 'pending')
        .get();

      for (const docSnap of pending.docs) {
        const data = docSnap.data();
        const uid = docSnap.ref.parent.parent?.id;
        if (!uid) continue;

        const requestId = docSnap.id;
        const dup = await db
          .collection('wallet_queue')
          .where('requestId', '==', requestId)
          .where('uid', '==', uid)
          .limit(1)
          .get();

        if (!dup.empty) {
          results.walletQueue.skipped += 1;
          continue;
        }

        await db.collection('wallet_queue').add({
          uid,
          requestId,
          type: data.type || 'purchase',
          amount: data.amount || 0,
          status: 'pending',
          receiptURL: data.receiptURL || null,
          payoutAlias: data.payoutAlias || null,
          createdAt: data.createdAt || FieldValue.serverTimestamp(),
          backfilled: true,
        });
        results.walletQueue.created += 1;
      }
    } catch (err) {
      results.walletQueue.error = err.message;
      console.warn('[ceroClubSetup] wallet backfill:', err.message);
    }

    res.json({ ok: true, ...results });
  }
);

/**
 * El operador con email autorizado puede activar su propio admin (sin Console).
 */
exports.claimOperatorRole = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Iniciá sesión primero');
    }
    const email = String(request.auth.token.email || '').toLowerCase();
    const allowed = BOOTSTRAP_OPERATOR_UIDS.map((o) => o.email.toLowerCase());
    if (!allowed.includes(email)) {
      throw new HttpsError('permission-denied', 'Email no autorizado para operador');
    }

    const db = getFirestore();
    await db.collection('admins').doc(request.auth.uid).set(
      {
        role: 'operator',
        email: request.auth.token.email || '',
        displayName: request.auth.token.name || '',
        grantedAt: FieldValue.serverTimestamp(),
        grantedBy: 'claimOperatorRole',
      },
      { merge: true }
    );
    return { ok: true, uid: request.auth.uid };
  }
);
