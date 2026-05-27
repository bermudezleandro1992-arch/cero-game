/**
 * Panel de operadores — gestión de usuarios y Cero Coins
 */
interface AdminGetUserRequest {
    uid?: string;
    email?: string;
}
export declare const adminGetUser: import("firebase-functions/v2/https").CallableFunction<AdminGetUserRequest, any>;
interface AdminSetCoinsRequest {
    uid: string;
    ceroCoins: number;
    reason?: string;
}
export declare const adminSetCeroCoins: import("firebase-functions/v2/https").CallableFunction<AdminSetCoinsRequest, any>;
interface AdminUpdateUserRequest {
    uid: string;
    displayName?: string;
    weeklyWins?: number;
}
export declare const adminUpdateUser: import("firebase-functions/v2/https").CallableFunction<AdminUpdateUserRequest, any>;
export declare const adminListTournaments: import("firebase-functions/v2/https").CallableFunction<{
    limit?: number;
}, any>;
export {};
