"use strict";
/**
 * CERO — Módulo 2: Backend (TypeScript / Cloud Functions v2)
 *
 * Garantías de seguridad:
 *   · El cliente NUNCA puede escribir en `matches/` ni en `private/server`.
 *   · Los balances de ceroCoins solo los modifica el Admin SDK dentro de una
 *     transacción Firestore — imposible de manipular desde el navegador.
 *   · El mazo y las manos ajenas jamás se exponen al cliente.
 *   · El número de turno (`turn`) actúa como llave de idempotencia:
 *     requests duplicados o retrasados son rechazados sin efecto.
 *
 * Colecciones Firestore:
 *
 *   users/{uid}
 *     email: string
 *     displayName: string
 *     ceroCoins: number          ← balance; solo escribe el servidor
 *     freeGamesPlayed: number    ← partidas gratis usadas
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
 *     stakeCC: number            ← coins apostadas por partida
 *     turn: number               ← se incrementa en cada acción (idempotencia)
 *     phase / current / direction / drawStack / chosenColor / topDiscard /
 *     handCounts / winner / pendingTurn  ← estado público (cliente escucha con onSnapshot)
 *     lastAction: LastAction | null
 *     createdAt / startedAt / finishedAt: Timestamp
 *
 *   matches/{matchId}/private/server   ← NADIE puede leer (solo Admin SDK)
 *     deck: Card[]
 *     discardPile: Card[]
 *     hands: Card[][]             ← indexado por playerIdx
 *     ceroCalled: number[]
 *
 *   matches/{matchId}/hands/{uid}      ← solo el dueño puede leer
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
exports.endMatch = exports.forfeitMatch = exports.getRejoinStatus = exports.temporaryLeaveMatch = exports.leaveMatch = exports.playTurn = exports.joinMatch = void 0;
exports.startMatch = startMatch;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const CeroEngine_1 = require("./CeroEngine");
// ─────────────────────────────────────────────────────────────────────────────
// Configuración del negocio
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
    FREE_GAMES_LIMIT: 2, // partidas gratis para nuevos usuarios
    ENTRY_COST_CC: 50, // Cero Coins por partida paga
    HAND_SIZE: 7,
    TURN_SECONDS: 30,
    MAX_PLAYERS: 2,
    REGION: 'us-central1',
    REJOIN_MS: 5 * 60 * 1000, // 5 minutos para reingresar
};
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
        _applyMatchEndUpdates((ref, data) => batch.update(ref, data), db, matchRef, match, winnerUid, 'timeout', { forfeit: { loserUid: uid, winnerUid, reason: 'rejoin_expired' } });
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
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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
/**
 * Aplica todas las escrituras necesarias para cerrar una partida.
 * Acepta un updateFn genérico para ser usado dentro de Transaction o WriteBatch.
 *
 *   · match → status=finished, winner, phase=game_over, endReason
 *   · winner → wins+1, totalGamesPlayed+1, ceroCoins += pozo (si stakeCC > 0)
 *   · loser  → totalGamesPlayed+1
 */
function _applyMatchEndUpdates(updateFn, db, matchRef, match, winnerUid, reason, extraMatchFields = {}) {
    const prize = match.stakeCC * match.playerIds.length;
    const loserUid = match.playerIds.find(id => id !== winnerUid) ?? null;
    updateFn(matchRef, {
        status: 'finished',
        winner: winnerUid,
        phase: 'game_over',
        finishedAt: firestore_1.FieldValue.serverTimestamp(),
        endReason: reason,
        ...extraMatchFields,
    });
    updateFn(db.doc(`users/${winnerUid}`), {
        wins: firestore_1.FieldValue.increment(1),
        totalGamesPlayed: firestore_1.FieldValue.increment(1),
        ...(prize > 0 ? { ceroCoins: firestore_1.FieldValue.increment(prize) } : {}),
    });
    if (loserUid) {
        updateFn(db.doc(`users/${loserUid}`), { totalGamesPlayed: firestore_1.FieldValue.increment(1) });
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
// ─────────────────────────────────────────────────────────────────────────────
// _startMatch — helper interno (no es un endpoint)
// ─────────────────────────────────────────────────────────────────────────────
async function startMatch(db, matchRef, match) {
    const { playerIds, players } = match;
    const uniqueIds = uniquePlayerIds(playerIds);
    guard(uniqueIds.length >= CFG.MAX_PLAYERS, 'failed-precondition', 'Faltan jugadores para iniciar la partida');
    const names = players.filter(p => uniqueIds.includes(p.uid)).map(p => p.name);
    const engine = new CeroEngine_1.CeroEngine({ playerCount: uniqueIds.length, names, handSize: CFG.HAND_SIZE });
    const dealt = engine.deal();
    guard(dealt.ok, 'internal', dealt.ok ? 'ok' : dealt.error);
    const snap = engine.toFullSnapshot();
    const batch = db.batch();
    // Incrementar freeGamesPlayed + totalGamesPlayed para todos los jugadores
    for (const uid of uniqueIds) {
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
/**
 * Verifica elegibilidad (partidas gratis o saldo), descuenta coins atómicamente
 * y une al jugador a una sala existente o crea una nueva.
 */
exports.joinMatch = (0, https_1.onCall)({ region: CFG.REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const mode = request.data?.mode === 'cero' ? 'cero' : 'classic';
    const requestedMatchId = typeof request.data?.matchId === 'string' && request.data.matchId.length > 0
        ? request.data.matchId
        : null;
    const forceCreate = request.data?.createNew === true;
    const db = (0, firestore_1.getFirestore)();
    const finishJoin = async (matchId, playerIndex, charged, coinsLeft, stakeCC) => {
        const matchSnap = await db.doc(`matches/${matchId}`).get();
        const matchData = matchSnap.data();
        if (matchData) {
            const ids = uniquePlayerIds(matchData.playerIds);
            const needsStart = ids.length >= CFG.MAX_PLAYERS &&
                (matchData.status === 'waiting' ||
                    (matchData.status === 'playing' && matchData.phase === 'waiting' && !matchData.topDiscard));
            if (needsStart) {
                await startMatch(db, matchSnap.ref, { ...matchData, playerIds: ids, playerCount: ids.length });
            }
        }
        return { matchId, playerIndex, charged, coinsLeft, stakeCC };
    };
    // ── 0. Reingreso a sala propia (sin cobrar de nuevo) ─────────────────────
    if (requestedMatchId) {
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
    else if (!forceCreate) {
        const mine = await db.collection('matches')
            .where('status', '==', 'waiting')
            .where('playerIds', 'array-contains', uid)
            .limit(1)
            .get();
        if (!mine.empty) {
            const docSnap = mine.docs[0];
            const d = docSnap.data();
            const ids = uniquePlayerIds(d.playerIds);
            // Solo reingresar a sala propia incompleta (1 jugador). Si está llena, crear nueva.
            if (ids.length < CFG.MAX_PLAYERS) {
                const bal = (await db.doc(`users/${uid}`).get()).data()?.ceroCoins ?? 0;
                return finishJoin(docSnap.id, ids.indexOf(uid), false, bal, d.stakeCC ?? 0);
            }
        }
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
        guard(ids.length < CFG.MAX_PLAYERS, 'failed-precondition', 'La sala está llena');
        guard(!ids.includes(uid), 'failed-precondition', 'Ya estás en esta sala');
        matchId = requestedMatchId;
        playerIndex = ids.length;
        entryStake = d.stakeCC ?? 0;
    }
    else {
        entryStake = parseRequestedStake(request.data?.stakeCC);
    }
    const { charged, coinsLeft } = await chargeEntryStake(db, uid, request.auth, entryStake);
    if (matchId) {
        // ── 3a. Unirse a sala existente (transacción) ─────────────────────────
        await db.runTransaction(async (tx) => {
            const ref = db.doc(`matches/${matchId}`);
            const snap = await tx.get(ref);
            const d = snap.data();
            const ids = uniquePlayerIds(d.playerIds);
            guard(d.status === 'waiting', 'failed-precondition', 'Sala ya no disponible');
            guard(ids.length < CFG.MAX_PLAYERS, 'failed-precondition', 'Sala llena');
            guard(!ids.includes(uid), 'failed-precondition', 'Ya estás en esta sala');
            const newPlayers = [...d.players, { uid, name: request.auth.token.name ?? 'Jugador', index: ids.length }];
            const newIds = [...ids, uid];
            tx.update(ref, { players: newPlayers, playerIds: newIds, playerCount: newIds.length });
        });
    }
    else {
        // ── 3b. Crear sala nueva ──────────────────────────────────────────────
        const newMatchData = {
            status: 'waiting',
            mode,
            players: [{ uid, name: request.auth.token.name ?? 'Jugador', index: 0 }],
            playerIds: [uid],
            playerCount: 1,
            maxPlayers: CFG.MAX_PLAYERS,
            stakeCC: entryStake,
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
 *   5. Si ok=true → escribe el nuevo estado atómicamente.
 *   6. Si ok=false → lanza HttpsError y la transacción hace rollback automático.
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
        guard(match.turn === turnNumber, 'failed-precondition', `Turno desactualizado (servidor: ${match.turn}, cliente: ${turnNumber}). Recargá el estado.`);
        const privHands = handsFromStorage(priv.hands, match.playerIds.length);
        // ── Reconstruir el motor desde el snapshot ────────────────────────────
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
        // ── Ejecutar la acción ─────────────────────────────────────────────────
        let result;
        switch (action) {
            case 'play': {
                guard(typeof data.cardId === 'number', 'invalid-argument', 'Falta cardId');
                result = engine.play(playerIndex, data.cardId);
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
                break;
            }
        }
        // ── Rollback si el motor rechaza la acción ────────────────────────────
        if (!result.ok) {
            throw new https_1.HttpsError('failed-precondition', result.error);
        }
        const newSnap = engine.toFullSnapshot();
        const newTurn = match.turn + 1;
        // ── Escribir nuevo estado (todo dentro de la misma transacción) ───────
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
        // publicPatch ya escribió status/winner/finishedAt en el match; aquí solo
        // actualizamos los contadores de coins y partidas de cada jugador.
        if (isFinished && winnerUid) {
            const prize = match.stakeCC * match.playerIds.length;
            const loserUid = match.playerIds.find(id => id !== winnerUid) ?? null;
            tx.update(db.doc(`users/${winnerUid}`), {
                wins: firestore_1.FieldValue.increment(1),
                totalGamesPlayed: firestore_1.FieldValue.increment(1),
                ...(prize > 0 ? { ceroCoins: firestore_1.FieldValue.increment(prize) } : {}),
            });
            if (loserUid) {
                tx.update(db.doc(`users/${loserUid}`), { totalGamesPlayed: firestore_1.FieldValue.increment(1) });
            }
        }
        resultPublic = publicPatch;
        resultHand = [...newSnap.hands[playerIndex]];
        resultTurn = newTurn;
        if (isFinished && winnerUid)
            finishedWinner = winnerUid;
    });
    if (finishedWinner) {
        await _onMatchFinishedHooks(matchId, finishedWinner);
    }
    return { ok: true, publicState: resultPublic, myHand: resultHand, turn: resultTurn };
});
// ─────────────────────────────────────────────────────────────────────────────
// leaveMatch — salir de sala en espera (sin cobrar ni penalizar)
// ─────────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────
// temporaryLeaveMatch — salir sin abandonar (5 min para volver)
// ─────────────────────────────────────────────────────────────────────────────
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
        tx.update(ref, {
            [`absences.${uid}`]: {
                rejoinUntil,
                leftAt: firestore_1.FieldValue.serverTimestamp(),
            },
        });
        tx.set(db.doc(`users/${uid}`), {
            activeRejoin: { matchId, rejoinUntil, status: match.status },
        }, { merge: true });
    });
    return { ok: true, rejoinUntil: rejoinUntilMs };
});
// ─────────────────────────────────────────────────────────────────────────────
// getRejoinStatus — consultar si hay partida para reingresar
// ─────────────────────────────────────────────────────────────────────────────
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
    if (!canRejoinMatch(match, uid)) {
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
    const winnerUid = match.playerIds.find(id => id !== uid) ?? '';
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
//# sourceMappingURL=game.js.map