/**
 * Configuración global editable desde el panel admin (Firestore config/app).
 */
import type { Firestore } from 'firebase-admin/firestore';
export interface AppConfigDoc {
    roomStakes: number[];
    stakeMin: number;
    stakeMax: number;
    waitingRoomMinutes: number;
    chaoticModeEnabled: boolean;
    freeRoomsEnabled: boolean;
}
export declare const DEFAULT_APP_CONFIG: AppConfigDoc;
export declare function getAppConfig(db?: Firestore): Promise<AppConfigDoc>;
export declare function invalidateAppConfigCache(): void;
export declare function getWaitingRoomMs(db?: Firestore): Promise<number>;
export declare function validateStakeAmount(stakeCC: number, cfg: AppConfigDoc): number;
export declare const adminGetAppConfig: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    config: AppConfigDoc;
}>>;
export declare const adminSetAppConfig: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
    config: AppConfigDoc;
}>>;
/** Payload público para el cliente (lobby, tienda, flags). */
export declare function publicConfigPayload(cfg: AppConfigDoc): {
    roomStakes: number[];
    stakeMin: number;
    stakeMax: number;
    waitingRoomMinutes: number;
    chaoticModeEnabled: boolean;
    freeRoomsEnabled: boolean;
};
