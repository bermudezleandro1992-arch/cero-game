/**
 * Panel de operadores — gestión de usuarios y Cero Coins
 */
interface AdminGetUserRequest {
    uid?: string;
    email?: string;
    displayName?: string;
}
export declare const adminGetUser: import("firebase-functions/v2/https").CallableFunction<AdminGetUserRequest, any>;
interface AdminSearchUsersRequest {
    query?: string;
    limit?: number;
}
export declare const adminSearchUsers: import("firebase-functions/v2/https").CallableFunction<AdminSearchUsersRequest, any>;
interface AdminSetCoinsRequest {
    uid: string;
    ceroCoins: number;
    reason?: string;
}
export declare const adminSetCeroCoins: import("firebase-functions/v2/https").CallableFunction<AdminSetCoinsRequest, any>;
interface AdminAddCoinsRequest {
    uid: string;
    amount: number;
    reason?: string;
}
export declare const adminAddCeroCoins: import("firebase-functions/v2/https").CallableFunction<AdminAddCoinsRequest, any>;
interface AdminUpdateUserRequest {
    uid: string;
    displayName?: string;
    weeklyWins?: number;
    monthlyWins?: number;
    wins?: number;
    totalGamesPlayed?: number;
    xp?: number;
    countryCode?: string | null;
    vipActive?: boolean;
}
export declare const adminUpdateUser: import("firebase-functions/v2/https").CallableFunction<AdminUpdateUserRequest, any>;
export declare const adminListTournaments: import("firebase-functions/v2/https").CallableFunction<{
    limit?: number;
}, any>;
export declare const adminListWaitingMatches: import("firebase-functions/v2/https").CallableFunction<{
    limit?: number;
}, any>;
interface AdminCloseWaitingRequest {
    matchId: string;
    reason?: string;
}
export declare const adminCloseWaitingMatch: import("firebase-functions/v2/https").CallableFunction<AdminCloseWaitingRequest, any>;
interface AdminCleanupStaleRequest {
    minAgeMinutes?: number;
    limit?: number;
}
export declare const adminCleanupStaleRooms: import("firebase-functions/v2/https").CallableFunction<AdminCleanupStaleRequest, any>;
export {};
