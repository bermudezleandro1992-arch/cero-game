/**
 * Configuración global editable desde el panel admin (Firestore config/app).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

const REGION   = 'us-central1';
const DOC_PATH = 'config/app';

export interface AppConfigDoc {
  roomStakes:           number[];
  stakeMin:             number;
  stakeMax:             number;
  waitingRoomMinutes:   number;
  chaoticModeEnabled:   boolean;
  freeRoomsEnabled:     boolean;
}

export const DEFAULT_APP_CONFIG: AppConfigDoc = {
  roomStakes:         [0, 30, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000],
  stakeMin:           30,
  stakeMax:           20_000,
  waitingRoomMinutes: 5,
  chaoticModeEnabled: false,
  freeRoomsEnabled:   true,
};

let cached: { cfg: AppConfigDoc; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

function normalizeConfig(raw: Record<string, unknown> | undefined): AppConfigDoc {
  const base = { ...DEFAULT_APP_CONFIG };
  if (!raw) return base;

  if (Array.isArray(raw.roomStakes)) {
    base.roomStakes = raw.roomStakes
      .map(v => Math.round(Number(v)))
      .filter(v => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);
    if (!base.roomStakes.length) base.roomStakes = [...DEFAULT_APP_CONFIG.roomStakes];
  }
  if (typeof raw.stakeMin === 'number') base.stakeMin = Math.max(0, Math.round(raw.stakeMin));
  if (typeof raw.stakeMax === 'number') base.stakeMax = Math.max(base.stakeMin, Math.round(raw.stakeMax));
  if (typeof raw.waitingRoomMinutes === 'number') {
    base.waitingRoomMinutes = Math.min(60, Math.max(1, Math.round(raw.waitingRoomMinutes)));
  }
  if (typeof raw.chaoticModeEnabled === 'boolean') base.chaoticModeEnabled = raw.chaoticModeEnabled;
  if (typeof raw.freeRoomsEnabled === 'boolean') base.freeRoomsEnabled = raw.freeRoomsEnabled;

  return base;
}

export async function getAppConfig(db: Firestore = getFirestore()): Promise<AppConfigDoc> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.cfg;
  try {
    const snap = await db.doc(DOC_PATH).get();
    const cfg  = normalizeConfig(snap.exists ? snap.data() as Record<string, unknown> : undefined);
    cached = { cfg, at: Date.now() };
    return cfg;
  } catch {
    return { ...DEFAULT_APP_CONFIG };
  }
}

export function invalidateAppConfigCache(): void {
  cached = null;
}

export async function getWaitingRoomMs(db: Firestore = getFirestore()): Promise<number> {
  const cfg = await getAppConfig(db);
  return Math.max(60_000, cfg.waitingRoomMinutes * 60 * 1000);
}

export function validateStakeAmount(stakeCC: number, cfg: AppConfigDoc): number {
  const rounded = Math.round(stakeCC);
  if (rounded <= 0) return 0;
  if (rounded < cfg.stakeMin || rounded > cfg.stakeMax) {
    throw new HttpsError(
      'invalid-argument',
      `Apuesta inválida. Elegí entre ${cfg.stakeMin} y ${cfg.stakeMax} CeroCoins.`,
    );
  }
  return rounded;
}

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

async function assertAdmin(uid: string): Promise<void> {
  const db   = getFirestore();
  const snap = await db.doc(`admins/${uid}`).get();
  guard(snap.exists, 'permission-denied', 'Solo operadores pueden usar el panel admin');
}

export const adminGetAppConfig = onCall(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);
    const cfg = await getAppConfig();
    return { config: cfg };
  },
);

export const adminSetAppConfig = onCall(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');
    await assertAdmin(request.auth!.uid);

    const data = (request.data ?? {}) as Partial<AppConfigDoc>;
    const cfg  = normalizeConfig(data as Record<string, unknown>);

    guard(cfg.stakeMin <= cfg.stakeMax, 'invalid-argument', 'Mínimo no puede superar al máximo');
    guard(cfg.roomStakes.every(s => s === 0 || (s >= cfg.stakeMin && s <= cfg.stakeMax)),
      'invalid-argument', 'Todas las apuestas deben estar dentro del rango min/max');

    const db = getFirestore();
    await db.doc(DOC_PATH).set({
      ...cfg,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth!.uid,
    }, { merge: true });

    invalidateAppConfigCache();
    return { ok: true, config: cfg };
  },
);

/** Payload público para el cliente (lobby, tienda, flags). */
export function publicConfigPayload(cfg: AppConfigDoc) {
  return {
    roomStakes:           cfg.roomStakes,
    stakeMin:             cfg.stakeMin,
    stakeMax:             cfg.stakeMax,
    waitingRoomMinutes:   cfg.waitingRoomMinutes,
    chaoticModeEnabled:   cfg.chaoticModeEnabled,
    freeRoomsEnabled:     cfg.freeRoomsEnabled,
  };
}
