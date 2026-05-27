"use strict";
/**
 * functions/src/tournaments.ts
 *
 * Sistema de torneos para CERO.
 *
 * Esquema Firestore:
 *
 *   tournaments/{id}
 *     name:             string
 *     description:      string
 *     mode:             'classic' | 'cero'
 *     entryFee:         number          — CC para inscribirse (0 = gratis)
 *     prizePool:        number          — CC acumulados del pozo
 *     guaranteedPrize:  number          — CC garantizados por el organizador
 *     maxPlayers:       number
 *     minPlayers:       number          — mínimo para iniciar
 *     registrationDeadline: Timestamp
 *     startTime:        Timestamp       — hora programada de inicio
 *     status:           'upcoming' | 'open' | 'in_progress' | 'finished' | 'cancelled'
 *     participantIds:   string[]
 *     participantCount: number
 *     winnerId:         string | null
 *     runnerUpId:       string | null
 *     prizeDistribution: { first: number; second?: number; third?: number } (% del pozo)
 *     createdAt:        Timestamp
 *     createdBy:        string          — uid del admin
 *     finishedAt:       Timestamp | null
 *
 *   tournaments/{id}/registrations/{uid}
 *     uid:          string
 *     displayName:  string
 *     registeredAt: Timestamp
 *     seed:         number | null
 *     eliminated:   boolean
 *     position:     number | null       — posición final
 *
 * Cloud Functions exportadas:
 *   registerTournament          — jugador: inscribirse pagando entryFee
 *   cancelTournamentRegistration — jugador: cancelar (si status = 'open')
 *   awardTournamentPrizes        — admin: distribuir premios al terminar
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.awardTournamentPrizes = exports.cancelTournamentRegistration = exports.registerTournament = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────
const REGION = 'us-central1';
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
/**
 * Inscribe al jugador en un torneo, descontando el entryFee de forma atómica.
 *
 * Condiciones para inscribirse:
 *   · status = 'open'
 *   · No inscripto previamente
 *   · registration deadline no superada
 *   · Sala no llena
 *   · Saldo >= entryFee (a menos que entryFee = 0 o sea VIP con fee <= 50)
 */
exports.registerTournament = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 30 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const displayName = request.auth.token.name ?? 'Jugador';
    const tournamentId = request.data.tournamentId;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');
    const db = (0, firestore_1.getFirestore)();
    const tournRef = db.doc(`tournaments/${tournamentId}`);
    const regRef = db.doc(`tournaments/${tournamentId}/registrations/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    let coinsLeft = 0;
    await db.runTransaction(async (tx) => {
        const [tournSnap, regSnap, userSnap] = await Promise.all([
            tx.get(tournRef),
            tx.get(regRef),
            tx.get(userRef),
        ]);
        guard(tournSnap.exists, 'not-found', 'Torneo no encontrado');
        const tourn = tournSnap.data();
        guard(tourn.status === 'open', 'failed-precondition', 'El torneo no está abierto para inscripciones');
        guard(!regSnap.exists, 'already-exists', 'Ya estás inscripto en este torneo');
        guard(tourn.participantCount < tourn.maxPlayers, 'resource-exhausted', 'El torneo está lleno');
        guard(tourn.registrationDeadline.toMillis() > Date.now(), 'failed-precondition', 'El plazo de inscripción ya cerró');
        const user = (userSnap.data() ?? {});
        const balance = user.ceroCoins ?? 0;
        const fee = tourn.entryFee;
        // VIP no paga si el entryFee es <= 100 CC
        const isVIP = !!(user.vip?.active === true &&
            (user.vip.expiresAt?.toMillis() ?? 0) > Date.now());
        const effectiveFee = (isVIP && fee <= 100) ? 0 : fee;
        guard(balance >= effectiveFee, 'resource-exhausted', `Saldo insuficiente. Necesitás ${effectiveFee} CC, tenés ${balance}.`);
        if (effectiveFee > 0) {
            tx.update(userRef, { ceroCoins: firestore_1.FieldValue.increment(-effectiveFee) });
            coinsLeft = balance - effectiveFee;
        }
        else {
            coinsLeft = balance;
        }
        // Registrar inscripción
        const regDoc = {
            uid,
            displayName,
            registeredAt: firestore_1.FieldValue.serverTimestamp(),
            seed: null,
            eliminated: false,
            position: null,
        };
        tx.set(regRef, regDoc);
        // Actualizar torneo: sumar al pozo y contador
        tx.update(tournRef, {
            participantIds: firestore_1.FieldValue.arrayUnion(uid),
            participantCount: firestore_1.FieldValue.increment(1),
            prizePool: firestore_1.FieldValue.increment(effectiveFee),
        });
    });
    const finalTourn = (await tournRef.get()).data();
    return {
        ok: true,
        position: finalTourn.participantCount,
        charged: true,
        coinsLeft,
    };
});
/**
 * Cancela la inscripción de un jugador y devuelve el entryFee.
 * Solo disponible mientras status = 'open'.
 */
exports.cancelTournamentRegistration = (0, https_1.onCall)({ region: REGION }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');
    const uid = request.auth.uid;
    const tournamentId = request.data.tournamentId;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');
    const db = (0, firestore_1.getFirestore)();
    const tournRef = db.doc(`tournaments/${tournamentId}`);
    const regRef = db.doc(`tournaments/${tournamentId}/registrations/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    let refunded = 0;
    await db.runTransaction(async (tx) => {
        const [tournSnap, regSnap] = await Promise.all([tx.get(tournRef), tx.get(regRef)]);
        guard(tournSnap.exists, 'not-found', 'Torneo no encontrado');
        guard(regSnap.exists, 'not-found', 'No estás inscripto en este torneo');
        const tourn = tournSnap.data();
        guard(tourn.status === 'open', 'failed-precondition', 'Solo podés cancelar mientras el torneo esté abierto');
        refunded = tourn.entryFee;
        tx.delete(regRef);
        tx.update(tournRef, {
            participantIds: firestore_1.FieldValue.arrayRemove(uid),
            participantCount: firestore_1.FieldValue.increment(-1),
            prizePool: firestore_1.FieldValue.increment(-refunded),
        });
        if (refunded > 0) {
            tx.update(userRef, { ceroCoins: firestore_1.FieldValue.increment(refunded) });
        }
    });
    return { ok: true, refunded };
});
/**
 * Cierra el torneo, registra los resultados y distribuye el premio.
 * Solo puede ser llamada por admins.
 *
 * `prizeDistribution` define los % para cada posición.
 * Si hay `guaranteedPrize`, se agrega al pozo antes de distribuir.
 */
exports.awardTournamentPrizes = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 60 }, async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const adminSnap = await db.doc(`admins/${callerUid}`).get();
    guard(adminSnap.exists, 'permission-denied', 'Solo operadores pueden distribuir premios');
    const { tournamentId, results } = request.data;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');
    guard(Array.isArray(results) && results.length > 0, 'invalid-argument', 'Falta results');
    const tournRef = db.doc(`tournaments/${tournamentId}`);
    const tournSnap = await tournRef.get();
    guard(tournSnap.exists, 'not-found', 'Torneo no encontrado');
    const tourn = tournSnap.data();
    guard(tourn.status === 'in_progress' || tourn.status === 'open', 'failed-precondition', 'El torneo ya fue procesado o cancelado');
    // Calcular premios
    const totalPot = tourn.prizePool + tourn.guaranteedPrize;
    const dist = tourn.prizeDistribution;
    const awarded = [];
    const prizeByPosition = {
        1: Math.floor(totalPot * (dist.first / 100)),
        2: Math.floor(totalPot * ((dist.second ?? 0) / 100)),
        3: Math.floor(totalPot * ((dist.third ?? 0) / 100)),
    };
    const batch = db.batch();
    // Actualizar registraciones
    for (const r of results) {
        const regRef = db.doc(`tournaments/${tournamentId}/registrations/${r.uid}`);
        batch.update(regRef, { position: r.position, eliminated: true });
        const coins = prizeByPosition[r.position] ?? 0;
        if (coins > 0) {
            batch.update(db.doc(`users/${r.uid}`), {
                ceroCoins: firestore_1.FieldValue.increment(coins),
                totalGamesPlayed: firestore_1.FieldValue.increment(1),
                ...(r.position === 1 ? { wins: firestore_1.FieldValue.increment(1) } : {}),
            });
            awarded.push({ uid: r.uid, coins, position: r.position });
        }
    }
    const winner = results.find(r => r.position === 1)?.uid ?? null;
    const runnerUp = results.find(r => r.position === 2)?.uid ?? null;
    batch.update(tournRef, {
        status: 'finished',
        winnerId: winner,
        runnerUpId: runnerUp,
        finishedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    // Ledger
    for (const a of awarded) {
        await db.collection('coin_ledger').add({
            uid: a.uid,
            amount: a.coins,
            type: 'tournament_prize',
            tournamentId,
            position: a.position,
            grantedBy: callerUid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return { ok: true, awarded };
});
//# sourceMappingURL=tournaments.js.map