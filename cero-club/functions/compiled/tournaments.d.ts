/**
 * Torneos semanales CERO — inscripción, bracket 8 jugadores, premio en CN
 */
export declare function seedBracket(tournamentId: string): Promise<void>;
export declare function onTournamentMatchFinished(matchId: string, winnerUid: string | null): Promise<void>;
export declare const registerTournament: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
    alreadyRegistered: boolean;
    tournamentId: string;
    participants?: never;
} | {
    ok: boolean;
    tournamentId: string;
    participants: number;
    alreadyRegistered?: never;
}>>;
export declare const cancelTournamentRegistration: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
}>>;
export declare const getWeeklyTournament: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    tournamentId: string;
    weekKey: string;
    status: any;
    entryFee: any;
    prizePool: any;
    participants: string[];
    participantCount: number;
    bracketSize: number;
    bracket: any;
    currentRound: any;
    championUid: any;
    names: Record<string, string>;
}>>;
export declare const adminSeedWeeklyTournament: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    ok: boolean;
    tournamentId: string;
    weekKey: string;
}>>;
export declare const seedWeeklyTournament: import("firebase-functions/v2/scheduler").ScheduleFunction;
