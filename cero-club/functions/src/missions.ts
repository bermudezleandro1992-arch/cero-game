/**
 * functions/src/missions.ts
 *
 * Sistema de misiones para CERO.
 *
 * Esquema Firestore:
 *
 *   missions/{missionId}              — definición global (inmutable por jugadores)
 *     id:          string
 *     title:       string             — "Ganar 3 partidas hoy"
 *     description: string
 *     type:        'daily' | 'weekly' | 'permanent'
 *     requirement: { action: MissionAction; count: number }
 *     reward:      { coins: number; xp?: number }
 *     active:      boolean
 *     order:       number             — orden de display
 *
 *   users/{uid}/mission_progress/{missionId}
 *     missionId:     string
 *     progress:      number           — progreso actual
 *     goal:          number           — copia de requirement.count (para display rápido)
 *     completed:     boolean
 *     rewardClaimed: boolean
 *     completedAt:   Timestamp | null
 *     resetAt:       Timestamp | null — próximo reset (daily/weekly)
 *
 * Cloud Functions exportadas:
 *   claimMissionReward    — jugador: reclama el premio de una misión completada
 *   onMatchFinished       — Firestore trigger: actualiza progreso cuando termina una partida
 *   resetDailyMissions    — Scheduler: resetea misiones diarias a las 00:00 UTC
 *   resetWeeklyMissions   — Scheduler: resetea misiones semanales los lunes a las 00:00 UTC
 *   seedMissions          — admin: siembra las definiciones en Firestore (setup único)
 */

import { onCall, HttpsError }            from 'firebase-functions/v2/https';
import { onSchedule }                    from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated }             from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Transaction }                    from 'firebase-admin/firestore';

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

type MissionType   = 'daily' | 'weekly' | 'permanent';
type MissionAction = 'win' | 'play' | 'declare_cero' | 'play_wild';

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de misiones predefinidas
// ─────────────────────────────────────────────────────────────────────────────

export interface MissionDef {
  id:          string;
  title:       string;
  description: string;
  type:        MissionType;
  requirement: { action: MissionAction; count: number };
  reward:      { coins: number; xp?: number };
  active:      boolean;
  order:       number;
}

export const MISSION_CATALOG: MissionDef[] = [
  // ── Permanentes (one-shot) ────────────────────────────────────────────────
  {
    id:          'first_win',
    title:       'Primera victoria',
    description: 'Ganá tu primera partida de CERO.',
    type:        'permanent',
    requirement: { action: 'win',  count: 1 },
    reward:      { coins: 25, xp: 50 },
    active:      true,
    order:       1,
  },
  {
    id:          'collector_20',
    title:       'Veterano',
    description: 'Jugá 20 partidas en total.',
    type:        'permanent',
    requirement: { action: 'play', count: 20 },
    reward:      { coins: 200, xp: 200 },
    active:      true,
    order:       2,
  },

  // ── Diarias ───────────────────────────────────────────────────────────────
  {
    id:          'daily_3wins',
    title:       'Ráfaga ganadora',
    description: 'Ganá 3 partidas hoy.',
    type:        'daily',
    requirement: { action: 'win',  count: 3 },
    reward:      { coins: 50, xp: 100 },
    active:      true,
    order:       10,
  },
  {
    id:          'daily_5games',
    title:       'Jugador activo',
    description: 'Jugá 5 partidas hoy.',
    type:        'daily',
    requirement: { action: 'play', count: 5 },
    reward:      { coins: 30, xp: 60 },
    active:      true,
    order:       11,
  },
  {
    id:          'daily_cero',
    title:       '¡CERO del día!',
    description: 'Declaró CERO 3 veces hoy.',
    type:        'daily',
    requirement: { action: 'declare_cero', count: 3 },
    reward:      { coins: 20, xp: 40 },
    active:      true,
    order:       12,
  },

  // ── Semanales ─────────────────────────────────────────────────────────────
  {
    id:          'weekly_5wins',
    title:       'Invicto',
    description: 'Ganá 5 partidas esta semana.',
    type:        'weekly',
    requirement: { action: 'win',  count: 5 },
    reward:      { coins: 150, xp: 250 },
    active:      true,
    order:       20,
  },
  {
    id:          'weekly_cero_master',
    title:       'Maestro del CERO',
    description: 'Declaró CERO 10 veces esta semana.',
    type:        'weekly',
    requirement: { action: 'declare_cero', count: 10 },
    reward:      { coins: 100, xp: 200 },
    active:      true,
    order:       21,
  },
  {
    id:          'weekly_wildcards',
    title:       'Comodín salvaje',
    description: 'Jugá 15 comodines esta semana.',
    type:        'weekly',
    requirement: { action: 'play_wild', count: 15 },
    reward:      { coins: 80, xp: 150 },
    active:      true,
    order:       22,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tipos Firestore
// ─────────────────────────────────────────────────────────────────────────────

interface MissionProgress {
  missionId:     string;
  progress:      number;
  goal:          number;
  completed:     boolean;
  rewardClaimed: boolean;
  completedAt:   FirebaseFirestore.FieldValue | null;
  resetAt:       FirebaseFirestore.Timestamp | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nextDailyReset(): FirebaseFirestore.Timestamp {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function nextWeeklyReset(): FirebaseFirestore.Timestamp {
  const d         = new Date();
  const dayOfW    = d.getUTCDay();
  const daysToMon = (8 - dayOfW) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysToMon);
  d.setUTCHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

/**
 * Incrementa el progreso de las misiones activas que coincidan con `action`.
 * Crea el doc de progreso si no existe.
 * Llama `FieldValue.increment` dentro de un batch para eficiencia.
 */
/** Expuesto para game.ts — registrar acciones en tiempo real (comodín, CERO, etc.) */
export async function trackMissionAction(
  db:     FirebaseFirestore.Firestore,
  uid:    string,
  action: MissionAction,
): Promise<void> {
  return _updateMissionProgress(db, uid, action);
}

async function _updateMissionProgress(
  db:     FirebaseFirestore.Firestore,
  uid:    string,
  action: MissionAction,
): Promise<void> {
  const now          = new Date();
  const activeMissions = MISSION_CATALOG.filter(
    m => m.active && m.requirement.action === action,
  );
  if (!activeMissions.length) return;

  const batch = db.batch();

  for (const mission of activeMissions) {
    const progRef   = db.doc(`users/${uid}/mission_progress/${mission.id}`);
    const progSnap  = await progRef.get();

    if (progSnap.exists) {
      const prog = progSnap.data() as MissionProgress;

      // Si es daily/weekly y pasó el resetAt, reiniciar
      const shouldReset =
        mission.type !== 'permanent' &&
        prog.resetAt !== null &&
        prog.resetAt.toMillis() <= now.getTime();

      if (shouldReset) {
        batch.set(progRef, {
          missionId:     mission.id,
          progress:      1,
          goal:          mission.requirement.count,
          completed:     mission.requirement.count === 1,
          rewardClaimed: false,
          completedAt:   mission.requirement.count === 1 ? FieldValue.serverTimestamp() : null,
          resetAt:       (mission.type === 'daily' ? nextDailyReset() : nextWeeklyReset()) as unknown as FirebaseFirestore.Timestamp,
        } satisfies MissionProgress);
        continue;
      }

      // Si ya completó y es permanent, no incrementar
      if (prog.completed && mission.type === 'permanent') continue;

      // Si ya completó (no permanent), seguir contando para display
      const newProgress = prog.progress + 1;
      const nowComplete = !prog.completed && newProgress >= mission.requirement.count;

      batch.update(progRef, {
        progress:     FieldValue.increment(1),
        ...(nowComplete ? {
          completed:   true,
          completedAt: FieldValue.serverTimestamp(),
        } : {}),
      });
    } else {
      // Primera vez que se registra progreso en esta misión
      const resetAt: FirebaseFirestore.Timestamp | null =
        mission.type === 'daily'   ? nextDailyReset() as unknown as FirebaseFirestore.Timestamp :
        mission.type === 'weekly'  ? nextWeeklyReset() as unknown as FirebaseFirestore.Timestamp :
        null;

      const firstComplete = mission.requirement.count === 1;

      batch.set(progRef, {
        missionId:     mission.id,
        progress:      1,
        goal:          mission.requirement.count,
        completed:     firstComplete,
        rewardClaimed: false,
        completedAt:   firstComplete ? FieldValue.serverTimestamp() : null,
        resetAt:       resetAt ? resetAt : null,
      } satisfies MissionProgress);
    }
  }

  await batch.commit();
}

// ─────────────────────────────────────────────────────────────────────────────
// claimMissionReward — jugador reclama el premio de una misión completada
// ─────────────────────────────────────────────────────────────────────────────

interface ClaimRequest  { missionId: string }
interface ClaimResponse { ok: true; coins: number; xp: number }

export const claimMissionReward = onCall<ClaimRequest, Promise<ClaimResponse>>(
  { region: REGION, timeoutSeconds: 30 },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid       = request.auth!.uid;
    const missionId = request.data.missionId;
    guard(typeof missionId === 'string' && missionId, 'invalid-argument', 'Falta missionId');

    // Buscar definición en catálogo
    const missionDef = MISSION_CATALOG.find(m => m.id === missionId);
    guard(missionDef, 'not-found', `Misión "${missionId}" no encontrada`);
    guard(missionDef.active, 'failed-precondition', 'Esta misión no está activa');

    const db      = getFirestore();
    const progRef = db.doc(`users/${uid}/mission_progress/${missionId}`);
    const userRef = db.doc(`users/${uid}`);

    let coinsAwarded = 0;
    let xpAwarded    = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const [progSnap, userSnap] = await Promise.all([tx.get(progRef), tx.get(userRef)]);

      guard(progSnap.exists,    'not-found',          'No tenés progreso en esta misión');
      const prog = progSnap.data() as MissionProgress;

      guard(prog.completed,     'failed-precondition', 'Todavía no completaste esta misión');
      guard(!prog.rewardClaimed,'already-exists',      'Ya reclamaste el premio de esta misión');

      coinsAwarded = missionDef.reward.coins;
      xpAwarded    = missionDef.reward.xp ?? 0;

      tx.update(progRef, { rewardClaimed: true });

      if (userSnap.exists) {
        tx.update(userRef, {
          ceroCoins: FieldValue.increment(coinsAwarded),
          ...(xpAwarded > 0 ? { xp: FieldValue.increment(xpAwarded) } : {}),
        });
      } else {
        tx.set(userRef, {
          ceroCoins: coinsAwarded,
          xp:        xpAwarded,
        }, { merge: true });
      }
    });

    // Ledger
    await db.collection('coin_ledger').add({
      uid,
      amount:    coinsAwarded,
      type:      'mission_reward',
      missionId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, coins: coinsAwarded, xp: xpAwarded };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// onMatchFinished — Firestore trigger al cerrar una partida
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Se dispara cuando un documento `matches/{matchId}` pasa a status='finished'.
 * Actualiza el progreso de misiones para el ganador (acción: 'win') y ambos
 * jugadores (acción: 'play').
 *
 * También cuenta declaraciones de CERO y comodines desde lastAction.
 */
export const onMatchFinished = onDocumentUpdated(
  { document: 'matches/{matchId}', region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();

    // Solo reaccionar a la transición waiting/playing → finished
    if (!before || !after) return;
    if (before['status'] === 'finished') return;
    if (after['status']  !== 'finished') return;

    const db        = getFirestore();
    const playerIds = (after['playerIds'] as string[] | undefined) ?? [];
    const winnerUid = (after['winner']    as string | null) ?? null;

    // Promesas independientes para no bloquear
    const updates: Promise<void>[] = [];

    // Acción 'play' para todos los jugadores
    for (const uid of playerIds) {
      updates.push(_updateMissionProgress(db, uid, 'play'));
    }

    // Acción 'win' para el ganador + compañero en 2v2
    if (winnerUid) {
      updates.push(_updateMissionProgress(db, winnerUid, 'win'));
      const matchFormat = after['format'] as string | undefined;
      if (matchFormat === '2v2' && playerIds.length >= 4) {
        const winIdx = playerIds.indexOf(winnerUid);
        if (winIdx >= 0) {
          const partnerUid = playerIds[(winIdx + 2) % 4];
          if (partnerUid && partnerUid !== winnerUid) {
            updates.push(_updateMissionProgress(db, partnerUid, 'win'));
          }
        }
      }
      updates.push(
        (async () => {
          const userSnap = await db.doc(`users/${winnerUid}`).get();
          const isGuest  = userSnap.data()?.['isGuest'] === true
                        || userSnap.data()?.['anon'] === true;
          if (isGuest) return;
          await db.doc(`users/${winnerUid}`).update({
            weeklyWins:  FieldValue.increment(1),
            monthlyWins: FieldValue.increment(1),
            rankScore:   FieldValue.increment(10),
          });
        })(),
      );
    }

    // declare_cero y play_wild se acreditan en playTurn (trackMissionAction).
    // Fallback: última acción al cerrar partida.
    const lastAction = after['lastAction'] as { type?: string; uid?: string } | null;
    if (lastAction?.type === 'declareCero' && lastAction?.uid) {
      updates.push(_updateMissionProgress(db, lastAction.uid, 'declare_cero'));
    }

    await Promise.allSettled(updates);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// resetDailyMissions — 00:00 UTC todos los días
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resetea el progreso de misiones diarias que ya vencieron.
 * Nota: el reset también ocurre lazily en _updateMissionProgress, pero
 * este scheduled job garantiza consistencia aunque el usuario no juegue.
 */
export const resetDailyMissions = onSchedule(
  { schedule: '0 0 * * *', region: REGION, timeoutSeconds: 540 },
  async () => {
    const db  = getFirestore();
    const now = new Date();

    // Buscar progreso con resetAt en el pasado, para misiones diarias
    const toReset = await db.collectionGroup('mission_progress')
      .where('resetAt', '<=', now)
      .where('completed', '==', true)
      .get();

    const BATCH_SIZE = 400;
    for (let i = 0; i < toReset.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const docSnap of toReset.docs.slice(i, i + BATCH_SIZE)) {
        const prog = docSnap.data() as MissionProgress;
        const def  = MISSION_CATALOG.find(m => m.id === prog.missionId);
        if (!def || def.type === 'permanent') continue;

        const nextReset = def.type === 'daily' ? nextDailyReset() : nextWeeklyReset();
        if (nextReset.toMillis() <= now.getTime()) continue;  // weekly que aún no vence

        batch.update(docSnap.ref, {
          progress:      0,
          completed:     false,
          rewardClaimed: false,
          completedAt:   null,
          resetAt:       nextReset,
        });
      }
      await batch.commit();
    }

    console.info('[resetDailyMissions] completado');
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// resetWeeklyMissions — lunes 00:00 UTC
// ─────────────────────────────────────────────────────────────────────────────

export const resetWeeklyMissions = onSchedule(
  { schedule: '0 0 * * 1', region: REGION, timeoutSeconds: 540 },
  async () => {
    const db  = getFirestore();
    const now = new Date();

    const weeklyIds = MISSION_CATALOG
      .filter(m => m.type === 'weekly')
      .map(m => m.id);

    if (!weeklyIds.length) return;

    const toReset = await db.collectionGroup('mission_progress')
      .where('missionId', 'in', weeklyIds.slice(0, 10))   // Firestore 'in' limit = 10
      .get();

    const BATCH_SIZE = 400;
    for (let i = 0; i < toReset.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const docSnap of toReset.docs.slice(i, i + BATCH_SIZE)) {
        batch.update(docSnap.ref, {
          progress:      0,
          completed:     false,
          rewardClaimed: false,
          completedAt:   null,
          resetAt:       nextWeeklyReset(),
        });
      }
      await batch.commit();
    }

    console.info('[resetWeeklyMissions] completado');
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// seedMissions — admin: siembra las definiciones en Firestore (una sola vez)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedMissionsToFirestore(
  db: FirebaseFirestore.Firestore,
): Promise<number> {
  const batch = db.batch();
  for (const def of MISSION_CATALOG) {
    batch.set(db.doc(`missions/${def.id}`), def, { merge: true });
  }
  await batch.commit();
  return MISSION_CATALOG.length;
}

export const seedMissions = onCall<Record<string, never>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    const callerUid = request.auth!.uid;

    const db        = getFirestore();
    const adminSnap = await db.doc(`admins/${callerUid}`).get();
    guard(adminSnap.exists, 'permission-denied', 'Solo operadores pueden sembrar misiones');

    const seeded = await seedMissionsToFirestore(db);
    return { ok: true, seeded };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// checkMissions — callable: el cliente llama a esta función después de cada
// partida para asegurarse de que el progreso de misiones esté actualizado.
// Es un seguro ante posibles fallos del trigger onMatchFinished.
// ─────────────────────────────────────────────────────────────────────────────

export const checkMissions = onCall<{ matchId: string }>(
  { region: REGION },
  async (request) => {
    const uid = request.auth?.uid;
    guard(uid, 'unauthenticated', 'Iniciá sesión');

    const { matchId } = request.data;
    guard(typeof matchId === 'string' && matchId.length > 0, 'invalid-argument', 'matchId requerido');

    const db        = getFirestore();
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    guard(matchSnap.exists, 'not-found', 'Partida no encontrada');

    const match = matchSnap.data()!;
    guard(
      (match['playerIds'] as string[] | undefined)?.includes(uid!),
      'permission-denied',
      'No sos jugador de esta partida',
    );

    if (match['status'] !== 'finished') {
      return { ok: true, skipped: true, reason: 'Partida aún en curso' };
    }

    const updates: Promise<void>[] = [];
    const winnerUid: string | undefined = match['winner'];

    // Acreditar 'play' a todos los jugadores de la partida
    for (const pid of (match['playerIds'] as string[])) {
      updates.push(_updateMissionProgress(db, pid, 'play'));
    }
    // Acreditar 'win' al ganador
    if (winnerUid) {
      updates.push(_updateMissionProgress(db, winnerUid, 'win'));
    }
    const lastAction = match['lastAction'] as { type?: string; uid?: string } | null;
    if (lastAction?.type === 'declareCero' && lastAction?.uid) {
      updates.push(_updateMissionProgress(db, lastAction.uid, 'declare_cero'));
    }

    await Promise.all(updates);
    return { ok: true, skipped: false };
  },
);
