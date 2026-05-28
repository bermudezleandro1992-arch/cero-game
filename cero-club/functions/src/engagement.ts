/**
 * functions/src/engagement.ts
 *
 * Loops de engagement de CERO:
 *
 *   initUserProfile        — callable: crea perfil con 100 CC de bienvenida
 *   claimDailyBonus        — callable: reclamar 10 CC (una vez cada 24 h)
 *   resetWeeklyRanking     — scheduler: lunes 00:00 UTC, premia top 10 y resetea
 *   purchaseCosmetic       — callable: comprar skin/marco con Coins
 *
 * Regla de oro: ningún saldo se modifica desde el cliente — solo Cloud Functions.
 */

import { onCall, HttpsError }             from 'firebase-functions/v2/https';
import { onSchedule }                     from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue }       from 'firebase-admin/firestore';
import type { Transaction }               from 'firebase-admin/firestore';
import * as crypto                        from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const REGION              = 'us-central1';
const WELCOME_COINS       = 100;
const DAILY_BONUS_COINS   = 10;
const DAILY_COOLDOWN_MS   = 24 * 60 * 60 * 1000;    // 24 h en ms

function referralCodeForUid(uid: string): string {
  return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 8).toUpperCase();
}

const WEEKLY_PRIZES: Record<number, number> = {  // posición → CC (top 3 destacados)
  1:  1_000,
  2:  600,
  3:  400,
  4:  75,
  5:  75,
  6:  50,
  7:  50,
  8:  50,
  9:  50,
  10: 50,
};

const MONTHLY_TOP3_PRIZES: Record<number, number> = {
  1: 5_000,
  2: 3_000,
  3: 1_500,
};

type ErrCode =
  | 'ok' | 'cancelled' | 'unknown' | 'invalid-argument' | 'deadline-exceeded'
  | 'not-found' | 'already-exists' | 'permission-denied' | 'resource-exhausted'
  | 'failed-precondition' | 'aborted' | 'out-of-range' | 'unimplemented'
  | 'internal' | 'unavailable' | 'data-loss' | 'unauthenticated';

function guard(cond: unknown, code: ErrCode, msg: string): asserts cond {
  if (!cond) throw new HttpsError(code, msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de cosméticos (SOLO el servidor define precios)
// ─────────────────────────────────────────────────────────────────────────────

type CosmeticCategory = 'card_skin' | 'avatar_frame' | 'table_bg' | 'room_bg' | 'deck_back';

const EQUIP_FIELD: Record<CosmeticCategory, string> = {
  card_skin:    'equippedSkin',
  avatar_frame: 'equippedFrame',
  table_bg:     'equippedTableBg',
  room_bg:      'equippedRoomBg',
  deck_back:    'equippedDeckBack',
};

export const COSMETIC_CATALOG: Record<string, {
  id:       string;
  name:     string;
  category: CosmeticCategory;
  price:    number;           // CC
  preview:  string;           // asset key o URL relativa
}> = {
  skin_neon:      { id: 'skin_neon',      name: 'Neón Oscuro',    category: 'card_skin',    price: 200,  preview: 'skins/neon'      },
  skin_gold:      { id: 'skin_gold',      name: 'Dorado Real',    category: 'card_skin',    price: 350,  preview: 'skins/gold'      },
  skin_galaxy:    { id: 'skin_galaxy',    name: 'Galaxia',        category: 'card_skin',    price: 500,  preview: 'skins/galaxy'    },
  skin_minimal:   { id: 'skin_minimal',   name: 'Minimalista',    category: 'card_skin',    price: 150,  preview: 'skins/minimal'   },
  frame_fire:     { id: 'frame_fire',     name: 'Marco de Fuego', category: 'avatar_frame', price: 200,  preview: 'frames/fire'     },
  frame_ice:      { id: 'frame_ice',      name: 'Marco de Hielo', category: 'avatar_frame', price: 200,  preview: 'frames/ice'      },
  frame_gold:     { id: 'frame_gold',     name: 'Marco Dorado',   category: 'avatar_frame', price: 400,  preview: 'frames/gold'     },
  frame_champion: { id: 'frame_champion', name: 'Campeón',        category: 'avatar_frame', price: 750,  preview: 'frames/champ'    },
  table_neon:     { id: 'table_neon',     name: 'Mesa Neón',      category: 'table_bg',     price: 300,  preview: 'tables/neon'     },
  table_marble:   { id: 'table_marble',   name: 'Mesa Mármol',    category: 'table_bg',     price: 450,  preview: 'tables/marble'   },
  table_carbon:   { id: 'table_carbon',   name: 'Mesa Carbon',    category: 'table_bg',     price: 550,  preview: 'tables/carbon'   },
  bg_stadium:     { id: 'bg_stadium',     name: 'Estadio',        category: 'room_bg',      price: 400,  preview: 'rooms/stadium'   },
  bg_beach:       { id: 'bg_beach',       name: 'Playa',          category: 'room_bg',      price: 350,  preview: 'rooms/beach'     },
  bg_city:        { id: 'bg_city',        name: 'Ciudad Noche',   category: 'room_bg',      price: 400,  preview: 'rooms/city'      },
  bg_football:    { id: 'bg_football',    name: 'Cancha Fútbol',  category: 'room_bg',      price: 500,  preview: 'rooms/football'  },
  deck_classic:   { id: 'deck_classic',   name: 'Mazo Clásico',   category: 'deck_back',    price: 150,  preview: 'decks/classic'   },
  deck_gold:      { id: 'deck_gold',      name: 'Mazo Dorado',    category: 'deck_back',    price: 350,  preview: 'decks/gold'      },
  deck_cyber:     { id: 'deck_cyber',     name: 'Mazo Cyber',     category: 'deck_back',    price: 450,  preview: 'decks/cyber'     },
  deck_holo:      { id: 'deck_holo',      name: 'Mazo Holográfico', category: 'deck_back',  price: 520,  preview: 'decks/cyber'     },
  table_felt:       { id: 'table_felt',     name: 'Mesa Casino',    category: 'table_bg',     price: 380,  preview: 'tables/neon'     },
  table_galaxy:     { id: 'table_galaxy',   name: 'Mesa Galaxia',   category: 'table_bg',     price: 620,  preview: 'tables/neon'     },
  table_royal:      { id: 'table_royal',    name: 'Mesa Real',      category: 'table_bg',     price: 800,  preview: 'tables/marble'   },
  bg_casino:        { id: 'bg_casino',      name: 'Casino VIP',     category: 'room_bg',      price: 550,  preview: 'rooms/stadium'   },
  bg_neon:          { id: 'bg_neon',        name: 'Neón Cyber',     category: 'room_bg',      price: 480,  preview: 'rooms/city'      },
  bg_arena:         { id: 'bg_arena',       name: 'Arena Pro',      category: 'room_bg',      price: 650,  preview: 'rooms/football'  },
  skin_carbon:      { id: 'skin_carbon',    name: 'Cartas Carbon',  category: 'card_skin',    price: 280,  preview: 'skins/minimal'   },
  skin_rainbow:     { id: 'skin_rainbow',   name: 'Cartas Arcoíris', category: 'card_skin',   price: 420,  preview: 'skins/galaxy'    },
  frame_diamond:    { id: 'frame_diamond',  name: 'Marco Diamante', category: 'avatar_frame', price: 900,  preview: 'frames/gold'     },
  frame_legend:     { id: 'frame_legend',   name: 'Marco Leyenda',  category: 'avatar_frame', price: 1200, preview: 'frames/champ'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// initUserProfile — crea perfil en Firestore con 100 CC de bienvenida
// ─────────────────────────────────────────────────────────────────────────────

interface InitProfileResponse {
  created:   boolean;   // true = perfil nuevo, false = ya existía
  ceroCoins: number;
}

/**
 * Idempotente: si el perfil ya existe, devuelve los datos actuales.
 * El cliente debe llamarla una vez al hacer login.
 */
export const initUserProfile = onCall<Record<string, never>, Promise<InitProfileResponse>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth!.uid;
    const name    = request.auth!.token.name  ?? 'Jugador';
    const email   = request.auth!.token.email ?? '';
    const isGuest = (
      (request.auth!.token['firebase'] as { sign_in_provider?: string } | undefined)
        ?.sign_in_provider === 'anonymous'
    );
    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    let created   = false;
    let ceroCoins = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);

      if (snap.exists) {
        ceroCoins = (snap.data()?.['ceroCoins'] as number | undefined) ?? 0;
        if (!snap.data()?.['referralCode']) {
          tx.update(userRef, { referralCode: referralCodeForUid(uid) });
        }
        return;   // perfil ya existe, no tocar saldo
      }

      // Primer login: crear perfil con bonus de bienvenida (invitados sin bonus)
      created   = true;
      ceroCoins = isGuest ? 0 : WELCOME_COINS;

      const referralCode = referralCodeForUid(uid);

      tx.set(userRef, {
        displayName:       name,
        email,
        ceroCoins:         isGuest ? 0 : WELCOME_COINS,
        isGuest,
        anon:              isGuest,
        freeGamesPlayed:   0,
        totalGamesPlayed:  0,
        wins:              0,
        weeklyWins:        0,     // ranking semanal
        monthlyWins:       0,     // ranking mensual
        rankScore:         0,     // puntos de ranking (wins × 10 − losses × 2)
        lastDailyClaim:    null,
        ownedCosmetics:    [] as string[],
        equippedSkin:      null as string | null,
        equippedFrame:     null as string | null,
        equippedTableBg:   null as string | null,
        equippedRoomBg:    null as string | null,
        equippedDeckBack:  null as string | null,
        countryCode:       null as string | null,
        photoURL:          null as string | null,
        referralCode,
        referredBy:        null as string | null,
        referralCount:     0,
        referralBonusClaimed: false,
        xp:                0,
        seasonId:          null as string | null,
        seasonClaimedTiers: [] as number[],
        fcmTokens:         [] as string[],
        pushEnabled:       false,
        createdAt:         FieldValue.serverTimestamp(),
      });
    });

    // Registrar el bonus en el ledger
    if (created) {
      await db.collection('coin_ledger').add({
        uid,
        amount:    WELCOME_COINS,
        type:      'welcome_bonus',
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { created, ceroCoins };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// claimDailyBonus — reclamar 10 CC, una vez cada 24 horas
// ─────────────────────────────────────────────────────────────────────────────

interface DailyBonusResponse {
  ok:           true;
  coinsAwarded: number;
  nextClaimAt:  number;   // epoch ms
  newBalance:   number;
}

export const claimDailyBonus = onCall<Record<string, never>, Promise<DailyBonusResponse>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid     = request.auth!.uid;
    const now     = Date.now();
    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    let newBalance = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      guard(snap.exists, 'not-found', 'Perfil no encontrado. Iniciá sesión primero.');

      const data          = snap.data()!;
      const lastClaimTs   = (data['lastDailyClaim'] as FirebaseFirestore.Timestamp | null)
                              ?.toMillis() ?? 0;
      const msSinceClaim  = now - lastClaimTs;

      guard(
        msSinceClaim >= DAILY_COOLDOWN_MS,
        'resource-exhausted',
        `Ya reclamaste hoy. Próximo reclamo en ${Math.ceil((DAILY_COOLDOWN_MS - msSinceClaim) / 60_000)} min.`,
      );

      const currentCoins = (data['ceroCoins'] as number | undefined) ?? 0;
      newBalance = currentCoins + DAILY_BONUS_COINS;

      tx.update(userRef, {
        ceroCoins:      FieldValue.increment(DAILY_BONUS_COINS),
        lastDailyClaim: FieldValue.serverTimestamp(),
      });
    });

    await db.collection('coin_ledger').add({
      uid,
      amount:    DAILY_BONUS_COINS,
      type:      'daily_bonus',
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ok:           true,
      coinsAwarded: DAILY_BONUS_COINS,
      nextClaimAt:  now + DAILY_COOLDOWN_MS,
      newBalance,
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// resetWeeklyRanking — lunes 00:00 UTC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Toma un snapshot del ranking semanal actual (top 100 por weeklyWins).
 * 2. Lo guarda en ranking/{YYYY-Www} para historiales.
 * 3. Premia a los top 10 con Coins.
 * 4. Resetea weeklyWins y rankScore a 0 para todos.
 */
export const resetWeeklyRanking = onSchedule(
  { schedule: '0 0 * * 1', region: REGION, timeoutSeconds: 540 },
  async () => {
    const db  = getFirestore();
    const now = new Date();

    // ISO week key, e.g. "2026-W22"
    const startOfYear   = new Date(now.getUTCFullYear(), 0, 1);
    const weekNum       = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getUTCDay() + 1) / 7,
    );
    // The snapshot is for the week that JUST ended (previous week)
    const prevWeekNum   = weekNum === 1 ? 52 : weekNum - 1;
    const year          = weekNum === 1 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    const weekKey       = `${year}-W${String(prevWeekNum).padStart(2, '0')}`;

    // ── Top 100 por weeklyWins ────────────────────────────────────────────
    const topSnap = await db.collection('users')
      .orderBy('weeklyWins', 'desc')
      .limit(100)
      .get();

    const entries = topSnap.docs.map((d, i) => ({
      uid:        d.id,
      name:       (d.data()['displayName'] as string | undefined) ?? 'Jugador',
      weeklyWins: (d.data()['weeklyWins']  as number | undefined) ?? 0,
      position:   i + 1,
    }));

    // Guardar snapshot histórico
    await db.doc(`ranking/${weekKey}`).set({
      weekKey,
      generatedAt: FieldValue.serverTimestamp(),
      entries,
    });

    // ── Premiar top 10 ────────────────────────────────────────────────────
    const batch = db.batch();

    for (const entry of entries.slice(0, 10)) {
      const prize = WEEKLY_PRIZES[entry.position] ?? 0;
      if (prize <= 0 || entry.weeklyWins === 0) continue;

      batch.update(db.doc(`users/${entry.uid}`), {
        ceroCoins: FieldValue.increment(prize),
      });

      // Notificación en la subcollection del usuario
      batch.set(
        db.collection(`users/${entry.uid}/notifications`).doc(),
        {
          type:      'weekly_prize',
          title:     `¡Top ${entry.position} semanal!`,
          body:      `Ganaste ${prize} CC por terminar en el puesto ${entry.position} esta semana.`,
          coins:     prize,
          weekKey,
          read:      false,
          createdAt: FieldValue.serverTimestamp(),
        },
      );
    }

    // ── Resetear contadores semanales para TODOS ──────────────────────────
    // Procesar en lotes de 450
    const BATCH_SIZE = 450;
    for (let i = 0; i < topSnap.docs.length; i += BATCH_SIZE) {
      const resetBatch = db.batch();
      for (const d of topSnap.docs.slice(i, i + BATCH_SIZE)) {
        resetBatch.update(d.ref, { weeklyWins: 0, rankScore: 0 });
      }
      await resetBatch.commit();
    }

    await batch.commit();

    console.info(`[resetWeeklyRanking] ${weekKey} procesado. Top: ${entries[0]?.name ?? 'nadie'}`);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// resetMonthlyRanking — día 1 de cada mes 00:05 UTC — premia top 3 del mes
// ─────────────────────────────────────────────────────────────────────────────

export const resetMonthlyRanking = onSchedule(
  { schedule: '5 0 1 * *', region: REGION, timeoutSeconds: 540 },
  async () => {
    const db  = getFirestore();
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getUTCMonth() === 0
      ? `${now.getUTCFullYear() - 1}-12`
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth()).padStart(2, '0')}`;

    const topSnap = await db.collection('users')
      .orderBy('monthlyWins', 'desc')
      .limit(50)
      .get();

    const entries = topSnap.docs.map((d, i) => ({
      uid:         d.id,
      name:        (d.data()['displayName'] as string | undefined) ?? 'Jugador',
      monthlyWins: (d.data()['monthlyWins'] as number | undefined) ?? 0,
      position:    i + 1,
    }));

    await db.doc(`ranking/${prevMonth}`).set({
      period:      'monthly',
      monthKey:    prevMonth,
      generatedAt: FieldValue.serverTimestamp(),
      entries:     entries.slice(0, 10),
    });

    const batch = db.batch();
    for (const entry of entries.slice(0, 3)) {
      const prize = MONTHLY_TOP3_PRIZES[entry.position] ?? 0;
      if (prize <= 0 || entry.monthlyWins === 0) continue;

      batch.update(db.doc(`users/${entry.uid}`), {
        ceroCoins: FieldValue.increment(prize),
      });
      batch.set(
        db.collection(`users/${entry.uid}/notifications`).doc(),
        {
          type:      'monthly_prize',
          title:     `Top ${entry.position} del mes`,
          body:      `Ganaste ${prize} CN por el puesto ${entry.position} en ${prevMonth}.`,
          coins:     prize,
          monthKey:  prevMonth,
          read:      false,
          createdAt: FieldValue.serverTimestamp(),
        },
      );
    }
    await batch.commit();

    for (let i = 0; i < topSnap.docs.length; i += 450) {
      const resetBatch = db.batch();
      for (const d of topSnap.docs.slice(i, i + 450)) {
        resetBatch.update(d.ref, { monthlyWins: 0 });
      }
      await resetBatch.commit();
    }

    console.info(`[resetMonthlyRanking] ${prevMonth} — campeón: ${entries[0]?.name ?? 'nadie'}`);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// purchaseCosmetic — comprar skin/marco con Coins
// ─────────────────────────────────────────────────────────────────────────────

interface PurchaseCosmeticRequest { cosmeticId: string }
interface PurchaseCosmeticResponse {
  ok:         true;
  cosmeticId: string;
  newBalance: number;
}

export const purchaseCosmetic = onCall<PurchaseCosmeticRequest, Promise<PurchaseCosmeticResponse>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid        = request.auth!.uid;
    const cosmeticId = request.data.cosmeticId;
    guard(typeof cosmeticId === 'string' && cosmeticId, 'invalid-argument', 'Falta cosmeticId');

    const cosmetic = COSMETIC_CATALOG[cosmeticId];
    guard(cosmetic, 'not-found', `Cosmético "${cosmeticId}" no existe`);

    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);
    let newBalance = 0;

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      guard(snap.exists, 'not-found', 'Perfil no encontrado');

      const data    = snap.data()!;
      const balance = (data['ceroCoins'] as number | undefined) ?? 0;
      const owned   = (data['ownedCosmetics'] as string[] | undefined) ?? [];

      guard(!owned.includes(cosmeticId), 'already-exists', `Ya tenés "${cosmetic.name}"`);
      guard(balance >= cosmetic.price,   'resource-exhausted',
        `Saldo insuficiente. Necesitás ${cosmetic.price} CC, tenés ${balance}.`);

      newBalance = balance - cosmetic.price;

      tx.update(userRef, {
        ceroCoins:       FieldValue.increment(-cosmetic.price),
        ownedCosmetics:  FieldValue.arrayUnion(cosmeticId),
      });
    });

    await db.collection('coin_ledger').add({
      uid,
      amount:    -cosmetic.price,
      type:      'cosmetic_purchase',
      cosmeticId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, cosmeticId, newBalance };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// equipCosmetic — equipar una skin/marco ya comprado
// ─────────────────────────────────────────────────────────────────────────────

interface EquipCosmeticRequest { cosmeticId: string | null }

export const equipCosmetic = onCall<EquipCosmeticRequest>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid        = request.auth!.uid;
    const cosmeticId = request.data.cosmeticId;   // null = desequipar

    const db      = getFirestore();
    const userRef = db.doc(`users/${uid}`);

    if (cosmeticId !== null) {
      const cosmetic = COSMETIC_CATALOG[cosmeticId];
      guard(cosmetic, 'not-found', `Cosmético "${cosmeticId}" no existe`);

      const snap  = await userRef.get();
      const owned = (snap.data()?.['ownedCosmetics'] as string[] | undefined) ?? [];
      guard(owned.includes(cosmeticId), 'permission-denied', 'No tenés este cosmético');

      const field = EQUIP_FIELD[cosmetic.category];
      await userRef.update({ [field]: cosmeticId });
    } else {
      await userRef.update({
        equippedSkin:     null,
        equippedFrame:    null,
        equippedTableBg:  null,
        equippedRoomBg:   null,
        equippedDeckBack: null,
      });
    }

    return { ok: true };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// claimDailyReward — alias del nombre solicitado (mismo comportamiento que
// claimDailyBonus: 10 CC una vez cada 24 h)
// ─────────────────────────────────────────────────────────────────────────────

export const claimDailyReward = onCall<Record<string, never>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Tenés que iniciar sesión');

    const uid = request.auth!.uid;
    const db  = getFirestore();
    const ref = db.doc(`users/${uid}`);

    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      guard(snap.exists, 'not-found', 'Perfil no encontrado — llamá a initUserProfile primero');

      const data         = snap.data()!;
      const lastClaim    = (data['lastDailyClaim'] as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
      const now          = Date.now();
      const elapsed      = now - lastClaim;

      if (elapsed < DAILY_COOLDOWN_MS) {
        const remaining = Math.ceil((DAILY_COOLDOWN_MS - elapsed) / 1000 / 60);
        throw new HttpsError('failed-precondition', `Ya reclamaste hoy. Próximo bonus en ${remaining} min.`);
      }

      tx.update(ref, {
        ceroCoins:      FieldValue.increment(DAILY_BONUS_COINS),
        lastDailyClaim: FieldValue.serverTimestamp(),
      });

      return { ok: true, coinsAwarded: DAILY_BONUS_COINS };
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// updateRanking — callable: (re)genera el snapshot del ranking semanal y lo
// guarda en ranking/current.  Cualquier usuario autenticado puede invocarlo;
// el resultado real viene del campo weeklyWins de cada usuario.
// ─────────────────────────────────────────────────────────────────────────────

export const updateRanking = onCall<Record<string, never>>(
  { region: REGION },
  async (request) => {
    guard(request.auth?.uid, 'unauthenticated', 'Iniciá sesión');

    const db   = getFirestore();
    const snap = await db
      .collection('users')
      .where('anon', '==', false)
      .orderBy('weeklyWins', 'desc')
      .limit(10)
      .get();

    const entries = snap.docs.map((d, i) => ({
      rank:       i + 1,
      uid:        d.id,
      name:       (d.data()['displayName'] as string | undefined) ?? 'Jugador',
      weeklyWins: (d.data()['weeklyWins'] as number | undefined) ?? 0,
      rankScore:  (d.data()['rankScore']  as number | undefined) ?? 0,
    }));

    await db.doc('ranking/current').set(
      { entries, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return { ok: true, entries };
  },
);
