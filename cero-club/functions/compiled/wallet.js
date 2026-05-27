"use strict";
/**
 * functions/src/wallet.ts
 *
 * Billetera Cero Coins:
 *   · transferCeroCoins   — transferencias P2P con límites anti-spam
 *   · getWalletHistory    — historial de movimientos (coin_ledger)
 *   · applyReferralCode   — bonus por referido (nuevos usuarios)
 *   · placeMatchBet       — apuesta de espectador (escrow server-side)
 *   · settleMatchBets     — liquidación al terminar partida (parimutuel)
 *   · joinAsSpectator     — registrar presencia de espectador
 *   · getMatchBettingInfo — estado de apuestas para UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TRANSFER = exports.MIN_TRANSFER = exports.MAX_BET = exports.MIN_BET = exports.BETTING_WINDOW_MS = exports.joinAsSpectator = exports.getMatchBettingInfo = exports.placeMatchBet = exports.applyReferralCode = exports.getWalletHistory = exports.transferCeroCoins = void 0;
exports.settleMatchBets = settleMatchBets;
exports.bettingOpenUntilTimestamp = bettingOpenUntilTimestamp;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const REGION = 'us-central1';
const MIN_TRANSFER = 10;
exports.MIN_TRANSFER = MIN_TRANSFER;
const MAX_TRANSFER = 5000;
exports.MAX_TRANSFER = MAX_TRANSFER;
const DAILY_TRANSFER_CAP = 10000;
const MIN_BET = 5;
exports.MIN_BET = MIN_BET;
const MAX_BET = 500;
exports.MAX_BET = MAX_BET;
const BETTING_WINDOW_MS = 3 * 60 * 1000; // 3 min desde inicio de partida
exports.BETTING_WINDOW_MS = BETTING_WINDOW_MS;
const REFERRAL_BONUS = 50;
const REFERRAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
async function ledgerEntry(db, entry) {
    await db.collection('coin_ledger').add({
        ...entry,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
exports.transferCeroCoins = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const fromUid = request.auth.uid;
    const { toUid, amount, note } = request.data;
    guard(typeof toUid === 'string' && toUid && toUid !== fromUid, 'invalid-argument', 'Destinatario inválido');
    guard(typeof amount === 'number' && Number.isInteger(amount)
        && amount >= MIN_TRANSFER && amount <= MAX_TRANSFER, 'invalid-argument', `Monto inválido (${MIN_TRANSFER}–${MAX_TRANSFER} CN)`);
    const db = (0, firestore_1.getFirestore)();
    const dayKey = todayKey();
    const transferLogRef = db.doc(`users/${fromUid}/transfer_daily/${dayKey}`);
    let newBalance = 0;
    await db.runTransaction(async (tx) => {
        const [fromSnap, toSnap, daySnap] = await Promise.all([
            tx.get(db.doc(`users/${fromUid}`)),
            tx.get(db.doc(`users/${toUid}`)),
            tx.get(transferLogRef),
        ]);
        guard(fromSnap.exists, 'not-found', 'Tu perfil no existe');
        guard(toSnap.exists, 'not-found', 'El destinatario no tiene perfil en Cero Club');
        const fromBalance = fromSnap.data()?.['ceroCoins'] ?? 0;
        guard(fromBalance >= amount, 'resource-exhausted', `Saldo insuficiente. Tenés ${fromBalance} CN.`);
        const sentToday = daySnap.data()?.['sent'] ?? 0;
        guard(sentToday + amount <= DAILY_TRANSFER_CAP, 'resource-exhausted', `Límite diario de transferencias (${DAILY_TRANSFER_CAP} CN). Enviaste ${sentToday} CN hoy.`);
        newBalance = fromBalance - amount;
        const toBalance = toSnap.data()?.['ceroCoins'] ?? 0;
        tx.update(db.doc(`users/${fromUid}`), { ceroCoins: firestore_1.FieldValue.increment(-amount) });
        tx.update(db.doc(`users/${toUid}`), { ceroCoins: firestore_1.FieldValue.increment(amount) });
        tx.set(transferLogRef, {
            sent: sentToday + amount,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(db.collection('transfers').doc(), {
            fromUid,
            toUid,
            amount,
            note: typeof note === 'string' ? note.slice(0, 120) : null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    await ledgerEntry(db, {
        uid: fromUid, amount: -amount, type: 'transfer_out', toUid,
        note: note?.slice(0, 120) ?? null,
    });
    await ledgerEntry(db, {
        uid: toUid, amount, type: 'transfer_in', fromUid,
        note: note?.slice(0, 120) ?? null,
    });
    return { ok: true, newBalance, toUid, amount };
});
exports.getWalletHistory = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const uid = request.auth.uid;
    const limit = Math.min(Math.max(request.data?.limit ?? 30, 1), 100);
    const db = (0, firestore_1.getFirestore)();
    const snap = await db.collection('coin_ledger')
        .where('uid', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    const entries = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            amount: data['amount'] ?? 0,
            type: data['type'] ?? 'unknown',
            createdAt: data['createdAt']?.toMillis() ?? null,
            meta: {
                toUid: data['toUid'] ?? null,
                fromUid: data['fromUid'] ?? null,
                matchId: data['matchId'] ?? null,
                reason: data['reason'] ?? null,
            },
        };
    });
    return { ok: true, entries };
});
exports.applyReferralCode = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const uid = request.auth.uid;
    const code = String(request.data?.code ?? '').trim().toUpperCase();
    guard(code.length >= 4 && code.length <= 12, 'invalid-argument', 'Código inválido');
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    const referrerSnap = await db.collection('users')
        .where('referralCode', '==', code)
        .limit(1)
        .get();
    guard(!referrerSnap.empty, 'not-found', 'Código de referido no encontrado');
    const referrerUid = referrerSnap.docs[0].id;
    guard(referrerUid !== uid, 'invalid-argument', 'No podés usar tu propio código');
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        guard(userSnap.exists, 'not-found', 'Perfil no encontrado');
        const data = userSnap.data();
        guard(!data['referredBy'], 'already-exists', 'Ya usaste un código de referido');
        guard(!data['referralBonusClaimed'], 'already-exists', 'Ya recibiste el bonus de referido');
        const createdAt = data['createdAt']?.toMillis() ?? Date.now();
        guard(Date.now() - createdAt <= REFERRAL_MAX_AGE_MS, 'failed-precondition', 'El código de referido solo aplica en los primeros 7 días de tu cuenta');
        tx.update(userRef, {
            referredBy: referrerUid,
            referralBonusClaimed: true,
            ceroCoins: firestore_1.FieldValue.increment(REFERRAL_BONUS),
        });
        tx.update(db.doc(`users/${referrerUid}`), {
            ceroCoins: firestore_1.FieldValue.increment(REFERRAL_BONUS),
            referralCount: firestore_1.FieldValue.increment(1),
        });
    });
    await ledgerEntry(db, { uid, amount: REFERRAL_BONUS, type: 'referral_bonus', referrerUid });
    await ledgerEntry(db, { uid: referrerUid, amount: REFERRAL_BONUS, type: 'referral_reward', referredUid: uid });
    return { ok: true, coinsAwarded: REFERRAL_BONUS, referrerUid };
});
exports.placeMatchBet = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const uid = request.auth.uid;
    const matchId = String(request.data?.matchId ?? '');
    const predictedWinnerUid = String(request.data?.predictedWinnerUid ?? '');
    const amount = Number(request.data?.amount);
    guard(matchId, 'invalid-argument', 'Falta matchId');
    guard(predictedWinnerUid, 'invalid-argument', 'Elegí quién va a ganar');
    guard(Number.isInteger(amount) && amount >= MIN_BET && amount <= MAX_BET, 'invalid-argument', `Apuesta inválida (${MIN_BET}–${MAX_BET} CN)`);
    const db = (0, firestore_1.getFirestore)();
    const matchRef = db.doc(`matches/${matchId}`);
    const betRef = db.doc(`matches/${matchId}/bets/${uid}`);
    let newBalance = 0;
    await db.runTransaction(async (tx) => {
        const [matchSnap, betSnap, userSnap] = await Promise.all([
            tx.get(matchRef),
            tx.get(betRef),
            tx.get(db.doc(`users/${uid}`)),
        ]);
        guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
        guard(!betSnap.exists, 'already-exists', 'Ya apostaste en esta partida');
        guard(userSnap.exists, 'not-found', 'Perfil no encontrado');
        const match = matchSnap.data();
        const playerIds = match['playerIds'] ?? [];
        guard(match['status'] === 'playing', 'failed-precondition', 'Solo podés apostar en partidas en curso');
        guard(!playerIds.includes(uid), 'permission-denied', 'Los jugadores de la partida no pueden apostar');
        guard(playerIds.includes(predictedWinnerUid), 'invalid-argument', 'Elegí a uno de los jugadores de la partida');
        const openUntil = match['bettingOpenUntil']?.toMillis() ?? 0;
        guard(Date.now() <= openUntil, 'failed-precondition', 'El período de apuestas cerró (primeros 3 minutos de la partida)');
        const balance = userSnap.data()?.['ceroCoins'] ?? 0;
        guard(balance >= amount, 'resource-exhausted', `Saldo insuficiente. Tenés ${balance} CN.`);
        newBalance = balance - amount;
        tx.update(db.doc(`users/${uid}`), { ceroCoins: firestore_1.FieldValue.increment(-amount) });
        tx.set(betRef, {
            uid,
            matchId,
            predictedWinnerUid,
            amount,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(matchRef, {
            betPoolTotal: firestore_1.FieldValue.increment(amount),
            betCount: firestore_1.FieldValue.increment(1),
        });
    });
    await ledgerEntry(db, {
        uid, amount: -amount, type: 'match_bet', matchId, predictedWinnerUid,
    });
    return { ok: true, newBalance, matchId, amount, predictedWinnerUid };
});
exports.getMatchBettingInfo = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const uid = request.auth.uid;
    const matchId = String(request.data?.matchId ?? '');
    guard(matchId, 'invalid-argument', 'Falta matchId');
    const db = (0, firestore_1.getFirestore)();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
    const match = matchSnap.data();
    const playerIds = match['playerIds'] ?? [];
    const [myBetSnap, allBetsSnap] = await Promise.all([
        db.doc(`matches/${matchId}/bets/${uid}`).get(),
        db.collection(`matches/${matchId}/bets`).get(),
    ]);
    const pools = {};
    for (const pid of playerIds)
        pools[pid] = 0;
    for (const doc of allBetsSnap.docs) {
        const d = doc.data();
        const pick = d['predictedWinnerUid'];
        if (pools[pick] !== undefined) {
            pools[pick] += d['amount'] ?? 0;
        }
    }
    const openUntil = match['bettingOpenUntil']?.toMillis() ?? 0;
    const canBet = match['status'] === 'playing'
        && !playerIds.includes(uid)
        && Date.now() <= openUntil
        && !myBetSnap.exists;
    return {
        ok: true,
        matchId,
        status: match['status'],
        players: match['players'] ?? [],
        betPoolTotal: match['betPoolTotal'] ?? 0,
        betCount: match['betCount'] ?? 0,
        pools,
        bettingOpenUntil: openUntil,
        canBet,
        myBet: myBetSnap.exists ? {
            predictedWinnerUid: myBetSnap.data()?.['predictedWinnerUid'],
            amount: myBetSnap.data()?.['amount'],
            status: myBetSnap.data()?.['status'],
            payout: myBetSnap.data()?.['payout'] ?? null,
        } : null,
    };
});
/**
 * Liquida apuestas al terminar una partida (parimutuel, suma cero entre apostadores).
 * Llamado desde game.ts — nunca desde el cliente.
 */
async function settleMatchBets(db, matchId, winnerUid) {
    const betsSnap = await db.collection(`matches/${matchId}/bets`)
        .where('status', '==', 'pending')
        .get();
    if (betsSnap.empty)
        return;
    const totalPool = betsSnap.docs.reduce((s, d) => s + (d.data()['amount'] ?? 0), 0);
    const winnerBets = betsSnap.docs.filter(d => d.data()['predictedWinnerUid'] === winnerUid);
    const winnerPool = winnerBets.reduce((s, d) => s + (d.data()['amount'] ?? 0), 0);
    const batch = db.batch();
    for (const doc of betsSnap.docs) {
        const data = doc.data();
        const amount = data['amount'] ?? 0;
        const betUid = data['uid'];
        const won = data['predictedWinnerUid'] === winnerUid;
        if (won && winnerPool > 0) {
            const payout = Math.floor((amount / winnerPool) * totalPool);
            batch.update(doc.ref, { status: 'won', payout, settledAt: firestore_1.FieldValue.serverTimestamp() });
            batch.update(db.doc(`users/${betUid}`), { ceroCoins: firestore_1.FieldValue.increment(payout) });
        }
        else {
            batch.update(doc.ref, { status: 'lost', payout: 0, settledAt: firestore_1.FieldValue.serverTimestamp() });
        }
    }
    await batch.commit();
    for (const doc of betsSnap.docs) {
        const data = doc.data();
        const amount = data['amount'] ?? 0;
        const betUid = data['uid'];
        const won = data['predictedWinnerUid'] === winnerUid;
        if (won && winnerPool > 0) {
            const payout = Math.floor((amount / winnerPool) * totalPool);
            await ledgerEntry(db, {
                uid: betUid, amount: payout, type: 'match_bet_won', matchId, winnerUid,
                staked: amount,
            });
        }
        else {
            await ledgerEntry(db, {
                uid: betUid, amount: -amount, type: 'match_bet_lost', matchId, winnerUid,
            });
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// joinAsSpectator — presencia + validación
// ─────────────────────────────────────────────────────────────────────────────
exports.joinAsSpectator = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const uid = request.auth.uid;
    const matchId = String(request.data?.matchId ?? '');
    guard(matchId, 'invalid-argument', 'Falta matchId');
    const db = (0, firestore_1.getFirestore)();
    const matchRef = db.doc(`matches/${matchId}`);
    const matchSnap = await matchRef.get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
    const match = matchSnap.data();
    const status = match['status'];
    guard(status === 'playing' || status === 'waiting', 'failed-precondition', 'Esta partida ya terminó');
    const playerIds = match['playerIds'] ?? [];
    guard(!playerIds.includes(uid), 'permission-denied', 'Ya estás jugando esta partida — entrá como jugador');
    const name = request.auth.token.name ?? 'Espectador';
    const specRef = db.doc(`matches/${matchId}/spectators/${uid}`);
    const specSnap = await specRef.get();
    await specRef.set({
        uid,
        displayName: name,
        joinedAt: specSnap.exists ? specSnap.data()?.['joinedAt'] : firestore_1.FieldValue.serverTimestamp(),
        lastSeen: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (!specSnap.exists) {
        await matchRef.update({ spectatorCount: firestore_1.FieldValue.increment(1) });
    }
    return {
        ok: true,
        matchId,
        publicState: {
            status: match['status'],
            phase: match['phase'],
            players: match['players'],
            handCounts: match['handCounts'],
            topDiscard: match['topDiscard'],
            current: match['current'],
            direction: match['direction'],
            drawStack: match['drawStack'],
            chosenColor: match['chosenColor'],
            winner: match['winner'],
            stakeCC: match['stakeCC'],
        },
    };
});
/** Timestamp de cierre de apuestas — llamado desde startMatch en game.ts */
function bettingOpenUntilTimestamp() {
    return firestore_1.Timestamp.fromMillis(Date.now() + BETTING_WINDOW_MS);
}
//# sourceMappingURL=wallet.js.map