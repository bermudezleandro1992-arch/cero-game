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

import { onCall, HttpsError }      from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction }         from 'firebase-admin/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

const REGION = 'us-central1';

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type TournamentStatus = 'upcoming' | 'open' | 'in_progress' | 'finished' | 'cancelled';

interface PrizeDistribution {
  first:   number;   // % del prizePool (ej: 70)
  second?: number;   // % (ej: 20)
  third?:  number;   // % (ej: 10)
}

interface TournamentDoc {
  name:                  string;
  description:           string;
  mode:                  'classic' | 'cero';
  entryFee:              number;
  prizePool:             number;
  guaranteedPrize:       number;
  maxPlayers:            number;
  minPlayers:            number;
  registrationDeadline:  FirebaseFirestore.Timestamp;
  startTime:             FirebaseFirestore.Timestamp;
  status:                TournamentStatus;
  participantIds:        string[];
  participantCount:      number;
  winnerId:              string | null;
  runnerUpId:            string | null;
  prizeDistribution:     PrizeDistribution;
  createdBy:             string;
  createdAt:             FirebaseFirestore.FieldValue;
  finishedAt:            FirebaseFirestore.FieldValue | null;
}

interface RegistrationDoc {
  uid:          string;
  displayName:  string;
  registeredAt: FirebaseFirestore.FieldValue;
  seed:         number | null;
  eliminated:   boolean;
  position:     number | null;
}

interface UserDoc {
  ceroCoins:  number;
  vip?:       { active: boolean; expiresAt: FirebaseFirestore.Timestamp };
}

// ─────────────────────────────────────────────────────────────────────────────
// registerTournament
// ─────────────────────────────────────────────────────────────────────────────

interface RegisterRequest  { tournamentId: string }
interface RegisterResponse { ok: true; position: number; charged: boolean; coinsLeft: number }

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
export const registerTournament = onCall<RegisterRequest, Promise<RegisterResponse>>(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid          = request.auth!.uid;
    const displayName  = request.auth!.token.name ?? 'Jugador';
    const tournamentId = request.data.tournamentId;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');

    const db          = getFirestore();
    const tournRef    = db.doc(`tournaments/${tournamentId}`);
    const regRef      = db.doc(`tournaments/${tournamentId}/registrations/${uid}`);
    const userRef     = db.doc(`users/${uid}`);

    let coinsLeft = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const [tournSnap, regSnap, userSnap] = await Promise.all([
        tx.get(tournRef),
        tx.get(regRef),
        tx.get(userRef),
      ]);

      guard(tournSnap.exists, 'not-found', 'Torneo no encontrado');
      const tourn = tournSnap.data() as TournamentDoc;

      guard(tourn.status === 'open',                       'failed-precondition', 'El torneo no está abierto para inscripciones');
      guard(!regSnap.exists,                               'already-exists',      'Ya estás inscripto en este torneo');
      guard(tourn.participantCount < tourn.maxPlayers,     'resource-exhausted',  'El torneo está lleno');
      guard(
        tourn.registrationDeadline.toMillis() > Date.now(),
        'failed-precondition',
        'El plazo de inscripción ya cerró',
      );

      const user    = (userSnap.data() ?? {}) as UserDoc;
      const balance = user.ceroCoins ?? 0;
      const fee     = tourn.entryFee;

      // VIP no paga si el entryFee es <= 100 CC
      const isVIP = !!(
        user.vip?.active === true &&
        (user.vip.expiresAt?.toMillis() ?? 0) > Date.now()
      );
      const effectiveFee = (isVIP && fee <= 100) ? 0 : fee;

      guard(
        balance >= effectiveFee,
        'resource-exhausted',
        `Saldo insuficiente. Necesitás ${effectiveFee} CC, tenés ${balance}.`,
      );

      if (effectiveFee > 0) {
        tx.update(userRef, { ceroCoins: FieldValue.increment(-effectiveFee) });
        coinsLeft = balance - effectiveFee;
      } else {
        coinsLeft = balance;
      }

      // Registrar inscripción
      const regDoc: RegistrationDoc = {
        uid,
        displayName,
        registeredAt: FieldValue.serverTimestamp(),
        seed:         null,
        eliminated:   false,
        position:     null,
      };
      tx.set(regRef, regDoc);

      // Actualizar torneo: sumar al pozo y contador
      tx.update(tournRef, {
        participantIds:   FieldValue.arrayUnion(uid),
        participantCount: FieldValue.increment(1),
        prizePool:        FieldValue.increment(effectiveFee),
      });
    });

    const finalTourn  = (await tournRef.get()).data() as TournamentDoc;
    return {
      ok:       true,
      position: finalTourn.participantCount,
      charged:  true,
      coinsLeft,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// cancelTournamentRegistration
// ─────────────────────────────────────────────────────────────────────────────

interface CancelRegResponse { ok: true; refunded: number }

/**
 * Cancela la inscripción de un jugador y devuelve el entryFee.
 * Solo disponible mientras status = 'open'.
 */
export const cancelTournamentRegistration = onCall<RegisterRequest, Promise<CancelRegResponse>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid          = request.auth!.uid;
    const tournamentId = request.data.tournamentId;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');

    const db       = getFirestore();
    const tournRef = db.doc(`tournaments/${tournamentId}`);
    const regRef   = db.doc(`tournaments/${tournamentId}/registrations/${uid}`);
    const userRef  = db.doc(`users/${uid}`);

    let refunded = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const [tournSnap, regSnap] = await Promise.all([tx.get(tournRef), tx.get(regRef)]);

      guard(tournSnap.exists, 'not-found',          'Torneo no encontrado');
      guard(regSnap.exists,   'not-found',          'No estás inscripto en este torneo');

      const tourn = tournSnap.data() as TournamentDoc;
      guard(tourn.status === 'open', 'failed-precondition', 'Solo podés cancelar mientras el torneo esté abierto');

      refunded = tourn.entryFee;

      tx.delete(regRef);
      tx.update(tournRef, {
        participantIds:   FieldValue.arrayRemove(uid),
        participantCount: FieldValue.increment(-1),
        prizePool:        FieldValue.increment(-refunded),
      });

      if (refunded > 0) {
        tx.update(userRef, { ceroCoins: FieldValue.increment(refunded) });
      }
    });

    return { ok: true, refunded };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// awardTournamentPrizes — admin: distribuye el pozo al terminar
// ─────────────────────────────────────────────────────────────────────────────

interface AwardPrizesRequest {
  tournamentId: string;
  results: Array<{        // posiciones finales (orden: 1.°, 2.°, 3.°…)
    uid:      string;
    position: number;
  }>;
}

interface AwardPrizesResponse {
  ok:      true;
  awarded: Array<{ uid: string; coins: number; position: number }>;
}

/**
 * Cierra el torneo, registra los resultados y distribuye el premio.
 * Solo puede ser llamada por admins.
 *
 * `prizeDistribution` define los % para cada posición.
 * Si hay `guaranteedPrize`, se agrega al pozo antes de distribuir.
 */
export const awardTournamentPrizes = onCall<AwardPrizesRequest, Promise<AwardPrizesResponse>>(
  { region: REGION, timeoutSeconds: 60 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid   = request.auth!.uid;

    const db          = getFirestore();
    const adminSnap   = await db.doc(`admins/${callerUid}`).get();
    guard(adminSnap.exists, 'permission-denied', 'Solo operadores pueden distribuir premios');

    const { tournamentId, results } = request.data;
    guard(typeof tournamentId === 'string' && tournamentId, 'invalid-argument', 'Falta tournamentId');
    guard(Array.isArray(results) && results.length > 0,     'invalid-argument', 'Falta results');

    const tournRef  = db.doc(`tournaments/${tournamentId}`);
    const tournSnap = await tournRef.get();
    guard(tournSnap.exists, 'not-found', 'Torneo no encontrado');

    const tourn = tournSnap.data() as TournamentDoc;
    guard(
      tourn.status === 'in_progress' || tourn.status === 'open',
      'failed-precondition',
      'El torneo ya fue procesado o cancelado',
    );

    // Calcular premios
    const totalPot  = tourn.prizePool + tourn.guaranteedPrize;
    const dist      = tourn.prizeDistribution;
    const awarded: AwardPrizesResponse['awarded'] = [];

    const prizeByPosition: Record<number, number> = {
      1: Math.floor(totalPot * (dist.first  / 100)),
      2: Math.floor(totalPot * ((dist.second ?? 0) / 100)),
      3: Math.floor(totalPot * ((dist.third  ?? 0) / 100)),
    };

    const batch = db.batch();

    // Actualizar registraciones
    for (const r of results) {
      const regRef = db.doc(`tournaments/${tournamentId}/registrations/${r.uid}`);
      batch.update(regRef, { position: r.position, eliminated: true });

      const coins = prizeByPosition[r.position] ?? 0;
      if (coins > 0) {
        batch.update(db.doc(`users/${r.uid}`), {
          ceroCoins:        FieldValue.increment(coins),
          totalGamesPlayed: FieldValue.increment(1),
          ...(r.position === 1 ? { wins: FieldValue.increment(1) } : {}),
        });
        awarded.push({ uid: r.uid, coins, position: r.position });
      }
    }

    const winner    = results.find(r => r.position === 1)?.uid ?? null;
    const runnerUp  = results.find(r => r.position === 2)?.uid ?? null;

    batch.update(tournRef, {
      status:      'finished',
      winnerId:    winner,
      runnerUpId:  runnerUp,
      finishedAt:  FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Ledger
    for (const a of awarded) {
      await db.collection('coin_ledger').add({
        uid:          a.uid,
        amount:       a.coins,
        type:         'tournament_prize',
        tournamentId,
        position:     a.position,
        grantedBy:    callerUid,
        createdAt:    FieldValue.serverTimestamp(),
      });
    }

    return { ok: true, awarded };
  },
);
