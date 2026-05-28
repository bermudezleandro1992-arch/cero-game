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
type MissionType = 'daily' | 'weekly' | 'permanent';
type MissionAction = 'win' | 'play' | 'declare_cero' | 'play_wild';
export interface MissionDef {
    id: string;
    title: string;
    description: string;
    type: MissionType;
    requirement: {
        action: MissionAction;
        count: number;
    };
    reward: {
        coins: number;
        xp?: number;
    };
    active: boolean;
    order: number;
}
export declare const MISSION_CATALOG: MissionDef[];
/**
 * Incrementa el progreso de las misiones activas que coincidan con `action`.
 * Crea el doc de progreso si no existe.
 * Llama `FieldValue.increment` dentro de un batch para eficiencia.
 */
/** Expuesto para game.ts — registrar acciones en tiempo real (comodín, CERO, etc.) */
export declare function trackMissionAction(db: FirebaseFirestore.Firestore, uid: string, action: MissionAction): Promise<void>;
interface ClaimRequest {
    missionId: string;
}
interface ClaimResponse {
    ok: true;
    coins: number;
    xp: number;
}
export declare const claimMissionReward: import("firebase-functions/v2/https").CallableFunction<ClaimRequest, Promise<ClaimResponse>>;
/**
 * Se dispara cuando un documento `matches/{matchId}` pasa a status='finished'.
 * Actualiza el progreso de misiones para el ganador (acción: 'win') y ambos
 * jugadores (acción: 'play').
 *
 * También cuenta declaraciones de CERO y comodines desde lastAction.
 */
export declare const onMatchFinished: import("firebase-functions/v2/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    matchId: string;
}>>;
/**
 * Resetea el progreso de misiones diarias que ya vencieron.
 * Nota: el reset también ocurre lazily en _updateMissionProgress, pero
 * este scheduled job garantiza consistencia aunque el usuario no juegue.
 */
export declare const resetDailyMissions: import("firebase-functions/v2/scheduler").ScheduleFunction;
export declare const resetWeeklyMissions: import("firebase-functions/v2/scheduler").ScheduleFunction;
export declare function seedMissionsToFirestore(db: FirebaseFirestore.Firestore): Promise<number>;
export declare const seedMissions: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
export declare const checkMissions: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, any>;
export {};
