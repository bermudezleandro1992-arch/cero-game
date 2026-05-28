/**
 * Pase de temporada — tiers de XP con recompensas en CC.
 */
export declare function currentSeasonId(): string;
export interface SeasonTier {
    tier: number;
    xp: number;
    coins: number;
}
export declare const SEASON_TIERS: SeasonTier[];
export declare const getSeasonPassStatus: import("firebase-functions/v2/https").CallableFunction<Record<string, never>, any>;
export declare const claimSeasonTier: import("firebase-functions/v2/https").CallableFunction<{
    tier: number;
}, any>;
