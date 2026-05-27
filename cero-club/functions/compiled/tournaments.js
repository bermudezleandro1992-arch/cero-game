"use strict";
/**
 * Torneos semanales CERO — inscripción, bracket 8 jugadores, premio en CN
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedWeeklyTournament = exports.adminSeedWeeklyTournament = exports.getWeeklyTournament = exports.cancelTournamentRegistration = exports.registerTournament = void 0;
exports.seedBracket = seedBracket;
exports.onTournamentMatchFinished = onTournamentMatchFinished;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const game_1 = require("./game");
const BRACKET_SIZE = 8;
const ENTRY_FEE = 50;
const PRIZE_POOL = 400;
const REGION = 'us-central1';
function guard(cond, code, msg) {
    if (!cond)
        throw new https_1.HttpsError(code, msg);
}
function weekKey(d = new Date()) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${x.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function tournamentDocId(wk) {
    return `weekly-${wk}`;
}
async function assertAdmin(uid) {
    const snap = await (0, firestore_1.getFirestore)().doc(`admins/${uid}`).get();
    guard(snap.exists, 'permission-denied', 'Solo operadores');
}
async function ensureWeeklyDoc(wk) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentDocId(wk));
    const snap = await ref.get();
    if (snap.exists)
        return ref;
    const now = Date.now();
    await ref.set({
        name: `Torneo semanal ${wk}`,
        type: 'weekly',
        weekKey: wk,
        status: 'registration',
        entryFee: ENTRY_FEE,
        prizePool: PRIZE_POOL,
        bracketSize: BRACKET_SIZE,
        participants: [],
        bracket: [],
        currentRound: 0,
        championUid: null,
        createdAt: now,
        startAt: now + 60000,
        lockAt: now + 7 * 24 * 60 * 60 * 1000,
        updatedAt: now,
    });
    return ref;
}
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
async function createTournamentMatch(p1, p2, tournamentId, tournamentRound, bracketSlot) {
    const db = (0, firestore_1.getFirestore)();
    const [u1, u2] = await Promise.all([
        db.doc(`users/${p1}`).get(),
        db.doc(`users/${p2}`).get(),
    ]);
    const matchData = {
        status: 'waiting',
        mode: 'classic',
        players: [
            { uid: p1, name: u1.data()?.displayName ?? 'Jugador', index: 0 },
            { uid: p2, name: u2.data()?.displayName ?? 'Jugador', index: 1 },
        ],
        playerIds: [p1, p2],
        playerCount: 2,
        maxPlayers: 2,
        stakeCC: 0,
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
        tournamentId,
        tournamentRound,
        bracketSlot,
    };
    const ref = await db.collection('matches').add(matchData);
    await (0, game_1.startMatch)(db, ref, matchData);
    return ref.id;
}
async function seedBracket(tournamentId) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentId);
    const snap = await ref.get();
    if (!snap.exists)
        return;
    const t = snap.data();
    if (t.status !== 'registration')
        return;
    let participants = [...(t.participants || [])];
    while (participants.length < BRACKET_SIZE) {
        participants.push(`__bye__${participants.length}`);
    }
    participants = shuffle(participants).slice(0, BRACKET_SIZE);
    const round1 = [];
    for (let i = 0; i < BRACKET_SIZE / 2; i++) {
        round1.push({
            slot: i,
            p1: participants[i * 2],
            p2: participants[i * 2 + 1],
            matchId: null,
            winnerUid: null,
        });
    }
    await ref.update({
        status: 'active',
        participants,
        bracket: [round1],
        currentRound: 1,
        updatedAt: Date.now(),
    });
    await createRoundMatches(tournamentId, 0);
}
async function createRoundMatches(tournamentId, roundIndex) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentId);
    const snap = await ref.get();
    const t = snap.data();
    const bracket = JSON.parse(JSON.stringify(t.bracket));
    const round = bracket[roundIndex];
    if (!round)
        return;
    const updatedRound = [...round];
    for (let i = 0; i < updatedRound.length; i++) {
        const pair = updatedRound[i];
        if (pair.matchId || pair.winnerUid)
            continue;
        const { p1, p2 } = pair;
        if (p1.startsWith('__bye__') && p2.startsWith('__bye__'))
            continue;
        if (p1.startsWith('__bye__')) {
            updatedRound[i] = { ...pair, winnerUid: p2 };
            continue;
        }
        if (p2.startsWith('__bye__')) {
            updatedRound[i] = { ...pair, winnerUid: p1 };
            continue;
        }
        const matchId = await createTournamentMatch(p1, p2, tournamentId, roundIndex + 1, pair.slot);
        updatedRound[i] = { ...pair, matchId };
    }
    bracket[roundIndex] = updatedRound;
    await ref.update({ bracket, updatedAt: Date.now() });
    await resolveByesAndAdvance(tournamentId);
}
async function onTournamentMatchFinished(matchId, winnerUid) {
    if (!winnerUid)
        return;
    const db = (0, firestore_1.getFirestore)();
    const matchSnap = await db.collection('matches').doc(matchId).get();
    if (!matchSnap.exists)
        return;
    const tournamentId = matchSnap.data()?.tournamentId;
    if (!tournamentId)
        return;
    const ref = db.collection('tournaments').doc(tournamentId);
    const tSnap = await ref.get();
    if (!tSnap.exists)
        return;
    const t = tSnap.data();
    if (t.status !== 'active')
        return;
    const bracket = JSON.parse(JSON.stringify(t.bracket));
    let found = false;
    for (let ri = 0; ri < bracket.length && !found; ri++) {
        for (let si = 0; si < (bracket[ri]?.length ?? 0); si++) {
            if (bracket[ri][si].matchId === matchId) {
                bracket[ri][si].winnerUid = winnerUid;
                found = true;
                break;
            }
        }
    }
    if (!found)
        return;
    await ref.update({ bracket, updatedAt: Date.now() });
    await resolveByesAndAdvance(tournamentId);
}
async function resolveByesAndAdvance(tournamentId) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentId);
    const snap = await ref.get();
    const t = snap.data();
    const bracket = JSON.parse(JSON.stringify(t.bracket));
    const roundIndex = bracket.length - 1;
    const round = bracket[roundIndex];
    if (!round)
        return;
    const allDone = round.every((p) => p.winnerUid != null || (p.p1.startsWith('__bye__') && p.p2.startsWith('__bye__')));
    if (!allDone)
        return;
    const winners = round.map((p) => p.winnerUid).filter(Boolean);
    if (winners.length === 1) {
        await awardTournamentWinner(tournamentId, winners[0]);
        return;
    }
    const nextRound = [];
    for (let i = 0; i < winners.length; i += 2) {
        nextRound.push({
            slot: Math.floor(i / 2),
            p1: winners[i],
            p2: winners[i + 1] ?? `__bye__${i}`,
            matchId: null,
            winnerUid: null,
        });
    }
    bracket.push(nextRound);
    await ref.update({
        bracket,
        currentRound: bracket.length,
        updatedAt: Date.now(),
    });
    await createRoundMatches(tournamentId, bracket.length - 1);
}
async function awardTournamentWinner(tournamentId, championUid) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentId);
    const snap = await ref.get();
    const prize = snap.data()?.prizePool ?? PRIZE_POOL;
    const userRef = db.doc(`users/${championUid}`);
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        tx.update(userRef, {
            ceroCoins: (userSnap.data()?.ceroCoins ?? 0) + prize,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(ref, {
            status: 'finished',
            championUid,
            finishedAt: Date.now(),
            updatedAt: Date.now(),
        });
        tx.set(db.collection('coinTransactions').doc(), {
            uid: championUid,
            type: 'tournament_prize',
            amount: prize,
            tournamentId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
}
exports.registerTournament = (0, https_1.onCall)({ region: REGION }, async (req) => {
    const uid = req.auth?.uid;
    guard(uid, 'unauthenticated', 'Iniciá sesión');
    const weekKeyParam = req.data?.weekKey || weekKey();
    const ref = await ensureWeeklyDoc(weekKeyParam);
    const snap = await ref.get();
    const t = snap.data();
    if (t.status !== 'registration') {
        throw new https_1.HttpsError('failed-precondition', 'Inscripciones cerradas.');
    }
    if (t.participants.includes(uid)) {
        return { ok: true, alreadyRegistered: true, tournamentId: ref.id };
    }
    if (t.participants.length >= BRACKET_SIZE) {
        throw new https_1.HttpsError('resource-exhausted', 'Cupos completos (8 jugadores).');
    }
    const db = (0, firestore_1.getFirestore)();
    const userRef = db.doc(`users/${uid}`);
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const balance = userSnap.data()?.ceroCoins ?? 0;
        if (balance < ENTRY_FEE) {
            throw new https_1.HttpsError('failed-precondition', `Necesitás ${ENTRY_FEE} Cero Coins.`);
        }
        tx.update(userRef, {
            ceroCoins: balance - ENTRY_FEE,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(ref, {
            participants: firestore_1.FieldValue.arrayUnion(uid),
            updatedAt: Date.now(),
        });
        tx.set(db.collection('coinTransactions').doc(), {
            uid,
            type: 'tournament_entry',
            amount: -ENTRY_FEE,
            tournamentId: ref.id,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    const after = await ref.get();
    const count = (after.data()?.participants || []).length;
    if (count >= BRACKET_SIZE) {
        await seedBracket(ref.id);
    }
    return { ok: true, tournamentId: ref.id, participants: count };
});
exports.cancelTournamentRegistration = (0, https_1.onCall)({ region: REGION }, async (req) => {
    const uid = req.auth?.uid;
    guard(uid, 'unauthenticated', 'Iniciá sesión');
    const tournamentId = req.data?.tournamentId;
    if (!tournamentId)
        throw new https_1.HttpsError('invalid-argument', 'tournamentId requerido.');
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection('tournaments').doc(tournamentId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Torneo no encontrado.');
    const t = snap.data();
    if (t.status !== 'registration') {
        throw new https_1.HttpsError('failed-precondition', 'El torneo ya empezó.');
    }
    if (!t.participants.includes(uid)) {
        throw new https_1.HttpsError('failed-precondition', 'No estás inscrito.');
    }
    const userRef = db.doc(`users/${uid}`);
    await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        tx.update(userRef, {
            ceroCoins: (userSnap.data()?.ceroCoins ?? 0) + ENTRY_FEE,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(ref, {
            participants: firestore_1.FieldValue.arrayRemove(uid),
            updatedAt: Date.now(),
        });
    });
    return { ok: true };
});
exports.getWeeklyTournament = (0, https_1.onCall)({ region: REGION }, async (req) => {
    if (!req.auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Iniciá sesión');
    const wk = req.data?.weekKey || weekKey();
    const ref = await ensureWeeklyDoc(wk);
    const snap = await ref.get();
    const t = snap.data();
    const participants = (t.participants || []).filter((id) => !id.startsWith('__bye__'));
    const names = {};
    await Promise.all(participants.map(async (pid) => {
        const u = await (0, firestore_1.getFirestore)().doc(`users/${pid}`).get();
        names[pid] = u.data()?.displayName || pid.slice(0, 8);
    }));
    return {
        tournamentId: ref.id,
        weekKey: wk,
        status: t.status,
        entryFee: t.entryFee,
        prizePool: t.prizePool,
        participants,
        participantCount: participants.length,
        bracketSize: BRACKET_SIZE,
        bracket: t.bracket || [],
        currentRound: t.currentRound || 0,
        championUid: t.championUid || null,
        names,
    };
});
exports.adminSeedWeeklyTournament = (0, https_1.onCall)({ region: REGION }, async (req) => {
    guard(req.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(req.auth.uid);
    const wk = req.data?.weekKey || weekKey();
    const ref = await ensureWeeklyDoc(wk);
    if (req.data?.forceSeed) {
        await seedBracket(ref.id);
    }
    return { ok: true, tournamentId: ref.id, weekKey: wk };
});
exports.seedWeeklyTournament = (0, scheduler_1.onSchedule)({ schedule: '0 12 * * 1', timeZone: 'America/Argentina/Buenos_Aires', region: REGION }, async () => {
    await ensureWeeklyDoc(weekKey());
});
//# sourceMappingURL=tournaments.js.map