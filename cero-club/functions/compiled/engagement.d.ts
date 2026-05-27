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
type CosmeticCategory = 'card_skin' | 'avatar_frame' | 'table_bg' | 'room_bg' | 'deck_back';
export declare const COSMETIC_CATALOG: Record<string, {
    id: string;
    name: string;
    category: CosmeticCategory;
    price: number;
    preview: string;
}>;
interface InitProfileResponse {
    created: boolean;
    ceroCoins: number;
}
/**
 * Idempotente: si el perfil ya existe, devuelve los datos actuales.
 * El cliente debe llamarla una vez al hacer login.
 */
export declare const initUserProfile: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, Promise<InitProfileResponse>>;
interface DailyBonusResponse {
    ok: true;
    coinsAwarded: number;
    nextClaimAt: number;
    newBalance: number;
}
export declare const claimDailyBonus: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, Promise<DailyBonusResponse>>;
/**
 * 1. Toma un snapshot del ranking semanal actual (top 100 por weeklyWins).
 * 2. Lo guarda en ranking/{YYYY-Www} para historiales.
 * 3. Premia a los top 10 con Coins.
 * 4. Resetea weeklyWins y rankScore a 0 para todos.
 */
export declare const resetWeeklyRanking: import("firebase-functions/v2/scheduler").ScheduleFunction;
export declare const resetMonthlyRanking: import("firebase-functions/v2/scheduler").ScheduleFunction;
interface PurchaseCosmeticRequest {
    cosmeticId: string;
}
interface PurchaseCosmeticResponse {
    ok: true;
    cosmeticId: string;
    newBalance: number;
}
export declare const purchaseCosmetic: import("firebase-functions/v2/https").CallableFunction<PurchaseCosmeticRequest, Promise<PurchaseCosmeticResponse>>;
interface EquipCosmeticRequest {
    cosmeticId: string | null;
}
export declare const equipCosmetic: import("firebase-functions/v2/https").CallableFunction<EquipCosmeticRequest, any>;
export declare const claimDailyReward: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
export declare const updateRanking: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
export {};
