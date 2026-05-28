"use strict";
/**
 * CERO �?? Módulo 2: Backend (TypeScript / Cloud Functions v2)
 *
 * Garantías de seguridad:
 *   · El cliente NUNCA puede escribir en `matches/` ni en `private/server`.
 *   · Los balances de ceroCoins solo los modifica el Admin SDK dentro de una
 *     transacción Firestore �?? imposible de manipular desde el navegador.
 *   · El mazo y las manos ajenas jamás se exponen al cliente.
 *   · El número de turno (`turn`) actúa como llave de idempotencia:
 *     requests duplicados o retrasados son rechazados sin efecto.
 *
 * Colecciones Firestore:
 *
 *   users/{uid}
 *     email: string
 *     displayName: string
 *     ceroCoins: number          �?� balance; solo escribe el servidor
 *     freeGamesPlayed: number    �?� partidas gratis usadas
 *     totalGamesPlayed: number
 *     wins: number
 *     createdAt: Timestamp
 *
 *   matches/{matchId}
 *     status: 'waiting' | 'playing' | 'finished'
 *     mode: 'classic' | 'cero'
 *     players: PlayerInfo[]
 *     playerIds: string[]
 *     playerCount: number
 *     maxPlayers: number
 *     stakeCC: number            �?� coins apostadas por partida
 *     turn: number               �?� se incrementa en cada acción (idempotencia)
 *     phase / current / direction / drawStack / chosenColor / topDiscard /
 *     handCounts / winner / pendingTurn  �?� estado público (cliente escucha con onSnapshot)
 *     lastAction: LastAction | null
 *     createdAt / startedAt / finishedAt: Timestamp
 *
 *   matches/{matchId}/private/server   �?� NADIE puede leer (solo Admin SDK)
 *     deck: Card[]
 *     discardPile: Card[]
 *     hands: Card[][]             �?� indexado por playerIdx
 *     ceroCalled: number[]
 *
 *   matches/{matchId}/hands/{uid}      �?� solo el dueño puede leer
 *     cards: Card[]
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
exports.getReplay = exports.endMatch = exports.forfeitMatch = exports.getRejoinStatus = exports.expireStaleWaitingMatches = exports.expireRejoinMatches = exports.checkMatchRejoinExpiry = exports.temporaryLeaveMatch = exports.leaveMatch = exports.playTurn = exports.joinMatch = exports.cleanupMyRooms = exports.ensureMatchStarted = void 0;
exports.isStuckMatch = isStuckMatch;
exports.forceCloseMatch = forceCloseMatch;
exports.closeWaitingRoom = closeWaitingRoom;
exports.startMatch = startMatch;
exports.cleanupOrphanRoomsForUser = cleanupOrphanRoomsForUser;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const CeroEngine_1 = require("./CeroEngine");
const missions_1 = require("./missions");
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// Configuración del negocio
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
const CFG = {
    FREE_GAMES_LIMIT: 2, // partidas gratis para nuevos usuarios
    ENTRY_COST_CC: 50, // Cero Coins por partida paga
    HAND_SIZE: 7,
    TURN_SECONDS: 18,
    MAX_PLAYERS: 2, // default 1v1
    REGION: 'us-central1',
    REJOIN_MS: 5 * 60 * 1000, // 5 minutos para reingresar
    WAITING_ROOM_MS: 4 * 60 * 1000, // cerrar salas waiting colgadas (~4 min)
};
function parseFormat(format) {
    return format === '2v2' ? '2v2' : '1v1';
}
function maxPlayersForFormat(format) {
    return format === '2v2' ? 4 : CFG.MAX_PLAYERS;
}
function matchMaxPlayers(match) {
    return match.maxPlayers ?? CFG.MAX_PLAYERS;
}
function resolveTeamOutcome(match, winnerUid) {
    const ids = uniquePlayerIds(match.playerIds);
    const format = match.format ?? '1v1';
    if (format !== '2v2' || ids.length < 4) {
        return {
            winnerUids: [winnerUid],
            loserUids: ids.filter(id => id !== winnerUid),
        };
    }
    const winIdx = ids.indexOf(winnerUid);
    const partnerIdx = winIdx >= 0 ? (winIdx + 2) % 4 : -1;
    const partnerUid = partnerIdx >= 0 ? ids[partnerIdx] : undefined;
    const winnerUids = partnerUid ? [winnerUid, partnerUid] : [winnerUid];
    return {
        winnerUids,
        loserUids: ids.filter(id => !winnerUids.includes(id)),
    };
}
function primaryWinnerForForfeit(match, forfeiterUid) {
    const ids = uniquePlayerIds(match.playerIds);
    const format = match.format ?? '1v1';
    if (format !== '2v2' || ids.length < 4) {
        return ids.find(id => id !== forfeiterUid) ?? '';
    }
    const idx = ids.indexOf(forfeiterUid);
    const team = idx >= 0 ? idx % 2 : 0;
    return ids[team === 0 ? 1 : 0] ?? ids.find(id => id !== forfeiterUid) ?? '';
}
function uniquePlayerIds(ids) {
    return [...new Set((ids || []).filter(Boolean))];
}
function canRejoinMatch(match, uid) {
    if (!match.playerIds.includes(uid))
        return false;
    const abs = match.absences?.[uid];
    if (!abs?.rejoinUntil)
        return match.status === 'waiting';
    return abs.rejoinUntil.toMillis() > Date.now();
}
async function clearPlayerAbsence(db, matchRef, uid) {
    await matchRef.update({
        [`absences.${uid}`]: firestore_1.FieldValue.delete(),
        rejoinBanner: firestore_1.FieldValue.delete(),
    });
    await db.doc(`users/${uid}`).set({ activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
}
async function expireAbsentPlayers(db, matchRef, match) {
    const now = Date.now();
    for (const uid of match.playerIds) {
        const abs = match.absences?.[uid];
        if (!abs?.rejoinUntil || abs.rejoinUntil.toMillis() > now)
            continue;
        const winnerUid = match.playerIds.find(id => id !== uid);
        if (!winnerUid)
            continue;
        const batch = db.batch();
        _applyMatchEndUpdates((ref, data) => batch.update(ref, data), db, matchRef, match, winnerUid, 'timeout', { forfeit: { loserUid: uid, winnerUid, reason: 'rejoin_expired' }, rejoinBanner: firestore_1.FieldValue.delete() });
        await batch.commit();
        await _onMatchFinishedHooks(matchRef.id, winnerUid);
        return winnerUid;
    }
    return null;
}
function handsToStorage(hands) {
    const out = {};
    hands.forEach((hand, i) => { out[String(i)] = [...hand]; });
    return out;
}
function handsFromStorage(raw, count) {
    if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
        return raw.map(h => [...h]);
    }
    const map = (raw && typeof raw === 'object' ? raw : {});
    return Array.from({ length: count }, (_, i) => [...(map[String(i)] || [])]);
}
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// Helpers
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
/** Hooks post-partida: torneos + liquidación de apuestas de espectadores. */
async function _onMatchFinishedHooks(matchId, winnerUid) {
    try {
        const { onTournamentMatchFinished } = await Promise.resolve().then(() => __importStar(require('./tournaments')));
        await onTournamentMatchFinished(matchId, winnerUid);
    }
    catch (err) {
        console.error('[onMatchFinished] tournament hook:', err);
    }
    try {
        const { settleMatchBets } = await Promise.resolve().then(() => __importStar(require('./wallet')));
        await settleMatchBets((0, firestore_1.getFirestore)(), matchId, winnerUid);
    }
    catch (err) {
        console.error('[onMatchFinished] bet settlement:', err);
    }
}
function requireString(data, key) {
    const v = data[key];
    if (typeof v !== 'string' || !v)
        throw new https_1.HttpsError('invalid-argument', `Falta "${key}"`);
    return v;
}
function isGuestAuth(auth) {
    const firebase = auth.token['firebase'];
    return firebase?.sign_in_provider === 'anonymous';
}
function isGuestUserData(data) {
    return data?.['isGuest'] === true || data?.['anon'] === true;
}
async function userIsGuest(db, uid) {
    const snap = await db.doc(`users/${uid}`).get();
    return isGuestUserData(snap.data());
}
function matchCreatedMs(createdAt) {
    if (!createdAt || typeof createdAt.toMillis !== 'function') {
        return 0;
    }
    return createdAt.toMillis();
}
function matchAgeMs(match) {
    const started = match.startedAt ? matchCreatedMs(match.startedAt) : 0;
    return started || matchCreatedMs(match.createdAt);
}
/** Sala/partida colgada: waiting vieja o playing que nunca arranc� del todo. */
function isStuckMatch(match, now = Date.now()) {
    const ageMs = matchAgeMs(match);
    const oldEnough = ageMs === 0 || now - ageMs >= CFG.WAITING_ROOM_MS;
    if (!oldEnough)
        return false;
    if (match.status === 'waiting')
        return true;
    if (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard)
        return true;
    return false;
}
async function clearActiveRejoinForPlayers(db, playerIds) {
    const batch = db.batch();
    for (const uid of playerIds) {
        batch.set(db.doc(`users/${uid}`), { activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
    }
    await batch.commit();
}
/** Cierra waiting (delete) o playing colgada (finished + reembolso). */
async function forceCloseMatch(db, matchRef, match, reason) {
    if (match.status === 'waiting') {
        await closeWaitingRoom(db, matchRef, match, reason);
        await clearActiveRejoinForPlayers(db, match.playerIds);
        return;
    }
    if (match.status !== 'playing')
        return;
    const batch = db.batch();
    const stake = match.stakeCC ?? 0;
    for (const uid of match.playerIds) {
        const upd = { activeRejoin: firestore_1.FieldValue.delete() };
        if (stake > 0)
            upd.ceroCoins = firestore_1.FieldValue.increment(stake);
        batch.set(db.doc(`users/${uid}`), upd, { merge: true });
    }
    batch.update(matchRef, {
        status: 'finished',
        phase: 'game_over',
        winner: null,
        finishedAt: firestore_1.FieldValue.serverTimestamp(),
        closedReason: reason,
        rejoinBanner: firestore_1.FieldValue.delete(),
    });
    await batch.commit();
    await db.collection('coin_ledger').add({
        matchId: matchRef.id,
        type: 'match_admin_closed',
        reason,
        playerIds: match.playerIds,
        stakeCC: stake,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }).catch(() => { });
}
function playerIsGuest(match, uid) {
    const p = match.players.find(x => x.uid === uid);
    return p?.isGuest === true;
}
async function assertCanJoinWaitingRoom(db, uid, match, joiningUserIsGuest) {
    if (joiningUserIsGuest) {
        guard(match.stakeCC === 0, 'permission-denied', 'Como invitado solo podés entrar a salas gratuitas (0 CN). Creá cuenta para jugar por premios.');
    }
    const otherIds = match.playerIds.filter(id => id !== uid);
    if (otherIds.length === 0)
        return;
    const flags = await Promise.all(otherIds.map(async (id) => ({
        id,
        guest: await userIsGuest(db, id),
    })));
    if (joiningUserIsGuest) {
        guard(flags.every(f => f.guest), 'permission-denied', 'Esta sala tiene jugadores registrados. Creá una sala invitado o registrate para más opciones.');
        return;
    }
    guard(!match.guestOnly, 'permission-denied', 'Sala exclusiva para invitados. Elegí otra sala abierta.');
    guard(flags.every(f => !f.guest), 'permission-denied', 'Hay un invitado en esta sala. Unite a otra sala gratuita.');
}
/** Cierra una sala en espera, devuelve stake y la elimina del lobby. */
async function closeWaitingRoom(db, matchRef, match, reason) {
    const batch = db.batch();
    if (match.stakeCC > 0) {
        for (const uid of match.playerIds) {
            batch.update(db.doc(`users/${uid}`), {
                ceroCoins: firestore_1.FieldValue.increment(match.stakeCC),
            });
        }
    }
    batch.delete(matchRef);
    await batch.commit();
    await db.collection('coin_ledger').add({
        matchId: matchRef.id,
        type: 'waiting_room_closed',
        reason,
        playerIds: match.playerIds,
        stakeCC: match.stakeCC ?? 0,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }).catch(() => { });
}
/**
 * Aplica todas las escrituras necesarias para cerrar una partida.
 * Acepta un updateFn genérico para ser usado dentro de Transaction o WriteBatch.
 *
 *   · match �?? status=finished, winner, phase=game_over, endReason
 *   · winner �?? wins+1, totalGamesPlayed+1, ceroCoins += pozo (si stakeCC > 0)
 *   · loser  �?? totalGamesPlayed+1
 */
function _applyMatchEndUpdates(updateFn, db, matchRef, match, winnerUid, reason, extraMatchFields = {}) {
    const prize = match.stakeCC * match.playerIds.length;
    const { winnerUids, loserUids } = resolveTeamOutcome(match, winnerUid);
    const coinRecipient = winnerUids[0] ?? winnerUid;
    updateFn(matchRef, {
        status: 'finished',
        winner: winnerUid,
        phase: 'game_over',
        finishedAt: firestore_1.FieldValue.serverTimestamp(),
        endReason: reason,
        winningTeam: winnerUids,
        ...extraMatchFields,
    });
    for (const wUid of winnerUids) {
        if (playerIsGuest(match, wUid))
            continue;
        updateFn(db.doc(`users/${wUid}`), {
            wins: firestore_1.FieldValue.increment(1),
            totalGamesPlayed: firestore_1.FieldValue.increment(1),
            xp: firestore_1.FieldValue.increment(25),
            ...(wUid === coinRecipient && prize > 0 ? { ceroCoins: firestore_1.FieldValue.increment(prize) } : {}),
        });
    }
    for (const lUid of loserUids) {
        if (playerIsGuest(match, lUid))
            continue;
        updateFn(db.doc(`users/${lUid}`), { totalGamesPlayed: firestore_1.FieldValue.increment(1) });
    }
}
/** Construye el objeto de estado público que el cliente puede ver en tiempo real. */
function buildPublicState(snap, playerIds) {
    return {
        phase: snap.phase,
        current: snap.current,
        direction: snap.direction,
        drawStack: snap.drawStack,
        chosenColor: snap.chosenColor ?? null,
        topDiscard: snap.topDiscard ?? null,
        handCounts: [...snap.handCounts],
        winner: snap.winner !== null ? (playerIds[snap.winner] ?? null) : null,
        pendingTurn: snap.pendingTurn ?? null,
    };
}
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// _startMatch �?? helper interno (no es un endpoint)
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
async function startMatch(db, matchRef, match) {
    const freshSnap = await matchRef.get();
    if (freshSnap.exists) {
        const fresh = freshSnap.data();
        if (fresh.status === 'playing' && fresh.topDiscard) {
            return;
        }
    }
    const { playerIds, players } = match;
    const uniqueIds = uniquePlayerIds(playerIds);
    guard(uniqueIds.length >= matchMaxPlayers(match), 'failed-precondition', 'Faltan jugadores para iniciar la partida');
    const names = players.filter(p => uniqueIds.includes(p.uid)).map(p => p.name);
    const engine = new CeroEngine_1.CeroEngine({ playerCount: uniqueIds.length, names, handSize: CFG.HAND_SIZE });
    const dealt = engine.deal();
    guard(dealt.ok, 'internal', dealt.ok ? 'ok' : dealt.error);
    const snap = engine.toFullSnapshot();
    const batch = db.batch();
    // Incrementar freeGamesPlayed + totalGamesPlayed (solo jugadores registrados)
    for (const uid of uniqueIds) {
        if (playerIsGuest(match, uid))
            continue;
        batch.set(db.doc(`users/${uid}`), {
            freeGamesPlayed: firestore_1.FieldValue.increment(1),
            totalGamesPlayed: firestore_1.FieldValue.increment(1),
        }, { merge: true });
    }
    // Estado privado del servidor (deck + discard + todas las manos)
    const privateRef = db.doc(`matches/${matchRef.id}/private/server`);
    batch.set(privateRef, {
        deck: [...snap.deck],
        discardPile: [...snap.discardPile],
        hands: handsToStorage(snap.hands),
        ceroCalled: [...snap.ceroCalled],
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Mano individual de cada jugador (solo él puede leer)
    for (let i = 0; i < uniqueIds.length; i++) {
        const uid = uniqueIds[i];
        const handRef = db.doc(`matches/${matchRef.id}/hands/${uid}`);
        batch.set(handRef, { cards: [...snap.hands[i]], updatedAt: firestore_1.FieldValue.serverTimestamp() });
    }
    const { bettingOpenUntilTimestamp } = await Promise.resolve().then(() => __importStar(require('./wallet')));
    // Estado público de la partida
    batch.update(matchRef, {
        status: 'playing',
        turn: 1,
        startedAt: firestore_1.FieldValue.serverTimestamp(),
        bettingOpenUntil: bettingOpenUntilTimestamp(),
        betPoolTotal: 0,
        betCount: 0,
        spectatorCount: 0,
        playerIds: uniqueIds,
        playerCount: uniqueIds.length,
        ...buildPublicState(snap, uniqueIds),
    });
    await batch.commit();
}
function matchNeedsStart(match) {
    const ids = uniquePlayerIds(match.playerIds);
    return ids.length >= matchMaxPlayers(match) &&
        (match.status === 'waiting' ||
            (match.status === 'playing' && match.phase === 'waiting' && !match.topDiscard));
}
async function tryStartMatchIfReady(db, matchRef, match) {
    const ids = uniquePlayerIds(match.playerIds);
    const normalized = { ...match, playerIds: ids, playerCount: ids.length };
    if (!matchNeedsStart(normalized))
        return false;
    await startMatch(db, matchRef, normalized);
    return true;
}
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// ensureMatchStarted ? cliente/spectator puede forzar inicio si la sala qued� colgada
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
exports.ensureMatchStarted = (0, https_1.onCall)({ region: CFG.REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten�s que iniciar sesi�n');
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`matches/${matchId}`);
    const snap = await ref.get();
    guard(snap.exists, 'not-found', 'Partida no encontrada');
    const match = snap.data();
    const started = await tryStartMatchIfReady(db, ref, match);
    const after = (await ref.get()).data();
    return { ok: true, started, status: after.status };
});
function parseRequestedStake(stakeCC) {
    const n = typeof stakeCC === 'number' ? stakeCC : Number(stakeCC);
    return n === CFG.ENTRY_COST_CC ? CFG.ENTRY_COST_CC : 0;
}
async function chargeEntryStake(db, uid, auth, stakeCC) {
    if (stakeCC <= 0) {
        const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
        return { charged: false, coinsLeft: bal };
    }
    return db.runTransaction(async (tx) => {
        const userRef = db.doc(`users/${uid}`);
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            tx.set(userRef, {
                email: auth.token.email ?? '',
                displayName: auth.token.name ?? 'Jugador',
                ceroCoins: 0,
                freeGamesPlayed: 0,
                totalGamesPlayed: 0,
                wins: 0,
            });
            guard(false, 'resource-exhausted', `Saldo insuficiente. Necesitás ${stakeCC} CN, tenés 0.`);
        }
        const user = snap.data();
        const balance = user.ceroCoins ?? 0;
        const isVIPActive = !!(user.vip?.active === true &&
            (user.vip.expiresAt?.toMillis() ?? 0) > Date.now());
        if (isVIPActive) {
            return { charged: false, coinsLeft: balance };
        }
        guard(balance >= stakeCC, 'resource-exhausted', `Saldo insuficiente. Necesitás ${stakeCC} CN, tenés ${balance}.`);
        tx.update(userRef, { ceroCoins: firestore_1.FieldValue.increment(-stakeCC) });
        return { charged: true, coinsLeft: balance - stakeCC };
    });
}
async function findActiveMatchForUser(db, uid) {
    for (const status of ['playing', 'waiting']) {
        const snap = await db.collection('matches')
            .where('status', '==', status)
            .where('playerIds', 'array-contains', uid)
            .limit(5)
            .get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            return { id: doc.id, data: doc.data() };
        }
    }
    return null;
}
/** Cierra salas waiting hu�rfanas/colgadas del jugador (p. ej. qued� una waiting + una playing). */
async function cleanupOrphanRoomsForUser(db, uid) {
    let closedWaiting = 0;
    let clearedRejoin = false;
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const activeRejoin = userSnap.data()?.activeRejoin;
    if (activeRejoin?.matchId) {
        const rejoinSnap = await db.doc(`matches/${activeRejoin.matchId}`).get();
        const untilMs = activeRejoin.rejoinUntil?.toMillis?.() ?? 0;
        const rejoinValid = rejoinSnap.exists
            && untilMs > Date.now()
            && canRejoinMatch(rejoinSnap.data(), uid);
        if (!rejoinValid) {
            await userRef.set({ activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
            clearedRejoin = true;
        }
    }
    const [waitingSnap, playingSnap] = await Promise.all([
        db.collection('matches')
            .where('status', '==', 'waiting')
            .where('playerIds', 'array-contains', uid)
            .get(),
        db.collection('matches')
            .where('status', '==', 'playing')
            .where('playerIds', 'array-contains', uid)
            .get(),
    ]);
    const hasPlaying = !playingSnap.empty;
    const now = Date.now();
    for (const docSnap of waitingSnap.docs) {
        const match = docSnap.data();
        const createdMs = matchCreatedMs(match.createdAt);
        const stale = createdMs > 0 && now - createdMs >= CFG.WAITING_ROOM_MS;
        const orphan = hasPlaying;
        if (orphan || stale) {
            await forceCloseMatch(db, docSnap.ref, match, orphan ? 'orphan_waiting' : 'waiting_expired');
            closedWaiting++;
        }
    }
    for (const docSnap of playingSnap.docs) {
        const match = docSnap.data();
        if (!isStuckMatch(match, now))
            continue;
        await tryStartMatchIfReady(db, docSnap.ref, match);
        const fresh = (await docSnap.ref.get()).data();
        if (fresh && isStuckMatch(fresh, now)) {
            await forceCloseMatch(db, docSnap.ref, fresh, 'stuck_playing_cleanup');
            closedWaiting++;
        }
    }
    return { closedWaiting, clearedRejoin };
}
exports.cleanupMyRooms = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten�s que iniciar sesi�n');
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const { closedWaiting, clearedRejoin } = await cleanupOrphanRoomsForUser(db, uid);
    const active = await findActiveMatchForUser(db, uid);
    return {
        ok: true,
        closedWaiting,
        clearedRejoin,
        activeMatch: active
            ? { matchId: active.id, status: active.data.status, stakeCC: active.data.stakeCC ?? 0 }
            : null,
    };
});
/**
 * Verifica elegibilidad (partidas gratis o saldo), descuenta coins atómicamente
 * y une al jugador a una sala existente o crea una nueva.
 */
exports.joinMatch = (0, https_1.onCall)({ region: CFG.REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const callerIsGuest = isGuestAuth(request.auth);
    const mode = request.data?.mode === 'cero' ? 'cero' : 'classic';
    const createFormat = parseFormat(request.data?.format);
    const createMaxPlayers = maxPlayersForFormat(createFormat);
    const requestedMatchId = typeof request.data?.matchId === 'string' && request.data.matchId.length > 0
        ? request.data.matchId
        : null;
    const forceCreate = request.data?.createNew === true;
    const db = (0, firestore_1.getFirestore)();
    await cleanupOrphanRoomsForUser(db, uid);
    const existingActive = await findActiveMatchForUser(db, uid);
    const finishJoin = async (matchId, playerIndex, charged, coinsLeft, stakeCC) => {
        const matchSnap = await db.doc(`matches/${matchId}`).get();
        const matchData = matchSnap.data();
        if (matchData) {
            await tryStartMatchIfReady(db, matchSnap.ref, matchData);
        }
        return { matchId, playerIndex, charged, coinsLeft, stakeCC };
    };
    // �??�?? 0. Reingreso a sala propia (sin cobrar de nuevo) �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
    if (requestedMatchId) {
        if (existingActive && existingActive.id !== requestedMatchId) {
            guard(false, 'failed-precondition', 'Ya ten�s una sala o partida activa. Volv� a ella antes de unirte a otra.');
        }
        const pre = await db.doc(`matches/${requestedMatchId}`).get();
        if (pre.exists) {
            const d = pre.data();
            const ids = uniquePlayerIds(d.playerIds);
            if (ids.includes(uid)) {
                const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
                guard(canRejoinMatch(d, uid), 'failed-precondition', d.status === 'playing'
                    ? 'El plazo de 5 minutos para reingresar expiró'
                    : 'No podés reingresar a esta sala');
                if (d.status === 'playing') {
                    await clearPlayerAbsence(db, pre.ref, uid);
                }
                return finishJoin(requestedMatchId, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
            }
        }
    }
    else if (!forceCreate && existingActive) {
        const d = existingActive.data;
        const ids = uniquePlayerIds(d.playerIds);
        const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
        if (d.status === 'playing' && canRejoinMatch(d, uid)) {
            await clearPlayerAbsence(db, db.doc(`matches/${existingActive.id}`), uid);
            return finishJoin(existingActive.id, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
        }
        if (d.status === 'waiting' && ids.length < matchMaxPlayers(d)) {
            return finishJoin(existingActive.id, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
        }
    }
    else if (forceCreate && existingActive) {
        guard(false, 'failed-precondition', 'Ya ten�s una sala o partida activa. Volv� a ella antes de crear otra.');
    }
    const matchesRef = db.collection('matches');
    let matchId = '';
    let playerIndex = -1;
    let entryStake = 0;
    if (requestedMatchId) {
        const specificSnap = await db.doc(`matches/${requestedMatchId}`).get();
        guard(specificSnap.exists, 'not-found', 'Sala no encontrada');
        const d = specificSnap.data();
        const ids = uniquePlayerIds(d.playerIds);
        guard(d.status === 'waiting', 'failed-precondition', 'La sala ya comenzó o terminó');
        guard(ids.length < matchMaxPlayers(d), 'failed-precondition', 'La sala est� llena');
        guard(!ids.includes(uid), 'failed-precondition', 'Ya estás en esta sala');
        await assertCanJoinWaitingRoom(db, uid, d, callerIsGuest || await userIsGuest(db, uid));
        matchId = requestedMatchId;
        playerIndex = ids.length;
        entryStake = d.stakeCC ?? 0;
    }
    else {
        guard(!existingActive, 'failed-precondition', 'Ya ten�s una sala o partida activa. Volv� a ella antes de crear otra.');
        entryStake = callerIsGuest ? 0 : parseRequestedStake(request.data?.stakeCC);
        guard(!callerIsGuest || entryStake === 0, 'permission-denied', 'Como invitado solo podés crear salas gratuitas (0 CN).');
    }
    const { charged, coinsLeft } = await chargeEntryStake(db, uid, request.auth, entryStake);
    const joiningUserIsGuest = callerIsGuest || await userIsGuest(db, uid);
    if (matchId) {
        // �??�?? 3a. Unirse a sala existente (transacción) �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
        await db.runTransaction(async (tx) => {
            const ref = db.doc(`matches/${matchId}`);
            const snap = await tx.get(ref);
            const d = snap.data();
            const ids = uniquePlayerIds(d.playerIds);
            guard(d.status === 'waiting', 'failed-precondition', 'Sala ya no disponible');
            guard(ids.length < matchMaxPlayers(d), 'failed-precondition', 'Sala llena');
            guard(!ids.includes(uid), 'failed-precondition', 'Ya estás en esta sala');
            const newPlayers = [...d.players, {
                    uid,
                    name: request.auth.token.name ?? 'Jugador',
                    index: ids.length,
                    isGuest: joiningUserIsGuest,
                }];
            const newIds = [...ids, uid];
            tx.update(ref, { players: newPlayers, playerIds: newIds, playerCount: newIds.length });
        });
    }
    else {
        // �??�?? 3b. Crear sala nueva �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
        const createIsGuest = callerIsGuest || await userIsGuest(db, uid);
        const newMatchData = {
            status: 'waiting',
            mode,
            format: createFormat,
            players: [{
                    uid,
                    name: request.auth.token.name ?? 'Jugador',
                    index: 0,
                    isGuest: createIsGuest,
                }],
            playerIds: [uid],
            playerCount: 1,
            maxPlayers: createMaxPlayers,
            stakeCC: entryStake,
            guestOnly: createIsGuest,
            turn: 0,
            phase: 'waiting',
            current: null,
            direction: null,
            drawStack: null,
            chosenColor: null,
            topDiscard: null,
            handCounts: null,
            winner: null,
            pendingTurn: null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            startedAt: null,
            finishedAt: null,
            lastAction: null,
        };
        const ref = await matchesRef.add(newMatchData);
        matchId = ref.id;
        playerIndex = 0;
    }
    return finishJoin(matchId, playerIndex, charged, coinsLeft, entryStake);
});
const VALID_ACTIONS = new Set(['play', 'draw', 'pickColor', 'declareCero']);
/**
 * Ejecuta una acción de juego dentro de una transacción Firestore.
 *
 * Flujo:
 *   1. Lee match + private/server + hands/{uid} en la misma transacción.
 *   2. Valida turno con turnNumber (idempotencia).
 *   3. Reconstruye CeroEngine desde el snapshot privado.
 *   4. Ejecuta la acción (play / draw / pickColor / declareCero).
 *   5. Si ok=true �?? escribe el nuevo estado atómicamente.
 *   6. Si ok=false �?? lanza HttpsError y la transacción hace rollback automático.
 */
exports.playTurn = (0, https_1.onCall)({ region: CFG.REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const data = request.data;
    guard(data?.matchId, 'invalid-argument', 'Falta matchId');
    guard(data?.action, 'invalid-argument', 'Falta action');
    guard(VALID_ACTIONS.has(data.action), 'invalid-argument', `Acción inválida: "${data.action}"`);
    const { matchId, action, turnNumber } = data;
    const db = (0, firestore_1.getFirestore)();
    const matchRef = db.doc(`matches/${matchId}`);
    const privateRef = db.doc(`matches/${matchId}/private/server`);
    const handRef = db.doc(`matches/${matchId}/hands/${uid}`);
    const preMatchSnap = await matchRef.get();
    if (preMatchSnap.exists) {
        const preMatch = preMatchSnap.data();
        const expiredWinner = await expireAbsentPlayers(db, matchRef, preMatch);
        if (expiredWinner) {
            throw new https_1.HttpsError('failed-precondition', 'La partida terminó por abandono del rival');
        }
    }
    let resultPublic;
    let resultHand;
    let resultTurn;
    let finishedWinner = null;
    let trackWild = false;
    let trackCero = false;
    const replayBox = { entry: null };
    await db.runTransaction(async (tx) => {
        const [matchSnap, privateSnap] = await Promise.all([
            tx.get(matchRef),
            tx.get(privateRef),
        ]);
        guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
        guard(privateSnap.exists, 'failed-precondition', 'Estado de servidor no disponible');
        const match = matchSnap.data();
        const priv = privateSnap.data();
        guard(match.status === 'playing', 'failed-precondition', 'La partida no está en curso');
        guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
        // Si el jugador volvió de una desconexión temporal, limpiar ausencia.
        if (match.absences?.[uid]) {
            tx.update(matchRef, {
                [`absences.${uid}`]: firestore_1.FieldValue.delete(),
                rejoinBanner: firestore_1.FieldValue.delete(),
            });
            tx.set(db.doc(`users/${uid}`), { activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
        }
        guard(match.turn === turnNumber, 'failed-precondition', `Turno desactualizado (servidor: ${match.turn}, cliente: ${turnNumber}). Recargá el estado.`);
        const privHands = handsFromStorage(priv.hands, match.playerIds.length);
        // �??�?? Reconstruir el motor desde el snapshot �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
        const fullSnap = {
            phase: match.phase,
            current: match.current ?? 0,
            direction: match.direction ?? 1,
            drawStack: match.drawStack ?? 0,
            chosenColor: match.chosenColor ?? null,
            pendingTurn: match.pendingTurn ?? null,
            winner: null,
            topDiscard: match.topDiscard ?? null,
            deckLeft: priv.deck.length,
            hands: privHands.map(h => [...h]),
            handCounts: privHands.map(h => h.length),
            players: match.players.map((p) => ({ id: p.index, name: p.name })),
            ceroCalled: [...priv.ceroCalled],
            deck: [...priv.deck],
            discardPile: [...priv.discardPile],
        };
        const engine = CeroEngine_1.CeroEngine.fromFullSnapshot(fullSnap);
        const playerIndex = match.playerIds.indexOf(uid);
        // declareCero no requiere que sea el turno del jugador
        if (action !== 'declareCero') {
            guard(engine.current === playerIndex, 'failed-precondition', 'No es tu turno');
        }
        // �??�?? Ejecutar la acción �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
        let result;
        switch (action) {
            case 'play': {
                guard(typeof data.cardId === 'number', 'invalid-argument', 'Falta cardId');
                const playedCard = privHands[playerIndex]?.find(c => c.id === data.cardId);
                result = engine.play(playerIndex, data.cardId);
                if (result.ok && playedCard?.color === 'wild') {
                    trackWild = true;
                }
                break;
            }
            case 'draw': {
                result = engine.draw(playerIndex);
                break;
            }
            case 'pickColor': {
                guard(typeof data.color === 'string', 'invalid-argument', 'Falta color');
                const color = data.color;
                guard(CeroEngine_1.COLORS.includes(color), 'invalid-argument', `Color inválido: "${color}"`);
                result = engine.pickColor(playerIndex, color);
                break;
            }
            case 'declareCero': {
                result = engine.declareCero(playerIndex);
                if (result.ok)
                    trackCero = true;
                break;
            }
        }
        // �??�?? Rollback si el motor rechaza la acción �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
        if (!result.ok) {
            throw new https_1.HttpsError('failed-precondition', result.error);
        }
        const newSnap = engine.toFullSnapshot();
        const newTurn = match.turn + 1;
        // �??�?? Escribir nuevo estado (todo dentro de la misma transacción) �??�??�??�??�??�??�??
        // 1. Estado privado del servidor
        tx.set(privateRef, {
            deck: [...newSnap.deck],
            discardPile: [...newSnap.discardPile],
            hands: handsToStorage(newSnap.hands),
            ceroCalled: [...newSnap.ceroCalled],
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // 2. Mano de cada jugador en su subcollección individual
        for (let i = 0; i < match.playerIds.length; i++) {
            const pUid = match.playerIds[i];
            const pHRef = db.doc(`matches/${matchId}/hands/${pUid}`);
            tx.set(pHRef, { cards: [...newSnap.hands[i]], updatedAt: firestore_1.FieldValue.serverTimestamp() });
        }
        // 3. Construir estado público para el cliente
        const winnerUid = newSnap.winner !== null ? (match.playerIds[newSnap.winner] ?? null) : null;
        const isFinished = newSnap.phase === 'game_over';
        const lastAction = {
            type: action,
            uid,
            playerIdx: playerIndex,
            card: (action === 'play' && data.cardId !== undefined)
                ? { id: data.cardId }
                : null,
            color: action === 'pickColor' ? data.color : null,
            ...(action === 'draw' && 'drawn' in result
                ? { count: result.drawn.length }
                : {}),
        };
        const publicPatch = {
            ...buildPublicState(newSnap, match.playerIds),
            turn: newTurn,
            status: isFinished ? 'finished' : 'playing',
            winner: winnerUid,
            lastAction,
            ...(isFinished ? { finishedAt: firestore_1.FieldValue.serverTimestamp() } : {}),
        };
        tx.update(matchRef, publicPatch);
        // 4. Stats de usuario cuando la partida termina.
        if (isFinished && winnerUid) {
            const prize = match.stakeCC * match.playerIds.length;
            const { winnerUids, loserUids } = resolveTeamOutcome(match, winnerUid);
            const coinRecipient = winnerUids[0] ?? winnerUid;
            for (const wUid of winnerUids) {
                if (playerIsGuest(match, wUid))
                    continue;
                tx.update(db.doc(`users/${wUid}`), {
                    wins: firestore_1.FieldValue.increment(1),
                    totalGamesPlayed: firestore_1.FieldValue.increment(1),
                    xp: firestore_1.FieldValue.increment(25),
                    ...(wUid === coinRecipient && prize > 0 ? { ceroCoins: firestore_1.FieldValue.increment(prize) } : {}),
                });
            }
            for (const lUid of loserUids) {
                if (playerIsGuest(match, lUid))
                    continue;
                tx.update(db.doc(`users/${lUid}`), { totalGamesPlayed: firestore_1.FieldValue.increment(1) });
            }
        }
        resultPublic = publicPatch;
        resultHand = [...newSnap.hands[playerIndex]];
        resultTurn = newTurn;
        if (isFinished && winnerUid)
            finishedWinner = winnerUid;
        replayBox.entry = {
            turn: newTurn,
            action: lastAction,
            handCounts: [...newSnap.handCounts],
            topDiscard: newSnap.topDiscard ?? null,
            phase: newSnap.phase,
            current: newSnap.current,
        };
    });
    if (replayBox.entry) {
        try {
            const entry = replayBox.entry;
            await db.collection(`matches/${matchId}/replay`).add({
                turn: entry.turn,
                action: entry.action,
                handCounts: entry.handCounts,
                topDiscard: entry.topDiscard,
                phase: entry.phase,
                current: entry.current,
                ts: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch { /* replay no bloquea la jugada */ }
    }
    if (finishedWinner) {
        await _onMatchFinishedHooks(matchId, finishedWinner);
    }
    try {
        if (trackWild)
            await (0, missions_1.trackMissionAction)(db, uid, 'play_wild');
        if (trackCero)
            await (0, missions_1.trackMissionAction)(db, uid, 'declare_cero');
    }
    catch { /* misiones no bloquean la jugada */ }
    return { ok: true, publicState: resultPublic, myHand: resultHand, turn: resultTurn };
});
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// leaveMatch �?? salir de sala en espera (sin cobrar ni penalizar)
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
exports.leaveMatch = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`matches/${matchId}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        guard(snap.exists, 'not-found', 'Partida no encontrada');
        const match = snap.data();
        guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta sala');
        guard(match.status === 'waiting', 'failed-precondition', 'La partida ya comenzó');
        const remaining = match.playerIds.filter(id => id !== uid);
        const remainingPlayers = match.players.filter(p => p.uid !== uid);
        if (match.stakeCC > 0) {
            tx.update(db.doc(`users/${uid}`), {
                ceroCoins: firestore_1.FieldValue.increment(match.stakeCC),
            });
        }
        if (remaining.length === 0) {
            tx.delete(ref);
        }
        else {
            tx.update(ref, {
                playerIds: remaining,
                players: remainingPlayers.map((p, i) => ({ ...p, index: i })),
                playerCount: remaining.length,
            });
        }
    });
    return { ok: true };
});
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// temporaryLeaveMatch �?? salir sin abandonar (5 min para volver)
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
exports.temporaryLeaveMatch = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`matches/${matchId}`);
    const rejoinUntilMs = Date.now() + CFG.REJOIN_MS;
    const rejoinUntil = firestore_1.Timestamp.fromMillis(rejoinUntilMs);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        guard(snap.exists, 'not-found', 'Partida no encontrada');
        const match = snap.data();
        guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
        guard(match.status === 'playing' || match.status === 'waiting', 'failed-precondition', 'La partida ya terminó');
        const playerName = match.players.find(p => p.uid === uid)?.name ?? 'Jugador';
        tx.update(ref, {
            [`absences.${uid}`]: {
                rejoinUntil,
                leftAt: firestore_1.FieldValue.serverTimestamp(),
            },
            rejoinBanner: {
                absentUid: uid,
                absentName: playerName,
                rejoinUntil,
            },
        });
        tx.set(db.doc(`users/${uid}`), {
            activeRejoin: { matchId, rejoinUntil, status: match.status },
        }, { merge: true });
    });
    return { ok: true, rejoinUntil: rejoinUntilMs };
});
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// checkMatchRejoinExpiry �?? polling cliente para expirar reconexión
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
exports.checkMatchRejoinExpiry = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.doc(`matches/${matchId}`);
    const snap = await ref.get();
    guard(snap.exists, 'not-found', 'Partida no encontrada');
    const match = snap.data();
    guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
    const winnerUid = await expireAbsentPlayers(db, ref, match);
    if (winnerUid) {
        return { ok: true, expired: true, winnerUid };
    }
    return { ok: true, expired: false };
});
/** Escanea partidas en curso con reconexión vencida (cada minuto). */
exports.expireRejoinMatches = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', region: CFG.REGION, timeZone: 'America/Montevideo' }, async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = Date.now();
    const playing = await db.collection('matches')
        .where('status', '==', 'playing')
        .limit(200)
        .get();
    for (const docSnap of playing.docs) {
        const match = docSnap.data();
        const hasExpired = match.playerIds.some(uid => {
            const abs = match.absences?.[uid];
            return abs?.rejoinUntil && abs.rejoinUntil.toMillis() <= now;
        });
        if (hasExpired) {
            await expireAbsentPlayers(db, docSnap.ref, match);
        }
    }
});
/** Cierra salas waiting colgadas sin rival (~4 min) y partidas playing atascadas. */
exports.expireStaleWaitingMatches = (0, scheduler_1.onSchedule)({ schedule: 'every 1 minutes', region: CFG.REGION, timeZone: 'America/Montevideo' }, async () => {
    const db = (0, firestore_1.getFirestore)();
    const now = Date.now();
    const cutoff = now - CFG.WAITING_ROOM_MS;
    const [waiting, playing] = await Promise.all([
        db.collection('matches').where('status', '==', 'waiting').limit(200).get(),
        db.collection('matches').where('status', '==', 'playing').limit(200).get(),
    ]);
    for (const docSnap of waiting.docs) {
        const match = docSnap.data();
        const createdMs = matchCreatedMs(match.createdAt);
        if (createdMs > 0 && createdMs <= cutoff) {
            await forceCloseMatch(db, docSnap.ref, match, 'waiting_expired');
        }
    }
    for (const docSnap of playing.docs) {
        const match = docSnap.data();
        if (isStuckMatch(match, now)) {
            await tryStartMatchIfReady(db, docSnap.ref, match);
            const fresh = (await docSnap.ref.get()).data();
            if (fresh && isStuckMatch(fresh, now)) {
                await forceCloseMatch(db, docSnap.ref, fresh, 'stuck_playing_expired');
            }
        }
    }
});
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
// getRejoinStatus �?? consultar si hay partida para reingresar
// �??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??�??
exports.getRejoinStatus = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const userSnap = await db.doc(`users/${uid}`).get();
    const active = userSnap.data()?.activeRejoin;
    if (!active?.matchId || !active.rejoinUntil) {
        return { available: false };
    }
    const untilMs = active.rejoinUntil.toMillis?.() ?? active.rejoinUntil;
    if (untilMs <= Date.now()) {
        await db.doc(`users/${uid}`).set({ activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
        return { available: false };
    }
    const matchSnap = await db.doc(`matches/${active.matchId}`).get();
    if (!matchSnap.exists) {
        return { available: false };
    }
    const match = matchSnap.data();
    if (!canRejoinMatch(match, uid) || match.status === 'finished' || isStuckMatch(match)) {
        await db.doc(`users/${uid}`).set({ activeRejoin: firestore_1.FieldValue.delete() }, { merge: true });
        return { available: false };
    }
    return {
        available: true,
        matchId: active.matchId,
        rejoinUntil: untilMs,
        status: match.status,
        stakeCC: match.stakeCC ?? 0,
    };
});
/** Abandono voluntario: entrega la victoria al rival y devuelve el pozo. */
exports.forfeitMatch = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
    const match = matchSnap.data();
    guard(match.status === 'playing', 'failed-precondition', 'La partida no está en curso');
    guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
    const winnerUid = primaryWinnerForForfeit(match, uid);
    guard(winnerUid, 'internal', 'No se pudo determinar el ganador');
    const batch = db.batch();
    _applyMatchEndUpdates((ref, data) => batch.update(ref, data), db, matchSnap.ref, match, winnerUid, 'forfeit', { forfeit: { loserUid: uid, winnerUid } });
    await batch.commit();
    await _onMatchFinishedHooks(matchId, winnerUid);
    return { ok: true, winnerUid };
});
/**
 * Cierra una partida en curso, calcula el pozo y acredita al ganador.
 *
 * Casos de uso:
 *   · El servidor detecta inactividad (lastSeen del jugador > TURN_SECONDS)
 *   · Un jugador se queda sin cartas y el cliente confirma manualmente
 *   · Un admin fuerza el cierre de una sala atascada
 *
 * Solo pueden llamar a esta función:
 *   · Uno de los jugadores de la partida
 *   · (El Admin SDK llama directamente a _applyMatchEndUpdates sin pasar por aquí)
 */
exports.endMatch = (0, https_1.onCall)({ region: CFG.REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const data = request.data;
    const matchId = requireString(data, 'matchId');
    const winnerUid = requireString(data, 'winnerUid');
    const reason = data['reason'] ?? 'won';
    const db = (0, firestore_1.getFirestore)();
    guard(['won', 'forfeit', 'timeout'].includes(reason), 'invalid-argument', `Razón inválida: "${reason}"`);
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
    const match = matchSnap.data();
    guard(match.status === 'playing', 'failed-precondition', 'La partida no está en curso');
    guard(match.playerIds.includes(uid), 'permission-denied', 'No sos parte de esta partida');
    guard(match.playerIds.includes(winnerUid), 'invalid-argument', 'El ganador no es parte de la partida');
    // Si el caller no es el ganador, solo puede invocar endMatch por inactividad
    // verificando que el rival lleva más de TURN_SECONDS sin actividad.
    if (uid !== winnerUid) {
        const presenceSnap = await db
            .doc(`matches/${matchId}/presence/${winnerUid}`)
            .get();
        // Si el ganador (rival) tiene actividad reciente, rechazar
        if (presenceSnap.exists) {
            const lastSeen = presenceSnap.data()?.lastSeen
                ?.toMillis() ?? 0;
            const elapsed = Date.now() - lastSeen;
            guard(elapsed > (CFG.TURN_SECONDS + 10) * 1000, 'failed-precondition', 'El rival sigue activo; no podés reclamar inactividad todavía');
        }
    }
    const batch = db.batch();
    _applyMatchEndUpdates((ref, d) => batch.update(ref, d), db, matchSnap.ref, match, winnerUid, reason);
    await batch.commit();
    await _onMatchFinishedHooks(matchId, winnerUid);
    return { ok: true, winnerUid };
});
exports.getReplay = (0, https_1.onCall)({ region: CFG.REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Ten�s que iniciar sesi�n');
    const uid = request.auth.uid;
    const matchId = requireString(request.data, 'matchId');
    const db = (0, firestore_1.getFirestore)();
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');
    const match = matchSnap.data();
    guard(match.playerIds.includes(uid) || match.status === 'finished', 'permission-denied', 'No pod�s ver este replay');
    const snap = await db.collection(`matches/${matchId}/replay`)
        .orderBy('turn', 'asc')
        .limit(200)
        .get();
    return {
        ok: true,
        actions: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
});
//# sourceMappingURL=game.js.map