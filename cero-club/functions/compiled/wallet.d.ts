/**
 * functions/src/wallet.ts
 *
 * Billetera Cero Coins:
 *   · transferCeroCoins   — transferencias P2P con límites anti-spam
 *   · getWalletHistory    — historial de movimientos (coin_ledger)
 *   · applyReferralCode   — bonus por referido (nuevos usuarios)
 *   · placeMatchBet       — apuesta de espectador (escrow server-side)
 *   · settleMatchBets     — liquidación al terminar partida (parimutuel)
 *   · joinAsSpectator     — registrar presencia de espectador
 *   · getMatchBettingInfo — estado de apuestas para UI
 */
declare const MIN_TRANSFER = 10;
declare const MAX_TRANSFER = 5000;
declare const MIN_BET = 5;
declare const MAX_BET = 500;
declare const BETTING_WINDOW_MS: number;
interface TransferRequest {
    toUid: string;
    amount: number;
    note?: string;
}
export declare const transferCeroCoins: import("firebase-functions/v2/https").CallableFunction<TransferRequest, any>;
interface HistoryRequest {
    limit?: number;
}
export declare const getWalletHistory: import("firebase-functions/v2/https").CallableFunction<HistoryRequest, any>;
interface ReferralRequest {
    code: string;
}
export declare const applyReferralCode: import("firebase-functions/v2/https").CallableFunction<ReferralRequest, any>;
interface PlaceBetRequest {
    matchId: string;
    predictedWinnerUid: string;
    amount: number;
}
export declare const placeMatchBet: import("firebase-functions/v2/https").CallableFunction<PlaceBetRequest, any>;
export declare const getMatchBettingInfo: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, any>;
/**
 * Liquida apuestas al terminar una partida (parimutuel, suma cero entre apostadores).
 * Llamado desde game.ts — nunca desde el cliente.
 */
export declare function settleMatchBets(db: FirebaseFirestore.Firestore, matchId: string, winnerUid: string): Promise<void>;
export declare const joinAsSpectator: import("firebase-functions/v2/https").CallableFunction<{
    matchId: string;
}, any>;
/** Timestamp de cierre de apuestas — llamado desde startMatch en game.ts */
export declare function bettingOpenUntilTimestamp(): FirebaseFirestore.Timestamp;
export { BETTING_WINDOW_MS, MIN_BET, MAX_BET, MIN_TRANSFER, MAX_TRANSFER };
