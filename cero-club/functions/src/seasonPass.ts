/**
 * Pase de temporada — tiers de XP con recompensas en CC.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';

const REGION = 'us-central1';

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

export function currentSeasonId(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface SeasonTier {
  tier:  number;
  xp:    number;
  coins: number;
}

export const SEASON_TIERS: SeasonTier[] = [
  { tier: 1, xp: 100,  coins: 30  },
  { tier: 2, xp: 250,  coins: 50  },
  { tier: 3, xp: 450,  coins: 75  },
  { tier: 4, xp: 700,  coins: 100 },
  { tier: 5, xp: 1000, coins: 150 },
  { tier: 6, xp: 1400, coins: 200 },
  { tier: 7, xp: 1900, coins: 250 },
  { tier: 8, xp: 2500, coins: 300 },
];

export const getSeasonPassStatus = onCall<Record<string, never>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth!.uid;
    const db      = getFirestore();
    const snap    = await db.doc(`users/${uid}`).get();
    const data    = snap.data() ?? {};
    const xp      = (data['xp'] as number | undefined) ?? 0;
    const season  = currentSeasonId();
    const claimed = (data['seasonClaimedTiers'] as number[] | undefined) ?? [];
    const userSeason = (data['seasonId'] as string | undefined) ?? season;

    const tiers = SEASON_TIERS.map(t => ({
      ...t,
      unlocked: xp >= t.xp,
      claimed:  userSeason === season && claimed.includes(t.tier),
    }));

    const nextTier = SEASON_TIERS.find(t => xp < t.xp) ?? null;

    return {
      seasonId: season,
      xp,
      level:    SEASON_TIERS.filter(t => xp >= t.xp).length,
      nextTier: nextTier ? { tier: nextTier.tier, xpNeeded: nextTier.xp - xp } : null,
      tiers,
    };
  },
);

export const claimSeasonTier = onCall<{ tier: number }>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid  = request.auth!.uid;
    const tier = request.data?.tier;
    guard(typeof tier === 'number' && tier >= 1, 'invalid-argument', 'tier inválido');

    const def = SEASON_TIERS.find(t => t.tier === tier);
    guard(def, 'not-found', 'Tier no encontrado');

    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    const season  = currentSeasonId();
    let coins = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      guard(snap.exists, 'not-found', 'Perfil no encontrado');

      const data     = snap.data()!;
      const xp       = (data['xp'] as number | undefined) ?? 0;
      let claimed    = (data['seasonClaimedTiers'] as number[] | undefined) ?? [];
      const userSeason = (data['seasonId'] as string | undefined) ?? season;

      if (userSeason !== season) {
        claimed = [];
      }

      guard(xp >= def!.xp, 'failed-precondition', `Necesitás ${def!.xp} XP (tenés ${xp})`);
      guard(!claimed.includes(tier), 'already-exists', 'Ya reclamaste este tier');

      coins = def!.coins;
      tx.update(userRef, {
        seasonId:           season,
        seasonClaimedTiers: [...claimed, tier],
        ceroCoins:          FieldValue.increment(coins),
      });
    });

    await db.collection('coin_ledger').add({
      uid,
      amount:    coins,
      type:      'season_pass',
      tier,
      seasonId:  season,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, coins, tier };
  },
);
